// Appointment booking functionality
import firebaseService from './firebase-service.js';

class AppointmentBooking {
  constructor() {
    this.form = null;
    this.submitButton = null;
    this.init();
  }

  init() {
    // Wait for DOM to be loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupForm());
    } else {
      this.setupForm();
    }
  }

  setupForm() {
    this.form = document.querySelector('form');
    if (!this.form) return;

    this.submitButton = this.form.querySelector('button[type="submit"]');
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  async handleSubmit(event) {
    event.preventDefault();
    
    if (!this.form) return;

    // Disable submit button and show loading state
    this.setLoadingState(true);

    try {
      // Get form data
      const formData = new FormData(this.form);
      const appointmentData = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        service: formData.get('service'),
        preferredDate: formData.get('preferred-date'),
        preferredTime: formData.get('preferred-time'),
        message: formData.get('message')
      };

      // Sanitize data
      const sanitizedData = firebaseService.sanitizeAppointmentData(appointmentData);
      
      // Validate data
      const validation = firebaseService.validateAppointmentData(sanitizedData);
      if (!validation.isValid) {
        this.showMessage(validation.errors.join('<br>'), 'error');
        return;
      }

      // Submit to Firebase
      const response = await firebaseService.submitAppointment(sanitizedData);
      
      if (response.success) {
        // Cloud Functions will automatically send confirmation emails
        this.showMessage('Dziękuję! Twoje zgłoszenie zostało wysłane. Skontaktuję się z Tobą w ciągu 24 godzin.', 'success');
        this.form.reset();
      } else {
        throw new Error(response.message || 'Wystąpił błąd podczas wysyłania zgłoszenia.');
      }

    } catch (error) {
      console.error('Error submitting appointment:', error);
      this.showMessage('Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później.', 'error');
    } finally {
      this.setLoadingState(false);
    }
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

// Initialize appointment booking when script loads
new AppointmentBooking();