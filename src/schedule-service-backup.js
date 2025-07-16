// Backup of proper getAvailableSlotsForMonth method
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
      const isDateBlocked = monthlySchedule.blockedSlots && 
                           monthlySchedule.blockedSlots.some(blocked => 
                             blocked.date === date && (!blocked.time || blocked.allDay));
      
      if (!isDateBlocked && daySchedule.length > 0) {
        // Add available time slots for this day
        daySchedule.forEach(time => {
          // Check if this specific time slot is blocked
          const isTimeBlocked = monthlySchedule.blockedSlots && 
                               monthlySchedule.blockedSlots.some(blocked => 
                                 blocked.date === date && blocked.time === time);
          
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