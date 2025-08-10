// Contact form functionality
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase-config.js';

class ContactForm {
  constructor() {
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
      contactForm.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    // Show loading state
    submitButton.disabled = true;
    submitButton.classList.add('opacity-75', 'cursor-not-allowed');
    submitButton.innerHTML = `
      <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
      </svg>
      <span class="text-sm sm:text-base">Wysyłanie...</span>
    `;
    
    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      // Validate required fields
      if (!data.name || !data.email || !data.subject || !data.message || !data.privacy) {
        throw new Error('Proszę wypełnić wszystkie wymagane pola i zaakceptować politykę prywatności.');
      }
      
      // Firebase configuration already imported
      
      // Prepare message data
      const messageData = {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone ? data.phone.trim() : null,
        subject: data.subject,
        message: data.message.trim(),
        createdAt: serverTimestamp(),
        processed: false,
        userAgent: navigator.userAgent,
        referrer: document.referrer || 'direct'
      };
      
      // Save to Firestore (this will trigger the Cloud Function)
      await addDoc(collection(db, 'contactMessages'), messageData);
      
      // Show success message
      this.showToast('Wiadomość została wysłana pomyślnie! Odpowiem w ciągu 24 godzin.', 'success');
      
      // Reset form
      form.reset();
      
    } catch (error) {
      console.error('Error sending message:', error);
      this.showToast('Wystąpił błąd podczas wysyłania wiadomości. Spróbuj ponownie lub skontaktuj się bezpośrednio przez email.', 'error');
    } finally {
      // Restore button
      submitButton.disabled = false;
      submitButton.classList.remove('opacity-75', 'cursor-not-allowed');
      submitButton.innerHTML = originalText;
    }
  }

  showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 translate-x-full`;
    
    // Set toast content based on type
    const icon = this.getToastIcon(type);
    const bgColor = this.getToastBgColor(type);
    const textColor = this.getToastTextColor(type);
    
    toast.innerHTML = `
      <div class="flex items-center ${bgColor} ${textColor} p-3 rounded-lg">
        <div class="flex-shrink-0 mr-3">
          ${icon}
        </div>
        <div class="flex-1 text-sm font-medium">
          ${message}
        </div>
        <button class="ml-3 flex-shrink-0 text-current hover:opacity-75" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.classList.remove('translate-x-full');
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('translate-x-full');
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
  }

  getToastIcon(type) {
    switch (type) {
      case 'success':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>`;
      case 'error':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>`;
      case 'warning':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>`;
      default:
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`;
    }
  }

  getToastBgColor(type) {
    switch (type) {
      case 'success':
        return 'bg-green-50 border border-green-200';
      case 'error':
        return 'bg-red-50 border border-red-200';
      case 'warning':
        return 'bg-yellow-50 border border-yellow-200';
      default:
        return 'bg-blue-50 border border-blue-200';
    }
  }

  getToastTextColor(type) {
    switch (type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      default:
        return 'text-blue-800';
    }
  }
}

// Initialize contact form only on pages with contact form
if (document.getElementById('contact-form')) {
  new ContactForm();
}