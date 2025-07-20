// Schedule management service
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
import { db } from './firebase-config.js';

class ScheduleService {
  constructor() {
    this.templatesCollection = collection(db, 'scheduleTemplates');
    this.monthlySchedulesCollection = collection(db, 'monthlySchedules');
    this.blockedSlotsCollection = collection(db, 'blockedSlots');
    this.reservationTokensCollection = collection(db, 'reservationTokens');
    this.templateAssignmentsCollection = collection(db, 'templateAssignments');
  }

  // Schedule Templates
  async createScheduleTemplate(templateData) {
    try {
      const docData = {
        ...templateData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(this.templatesCollection, docData);
      
      // Clear any cache after creating template
      if (window.firebaseService) {
        window.firebaseService.slotsCache.clear();
      }
      
      return {
        success: true,
        templateId: docRef.id,
        message: 'Schedule template created successfully'
      };
    } catch (error) {
      console.error('Error creating schedule template:', error);
      throw new Error('Failed to create schedule template');
    }
  }

  async getScheduleTemplates() {
    try {
      const q = query(this.templatesCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const templates = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        templates.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        });
      });

      return {
        success: true,
        templates
      };
    } catch (error) {
      console.error('Error fetching schedule templates:', error);
      throw new Error('Failed to fetch schedule templates');
    }
  }

  async getScheduleTemplate(templateId) {
    try {
      const templateRef = doc(db, 'scheduleTemplates', templateId);
      const docSnap = await getDoc(templateRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          success: true,
          template: {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate()
          }
        };
      } else {
        throw new Error('Template not found');
      }
    } catch (error) {
      console.error('Error fetching schedule template:', error);
      throw new Error('Failed to fetch schedule template');
    }
  }

  async updateScheduleTemplate(templateId, updateData) {
    try {
      const templateRef = doc(db, 'scheduleTemplates', templateId);
      
      const dataToUpdate = {
        ...updateData,
        updatedAt: Timestamp.now()
      };

      await updateDoc(templateRef, dataToUpdate);
      
      return {
        success: true,
        message: 'Schedule template updated successfully'
      };
    } catch (error) {
      console.error('Error updating schedule template:', error);
      throw new Error('Failed to update schedule template');
    }
  }

  async deleteScheduleTemplate(templateId) {
    try {
      const templateRef = doc(db, 'scheduleTemplates', templateId);
      await deleteDoc(templateRef);
      
      return {
        success: true,
        message: 'Schedule template deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting schedule template:', error);
      throw new Error('Failed to delete schedule template');
    }
  }

  // Monthly Schedules
  async generateMonthlySchedule(year, month, templateId) {
    try {
      // Get template
      const templates = await this.getScheduleTemplates();
      const template = templates.templates.find(t => t.id === templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      // Check if schedule already exists
      const existingSchedule = await this.getMonthlySchedule(year, month);
      if (existingSchedule.schedule) {
        throw new Error('Schedule for this month already exists');
      }

      // Generate schedule
      const monthlyScheduleData = {
        year,
        month,
        templateId,
        customSlots: [],
        blockedSlots: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(this.monthlySchedulesCollection, monthlyScheduleData);
      
      // Clear cache after generating monthly schedule
      if (window.firebaseService) {
        window.firebaseService.slotsCache.clear();
      }
      
      return {
        success: true,
        scheduleId: docRef.id,
        message: 'Monthly schedule generated successfully'
      };
    } catch (error) {
      console.error('Error generating monthly schedule:', error);
      throw new Error(error.message || 'Failed to generate monthly schedule');
    }
  }

  async getMonthlySchedule(year, month) {
    try {
      const q = query(
        this.monthlySchedulesCollection,
        where('year', '==', year),
        where('month', '==', month),
        firestoreLimit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return {
          success: true,
          schedule: null
        };
      }

      const scheduleDoc = querySnapshot.docs[0];
      const data = scheduleDoc.data();
      
      const schedule = {
        id: scheduleDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      };

      return {
        success: true,
        schedule
      };
    } catch (error) {
      console.error('Error fetching monthly schedule:', error);
      throw new Error('Failed to fetch monthly schedule');
    }
  }

  async updateMonthlySchedule(scheduleId, updateData) {
    try {
      const scheduleRef = doc(db, 'monthlySchedules', scheduleId);
      
      const dataToUpdate = {
        ...updateData,
        updatedAt: Timestamp.now()
      };

      await updateDoc(scheduleRef, dataToUpdate);
      
      return {
        success: true,
        message: 'Monthly schedule updated successfully'
      };
    } catch (error) {
      console.error('Error updating monthly schedule:', error);
      throw new Error('Failed to update monthly schedule');
    }
  }

  // Blocked Slots
  async createBlockedSlot(blockData) {
    try {
      const docData = {
        ...blockData,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(this.blockedSlotsCollection, docData);
      
      // Clear cache in firebase service to reflect new blocks
      if (window.firebaseService && window.firebaseService.slotsCache) {
        window.firebaseService.slotsCache.clear();
      }
      
      return {
        success: true,
        blockId: docRef.id,
        message: 'Slot blocked successfully'
      };
    } catch (error) {
      console.error('Error creating blocked slot:', error);
      throw new Error('Failed to block slot');
    }
  }

  async getBlockedSlots(startDate, endDate) {
    try {
      let q;
      if (startDate && endDate) {
        q = query(
          this.blockedSlotsCollection,
          where('startDate', '>=', startDate),
          where('startDate', '<=', endDate),
          orderBy('startDate', 'asc')
        );
      } else {
        q = query(this.blockedSlotsCollection, orderBy('startDate', 'asc'));
      }
      
      const querySnapshot = await getDocs(q);
      const blockedSlots = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        blockedSlots.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate()
        });
      });

      return {
        success: true,
        blockedSlots
      };
    } catch (error) {
      console.error('Error fetching blocked slots:', error);
      throw new Error('Failed to fetch blocked slots');
    }
  }

  async deleteBlockedSlot(blockId) {
    try {
      const blockRef = doc(db, 'blockedSlots', blockId);
      await deleteDoc(blockRef);
      
      // Clear cache in firebase service to reflect removed blocks
      if (window.firebaseService && window.firebaseService.slotsCache) {
        window.firebaseService.slotsCache.clear();
      }
      
      return {
        success: true,
        message: 'Blocked slot removed successfully'
      };
    } catch (error) {
      console.error('Error deleting blocked slot:', error);
      throw new Error('Failed to remove blocked slot');
    }
  }

  // Utility methods for calendar generation
  getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  getDayOfWeek(year, month, day) {
    const date = new Date(year, month - 1, day);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  async getAvailableSlotsForMonth(year, month) {
    try {
      // First check for template assignment
      let templateToUse = null;
      try {
        const templateAssignment = await this.getTemplateForMonth(year, month);
        if (templateAssignment.success) {
          // Get the assigned template
          const templates = await this.getScheduleTemplates();
          templateToUse = templates.templates.find(t => t.id === templateAssignment.templateId);
        }
      } catch (assignmentError) {
        console.warn('Error checking template assignment:', assignmentError);
      }

      // Get monthly schedule
      let monthlyScheduleResult = await this.getMonthlySchedule(year, month);
      if (!monthlyScheduleResult.schedule) {
        // Only auto-generate schedule if there is an assigned template
        if (templateToUse) {
          try {
            await this.generateMonthlySchedule(year, month, templateToUse.id);
            
            // Retry getting the monthly schedule
            monthlyScheduleResult = await this.getMonthlySchedule(year, month);
            if (!monthlyScheduleResult.schedule) {
              return {
                success: true,
                slots: [],
                message: 'Could not auto-generate monthly schedule'
              };
            }
          } catch (generationError) {
            console.warn('Error generating monthly schedule:', generationError);
            return {
              success: true,
              slots: [],
              message: 'Could not generate monthly schedule'
            };
          }
        } else {
          // No template assigned for this month - return empty slots
          return {
            success: true,
            slots: [],
            message: 'No template assigned for this month'
          };
        }
      }

      const monthlySchedule = monthlyScheduleResult.schedule;
      
      // Use the assigned template that was already determined
      if (!templateToUse) {
        return {
          success: true,
          slots: [],
          message: 'No template assigned for this month'
        };
      }

      // Generate slots based on the template and monthly schedule
      const slots = [];
      const template = templateToUse;
      
      // Get global blocked slots for this month
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}`;
      
      let globalBlockedSlots = [];
      try {
        const blockedSlotsResult = await this.getBlockedSlots(startDate, endDate);
        if (blockedSlotsResult.success) {
          globalBlockedSlots = blockedSlotsResult.blockedSlots;
        }
      } catch (blockError) {
        console.warn('Error fetching global blocked slots:', blockError);
      }
      
      // Get number of days in the month
      const daysInMonth = new Date(year, month, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const dayOfWeek = new Date(year, month - 1, day).getDay();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        
        // Get available times for this day from template
        const daySchedule = template.schedule[dayName] || [];
        
        // Check if this day is blocked in monthly schedule
        const isDateBlockedInMonthly = monthlySchedule.blockedSlots && 
                                      monthlySchedule.blockedSlots.some(blocked => 
                                        blocked.date === date && (!blocked.time || blocked.allDay));
        
        // Check if this day is globally blocked (all day blocks)
        const isDateBlockedGlobally = globalBlockedSlots.some(blocked => {
          const blockStartDate = blocked.startDate;
          const blockEndDate = blocked.endDate || blocked.startDate;
          return date >= blockStartDate && date <= blockEndDate && 
                 (blocked.isAllDay || (!blocked.startTime && !blocked.endTime));
        });
        
        const isDateBlocked = isDateBlockedInMonthly || isDateBlockedGlobally;
        
        if (!isDateBlocked && daySchedule.length > 0) {
          // Add available time slots for this day
          daySchedule.forEach(time => {
            // Check if this specific time slot is blocked in monthly schedule
            const isTimeBlockedInMonthly = monthlySchedule.blockedSlots && 
                                          monthlySchedule.blockedSlots.some(blocked => 
                                            blocked.date === date && blocked.time === time);
            
            // Check if this specific time slot is globally blocked
            const isTimeBlockedGlobally = globalBlockedSlots.some(blocked => {
              const blockStartDate = blocked.startDate;
              const blockEndDate = blocked.endDate || blocked.startDate;
              
              // Check if date is in the blocked range
              const isDateInRange = date >= blockStartDate && date <= blockEndDate;
              
              if (!isDateInRange) return false;
              
              // If it's an all-day block, this time is blocked
              if (blocked.isAllDay || (!blocked.startTime && !blocked.endTime)) {
                return true;
              }
              
              // Check if the time falls within the blocked time range
              if (blocked.startTime && blocked.endTime) {
                return time >= blocked.startTime && time <= blocked.endTime;
              }
              
              return false;
            });
            
            const isTimeBlocked = isTimeBlockedInMonthly || isTimeBlockedGlobally;
            
            if (!isTimeBlocked) {
              slots.push({
                date,
                time,
                isAvailable: true,
                isBlocked: false,
                dayOfWeek,
                templateId: template.id
              });
            }
          });
        }
      }

      return {
        success: true,
        slots
      };
    } catch (error) {
      console.error('Error getting available slots for month:', error);
      throw new Error('Failed to get available slots');
    }
  }

  // Reservation tokens
  async generateReservationToken(appointmentId) {
    try {
      const token = this.generateUniqueToken();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 6); // Token expires in 6 months
      
      const tokenData = {
        appointmentId,
        token,
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: Timestamp.now(),
        isUsed: false
      };

      const docRef = await addDoc(this.reservationTokensCollection, tokenData);
      
      return {
        success: true,
        token,
        tokenId: docRef.id
      };
    } catch (error) {
      console.error('Error generating reservation token:', error);
      throw new Error('Failed to generate reservation token');
    }
  }

  async validateReservationToken(token) {
    try {
      // Check token directly on appointment documents (more reliable)
      const appointmentQuery = query(
        collection(db, 'appointments'),
        where('reservationToken', '==', token),
        firestoreLimit(1)
      );
      
      const appointmentSnapshot = await getDocs(appointmentQuery);
      
      if (appointmentSnapshot.empty) {
        return {
          success: false,
          message: 'Invalid or expired token'
        };
      }

      const appointmentDoc = appointmentSnapshot.docs[0];
      const appointmentData = appointmentDoc.data();
      
      // Check if token is expired (6 months from creation)
      const now = new Date();
      const tokenExpiresAt = appointmentData.tokenExpiresAt?.toDate();
      
      if (tokenExpiresAt && now > tokenExpiresAt) {
        return {
          success: false,
          message: 'Token has expired'
        };
      }

      return {
        success: true,
        tokenData: {
          appointmentId: appointmentDoc.id,
          token: appointmentData.reservationToken,
          expiresAt: tokenExpiresAt,
          createdAt: appointmentData.createdAt?.toDate()
        }
      };
    } catch (error) {
      console.error('Error validating reservation token:', error);
      throw new Error('Failed to validate token');
    }
  }

  generateUniqueToken() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Template Assignments - assign templates to specific months/periods
  async createTemplateAssignment(assignmentData) {
    try {
      const docData = {
        ...assignmentData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(this.templateAssignmentsCollection, docData);
      
      return {
        success: true,
        assignmentId: docRef.id,
        message: 'Template assignment created successfully'
      };
    } catch (error) {
      console.error('Error creating template assignment:', error);
      throw new Error('Failed to create template assignment');
    }
  }

  async getTemplateAssignments() {
    try {
      // Simple query without complex ordering to avoid index issues
      const querySnapshot = await getDocs(this.templateAssignmentsCollection);
      const assignments = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        assignments.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        });
      });

      // Sort client-side instead
      assignments.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month === null && b.month === null) return 0;
        if (a.month === null) return -1;
        if (b.month === null) return 1;
        return b.month - a.month;
      });

      return {
        success: true,
        assignments
      };
    } catch (error) {
      console.error('Error fetching template assignments:', error);
      throw new Error('Failed to fetch template assignments');
    }
  }

  async updateTemplateAssignment(assignmentId, updateData) {
    try {
      const assignmentRef = doc(db, 'templateAssignments', assignmentId);
      
      const dataToUpdate = {
        ...updateData,
        updatedAt: Timestamp.now()
      };

      await updateDoc(assignmentRef, dataToUpdate);
      
      return {
        success: true,
        message: 'Template assignment updated successfully'
      };
    } catch (error) {
      console.error('Error updating template assignment:', error);
      throw new Error('Failed to update template assignment');
    }
  }

  async deleteTemplateAssignment(assignmentId) {
    try {
      const assignmentRef = doc(db, 'templateAssignments', assignmentId);
      await deleteDoc(assignmentRef);
      
      return {
        success: true,
        message: 'Template assignment deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting template assignment:', error);
      throw new Error('Failed to delete template assignment');
    }
  }

  async getTemplateForMonth(year, month) {
    try {
      // First check for specific month assignment
      const monthQuery = query(
        this.templateAssignmentsCollection,
        where('year', '==', year),
        where('month', '==', month),
        firestoreLimit(1)
      );
      
      const monthSnapshot = await getDocs(monthQuery);
      
      if (!monthSnapshot.empty) {
        const assignment = monthSnapshot.docs[0].data();
        return {
          success: true,
          templateId: assignment.templateId,
          assignmentType: 'specific'
        };
      }

      // If no specific month assignment, check for year assignment
      const yearQuery = query(
        this.templateAssignmentsCollection,
        where('year', '==', year),
        where('month', '==', null),
        firestoreLimit(1)
      );
      
      const yearSnapshot = await getDocs(yearQuery);
      
      if (!yearSnapshot.empty) {
        const assignment = yearSnapshot.docs[0].data();
        return {
          success: true,
          templateId: assignment.templateId,
          assignmentType: 'yearly'
        };
      }

      // If no assignment found, return default
      return {
        success: false,
        message: 'No template assignment found for this period'
      };
      
    } catch (error) {
      console.error('Error getting template for month:', error);
      throw new Error('Failed to get template for month');
    }
  }

  async assignTemplateToMonths(templateId, assignments) {
    try {
      const promises = assignments.map(assignment => {
        const assignmentData = {
          templateId,
          year: assignment.year,
          month: assignment.month || null, // null for yearly assignments
          description: assignment.description || ''
        };
        return this.createTemplateAssignment(assignmentData);
      });

      await Promise.all(promises);

      return {
        success: true,
        message: 'Template assignments created successfully'
      };
    } catch (error) {
      console.error('Error assigning template to months:', error);
      throw new Error('Failed to assign template to months');
    }
  }
}

// Export singleton instance
export const scheduleService = new ScheduleService();
export default scheduleService;