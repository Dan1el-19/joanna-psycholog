// Firebase service for appointment booking
import { 
  collection, 
  addDoc, 
  getDocs, 
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
import { httpsCallable } from 'firebase/functions';
import { trace } from 'firebase/performance';
import { db, functions, perf } from './firebase-config.js';

class FirebaseService {
  constructor() {
    this.appointmentsCollection = collection(db, 'appointments');
    this.temporaryBlocksCollection = collection(db, 'temporaryBlocks');
    this.blockDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
    this.slotsCache = new Map(); // Cache for available slots - UPDATED v1.1
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  // Submit appointment using Firestore directly
  async submitAppointmentDirect(appointmentData, sessionId = null) {
    const perfTrace = trace(perf, 'submitAppointment');
    perfTrace.start();
    perfTrace.putAttribute('service', appointmentData.service || 'unknown');
    
    try {
      // Check for double booking with duration consideration before submitting
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
      
      // Remove temporary block after successful booking
      if (sessionId) {
        await this.removeTemporaryBlock(sessionId);
      }
      
      perfTrace.putAttribute('success', 'true');
      perfTrace.stop();
      return {
        success: true,
        appointmentId: docRef.id,
        message: 'Appointment submitted successfully'
      };
    } catch (error) {
      console.error('Error submitting appointment:', error);
      perfTrace.putAttribute('error', 'true');
      perfTrace.stop();
      throw new Error(error.message || 'Failed to submit appointment');
    }
  }

  // Submit appointment using Cloud Function (recommended for email notifications)
  async submitAppointment(appointmentData, sessionId = null) {
    try {
      // Use the REST API approach as fallback
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...appointmentData,
          sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Remove temporary block after successful booking
      if (sessionId && result.success) {
        await this.removeTemporaryBlock(sessionId);
      }
      
      return result;
    } catch (error) {
      console.log('API endpoint not available, using direct Firestore (this is normal):', error.message);
      // Fallback to direct Firestore if API fails - this is the expected flow
      return await this.submitAppointmentDirect(appointmentData, sessionId);
    }
  }

  // Get appointments (admin function)
  async getAppointments(options = {}) {
    try {
      const { status, limit = 50 } = options;
      
      // Simple query first - get all and filter client-side to avoid Firestore index issues
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

      // Filter client-side if status specified
      if (status && status !== 'all') {
        if (status === 'completed') {
          appointments = appointments.filter(appointment => appointment.sessionCompleted === true && !appointment.isArchived);
        } else if (status === 'archived') {
          appointments = appointments.filter(appointment => appointment.isArchived === true);
        } else {
          appointments = appointments.filter(appointment => appointment.status === status && !appointment.isArchived);
        }
      } else {
        // Default behavior for 'all' and undefined status - exclude archived appointments
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

  // Update appointment status
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

  // Validate appointment data
  validateAppointmentData(data) {
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

    const validServices = ['terapia-indywidualna', 'terapia-par', 'terapia-rodzinna', 'konsultacje-online'];
    if (data.service && !validServices.includes(data.service)) {
      errors.push('Invalid service selection');
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

  // Get therapy duration in minutes based on service type
  getTherapyDuration(service) {
    const durations = {
      'terapia-indywidualna': 50, // 50 minutes
      'terapia-par': 90,         // 90 minutes  
      'terapia-rodzinna': 90     // 90 minutes
    };
    return durations[service] || 50; // Default to 50 minutes
  }

  // Calculate which time slots should be blocked for an appointment
  getBlockedSlotsForAppointment(appointment) {
    const startTime = appointment.preferredTime || appointment.confirmedTime;
    const service = appointment.service;
    const duration = this.getTherapyDuration(service);
    
    if (!startTime) return [startTime];
    
    const blockedSlots = [];
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = startTimeInMinutes + duration;
    
    // Define all possible time slots (every 30 minutes from 7:00 to 20:30)
    const allSlots = this.generateAllTimeSlots();
    
    // Check which slots overlap with our appointment
    for (const slot of allSlots) {
      const [slotHour, slotMinute] = slot.split(':').map(Number);
      const slotTimeInMinutes = slotHour * 60 + slotMinute;
      const slotEndTimeInMinutes = slotTimeInMinutes + 30; // Each slot is 30 minutes
      
      // Check if this slot overlaps with our appointment
      // Overlap occurs if: slot starts before appointment ends AND slot ends after appointment starts
      if (slotTimeInMinutes < endTimeInMinutes && slotEndTimeInMinutes > startTimeInMinutes) {
        blockedSlots.push(slot);
      }
    }
    
    return blockedSlots;
  }

  // Check if a time slot conflicts with existing appointments considering duration
  async isTimeSlotAvailableWithDuration(date, time, service, excludeSessionId = null) {
    try {
      const duration = this.getTherapyDuration(service);
      
      // Check if the requested slot conflicts with existing appointments
      const appointmentQuery = query(
        this.appointmentsCollection,
        where('preferredDate', '==', date),
        where('status', 'in', ['pending', 'confirmed'])
      );
      
      const appointmentSnapshot = await getDocs(appointmentQuery);
      
      // Check each existing appointment for conflicts
      for (const doc of appointmentSnapshot.docs) {
        const appointment = doc.data();
        const existingBlockedSlots = this.getBlockedSlotsForAppointment(appointment);
        
        // Check if any of our required slots conflict with existing blocked slots
        const requestedSlots = this.getBlockedSlotsForAppointment({
          preferredTime: time,
          service: service
        });
        
        for (const requestedSlot of requestedSlots) {
          if (existingBlockedSlots.includes(requestedSlot)) {
            return false; // Conflict found
          }
        }
      }
      
      // Check for temporary blocks (same logic as before)
      try {
        const now = Timestamp.now();
        const blockQuery = query(
          this.temporaryBlocksCollection,
          where('date', '==', date),
          where('expiresAt', '>', now)
        );
        
        const blockSnapshot = await getDocs(blockQuery);
        
        if (!blockSnapshot.empty) {
          const hasOtherSessionBlocks = blockSnapshot.docs.some(doc => {
            const blockData = doc.data();
            return blockData.sessionId !== excludeSessionId;
          });
          
          if (hasOtherSessionBlocks) {
            return false;
          }
        }
      } catch (error) {
        if (error.code === 'permission-denied') {
          console.warn('Firebase permissions not configured for temporaryBlocks collection.');
        } else {
          console.warn('Could not check temporary blocks:', error.message);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking time slot availability with duration:', error);
      return false;
    }
  }

  // Sanitize input data
  sanitizeAppointmentData(data) {
    return {
      name: data.name?.trim() || '',
      email: data.email?.trim().toLowerCase() || '',
      service: data.service || '',
      preferredDate: data.preferredDate || '',
      preferredTime: data.preferredTime || '',
      message: data.message?.trim() || ''
    };
  }

  // Helper method to get service display name (kept for compatibility)
  getServiceName(serviceCode) {
    const services = {
      'terapia-indywidualna': 'Terapia Indywidualna',
      'terapia-par': 'Terapia Par',
      'terapia-rodzinna': 'Terapia Rodzinna',
      'konsultacje-online': 'Konsultacje online'
    };
    return services[serviceCode] || serviceCode;
  }

  // Check if user has had a completed session before (for first session discount)
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
      // If error, assume no discount to be safe
      return true;
    }
  }

  // Get pricing information based on service and email history
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
      
      return {
        basePrice,
        finalPrice,
        isFirstSession,
        discount: isFirstSession ? 50 : 0,
        serviceName: this.getServiceName(service)
      };
    } catch (error) {
      console.error('Error calculating pricing:', error);
      // Return full price if error
      return {
        basePrice,
        finalPrice: basePrice,
        isFirstSession: false,
        discount: 0,
        serviceName: this.getServiceName(service)
      };
    }
  }

  // Check if a time slot is available for booking
  async isTimeSlotAvailable(date, time, excludeSessionId = null) {
    try {
      // Check for existing appointments
      const appointmentQuery = query(
        this.appointmentsCollection,
        where('preferredDate', '==', date),
        where('preferredTime', '==', time),
        where('status', 'in', ['pending', 'confirmed'])
      );
      
      const appointmentSnapshot = await getDocs(appointmentQuery);
      if (!appointmentSnapshot.empty) {
        return false;
      }
      
      // Check for temporary blocks
      try {
        const now = Timestamp.now();
        const blockQuery = query(
          this.temporaryBlocksCollection,
          where('date', '==', date),
          where('time', '==', time),
          where('expiresAt', '>', now)
        );
        
        const blockSnapshot = await getDocs(blockQuery);
        
        // If there are active blocks, check if any are from different sessions
        if (!blockSnapshot.empty) {
          const hasOtherSessionBlocks = blockSnapshot.docs.some(doc => {
            const blockData = doc.data();
            return blockData.sessionId !== excludeSessionId;
          });
          
          if (hasOtherSessionBlocks) {
            return false;
          }
        }
      } catch (error) {
        if (error.code === 'permission-denied') {
          console.warn('Firebase permissions not configured for temporaryBlocks collection.');
        } else {
          console.warn('Could not check temporary blocks:', error.message);
        }
        // Continue without temporary block check if collection doesn't exist
      }
      
      return true;
    } catch (error) {
      console.error('Error checking time slot availability:', error);
      return false; // Assume not available if error occurs
    }
  }

  // Get available time slots for a specific date
  async getAvailableTimeSlots(date, excludeSessionId = null) {
    const perfTrace = trace(perf, 'getAvailableTimeSlots');
    perfTrace.start();
    
    try {
      // Check cache first
      const cacheKey = `${date}-${excludeSessionId || 'none'}`;
      const cached = this.slotsCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        perfTrace.putAttribute('cache_hit', 'true');
        perfTrace.stop();
        return cached.slots;
      }
      
      perfTrace.putAttribute('cache_hit', 'false');
      
      // Clean up expired temporary blocks first (optional operation)
      try {
        await this.cleanupExpiredBlocks();
      } catch (cleanupError) {
        // Continue without cleanup if it fails
        console.log('Cleanup skipped due to permissions, continuing with slot check');
      }
      
      // Get available slots from schedule service (admin-defined)
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      
      let adminSlots = [];
      try {
        // Import schedule service dynamically to avoid circular imports
        const { default: scheduleService } = await import('./schedule-service.js');
        const adminSlotsResult = await scheduleService.getAvailableSlotsForMonth(year, month);
        
        if (adminSlotsResult.success && adminSlotsResult.slots) {
          // Filter slots for this specific date
          adminSlots = adminSlotsResult.slots
            .filter(slot => slot.date === date)
            .map(slot => slot.time);
        }
      } catch (scheduleError) {
        console.warn('Could not get admin schedule, using empty slots:', scheduleError);
        // If no admin schedule is available, return empty slots
        adminSlots = [];
      }
      
      // If no admin slots for this date, return empty array
      if (adminSlots.length === 0) {
        const result = [];
        this.slotsCache.set(cacheKey, {
          slots: result,
          timestamp: Date.now()
        });
        return result;
      }
      
      const workingHours = adminSlots;

      // Get existing appointments for this date
      const appointmentQuery = query(
        this.appointmentsCollection,
        where('preferredDate', '==', date),
        where('status', 'in', ['pending', 'confirmed'])
      );
      
      const appointmentSnapshot = await getDocs(appointmentQuery);
      const bookedTimes = new Set();
      
      appointmentSnapshot.forEach((doc) => {
        const appointment = doc.data();
        const blockedSlots = this.getBlockedSlotsForAppointment(appointment);
        console.log(`Appointment at ${appointment.preferredTime} (${appointment.service}) blocks:`, blockedSlots); // DEBUG
        blockedSlots.forEach(slot => bookedTimes.add(slot));
      });
      
      
      // Get active temporary blocks for this date
      const temporarilyBlocked = new Set();
      
      try {
        const now = Timestamp.now();
        const blockQuery = query(
          this.temporaryBlocksCollection,
          where('date', '==', date),
          where('expiresAt', '>', now)
        );
        
        const blockSnapshot = await getDocs(blockQuery);
        
        blockSnapshot.forEach((doc) => {
          const block = doc.data();
          // Only block if it's from a different session
          if (block.sessionId !== excludeSessionId) {
            temporarilyBlocked.add(block.time);
          }
        });
      } catch (error) {
        console.warn('Could not fetch temporary blocks (collection may not exist):', error);
        // Continue without temporary blocks if collection doesn't exist
      }

      // Return available slots with detailed information, checking ALL possible conflicts
      const result = workingHours.map(time => {
        const isTemporarilyBlocked = temporarilyBlocked.has(time);
        
        // Check availability for each service type by simulating booking attempt
        const serviceAvailability = {};
        const serviceTypes = ['terapia-indywidualna', 'terapia-par', 'terapia-rodzinna'];
        
        for (const serviceType of serviceTypes) {
          // Get slots that would be blocked by this service type at this time
          const requiredSlots = this.getBlockedSlotsForAppointment({
            preferredTime: time,
            service: serviceType
          });
          
          // Check if ANY of the required slots conflict with existing bookings
          const hasConflict = requiredSlots.some(slot => bookedTimes.has(slot));
          
          serviceAvailability[serviceType] = !hasConflict && !isTemporarilyBlocked;
        }
        
        // A slot is generally available if it's available for individual therapy (shortest session)
        const isAvailable = serviceAvailability['terapia-indywidualna'];
        const isBooked = bookedTimes.has(time);
        
        return {
          date,
          time,
          isAvailable,
          isBooked,
          isTemporarilyBlocked,
          serviceAvailability,
          // Add reason why slot is unavailable
          unavailableReason: !isAvailable ? (isBooked ? 'booked' : (isTemporarilyBlocked ? 'temporarily_blocked' : 'conflict')) : null
        };
      });
      
      // Cache the result
      this.slotsCache.set(cacheKey, {
        slots: result,
        timestamp: Date.now()
      });
      
      perfTrace.putAttribute('slots_count', result.length.toString());
      perfTrace.stop();
      return result;
    } catch (error) {
      console.error('Error getting available time slots:', error);
      perfTrace.putAttribute('error', 'true');
      perfTrace.stop();
      return [];
    }
  }

  // Helper function to get the next hour slot
  getNextHourSlot(time) {
    const [hour, minute] = time.split(':').map(Number);
    const nextHour = hour + 1;
    if (nextHour > 17) return null; // Past working hours
    return `${String(nextHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // Get available dates for the next 30 days (excluding weekends)
  getAvailableDates() {
    const dates = [];
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    for (let date = new Date(today); date <= thirtyDaysFromNow; date.setDate(date.getDate() + 1)) {
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        dates.push(date.toISOString().split('T')[0]);
      }
    }
    
    return dates;
  }

  // Cancel appointment
  async cancelAppointment(appointmentId, cancelledBy = 'client', reason = '') {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      
      const updateData = {
        status: 'cancelled',
        cancelledAt: Timestamp.now(),
        cancelledBy,
        cancellationReason: reason,
        updatedAt: Timestamp.now()
      };

      await updateDoc(appointmentRef, updateData);
      
      return {
        success: true,
        message: 'Appointment cancelled successfully'
      };
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      throw new Error('Failed to cancel appointment');
    }
  }

  // Reschedule appointment
  async rescheduleAppointment(appointmentId, newDate, newTime) {
    try {
      // Get current appointment data first to check service type
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const appointmentDoc = await getDoc(appointmentRef);
      
      if (!appointmentDoc.exists()) {
        throw new Error('Appointment not found');
      }

      const currentData = appointmentDoc.data();
      
      // Check if new slot is available with duration consideration
      const isAvailable = await this.isTimeSlotAvailableWithDuration(newDate, newTime, currentData.service);
      if (!isAvailable) {
        throw new Error('Selected time slot is not available or conflicts with existing appointment');
      }
      
      const updateData = {
        originalDate: currentData.preferredDate,
        originalTime: currentData.preferredTime,
        preferredDate: newDate,
        preferredTime: newTime,
        rescheduleCount: (currentData.rescheduleCount || 0) + 1,
        updatedAt: Timestamp.now()
      };

      await updateDoc(appointmentRef, updateData);
      
      return {
        success: true,
        message: 'Appointment rescheduled successfully'
      };
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      throw new Error(error.message || 'Failed to reschedule appointment');
    }
  }

  // Update payment status
  async updatePaymentStatus(appointmentId, paymentMethod, paymentStatus) {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      
      const updateData = {
        paymentMethod,
        paymentStatus,
        updatedAt: Timestamp.now()
      };

      if (paymentStatus === 'paid') {
        updateData.paymentDate = Timestamp.now();
      }

      await updateDoc(appointmentRef, updateData);
      
      return {
        success: true,
        message: 'Payment status updated successfully'
      };
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw new Error('Failed to update payment status');
    }
  }

  // Get appointments for a specific client
  async getClientAppointments(email) {
    try {
      const q = query(
        this.appointmentsCollection,
        where('email', '==', email.toLowerCase()),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const appointments = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        appointments.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          paymentDate: data.paymentDate?.toDate(),
          cancelledAt: data.cancelledAt?.toDate()
        });
      });

      return {
        success: true,
        appointments
      };
    } catch (error) {
      console.error('Error fetching client appointments:', error);
      throw new Error('Failed to fetch client appointments');
    }
  }

  // Create temporary block for a time slot
  async createTemporaryBlock(date, time, sessionId) {
    try {
      // Clean up expired blocks first
      await this.cleanupExpiredBlocks();
      
      // Check if slot is still available
      const isAvailable = await this.isTimeSlotAvailable(date, time, sessionId);
      if (!isAvailable) {
        throw new Error('Time slot is no longer available');
      }
      
      // Create or update temporary block
      const expiresAt = new Date(Date.now() + this.blockDuration);
      const blockData = {
        date,
        time,
        sessionId,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(expiresAt)
      };
      
      // Remove any existing blocks for this session
      await this.removeTemporaryBlock(sessionId);
      
      const docRef = await addDoc(this.temporaryBlocksCollection, blockData);
      
      return {
        success: true,
        blockId: docRef.id,
        expiresAt: expiresAt.toISOString()
      };
    } catch (error) {
      console.error('Error creating temporary block:', error);
      throw new Error(error.message || 'Failed to create temporary block');
    }
  }
  
  // Remove temporary block
  async removeTemporaryBlock(sessionId) {
    try {
      const q = query(
        this.temporaryBlocksCollection,
        where('sessionId', '==', sessionId)
      );
      
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      
      return {
        success: true,
        message: 'Temporary block removed successfully'
      };
    } catch (error) {
      console.error('Error removing temporary block:', error);
      // Don't throw error as this is a cleanup operation
      return { success: false, error: error.message };
    }
  }
  
  // Clean up expired temporary blocks
  async cleanupExpiredBlocks() {
    try {
      const now = Timestamp.now();
      const q = query(
        this.temporaryBlocksCollection,
        where('expiresAt', '<=', now)
      );
      
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      
      return {
        success: true,
        deletedCount: querySnapshot.size
      };
    } catch (error) {
      // Check if it's a permissions error
      if (error.code === 'permission-denied') {
        console.warn('Firebase permissions not configured for temporaryBlocks collection. This is optional for basic functionality.');
      } else if (error.code === 'not-found') {
        console.log('temporaryBlocks collection does not exist yet, will be created when first block is added.');
      } else {
        console.warn('Could not clean up expired blocks:', error.message);
      }
      return { success: false, error: error.message };
    }
  }
  
  // Extend temporary block
  async extendTemporaryBlock(sessionId) {
    try {
      const q = query(
        this.temporaryBlocksCollection,
        where('sessionId', '==', sessionId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('No temporary block found for this session');
      }
      
      const doc = querySnapshot.docs[0];
      const newExpiresAt = new Date(Date.now() + this.blockDuration);
      
      await updateDoc(doc.ref, {
        expiresAt: Timestamp.fromDate(newExpiresAt)
      });
      
      return {
        success: true,
        expiresAt: newExpiresAt.toISOString()
      };
    } catch (error) {
      console.error('Error extending temporary block:', error);
      throw new Error(error.message || 'Failed to extend temporary block');
    }
  }
  
  // Submit client feedback
  async submitClientFeedback(appointmentId, feedbackData) {
    try {
      const feedbackDoc = {
        appointmentId,
        ...feedbackData,
        createdAt: Timestamp.now(),
        status: 'pending'
      };

      const feedbackRef = await addDoc(collection(db, 'feedback'), feedbackDoc);
      
      // Update appointment with feedback reference
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, {
        feedbackSubmitted: true,
        feedbackId: feedbackRef.id,
        feedbackSubmittedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      return {
        success: true,
        feedbackId: feedbackRef.id,
        message: 'Feedback submitted successfully'
      };
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw new Error('Failed to submit feedback');
    }
  }

  // Get client feedback for appointment
  async getClientFeedback(appointmentId) {
    try {
      const q = query(
        collection(db, 'feedback'),
        where('appointmentId', '==', appointmentId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return {
          success: true,
          feedback: null
        };
      }

      const feedbackDoc = querySnapshot.docs[0];
      const feedback = {
        id: feedbackDoc.id,
        ...feedbackDoc.data(),
        createdAt: feedbackDoc.data().createdAt?.toDate()
      };

      return {
        success: true,
        feedback
      };
    } catch (error) {
      console.error('Error fetching feedback:', error);
      throw new Error('Failed to fetch feedback');
    }
  }

  // Archive appointment
  async archiveAppointment(appointmentId) {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      
      const updateData = {
        isArchived: true,
        archivedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await updateDoc(appointmentRef, updateData);
      
      return {
        success: true,
        message: 'Appointment archived successfully'
      };
    } catch (error) {
      console.error('Error archiving appointment:', error);
      throw new Error('Failed to archive appointment');
    }
  }

  // Unarchive appointment
  async unarchiveAppointment(appointmentId) {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      
      const updateData = {
        isArchived: false,
        archivedAt: null,
        updatedAt: Timestamp.now()
      };

      await updateDoc(appointmentRef, updateData);
      
      return {
        success: true,
        message: 'Appointment unarchived successfully'
      };
    } catch (error) {
      console.error('Error unarchiving appointment:', error);
      throw new Error('Failed to unarchive appointment');
    }
  }

  // Cleanup old appointments (12+ months old)
  async cleanupOldAppointments() {
    try {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const q = query(
        this.appointmentsCollection,
        where('createdAt', '<', Timestamp.fromDate(twelveMonthsAgo))
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return {
          success: true,
          deletedCount: 0,
          message: 'No old appointments found for cleanup'
        };
      }

      // Delete appointments older than 12 months
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      return {
        success: true,
        deletedCount: querySnapshot.size,
        message: `Successfully deleted ${querySnapshot.size} old appointments`
      };
    } catch (error) {
      console.error('Error cleaning up old appointments:', error);
      throw new Error('Failed to cleanup old appointments');
    }
  }

  // Daily maintenance check (should be called by scheduled function)
  async performDailyMaintenance() {
    try {
      console.log('Starting daily maintenance...');
      
      // Cleanup old appointments
      const cleanupResult = await this.cleanupOldAppointments();
      console.log('Cleanup result:', cleanupResult);
      
      // Cleanup expired temporary blocks
      const blockCleanup = await this.cleanupExpiredBlocks();
      console.log('Block cleanup result:', blockCleanup);
      
      return {
        success: true,
        message: 'Daily maintenance completed successfully',
        cleanupResults: {
          appointments: cleanupResult,
          blocks: blockCleanup
        }
      };
    } catch (error) {
      console.error('Error during daily maintenance:', error);
      throw new Error('Failed to perform daily maintenance');
    }
  }

  // Generate all available time slots (7:00 to 20:30 in 30-minute intervals)
  generateAllTimeSlots() {
    const slots = [];
    for (let hour = 7; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour <= 20) { // Include 20:30 as the final slot
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }
}

// Export singleton instance
export const firebaseService = new FirebaseService();
export default firebaseService;