// Reservation management interface for clients
import scheduleService from './schedule-service.js';
import firebaseService from './firebase-service.js';
import { publicAuth } from './public-auth.js';
import pricingService from './pricing-service.js'

class ReservationManagement {
  constructor() {
    this.token = null;
    this.appointment = null;
    this.isRescheduleMode = false;
    this.rescheduleSelectedDate = null;
    this.rescheduleSelectedTime = null;
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();
    this.availableSlots = [];
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async setup() {
    // Get token from URL
    this.token = this.getTokenFromURL();
    
    if (!this.token) {
      this.showError('Nieprawidłowy link zarządzania rezerwacją');
      return;
    }

    // Initialize anonymous auth for Firebase access
    try {
      await publicAuth.init();
      await this.loadReservation();
    } catch (error) {
      console.error('Error initializing auth:', error);
      this.showError('Błąd inicjalizacji. Spróbuj odświeżyć stronę.');
    }
  }

  getTokenFromURL() {
    const pathParts = window.location.pathname.split('/');
    const tokenIndex = pathParts.indexOf('manage-reservation') + 1;
    return pathParts[tokenIndex] || null;
  }

  async loadReservation() {
    try {
      // Validate token and get appointment
      const tokenResult = await scheduleService.validateReservationToken(this.token);
      
      if (!tokenResult.success) {
        this.showError(tokenResult.message || 'Link wygasł lub jest nieprawidłowy');
        return;
      }

      // Get appointment details
      const appointments = await firebaseService.getAppointments({ limit: 1000 });
      this.appointment = appointments.appointments.find(app => app.id === tokenResult.tokenData.appointmentId);

      if (!this.appointment) {
        this.showError('Nie znaleziono rezerwacji');
        return;
      }

      await this.renderReservationDetails();
    } catch (error) {
      console.error('Error loading reservation:', error);
      this.showError('Błąd podczas ładowania szczegółów rezerwacji');
    }
  }

  renderPriceDisplay(servicePrice) {
    // POPRAWIONE WYŚWIETLANIE CENY - priorytet dla servicePrice
    if (servicePrice) {
      // Użyj ceny z bazy danych usług jako głównej
      return `
        <div class="flex flex-col">
          <div class="flex justify-between">
            <span class="text-gray-600">Cena:</span>
            <span class="font-medium">${servicePrice} PLN <span class="text-sm text-gray-500">(aktualna cena)</span></span>
          </div>
          ${this.appointment.calculatedPrice && this.appointment.calculatedPrice !== servicePrice ? `
            <div class="flex justify-between text-sm text-gray-500 mt-1">
              <span>Cena przy rezerwacji:</span>
              <span>${this.appointment.calculatedPrice} PLN${this.appointment.isFirstSession ? ' (50% zniżki)' : ''}</span>
            </div>
          ` : ''}
        </div>
      `;
    } else if (this.appointment.calculatedPrice) {
      // Fallback na cenę obliczoną podczas rezerwacji
      return `
        <div class="flex flex-col">
          <div class="flex justify-between">
            <span class="text-gray-600">Cena:</span>
            <span class="font-medium">
              ${this.appointment.calculatedPrice} PLN
              ${this.appointment.isFirstSession ? ' <span class="text-green-600 text-sm">(50% zniżki)</span>' : ''}
            </span>
          </div>
          ${this.appointment.originalServicePrice ? `
            <div class="flex justify-between text-sm text-gray-500 mt-1">
              <span>Cena podstawowa:</span>
              <span>${this.appointment.originalServicePrice} PLN</span>
            </div>
          ` : ''}
        </div>
      `;
    }
    return '';
  }

  async renderReservationDetails() {
    const container = document.getElementById('reservation-content');
    
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      completed: 'bg-blue-100 text-blue-800 border-blue-200'
    };

    const statusLabels = {
      pending: 'Oczekuje potwierdzenia',
      confirmed: 'Potwierdzona',
      cancelled: 'Anulowana',
      completed: 'Zakończona'
    };

    const augmentedData = await pricingService.getAugmentedAppointmentData(this.appointment);

    container.innerHTML = `
      <div class="max-w-3xl mx-auto">
        <div class="text-center mb-8">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h3 class="text-2xl font-bold text-primary mb-2">Twoja rezerwacja</h3>
          <div class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusColors[this.appointment.status]}">
            ${statusLabels[this.appointment.status]}
          </div>
        </div>

        <div class="bg-gray-50 rounded-lg p-6 mb-6">
          <div class="grid md:grid-cols-2 gap-6">
            <div>
              <h4 class="font-semibold text-gray-900 mb-3">Szczegóły wizyty</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Usługa:</span>
                  <span class="font-medium">${serviceName}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Data:</span>
                  <span class="font-medium">${this.appointment.confirmedDate || this.appointment.preferredDate}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Godzina:</span>
                  <span class="font-medium">${this.appointment.confirmedTime || this.appointment.preferredTime}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Czas trwania:</span>
                  <span class="font-medium">${serviceDuration} minut</span>
                </div>
                ${this.renderPriceDisplay(servicePrice)}
              </div>
            </div>
            
            <div>
              <h4 class="font-semibold text-gray-900 mb-3">Dane kontaktowe</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Imię i nazwisko:</span>
                  <span class="font-medium">${this.appointment.name}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Email:</span>
                  <span class="font-medium">${this.appointment.email}</span>
                </div>
                ${this.appointment.phone ? `
                  <div class="flex justify-between">
                    <span class="text-gray-600">Telefon:</span>
                    <span class="font-medium">${this.appointment.phone}</span>
                  </div>
                ` : ''}
                <div class="flex justify-between">
                  <span class="text-gray-600">Zgłoszenie:</span>
                  <span class="font-medium">${this.appointment.createdAt.toLocaleDateString('pl-PL')}</span>
                </div>
              </div>
            </div>
          </div>
          
          ${this.appointment.message ? `
            <div class="mt-4 pt-4 border-t border-gray-200">
              <h4 class="font-semibold text-gray-900 mb-2">Wiadomość:</h4>
              <p class="text-sm text-gray-700">${this.appointment.message}</p>
            </div>
          ` : ''}
        </div>

        ${this.renderActionButtons()}
        
        ${this.appointment.rescheduleCount && this.appointment.rescheduleCount > 0 ? `
          <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-700">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Ta wizyta była przełożona ${this.appointment.rescheduleCount} ${this.appointment.rescheduleCount === 1 ? 'raz' : 'razy'}.
            </p>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderActionButtons() {
    if (this.appointment.status === 'cancelled' || this.appointment.status === 'completed') {
      return `
        <div class="text-center">
          <p class="text-gray-600">
            ${this.appointment.status === 'cancelled' ? 'Ta wizyta została anulowana.' : 'Ta wizyta została zakończona.'}
          </p>
        </div>
      `;
    }

    // Check if appointment is in the past
    const appointmentDate = new Date(`${this.appointment.confirmedDate || this.appointment.preferredDate}T${this.appointment.confirmedTime || this.appointment.preferredTime}`);
    const now = new Date();
    const isPast = appointmentDate < now;

    if (isPast) {
      return `
        <div class="text-center">
          <p class="text-gray-600">Ta wizyta już minęła.</p>
        </div>
      `;
    }

    // Check if it's too late to cancel (24h before)
    const timeDiff = appointmentDate.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 3600);
    const canCancel = hoursDiff > 24;

    return `
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        ${canCancel ? `
          <button onclick="reservationManager.showRescheduleInterface()" 
                  class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">
            <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            Zmień termin
          </button>
          <button onclick="reservationManager.showCancelConfirmation()" 
                  class="px-6 py-3 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors font-medium">
            <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            Anuluj wizytę
          </button>
        ` : `
          <div class="text-center">
            <p class="text-orange-600 font-medium mb-2">
              <svg class="w-5 h-5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              Anulowanie możliwe do 24h przed wizytą
            </p>
            <p class="text-sm text-gray-600">
              W przypadku pilnej potrzeby anulowania skontaktuj się bezpośrednio: 
              <a href="mailto:j.rudzinska@myreflection.pl" class="text-blue-600 hover:text-blue-800">j.rudzinska@myreflection.pl</a>
            </p>
          </div>
        `}
      </div>
    `;
  }

