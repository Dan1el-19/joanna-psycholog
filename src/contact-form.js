// Contact form functionality
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
    submitButton.innerHTML = `
      <svg class="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
      </svg>
      Wysyłanie...
    `;
    
    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      // Validate required fields
      if (!data.name || !data.email || !data.subject || !data.message || !data.privacy) {
        throw new Error('Proszę wypełnić wszystkie wymagane pola i zaakceptować politykę prywatności.');
      }
      
      // Firebase config - using the correct project configuration
      const firebaseConfig = {
        apiKey: "AIzaSyA3v9KK7hqhZOv2r1fg3raeCWfOjDYSAKY",
        authDomain: "joanna-psycholog.firebaseapp.com",
        projectId: "joanna-psycholog",
        storageBucket: "joanna-psycholog.firebasestorage.app",
        messagingSenderId: "1064648871285",
        appId: "1:1064648871285:web:50dccd6147aba48571973c"
      };
      
      // Initialize Firebase
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      
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
      submitButton.innerHTML = originalText;
    }
  }

  showToast(message, type = 'info') {
    // Remove existing toasts
    document.querySelectorAll('.contact-toast').forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `contact-toast fixed top-5 right-5 p-4 rounded-lg shadow-lg z-50 max-w-md ${
      type === 'success' ? 'bg-green-100 border border-green-200 text-green-800' :
      type === 'error' ? 'bg-red-100 border border-red-200 text-red-800' :
      'bg-blue-100 border border-blue-200 text-blue-800'
    }`;
    
    toast.innerHTML = `
      <div class="flex items-start">
        <div class="flex-shrink-0">
          ${type === 'success' ? 
            '<svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' :
            type === 'error' ?
            '<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>' :
            '<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
          }
        </div>
        <div class="ml-3 flex-1">
          <p class="text-sm font-medium">${message}</p>
        </div>
        <div class="ml-4 flex-shrink-0">
          <button onclick="this.closest('.contact-toast').remove()" class="inline-flex text-gray-400 hover:text-gray-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 6 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 6000);
  }
}

// Initialize contact form
new ContactForm();
export default ContactForm;