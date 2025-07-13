// Firebase service for appointment booking
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  where, 
  limit as firestoreLimit,
  Timestamp 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase-config.js';

class FirebaseService {
  constructor() {
    this.appointmentsCollection = collection(db, 'appointments');
  }

  // Submit appointment using Firestore directly
  async submitAppointmentDirect(appointmentData) {
    try {
      const docData = {
        ...appointmentData,
        status: 'pending',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(this.appointmentsCollection, docData);
      
      return {
        success: true,
        appointmentId: docRef.id,
        message: 'Appointment submitted successfully'
      };
    } catch (error) {
      console.error('Error submitting appointment:', error);
      throw new Error('Failed to submit appointment');
    }
  }

  // Submit appointment using Cloud Function (recommended for email notifications)
  async submitAppointment(appointmentData) {
    try {
      // Use the REST API approach as fallback
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error with API call, trying direct Firestore:', error);
      // Fallback to direct Firestore if API fails
      return await this.submitAppointmentDirect(appointmentData);
    }
  }

  // Get appointments (admin function)
  async getAppointments(options = {}) {
    try {
      const { status, limit = 50 } = options;
      
      let q = query(
        this.appointmentsCollection, 
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );
      
      if (status) {
        q = query(
          this.appointmentsCollection,
          where('status', '==', status),
          orderBy('createdAt', 'desc'),
          firestoreLimit(limit)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const appointments = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        appointments.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        });
      });

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

    const validServices = ['terapia-indywidualna', 'terapia-par', 'konsultacje-online'];
    if (data.service && !validServices.includes(data.service)) {
      errors.push('Invalid service selection');
    }

    if (data.phone && data.phone.length > 0 && data.phone.length < 9) {
      errors.push('Phone number must be at least 9 digits');
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

  // Sanitize input data
  sanitizeAppointmentData(data) {
    return {
      name: data.name?.trim() || '',
      email: data.email?.trim().toLowerCase() || '',
      phone: data.phone?.trim() || '',
      service: data.service || '',
      preferredDate: data.preferredDate || '',
      preferredTime: data.preferredTime || '',
      message: data.message?.trim() || ''
    };
  }
}

// Export singleton instance
export const firebaseService = new FirebaseService();
export default firebaseService;