  showCancelConfirmation() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    modal.innerHTML = `
      <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <div class="text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Anulować wizytę?</h3>
          <p class="text-sm text-gray-600 mb-6">
            Czy na pewno chcesz anulować wizytę na ${this.appointment.confirmedDate || this.appointment.preferredDate} 
            o ${this.appointment.confirmedTime || this.appointment.preferredTime}?
          </p>
          
          <div class="flex gap-3">
            <button onclick="this.closest('.fixed').remove()" 
                    class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              Nie, zachowaj
            </button>
            <button onclick="reservationManager.cancelAppointment()" 
                    class="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
              Tak, anuluj
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  async cancelAppointment() {
    try {
      // Close modal
      const modal = document.querySelector('.fixed');
      if (modal) modal.remove();

      // Show loading
      this.showLoading('Anulowanie wizyty...');

      // Cancel appointment
      await firebaseService.cancelAppointment(this.appointment.id, 'client', 'Anulowanie przez klienta');

      // Show success message
      this.showSuccess('Wizyta została anulowana', 
        'Otrzymasz email z potwierdzeniem anulowania. Dziękujemy za wcześniejsze powiadomienie.');

    } catch (error) {
      console.error('Error canceling appointment:', error);
      this.showError('Błąd podczas anulowania wizyty. Spróbuj ponownie lub skontaktuj się bezpośrednio.');
    }
  }

  async showRescheduleInterface() {
    try {
      this.isRescheduleMode = true;
      
      // Show loading
      this.showLoading('Ładowanie dostępnych terminów...');

      // Create reschedule interface
      const container = document.getElementById('reservation-content');
      container.innerHTML = `
        <div class="max-w-3xl mx-auto">
          <div class="text-center mb-8">
            <h3 class="text-2xl font-bold text-primary mb-2">Zmień termin wizyty</h3>
            <p class="text-gray-600">Wybierz nowy termin z dostępnych poniżej</p>
          </div>

