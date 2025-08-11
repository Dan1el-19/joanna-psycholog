// Appointment booking functionality
import firebaseService from './firebase-service.js';
import { publicAuth } from './public-auth.js';

class AppointmentBooking {
  constructor() {
    this.form = null;
    this.submitButton = null;
    this.dateInput = null;
    this.timeSelect = null;
    this.availableSlots = new Map();
    this.sessionId = this.generateSessionId();
    this.selectedSlot = null;
    this.blockExtensionInterval = null;
    this.init();
  }

  async init() {
    // Initialize anonymous authentication first
    try {
      // Wait for publicAuth to be ready
      if (!publicAuth.isInitialized) {
        await publicAuth.init();
      }
    } catch {
      this.showMessage('Błąd połączenia. Spróbuj odświeżyć stronę.', 'error');
      this.setLoadingState(false);
      return;
    }

    // Wait for DOM to be loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupForm());
    } else {
      this.setupForm();
    }
    
    // Clean up temporary block on page unload
    window.addEventListener('beforeunload', () => {
      if (this.selectedSlot) {
        // Use sendBeacon for reliable cleanup on page unload
        navigator.sendBeacon('/api/cleanup-temp-block', JSON.stringify({
          sessionId: this.sessionId
        }));
      }
    });
  }

  setupForm() {
    this.form = document.querySelector('form');
    if (!this.form) return;

    this.submitButton = this.form.querySelector('button[type="submit"]');
    this.dateInput = this.form.querySelector('#preferred-date');
    this.timeSelect = this.form.querySelector('#preferred-time');
    
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Set up date input restrictions and availability checking
    this.setupDateRestrictions();
    
    if (this.dateInput) {
      this.dateInput.addEventListener('change', () => this.updateAvailableTimeSlots());
    }
    
    // Add time slot selection handler
    if (this.timeSelect) {
      this.timeSelect.addEventListener('change', (e) => this.handleTimeSlotSelection(e));
    }
    
    // Add service selection handler to refresh time slots when service changes
    const serviceSelect = this.form?.querySelector('#service');
    if (serviceSelect) {
      serviceSelect.addEventListener('change', () => {
        // Clear any existing temporary block since service changed
        this.clearTemporaryBlock();
        
        // Clear selected time since availability may have changed
        if (this.timeSelect) {
          this.timeSelect.value = '';
        }
        
        // Refresh time slots for new service
        if (this.dateInput?.value) {
          this.updateAvailableTimeSlots();
        }
      });
    }
  }

  setupDateRestrictions() {
    if (!this.dateInput) return;
    
    // Set minimum date to today
    const today = new Date();
    const minDate = today.toISOString().split('T')[0];
    this.dateInput.min = minDate;
    
    // Set maximum date to 30 days from now
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 30);
    this.dateInput.max = maxDate.toISOString().split('T')[0];
    
    // Disable weekends using onchange validation
    this.dateInput.addEventListener('input', (e) => {
      const selectedDate = new Date(e.target.value);
      const dayOfWeek = selectedDate.getDay();
      
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        this.showMessage('Proszę wybrać termin od poniedziałku do piątku.', 'error');
        e.target.value = '';
        this.clearTimeSlots();
      }
    });
  }

  async updateAvailableTimeSlots() {
    if (!this.dateInput.value || !this.timeSelect) return;
    
    try {
      // Show loading state for time select
      this.timeSelect.disabled = true;
      this.timeSelect.innerHTML = '<option value="">Ładowanie dostępnych godzin...</option>';
      
      // Get available time slots for selected date (excluding our session)
      const slots = await firebaseService.getAvailableTimeSlots(this.dateInput.value, this.sessionId);
      
      // Clear existing options
      this.timeSelect.innerHTML = '<option value="">Wybierz godzinę</option>';
      
      // Get currently selected service to provide specific availability info
      const serviceSelect = this.form?.querySelector('#service');
      const selectedService = serviceSelect?.value;
      
      // Add available time slots
      slots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot.time;
        option.textContent = slot.time;
        
        // Check if this slot is available for the currently selected service
        let isAvailableForSelectedService = slot.isAvailable;
        if (selectedService && slot.serviceAvailability) {
          isAvailableForSelectedService = slot.serviceAvailability[selectedService];
        }
        
        if (!isAvailableForSelectedService) {
          option.disabled = true;
          
          if (slot.isTemporarilyBlocked) {
            option.textContent += ' (tymczasowo zajęte)';
          } else if (slot.isBooked) {
            option.textContent += ' (zajęte)';
          } else if (selectedService && slot.serviceAvailability && !slot.serviceAvailability[selectedService]) {
            // Specific service not available due to duration conflict
            option.textContent += ' (konflikt z inną sesją)';
          } else {
            option.textContent += ' (niedostępne)';
          }
          option.style.color = '#999';
        } else if (slot.serviceAvailability && !selectedService) {
          // No service selected yet - show general availability info
          const availableServices = [];
          const unavailableServices = [];
          
          if (unavailableServices.length > 0 && availableServices.length > 0) {
            option.textContent += ` (dostępne dla: ${availableServices.join(', ')})`;
            option.style.color = '#d97706'; // Orange color for limited availability
          }
        }
        
        this.timeSelect.appendChild(option);
      });
      
      // Re-enable time select
      this.timeSelect.disabled = false;
      
      // Store available slots for validation
      this.availableSlots.set(this.dateInput.value, slots);
      
    } catch (error) {
      console.error('Error loading available time slots:', error);
      this.showMessage('Błąd podczas ładowania dostępnych godzin. Spróbuj ponownie.', 'error');
      this.clearTimeSlots();
    }
  }


  async handleSubmit(event) {
    event.preventDefault();
    
    if (!this.form) return;

    // Ensure user is authenticated
    try {
      await publicAuth.ensureAuthenticated();
    } catch {
      this.showMessage('Błąd połączenia. Spróbuj odświeżyć stronę.', 'error');
      this.setLoadingState(false);
      return;
    }

    // Disable submit button and show loading state
    this.setLoadingState(true);

    try {
      // Get form data
      const formData = new FormData(this.form);
      const appointmentData = {
        name: formData.get('name'),
        email: formData.get('email'),
        service: formData.get('service'),
        preferredDate: formData.get('preferred-date'),
        preferredTime: formData.get('preferred-time'),
        message: formData.get('message')
      };

      // Sanitize data
      const sanitizedData = firebaseService.sanitizeAppointmentData(appointmentData);
      
      // Validate sanitized data
      const validation = await firebaseService.validateAppointmentData(sanitizedData);
      if (!validation.isValid) {
        this.showMessage(validation.errors.join('<br>'), 'error');
        return;
      }
      
      // Check privacy policy checkbox
      const privacyPolicyCheckbox = this.form.querySelector('#privacy-policy');
      if (!privacyPolicyCheckbox || !privacyPolicyCheckbox.checked) {
        this.showMessage('Musisz zaakceptować politykę prywatności, aby wysłać formularz.', 'error');
        if (privacyPolicyCheckbox) {
          privacyPolicyCheckbox.focus();
          privacyPolicyCheckbox.classList.add('border-red-500');
          setTimeout(() => privacyPolicyCheckbox.classList.remove('border-red-500'), 3000);
        }
        return;
      }


      // Validate that time is selected (critical requirement)
      if (!sanitizedData.preferredTime || sanitizedData.preferredTime.trim() === '') {
        this.showMessage('Proszę wybrać godzinę wizyty. Godzina jest wymagana do przesłania formularza.', 'error');
        
        // Highlight the time field or calendar
        const timeSelect = document.getElementById('preferred-time');
        if (timeSelect && timeSelect.style.display !== 'none') {
          timeSelect.focus();
          timeSelect.classList.add('border-red-500');
          setTimeout(() => timeSelect.classList.remove('border-red-500'), 3000);
        } else {
          // If calendar is visible, show message about selecting time from calendar
          const calendarInterface = document.getElementById('appointment-calendar');
          if (calendarInterface && !calendarInterface.classList.contains('hidden')) {
            this.showMessage('Proszę wybrać datę z kalendarza, a następnie godzinę z dostępnych terminów.', 'error');
          }
        }
        return;
      }

      // Additional validation: Check if selected time slot is still available with duration consideration
      if (sanitizedData.preferredDate && sanitizedData.preferredTime && sanitizedData.service) {
        const isAvailable = await firebaseService.isTimeSlotAvailableWithDuration(
          sanitizedData.preferredDate,
          sanitizedData.preferredTime,
          sanitizedData.service,
          this.sessionId
        );
        
        if (!isAvailable) {
          this.showMessage('Wybrany termin jest już zajęty lub koliduje z inną sesją. Proszę wybrać inny termin.', 'error');
          // Refresh available slots for current date
          await this.updateAvailableTimeSlots();
          return;
        }
      }

      // Submit to Firebase with session ID
      const response = await firebaseService.submitAppointment(sanitizedData, this.sessionId);
      
      if (response.success) {
        // Cloud Functions will automatically send confirmation emails
        this.showMessage('Dziękuję! Twoje zgłoszenie zostało wysłane.', 'success');
        this.form.reset();
        this.clearTimeSlots();
        this.clearTemporaryBlock();
        
        // Refresh calendar to show updated availability
        if (window.calendarInterface) {
          window.calendarInterface.onAppointmentMade();
        }
        
        // Scroll to top of page after a small delay to ensure message is rendered
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      } else {
        throw new Error(response.message || 'Wystąpił błąd podczas wysyłania zgłoszenia.');
      }

    } catch (error) {
      console.error('Error submitting appointment:', error);
      
      // Show specific error message if it's about time slot availability
      if (error.message.includes('time slot')) {
        this.showMessage('Wybrany termin jest już zajęty. Proszę wybrać inny termin.', 'error');
        await this.updateAvailableTimeSlots();
      } else {
        this.showMessage('Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później.', 'error');
      }
    } finally {
      this.setLoadingState(false);
    }
  }
  
  // Generate unique session ID
  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
  
  // Handle time slot selection
  async handleTimeSlotSelection(event) {
    const selectedTime = event.target.value;
    const selectedDate = this.dateInput?.value;
    
    if (!selectedTime || !selectedDate) {
      this.clearTemporaryBlock();
      return;
    }
    
    // Check if a service is selected for duration-aware validation
    const serviceSelect = this.form?.querySelector('#service');
    const selectedService = serviceSelect?.value;
    
    if (selectedService) {
      // Validate that this time slot is available for the selected service type
      try {
        const isAvailable = await firebaseService.isTimeSlotAvailableWithDuration(
          selectedDate,
          selectedTime,
          selectedService,
          this.sessionId
        );
        
        if (!isAvailable) {
          this.showMessage('Wybrany termin nie jest dostępny dla tego typu terapii. Wybierz inny termin.', 'error');
          event.target.value = '';
          return;
        }
      } catch {
        console.warn('Could not validate service-specific availability');
      }
    }
    
    try {
      // Create temporary block for selected slot
      const blockResult = await firebaseService.createTemporaryBlock(
        selectedDate,
        selectedTime,
        this.sessionId
      );
      
      if (blockResult.success) {
        this.selectedSlot = {
          date: selectedDate,
          time: selectedTime,
          blockId: blockResult.blockId,
          expiresAt: blockResult.expiresAt
        };
        
        // Set up periodic extension of the block
        this.setupBlockExtension();
        
        // Show user feedback
        this.showMessage(
          `Termin ${selectedTime} w dniu ${selectedDate} został tymczasowo zarezerwowany na 10 minut.`,
          'info'
        );
      }
    } catch (error) {
      console.warn('Could not create temporary block (continuing without it):', error);
      
      // Continue without temporary blocking if it fails
      this.selectedSlot = {
        date: selectedDate,
        time: selectedTime,
        blockId: null,
        expiresAt: null
      };
      
      // If slot is no longer available, refresh the time slots
      if (error.message.includes('no longer available')) {
        this.showMessage('Wybrany termin jest już zajęty. Wybierz inny termin.', 'error');
        await this.updateAvailableTimeSlots();
        event.target.value = '';
      }
    }
  }
  
  // Setup automatic block extension
  setupBlockExtension() {
    // Clear existing interval
    if (this.blockExtensionInterval) {
      clearInterval(this.blockExtensionInterval);
    }
    
    // Extend block every 8 minutes (before the 10-minute expiry)
    this.blockExtensionInterval = setInterval(async () => {
      if (this.selectedSlot && this.selectedSlot.blockId) {
        try {
          await firebaseService.extendTemporaryBlock(this.sessionId);
        } catch (error) {
          console.warn('Could not extend temporary block:', error);
          // Continue without extending - don't clear selection
        }
      }
    }, 8 * 60 * 1000); // 8 minutes
  }
  
  // Clear temporary block
  clearTemporaryBlock() {
    if (this.selectedSlot && this.selectedSlot.blockId) {
      firebaseService.removeTemporaryBlock(this.sessionId).catch(error => {
        console.warn('Could not remove temporary block:', error);
      });
    }
    
    this.selectedSlot = null;
    
    if (this.blockExtensionInterval) {
      clearInterval(this.blockExtensionInterval);
      this.blockExtensionInterval = null;
    }
  }
  
  // Clear time slots and temporary block
  clearTimeSlots() {
    if (this.timeSelect) {
      this.timeSelect.innerHTML = '<option value="">Wybierz godzinę</option>';
      this.timeSelect.disabled = false;
    }
    this.clearTemporaryBlock();
  }

  // This method is now handled by firebaseService.submitAppointment()
  // Keeping for backward compatibility, but it's no longer used

  setLoadingState(isLoading) {
    if (!this.submitButton) return;

    if (isLoading) {
      this.submitButton.disabled = true;
      this.submitButton.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Wysyłanie...
      `;
    } else {
      this.submitButton.disabled = false;
      this.submitButton.innerHTML = 'Wyślij zapytanie';
    }
  }

  showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessage = document.querySelector('.appointment-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `appointment-message p-4 rounded-lg mb-6 ${this.getMessageClasses(type)}`;
    messageDiv.innerHTML = `
      <div class="flex">
        <div class="flex-shrink-0">
          ${this.getMessageIcon(type)}
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium">${message}</p>
        </div>
      </div>
    `;

    // Insert before form
    if (this.form) {
      this.form.parentNode.insertBefore(messageDiv, this.form);
    }

    // Auto-remove success messages after 10 seconds
    if (type === 'success') {
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 10000);
    }
  }

  getMessageClasses(type) {
    switch (type) {
      case 'success':
        return 'bg-green-50 border border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border border-red-200 text-red-800';
      default:
        return 'bg-blue-50 border border-blue-200 text-blue-800';
    }
  }

  getMessageIcon(type) {
    switch (type) {
      case 'success':
        return `
          <svg class="w-5 h-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        `;
      case 'error':
        return `
          <svg class="w-5 h-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        `;
      default:
        return `
          <svg class="w-5 h-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        `;
    }
  }

  // Email validation is now handled by firebaseService
  // Keeping for backward compatibility
  isValidEmail(email) {
    return firebaseService.isValidEmail(email);
  }
}

// Initialize appointment booking only on pages with appointment form
if (document.querySelector('form') && document.querySelector('#preferred-date')) {
  new AppointmentBooking();
}