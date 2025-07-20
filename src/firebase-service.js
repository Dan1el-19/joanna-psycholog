// Firebase service for appointment booking
import { 
  collection, 
  addDoc, 
  getDocs, 
  setDoc,
  doc, 
  updateDoc, 
  deleteDoc,
  query, 
  orderBy, 
  where, 
  limit as firestoreLimit,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { trace } from 'firebase/performance';
import { db, perf } from './firebase-config.js';

class FirebaseService {
  constructor() {
    this.appointmentsCollection = collection(db, 'appointments');
    this.temporaryBlocksCollection = collection(db, 'temporaryBlocks');
    this.blockDuration = 10 * 60 * 1000; // 10 minutes
    this.slotsCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.servicesCache = null;
    this.servicesCacheTimeout = 5 * 60 * 1000;
    this.servicesCacheTimestamp = 0;
  }

  // ##################################################################
  // # CORE LOGIC - The new brain of the scheduling system
  // ##################################################################

  /**
   * Calculates the full availability for a given day, including forward and backward blocking.
   * This is the new core function that determines what is truly available.
   * @param {string} date - The date in YYYY-MM-DD format.
   * @returns {Promise<Map<string, {status: string, appointmentId: string | null}>>} A map of time slots and their detailed status.
   */
  async calculateFullDayAvailability(date) {
    // 1. Fetch all necessary data upfront
    const [services, appointments, adminSlots] = await Promise.all([
      this.getServices(),
      this.getAppointmentsForDate(date),
      this.getAdminSlotsForDate(date)
    ]);

    const allPossibleSlots = this.generateAllTimeSlots();
    const daySchedule = new Map();

    // 2. Initialize the day's schedule with admin-defined working hours
    allPossibleSlots.forEach(time => {
      daySchedule.set(time, {
        status: adminSlots.includes(time) ? 'free' : 'unavailable',
        appointmentId: null
      });
    });

    // 3. Apply "Forward Blocking" for each existing appointment
    for (const app of appointments) {
      const startTime = app.confirmedTime || app.preferredTime;
      const duration = await this.getTherapyDuration(app.service);
      const endTime = this.addMinutesToTime(startTime, duration);

      // Mark all slots covered by the appointment duration as "booked"
      for (const [time, slot] of daySchedule.entries()) {
        if (time >= startTime && time < endTime) {
          slot.status = 'booked';
          slot.appointmentId = app.id;
        }
      }

      // Add "forward buffer" if the appointment ends exactly at the start of the next slot
      const lastBlockedSlot = this.findLastBlockedSlot(startTime, endTime);
      if (lastBlockedSlot && (endTime.endsWith(':00') || endTime.endsWith(':30'))) {
        const nextSlotTime = this.addMinutesToTime(lastBlockedSlot, 30);
        if (daySchedule.has(nextSlotTime) && daySchedule.get(nextSlotTime).status === 'free') {
          daySchedule.get(nextSlotTime).status = 'buffer_forward';
        }
      }
    }

    // 4. Apply "Backward Blocking" (pre-emptive buffering)
    const bookedStartTimes = appointments.map(app => app.confirmedTime || app.preferredTime).sort();
    
    const reversedSlots = [...allPossibleSlots].reverse();
    for (const time of reversedSlots) {
        const currentSlot = daySchedule.get(time);
        if (currentSlot.status !== 'free') continue;

        const nextAppointmentTime = bookedStartTimes.find(bookedTime => bookedTime > time);
        if (!nextAppointmentTime) continue;
        
        for (const service of services) {
            const serviceDuration = service.duration;
            const potentialEndTime = this.addMinutesToTime(time, serviceDuration);

            if (potentialEndTime === nextAppointmentTime) {
                currentSlot.status = 'buffer_backward';
                break;
            }
        }
    }

    return daySchedule;
  }

  /**
   * Gets available time slots for a specific date, using the new advanced logic.
   * @param {string} date - The date in YYYY-MM-DD format.
   * @param {string|null} excludeSessionId - The session ID to exclude from temporary blocks.
   * @returns {Promise<Array<object>>} A list of available slots with details.
   */
  async getAvailableTimeSlots(date, excludeSessionId = null) {
    const perfTrace = perf ? trace(perf, 'getAvailableTimeSlots_Advanced') : null;
    perfTrace?.start();
    try {
      const cacheKey = `advanced_${date}_${excludeSessionId || 'none'}`;
      const cached = this.slotsCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        perfTrace?.stop();
        return cached.slots;
      }

      // Fetch temporary blocks for other sessions
      const tempBlockedSlots = new Set();
      if (excludeSessionId) {
          try {
            const now = Timestamp.now();
            // ✅ FIX: Modified query to avoid needing a composite index
            const q = query(
              this.temporaryBlocksCollection,
              where('date', '==', date),
              where('expiresAt', '>', now)
            );
            const snapshot = await getDocs(q);
            // Filter by session ID in the code
            snapshot.docs.forEach(doc => {
                if(doc.data().sessionId !== excludeSessionId) {
                    tempBlockedSlots.add(doc.data().time)
                }
            });
          } catch (error) {
              console.warn("Could not check temporary blocks", error);
          }
      }

      const daySchedule = await this.calculateFullDayAvailability(date);
      const allServices = await this.getServices();
      const result = [];

      for (const [time, slotData] of daySchedule.entries()) {
          const isTempBlockedByOther = tempBlockedSlots.has(time);
          const isGenerallyAvailable = slotData.status === 'free' && !isTempBlockedByOther;
          
          const serviceAvailability = {};
          if (isGenerallyAvailable) {
              for (const service of allServices) {
                  const duration = service.duration;
                  const numSlotsNeeded = Math.ceil(duration / 30);
                  const slotsToCheck = this.getSlotsSlice(time, numSlotsNeeded);
                  
                  const canFit = slotsToCheck.every(t => {
                      const sData = daySchedule.get(t);
                      return sData && sData.status === 'free' && !tempBlockedSlots.has(t);
                  });
                  serviceAvailability[service.id] = canFit;
              }
          } else {
              allServices.forEach(service => serviceAvailability[service.id] = false);
          }

          result.push({
              date,
              time,
              isAvailable: isGenerallyAvailable,
              isBooked: slotData.status === 'booked',
              isBuffer: slotData.status.includes('buffer'),
              isTemporarilyBlocked: isTempBlockedByOther,
              serviceAvailability
          });
      }

      this.slotsCache.set(cacheKey, { slots: result, timestamp: Date.now() });
      perfTrace?.stop();
      return result;

    } catch (error) {
      console.error('Error getting available time slots with advanced logic:', error);
      perfTrace?.stop();
      return [];
    }
  }

  /**
   * Checks if a specific time slot is available for a specific service.
   * This is the final validation before booking.
   * @param {string} date
   * @param {string} time
   * @param {string} serviceId
   * @param {string|null} excludeSessionId
   * @param {string|null} excludeAppointmentId
   * @returns {Promise<boolean>}
   */
  async isTimeSlotAvailableWithDuration(date, time, serviceId, excludeSessionId = null, excludeAppointmentId = null) {
      try {
          const service = (await this.getServices()).find(s => s.id === serviceId);
          if (!service) throw new Error(`Service with id ${serviceId} not found.`);

          const duration = service.duration;
          const numSlotsNeeded = Math.ceil(duration / 30);
          const requiredSlots = this.getSlotsSlice(time, numSlotsNeeded);

          const daySchedule = await this.calculateFullDayAvailability(date);

          for (const slotTime of requiredSlots) {
              const slotData = daySchedule.get(slotTime);
              if (!slotData || slotData.status !== 'free') {
                  if (excludeAppointmentId && slotData.appointmentId === excludeAppointmentId) {
                      continue;
                  }
                  return false;
              }
          }
          
          const isTempBlocked = await this.isTemporarilyBlocked(date, requiredSlots, excludeSessionId);
          if (isTempBlocked) return false;

          return true;
      } catch (error) {
          console.error("Error in isTimeSlotAvailableWithDuration:", error);
          return false;
      }
  }


  // ##################################################################
  // # HELPER FUNCTIONS for the new logic
  // ##################################################################
  
  addMinutesToTime(time, minutes) {
    const [hour, minute] = time.split(':').map(Number);
    const date = new Date(0);
    date.setHours(hour, minute + minutes);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  findLastBlockedSlot(startTime, endTime) {
    const allSlots = this.generateAllTimeSlots();
    let lastSlot = null;
    for (const slot of allSlots) {
      if (slot >= startTime && slot < endTime) {
        lastSlot = slot;
      }
    }
    return lastSlot;
  }

  getSlotsSlice(startTime, count) {
    const allSlots = this.generateAllTimeSlots();
    const startIndex = allSlots.indexOf(startTime);
    if (startIndex === -1) return [];
    return allSlots.slice(startIndex, startIndex + count);
  }

  async getAppointmentsForDate(date) {
    const q = query(
      this.appointmentsCollection,
      where('preferredDate', '==', date),
      where('status', 'in', ['pending', 'confirmed'])
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getAdminSlotsForDate(date) {
    try {
      const { default: scheduleService } = await import('./schedule-service.js');
      const dateObj = new Date(date);
      const adminSlotsResult = await scheduleService.getAvailableSlotsForMonth(dateObj.getFullYear(), dateObj.getMonth() + 1);
      if (adminSlotsResult.success && adminSlotsResult.slots) {
        return adminSlotsResult.slots.filter(slot => slot.date === date).map(slot => slot.time);
      }
      return [];
    } catch (e) {
      console.warn("Could not get admin schedule", e);
      return [];
    }
  }
  
  async isTemporarilyBlocked(date, slots, excludeSessionId) {
      if (!excludeSessionId) return false;
      try {
        const now = Timestamp.now();
        // ✅ FIX: Modified query to avoid needing a composite index
        const q = query(
          this.temporaryBlocksCollection,
          where('date', '==', date),
          where('expiresAt', '>', now)
        );
        const snapshot = await getDocs(q);
        const blockedTimes = new Set();
        // Filter in code
        snapshot.docs.forEach(doc => {
            if (doc.data().sessionId !== excludeSessionId) {
                blockedTimes.add(doc.data().time);
            }
        });
        return slots.some(slot => blockedTimes.has(slot));
      } catch (error) {
          console.warn("Could not check temporary blocks", error);
          return false;
      }
  }

  generateAllTimeSlots() {
    const slots = [];
    for (let hour = 7; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }

  // ##################################################################
  // # OTHER CLASS METHODS (Existing logic from your file)
  // ##################################################################

  async getServices() {
    const now = Date.now();
    if (this.servicesCache && (now - this.servicesCacheTimestamp < this.servicesCacheTimeout)) {
      return this.servicesCache;
    }
    try {
      const servicesCollection = collection(db, 'services');
      const q = query(servicesCollection, orderBy('name'));
      const querySnapshot = await getDocs(q);
      const services = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.servicesCache = services;
      this.servicesCacheTimestamp = now;
      return services;
    } catch (error) {
      console.error("Błąd podczas pobierania usług:", error);
      return [];
    }
  }

  async getTherapyDuration(service) {
    try {
      const services = await this.getServices();
      const serviceObj = services.find(s => s.id === service);
      if (serviceObj && serviceObj.duration) {
        return serviceObj.duration;
      }
    } catch (error) {
      console.warn('Could not load services from database, using defaults:', error);
    }
    const durations = { 'terapia-indywidualna': 50, 'terapia-par': 90, 'terapia-rodzinna': 90 };
    return durations[service] || 50;
  }

  async submitAppointmentDirect(appointmentData, sessionId = null) {
    const perfTrace = perf ? trace(perf, 'submitAppointment') : null;
    perfTrace?.start();
    perfTrace?.putAttribute('service', appointmentData.service || 'unknown');
    
    try {
      const isAvailable = await this.isTimeSlotAvailableWithDuration(
        appointmentData.preferredDate, 
        appointmentData.preferredTime,
        appointmentData.service,
        sessionId
      );
      
      if (!isAvailable) {
        throw new Error('Selected time slot is no longer available or conflicts with existing appointment');
      }

      const docData = {
        ...appointmentData,
        status: 'pending',
        paymentStatus: 'pending',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(this.appointmentsCollection, docData);
      
      if (sessionId) {
        await this.removeTemporaryBlock(sessionId);
      }
      
      perfTrace?.putAttribute('success', 'true');
      perfTrace?.stop();
      return {
        success: true,
        appointmentId: docRef.id,
        message: 'Appointment submitted successfully'
      };
    } catch (error) {
      console.error('Error submitting appointment:', error);
      perfTrace?.putAttribute('error', 'true');
      perfTrace?.stop();
      throw new Error(error.message || 'Failed to submit appointment');
    }
  }

  // ✅ FIX: Added back for compatibility with other modules
  async submitAppointment(appointmentData, sessionId = null) {
    return this.submitAppointmentDirect(appointmentData, sessionId);
  }

  async getAppointments(options = {}) {
    try {
      const { status, limit = 50 } = options;
      
      let q = query(
        this.appointmentsCollection, 
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );
      
      const querySnapshot = await getDocs(q);
      let appointments = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        appointments.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        });
      });

      if (status && status !== 'all') {
        if (status === 'completed') {
          appointments = appointments.filter(appointment => appointment.sessionCompleted === true && !appointment.isArchived);
        } else if (status === 'archived') {
          appointments = appointments.filter(appointment => appointment.isArchived === true);
        } else {
          appointments = appointments.filter(appointment => appointment.status === status && !appointment.isArchived);
        }
      } else {
        appointments = appointments.filter(appointment => !appointment.isArchived);
      }

      return {
        success: true,
        appointments,
        count: appointments.length
      };
    } catch (error) {
      console.error('Error fetching appointments:', error);
      throw new Error('Failed to fetch appointments');
    }
  }

  async getAppointmentById(appointmentId) {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const docSnap = await getDoc(appointmentRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching appointment:', error);
      throw new Error('Failed to fetch appointment');
    }
  }

  async updateAppointment(appointmentId, updateData) {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      
      const dataToUpdate = {
        ...updateData,
        updatedAt: Timestamp.now()
      };

      await updateDoc(appointmentRef, dataToUpdate);
      
      return {
        success: true,
        message: 'Appointment updated successfully'
      };
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw new Error('Failed to update appointment');
    }
  }

  async validateAppointmentData(data) {
    const errors = [];

    if (!data.name || data.name.trim().length < 2) {
      errors.push('Name is required and must be at least 2 characters');
    }

    if (!data.email || !this.isValidEmail(data.email)) {
      errors.push('Valid email address is required');
    }

    if (!data.service) {
      errors.push('Service selection is required');
    }

    if (data.service) {
      try {
        const services = await this.getServices();
        const validServiceIds = services.map(service => service.id);
        if (!validServiceIds.includes(data.service)) {
          errors.push('Invalid service selection');
        }
      } catch (error) {
        console.error('Error validating service:', error);
        console.warn('Could not validate service against database, proceeding without validation');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async addService(serviceData) {
    try {
      const serviceRef = doc(db, 'services', serviceData.id);
      await setDoc(serviceRef, serviceData);
      this.clearServicesCache();
      return { success: true };
    } catch (error) {
      console.error("Błąd podczas dodawania usługi:", error);
      throw error;
    }
  }

  async updateService(serviceId, serviceData) {
    try {
      const serviceRef = doc(db, 'services', serviceId);
      await updateDoc(serviceRef, serviceData);
      this.clearServicesCache();
      return { success: true };
    } catch (error) {
      console.error("Błąd podczas aktualizacji usługi:", error);
      throw error;
    }
  }

  async deleteService(serviceId) {
    if (!serviceId) {
      throw new Error('Nie podano ID usługi do usunięcia.');
    }
    try {
      const serviceRef = doc(db, 'services', serviceId);
      await deleteDoc(serviceRef);
      this.clearServicesCache();
      return { success: true, message: 'Usługa została pomyślnie usunięta.' };
    } catch (error) {
      console.error('Błąd w firebase-service podczas usuwania usługi:', error);
      throw new Error('Wystąpił błąd podczas usuwania usługi z bazy danych.');
    }
  }

  clearServicesCache() {
    this.servicesCache = null;
    this.servicesCacheTimestamp = 0;
    console.log('Cache usług został wyczyszczony.');
  }

  sanitizeAppointmentData(data) {
    return {
      name: this.sanitizeString(data.name, 100),
      email: this.sanitizeEmail(data.email),
      service: this.sanitizeString(data.service, 50),
      preferredDate: this.sanitizeDate(data.preferredDate),
      preferredTime: this.sanitizeString(data.preferredTime, 10),
      message: this.sanitizeString(data.message, 1000)
    };
  }

  sanitizeString(str, maxLength = 255) {
    if (!str) return '';
    const sanitized = str.toString().replace(/<[^>]*>/g, '').replace(/[<>"'&]/g, '').trim();
    return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
  }

  sanitizeEmail(email) {
    if (!email) return '';
    const sanitized = email.toString().trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(sanitized) ? sanitized : '';
  }

  sanitizeDate(date) {
    if (!date) return '';
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return '';
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime()) ? date : '';
  }

  getServiceName(serviceCode) {
    const services = {
      'terapia-indywidualna': 'Terapia Indywidualna',
      'terapia-par': 'Terapia Par',
      'terapia-rodzinna': 'Terapia Rodzinna',
      'konsultacje-online': 'Konsultacje online'
    };
    return services[serviceCode] || serviceCode;
  }

  async hasCompletedSession(email) {
    try {
      const q = query(
        this.appointmentsCollection,
        where('email', '==', email.toLowerCase()),
        where('sessionCompleted', '==', true),
        firestoreLimit(1)
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking completed sessions:', error);
      return true;
    }
  }

  async getPricing(service, email) {
    const basePrices = {
      'terapia-indywidualna': 150,
      'terapia-par': 220,
      'terapia-rodzinna': 230
    };
    const basePrice = basePrices[service] || 150;
    try {
      const hasCompletedBefore = await this.hasCompletedSession(email);
      const isFirstSession = !hasCompletedBefore;
      const finalPrice = isFirstSession ? Math.round(basePrice * 0.5) : basePrice;
      return { basePrice, finalPrice, isFirstSession, discount: isFirstSession ? 50 : 0, serviceName: this.getServiceName(service) };
    } catch (error) {
      console.error('Error calculating pricing:', error);
      return { basePrice, finalPrice: basePrice, isFirstSession: false, discount: 0, serviceName: this.getServiceName(service) };
    }
  }

  async cancelAppointment(appointmentId, cancelledBy = 'client', reason = '') {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const updateData = { status: 'cancelled', cancelledAt: Timestamp.now(), cancelledBy, cancellationReason: reason, updatedAt: Timestamp.now() };
      await updateDoc(appointmentRef, updateData);
      return { success: true, message: 'Appointment cancelled successfully' };
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      throw new Error('Failed to cancel appointment');
    }
  }

  async rescheduleAppointment(appointmentId, newDate, newTime) {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const appointmentDoc = await getDoc(appointmentRef);
      if (!appointmentDoc.exists()) throw new Error('Appointment not found');
      
      const currentData = appointmentDoc.data();
      const isAvailable = await this.isTimeSlotAvailableWithDuration(newDate, newTime, currentData.service, null, appointmentId);
      if (!isAvailable) throw new Error('Selected time slot is not available or conflicts with existing appointment');
      
      const updateData = {
        originalDate: currentData.confirmedDate || currentData.preferredDate,
        originalTime: currentData.confirmedTime || currentData.preferredTime,
        preferredDate: newDate,
        preferredTime: newTime,
        confirmedDate: newDate,
        confirmedTime: newTime,
        rescheduleCount: (currentData.rescheduleCount || 0) + 1,
        updatedAt: Timestamp.now()
      };
      await updateDoc(appointmentRef, updateData);
      return { success: true, message: 'Appointment rescheduled successfully' };
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      throw new Error(error.message || 'Failed to reschedule appointment');
    }
  }

  async updatePaymentStatus(appointmentId, paymentMethod, paymentStatus) {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const updateData = { paymentMethod, paymentStatus, updatedAt: Timestamp.now() };
      if (paymentStatus === 'paid') updateData.paymentDate = Timestamp.now();
      await updateDoc(appointmentRef, updateData);
      return { success: true, message: 'Payment status updated successfully' };
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw new Error('Failed to update payment status');
    }
  }

  async getClientAppointments(email) {
    try {
      const q = query(this.appointmentsCollection, where('email', '==', email.toLowerCase()), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const appointments = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        appointments.push({ id: doc.id, ...data, createdAt: data.createdAt?.toDate(), updatedAt: data.updatedAt?.toDate(), paymentDate: data.paymentDate?.toDate(), cancelledAt: data.cancelledAt?.toDate() });
      });
      return { success: true, appointments };
    } catch (error) {
      console.error('Error fetching client appointments:', error);
      throw new Error('Failed to fetch client appointments');
    }
  }

  async createTemporaryBlock(date, time, sessionId) {
    try {
      await this.cleanupExpiredBlocks();
      await this.removeTemporaryBlock(sessionId);
      const isAvailable = await this.isTimeSlotAvailableWithDuration(date, time, 'terapia-indywidualna', sessionId); // Check for shortest duration
      if (!isAvailable) throw new Error('Time slot is no longer available');
      
      const expiresAt = new Date(Date.now() + this.blockDuration);
      const blockData = { date, time, sessionId, createdAt: Timestamp.now(), expiresAt: Timestamp.fromDate(expiresAt) };
      const docRef = await addDoc(this.temporaryBlocksCollection, blockData);
      return { success: true, blockId: docRef.id, expiresAt: expiresAt.toISOString() };
    } catch (error) {
      console.error('Error creating temporary block:', error);
      throw new Error(error.message || 'Failed to create temporary block');
    }
  }
  
  async removeTemporaryBlock(sessionId) {
    try {
      const q = query(this.temporaryBlocksCollection, where('sessionId', '==', sessionId));
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      return { success: true, message: 'Temporary block removed successfully' };
    } catch (error) {
      console.error('Error removing temporary block:', error);
      return { success: false, error: error.message };
    }
  }
  
  async cleanupExpiredBlocks() {
    try {
      const now = Timestamp.now();
      const q = query(this.temporaryBlocksCollection, where('expiresAt', '<=', now));
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      return { success: true, deletedCount: querySnapshot.size };
    } catch (error) {
      if (error.code === 'permission-denied') console.warn('Firebase permissions not configured for temporaryBlocks collection.');
      else if (error.code !== 'not-found') console.warn('Could not clean up expired blocks:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  async extendTemporaryBlock(sessionId) {
    try {
      const q = query(this.temporaryBlocksCollection, where('sessionId', '==', sessionId));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) throw new Error('No temporary block found for this session');
      const doc = querySnapshot.docs[0];
      const newExpiresAt = new Date(Date.now() + this.blockDuration);
      await updateDoc(doc.ref, { expiresAt: Timestamp.fromDate(newExpiresAt) });
      return { success: true, expiresAt: newExpiresAt.toISOString() };
    } catch (error) {
      console.error('Error extending temporary block:', error);
      throw new Error(error.message || 'Failed to extend temporary block');
    }
  }
  
  async submitClientFeedback(appointmentId, feedbackData) {
    try {
      const feedbackDoc = { appointmentId, ...feedbackData, createdAt: Timestamp.now(), status: 'pending' };
      const feedbackRef = await addDoc(collection(db, 'feedback'), feedbackDoc);
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, { feedbackSubmitted: true, feedbackId: feedbackRef.id, feedbackSubmittedAt: Timestamp.now(), updatedAt: Timestamp.now() });
      return { success: true, feedbackId: feedbackRef.id, message: 'Feedback submitted successfully' };
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw new Error('Failed to submit feedback');
    }
  }

  async getClientFeedback(appointmentId) {
    try {
      const q = query(collection(db, 'feedback'), where('appointmentId', '==', appointmentId), orderBy('createdAt', 'desc'), firestoreLimit(1));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return { success: true, feedback: null };
      const feedbackDoc = querySnapshot.docs[0];
      const feedback = { id: feedbackDoc.id, ...feedbackDoc.data(), createdAt: feedbackDoc.data().createdAt?.toDate() };
      return { success: true, feedback };
    } catch (error) {
      console.error('Error fetching feedback:', error);
      throw new Error('Failed to fetch feedback');
    }
  }

  async archiveAppointment(appointmentId) {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const updateData = { isArchived: true, archivedAt: Timestamp.now(), updatedAt: Timestamp.now() };
      await updateDoc(appointmentRef, updateData);
      return { success: true, message: 'Appointment archived successfully' };
    } catch (error) {
      console.error('Error archiving appointment:', error);
      throw new Error('Failed to archive appointment');
    }
  }

  async unarchiveAppointment(appointmentId) {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const updateData = { isArchived: false, archivedAt: null, updatedAt: Timestamp.now() };
      await updateDoc(appointmentRef, updateData);
      return { success: true, message: 'Appointment unarchived successfully' };
    } catch (error) {
      console.error('Error unarchiving appointment:', error);
      throw new Error('Failed to unarchive appointment');
    }
  }

  async cleanupOldAppointments() {
    try {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const q = query(this.appointmentsCollection, where('createdAt', '<', Timestamp.fromDate(twelveMonthsAgo)));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return { success: true, deletedCount: 0, message: 'No old appointments found for cleanup' };
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      return { success: true, deletedCount: querySnapshot.size, message: `Successfully deleted ${querySnapshot.size} old appointments` };
    } catch (error) {
      console.error('Error cleaning up old appointments:', error);
      throw new Error('Failed to cleanup old appointments');
    }
  }

  async performDailyMaintenance() {
    try {
      const cleanupResult = await this.cleanupOldAppointments();
      const blockCleanup = await this.cleanupExpiredBlocks();
      return { success: true, message: 'Daily maintenance completed successfully', cleanupResults: { appointments: cleanupResult, blocks: blockCleanup } };
    } catch (error) {
      console.error('Error during daily maintenance:', error);
      throw new Error('Failed to perform daily maintenance');
    }
  }
}

// Export singleton instance
export const firebaseService = new FirebaseService();
export default firebaseService;