          <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 class="font-medium text-blue-900 mb-2">Aktualny termin:</h4>
            <p class="text-blue-700">
              ${this.appointment.confirmedDate || this.appointment.preferredDate} o 
              ${this.appointment.confirmedTime || this.appointment.preferredTime}
            </p>
          </div>

          <div id="reschedule-calendar" class="mb-6">
            <!-- Calendar will be inserted here -->
          </div>

          <div class="flex gap-4 justify-center">
            <button onclick="reservationManager.cancelReschedule()" 
                    class="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              Anuluj zmianę
            </button>
            <button id="confirm-reschedule" onclick="reservationManager.confirmReschedule()" 
                    class="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed" 
                    disabled>
              Potwierdź nowy termin
            </button>
          </div>

          <input type="hidden" id="new-date" value="">
          <input type="hidden" id="new-time" value="">
        </div>
      `;

      // Initialize calendar for reschedule
      this.initRescheduleCalendar();

    } catch (error) {
      console.error('Error showing reschedule interface:', error);
      this.showError('Błąd podczas ładowania kalendarza');
    }
  }

  async initRescheduleCalendar() {
    // Create temporary form structure needed by CalendarInterface
    const calendarContainer = document.getElementById('reschedule-calendar');
    calendarContainer.innerHTML = `
      <div id="temp-form-container">
        <!-- Temporary inputs that CalendarInterface expects -->
        <input type="date" id="preferred-date" style="display: none;" />
        <select id="preferred-time" style="display: none;">
          <option value="">Wybierz godzinę</option>
        </select>
        <label for="preferred-date" style="display: none;"></label>
        <label for="preferred-time" style="display: none;"></label>
        
