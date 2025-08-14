
import { mutateAppointmentState } from './state-machine.js';
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
import { db } from './firebase-config.js';

const MAX_RESCHEDULES = 3;

class FirebaseService {
  /**
   * Pobiera historię zmian dla danej wizyty (appointmentId)
   */
  async getAppointmentHistory(appointmentId) {
    const historyRef = collection(db, 'appointmentHistory');
    const q = query(historyRef, where('appointmentId', '==', appointmentId), orderBy('ts', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  constructor() {
    this.appointmentsCollection = collection(db, 'appointments');
    this.temporaryBlocksCollection = collection(db, 'temporaryBlocks');
    this.blockDuration = 10 * 60 * 1000; // 10 minutes
    this.slotsCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.servicesCache = null;
    this.servicesCacheTimeout = 5 * 60 * 1000;
    this.servicesCacheTimestamp = 0;
  // Flag to avoid spamming the console with repeated permission-denied messages
  this._permissionDeniedWarned = false;
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
    try {
      const cacheKey = `advanced_${date}_${excludeSessionId || 'none'}`;
      const cached = this.slotsCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
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
      return result;

    } catch (error) {
      // Detect permission errors and avoid spamming the console/network
      const isPermissionError = (error && (error.code === 'permission-denied' || (error.message && /permission/i.test(error.message))));
      if (isPermissionError && !this._permissionDeniedWarned) {
        console.warn('Firebase permission denied when fetching available slots. Public pages may not have access to scheduling data.');
        this._permissionDeniedWarned = true;
      } else if (!isPermissionError) {
        console.error('Error getting available time slots with advanced logic:', error);
      }

      // Cache empty result briefly to avoid repeated failing requests from the UI
      try {
        const cacheKey = `advanced_${date}_${excludeSessionId || 'none'}`;
        this.slotsCache.set(cacheKey, { slots: [], timestamp: Date.now() });
      } catch (_) {
        // reference the variable so linters don't flag it as unused
        void _;
        // ignore cache set failures
      }

      return [];
    }
  }

  /**
   * Batch-fetch availability for an entire month using server endpoint (range=long).
   * Returns an array of slot objects similar to getAvailableTimeSlots but for the whole month.
   */
  async getAvailableTimeSlotsForMonth(year, month, excludeSessionId = null) {
    const monthKey = `month_${year}_${String(month).padStart(2, '0')}_${excludeSessionId || 'none'}`;
    const cached = this.slotsCache.get(monthKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) return cached.slots;

    // Build first-of-month date
    const firstDate = `${year}-${String(month).padStart(2, '0')}-01`;

    try {
      // Prefer hosting /api path so routing and CORS are handled by Hosting rewrites
      const functionBase = `${location.origin}/api`;
      const resp = await fetch(`${functionBase}/public/availability?date=${encodeURIComponent(firstDate)}&range=long`);
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const data = await resp.json();
      if (!data || !data.success) throw new Error('Invalid server response');

      // server returns { appointments: [...], temporaryBlocks: [...] }
      // Convert to per-day slot structures expected by calendar: build minimal slot array
      const slotsByDate = new Map();

      // From appointments
      (data.appointments || []).forEach(a => {
        const d = a.confirmedTime || a.preferredTime || null;
        const date = a.preferredDate || a.confirmedDate || null;
        if (!date || !d) return;
        const entry = {
          date,
          time: d,
          isAvailable: false,
          isBooked: true,
          isTemporarilyBlocked: false
        };
        if (!slotsByDate.has(date)) slotsByDate.set(date, []);
        slotsByDate.get(date).push(entry);
      });

      // From temporaryBlocks
      (data.temporaryBlocks || []).forEach(tb => {
        const date = tb.date;
        const entry = {
          date,
          time: tb.time,
          isAvailable: false,
          isBooked: false,
          isTemporarilyBlocked: true
        };
        if (!slotsByDate.has(date)) slotsByDate.set(date, []);
        slotsByDate.get(date).push(entry);
      });

      // Flatten into array
      const result = [];
  slotsByDate.forEach(arr => result.push(...arr));

      this.slotsCache.set(monthKey, { slots: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      console.warn('Month availability fallback failed, falling back to per-day computation', err);
      // Fallback: compute per-day locally by calling getAvailableTimeSlots for each day (keeps previous behavior)
      const daysInMonth = new Date(year, month, 0).getDate();
      const results = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const daySlots = await this.getAvailableTimeSlots(dateStr, excludeSessionId);
        results.push(...daySlots);
      }
      this.slotsCache.set(monthKey, { slots: results, timestamp: Date.now() });
      return results;
    }
  }

  /**
   * Checks if a specific time slot is available for a specific service.
   * This is the final validation before booking.
   * @param {string} date
   * @param {string} time
                    await this.logAppointmentHistory(appointmentId, data.status, 'cancelled', cancelledBy, updateData);
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
    try {
      const q = query(
        this.appointmentsCollection,
        where('preferredDate', '==', date),
        where('status', 'in', ['pending', 'confirmed'])
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      const isPermissionError = (error && (error.code === 'permission-denied' || (error.message && /permission/i.test(error.message))));
      if (isPermissionError) {
        if (!this._permissionDeniedWarned) {
          console.warn('Firebase permission denied when fetching appointments for date. Falling back to server endpoint.');
          this._permissionDeniedWarned = true;
        }

        // Try server endpoint as a fallback (functions using Admin SDK)
        try {
          // Use the direct Cloud Function URL (region-specific) to avoid relying on hosting rewrites
          const functionBase = 'https://europe-central2-joanna-psycholog.cloudfunctions.net/api';
          const resp = await fetch(`${functionBase}/public/availability?date=${encodeURIComponent(date)}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data && data.success && Array.isArray(data.appointments)) {
              return data.appointments.map(a => ({ id: a.id, ...a }));
            }
          }
        } catch (fetchErr) {
          console.warn('Fallback server availability endpoint failed:', fetchErr);
        }
      } else {
        console.error('Error fetching appointments for date:', error);
      }

      // Safe fallback
      return [];
    }
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
      
      return {
        success: true,
        appointmentId: docRef.id,
        message: 'Appointment submitted successfully'
      };
    } catch (error) {
      console.error('Error submitting appointment:', error);
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
      this.handleFirebaseError(error, 'Failed to update appointment');
    }
  }

  handleFirebaseError(error, defaultMessage = 'Operation failed') {
    // Sprawdzamy czy błąd jest spowodowany przez adblocker
    if (error.message && error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
      throw new Error('Połączenie zostało zablokowane przez adblocker. Spróbuj wyłączyć adblocker lub dodać stronę do wyjątków.');
    }
    
    // Sprawdzamy inne typowe błędy Firebase
    if (error.code) {
      switch (error.code) {
        case 'permission-denied':
          throw new Error('Brak uprawnień do wykonania tej operacji.');
        case 'unavailable':
          throw new Error('Usługa Firebase jest tymczasowo niedostępna. Spróbuj ponownie za chwilę.');
        case 'deadline-exceeded':
          throw new Error('Operacja przekroczyła limit czasu. Spróbuj ponownie.');
        case 'resource-exhausted':
          throw new Error('Przekroczono limit zasobów. Spróbuj ponownie później.');
        default:
          console.error('Firebase error code:', error.code, error.message);
          throw new Error(defaultMessage);
      }
    }
    
    throw new Error(error.message || defaultMessage);
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
      const appointmentDoc = await getDoc(appointmentRef);
      if (!appointmentDoc.exists()) throw new Error('Appointment not found');
      const data = appointmentDoc.data();
      const updateData = mutateAppointmentState(data, 'cancelled', { now: Timestamp.now(), cancelledBy, reason });
      await updateDoc(appointmentRef, updateData);
      return { success: true, message: 'Appointment cancelled successfully' };
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      throw new Error('Failed to cancel appointment');
    }
  }

  async rescheduleAppointment(appointmentId, newDate, newTime, initiatedBy = 'client') {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const appointmentDoc = await getDoc(appointmentRef);
      if (!appointmentDoc.exists()) throw new Error('Appointment not found');

      const currentData = appointmentDoc.data();
      // Limit przełożeń tylko dla klienta
      if (initiatedBy === 'client' && (currentData.rescheduleCount || 0) >= MAX_RESCHEDULES) {
        throw new Error(`Osiągnięto maksymalną liczbę przełożeń (${MAX_RESCHEDULES}). Skontaktuj się bezpośrednio w celu dalszych zmian.`);
      }

      const isAvailable = await this.isTimeSlotAvailableWithDuration(newDate, newTime, currentData.service, null, appointmentId);
      if (!isAvailable) throw new Error('Selected time slot is not available or conflicts with existing appointment');

      const previousDate = currentData.confirmedDate || currentData.preferredDate;
      const previousTime = currentData.confirmedTime || currentData.preferredTime;
      const wasConfirmed = currentData.status === 'confirmed';


      let updateData;
      if (initiatedBy === 'admin') {
        // Admin: przejście na confirmed (jeśli pending) lub pozostaje confirmed
        updateData = mutateAppointmentState(currentData, 'confirmed', { now: Timestamp.now() });
        updateData.preferredDate = newDate;
        updateData.preferredTime = newTime;
        updateData.rescheduleCount = (currentData.rescheduleCount || 0) + 1;
        updateData.originalDate = previousDate;
        updateData.originalTime = previousTime;
      } else {
        // Klient: jeśli było confirmed, przejście na pending, jeśli pending – pozostaje pending
        const nextState = wasConfirmed ? 'pending' : currentData.status;
        updateData = mutateAppointmentState(currentData, nextState, { now: Timestamp.now() });
        updateData.preferredDate = newDate;
        updateData.preferredTime = newTime;
        updateData.rescheduleCount = (currentData.rescheduleCount || 0) + 1;
        updateData.originalDate = previousDate;
        updateData.originalTime = previousTime;
      }

      await updateDoc(appointmentRef, updateData);
      return { success: true, message: 'Appointment rescheduled successfully', revertedToPending: initiatedBy !== 'admin' && wasConfirmed };
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

  /**
   * Confirm appointment: only if status is pending. Sets status=confirmed, confirmedDate/Time if missing, resets confirmEmailSent flag.
   */
  async confirmAppointment(appointmentId) {
    const appointmentRef = doc(db, 'appointments', appointmentId);
    const appointmentDoc = await getDoc(appointmentRef);
    if (!appointmentDoc.exists()) throw new Error('Appointment not found');
    const data = appointmentDoc.data();
    if (data.status !== 'pending') throw new Error('Można potwierdzić tylko wizytę oczekującą.');
    const updateData = mutateAppointmentState(data, 'confirmed', { now: Timestamp.now() });
    updateData.confirmEmailSent = false;
    await updateDoc(appointmentRef, updateData);
    return { success: true };
  }
}

// Export singleton instance
export const firebaseService = new FirebaseService();
export default firebaseService;