        <!-- Calendar will be injected here by CalendarInterface -->
      </div>
    `;

    // Import the calendar interface (it exports an instance, not a class)
    const calendarInterfaceModule = await import('./calendar-interface.js');
    this.rescheduleCalendar = calendarInterfaceModule.default;
    
    // Override the calendar's setup to work within our container
    await this.rescheduleCalendar.setup();
    
    // Set up listeners to capture calendar selections
    this.setupRescheduleListeners();
  }

  setupRescheduleListeners() {
    // Monitor the hidden inputs that CalendarInterface updates
    const dateInput = document.getElementById('preferred-date');
    const timeInput = document.getElementById('preferred-time');
    
    if (dateInput) {
      // Multiple event types to catch all changes
      ['change', 'input'].forEach(eventType => {
        dateInput.addEventListener(eventType, (e) => {
          this.rescheduleSelectedDate = e.target.value;
          document.getElementById('new-date').value = e.target.value;
          this.updateConfirmButton();
        });
      });
    }
    
    if (timeInput) {
      // MutationObserver for value attribute changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
            const value = timeInput.value;
            if (value) {
              this.rescheduleSelectedTime = value;
              document.getElementById('new-time').value = value;
              this.updateConfirmButton();
            }
          }
        });
      });
      
      observer.observe(timeInput, { 
        attributes: true, 
        attributeFilter: ['value']
      });
      
      // Multiple event listeners for time input
      ['change', 'input', 'blur'].forEach(eventType => {
        timeInput.addEventListener(eventType, (e) => {
          this.rescheduleSelectedTime = e.target.value;
          document.getElementById('new-time').value = e.target.value;
          this.updateConfirmButton();
        });
      });
      
      // Periodically check values as fallback
      setInterval(() => {
        const currentDate = dateInput.value;
        const currentTime = timeInput.value;
        
        if (currentDate && currentDate !== this.rescheduleSelectedDate) {
          this.rescheduleSelectedDate = currentDate;
          document.getElementById('new-date').value = currentDate;
          this.updateConfirmButton();
        }
        
        if (currentTime && currentTime !== this.rescheduleSelectedTime) {
          this.rescheduleSelectedTime = currentTime;
          document.getElementById('new-time').value = currentTime;
          this.updateConfirmButton();
        }
      }, 500);
    }
  }
  
  updateConfirmButton() {
    const confirmButton = document.getElementById('confirm-reschedule');
    if (confirmButton) {
      confirmButton.disabled = !(this.rescheduleSelectedDate && this.rescheduleSelectedTime);
    }
  }


  async cancelReschedule() {
    this.isRescheduleMode = false;
    await this.renderReservationDetails();
  }

  async confirmReschedule() {
    if (!this.rescheduleSelectedDate || !this.rescheduleSelectedTime) {
      this.showError('Wybierz nową datę i godzinę');
      return;
    }

    try {
      // Show loading
      this.showLoading('Zmienianie terminu wizyty...');

      // Use the same reschedule method as admin panel
      await firebaseService.rescheduleAppointment(
        this.appointment.id, 
        this.rescheduleSelectedDate, 
        this.rescheduleSelectedTime
      );

      // Reload appointment data to show updated details
      await this.loadReservation();
      
      // Show success message
      this.showSuccess('Termin został zmieniony', 
        `Nowy termin: ${this.rescheduleSelectedDate} o ${this.rescheduleSelectedTime}. Otrzymasz email z potwierdzeniem.`);

    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      this.showError(error.message || 'Błąd podczas zmiany terminu. Spróbuj ponownie lub skontaktuj się bezpośrednio.');
    }
  }

  showLoading(message) {
    const container = document.getElementById('reservation-content');
    container.innerHTML = `
      <div class="text-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p class="mt-4 text-gray-600">${message}</p>
      </div>
    `;
  }

  showError(message) {
    const container = document.getElementById('reservation-content');
    container.innerHTML = `
      <div class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">Wystąpił błąd</h3>
        <p class="text-gray-600 mb-6">${message}</p>
        <a href="/umow-wizyte.html" class="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          Wróć do formularza rezerwacji
        </a>
      </div>
    `;
  }

  showSuccess(title, message) {
    const container = document.getElementById('reservation-content');
    container.innerHTML = `
      <div class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">${title}</h3>
        <p class="text-gray-600 mb-6">${message}</p>
        <a href="/umow-wizyte" class="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          Zarezerwuj nową wizytę
        </a>
      </div>
    `;
  }
}

// Create global instance
window.reservationManager = new ReservationManagement();
export default window.reservationManager;