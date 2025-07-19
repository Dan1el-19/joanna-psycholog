// Admin panel for managing appointments
import firebaseService from './firebase-service.js';
import { authSystem } from './auth.js';
import pricingService from './pricing-service.js'

class AdminPanel {
  constructor() {
    this.appointments = [];
    this.currentFilter = 'all';
    this.isAuthenticated = false;
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
    // Check authentication first
    const authStatus = authSystem.getAuthStatus();
    if (!authStatus.isAuthenticated || !authStatus.sessionValid) {
      this.showAuthRequired();
      return;
    }

    this.isAuthenticated = true;
    
    // Check if we're in the new navigation system
    if (window.adminNav) {
      // Navigation system will handle initialization
      return;
    }
    
    // Fallback to old system
    this.createAdminInterface();
    this.loadAppointments();
    
    // Set up global auth success handler
    window.onAdminAuthSuccess = () => {
      this.isAuthenticated = true;
      this.createAdminInterface();
      this.loadAppointments();
    };
  }

  showAuthRequired() {
    const container = document.getElementById('admin-panel') || this.createAdminContainer();
    container.innerHTML = `
      <div class="bg-white p-8 rounded-lg shadow-lg text-center">
        <div class="mb-6">
          <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V9m0 0V7m0 2H10m2 0h2"></path>
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-gray-800 mb-2">Dostęp Ograniczony</h2>
          <p class="text-gray-600">Ta strona wymaga autoryzacji administratora.</p>
        </div>
        <button onclick="authSystem.showLoginForm()" class="bg-primary text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors">
          Zaloguj się jako Administrator
        </button>
      </div>
    `;
  }

  createAdminInterface() {
    // Check if we're on an admin page or create a simple admin interface
    const adminContainer = document.getElementById('admin-panel') || this.createAdminContainer();
    
    adminContainer.innerHTML = `
      <div class="bg-white p-4 md:p-6 rounded-lg shadow-lg">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
          <h2 class="text-xl md:text-2xl font-bold text-primary">Panel Administracyjny - Wizyty</h2>
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <span class="text-xs sm:text-sm text-gray-600">Zalogowany jako Administrator</span>
            <button onclick="adminPanel.logout()" class="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 transition-colors text-sm w-full sm:w-auto">
              Wyloguj się
            </button>
          </div>
        </div>
        
        <div class="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:flex gap-2 sm:gap-4">
          <button onclick="adminPanel.filterAppointments('all')" 
                  class="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors text-sm">
            Wszystkie
          </button>
          <button onclick="adminPanel.filterAppointments('pending')" 
                  class="px-3 py-2 bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300 transition-colors text-sm">
            Oczekujące
          </button>
          <button onclick="adminPanel.filterAppointments('confirmed')" 
                  class="px-3 py-2 bg-green-200 text-green-800 rounded hover:bg-green-300 transition-colors text-sm">
            Potwierdzone
          </button>
          <button onclick="adminPanel.filterAppointments('completed')" 
                  class="px-3 py-2 bg-purple-200 text-purple-800 rounded hover:bg-purple-300 transition-colors text-sm">
            Odbyte
          </button>
          <button onclick="adminPanel.filterAppointments('cancelled')" 
                  class="px-3 py-2 bg-red-200 text-red-800 rounded hover:bg-red-300 transition-colors text-sm">
            Anulowane
          </button>
          <button onclick="adminPanel.filterAppointments('archived')" 
                  class="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm">
            Archiwum
          </button>
          <button onclick="adminPanel.loadAppointments()" 
                  class="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm col-span-2 sm:col-span-1 lg:col-span-1">
            Odśwież
          </button>
        </div>

        <div id="appointments-list" class="space-y-4">
          <div class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
            <p class="mt-2 text-gray-600">Ładowanie wizyt...</p>
          </div>
        </div>
      </div>
    `;
  }

  createAdminContainer() {
    const container = document.createElement('div');
    container.id = 'admin-panel';
    container.className = 'container mx-auto px-4 py-8';
    document.body.appendChild(container);
    return container;
  }

  async loadAppointments() {
    // Verify authentication before loading sensitive data
    if (!this.verifyAdminAccess()) {
      return;
    }

    try {
      const listContainer = document.getElementById('appointments-list');
      if (!listContainer) {
        console.error('appointments-list container not found');
        return;
      }
      
      listContainer.innerHTML = `
        <div class="text-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
          <p class="mt-2 text-gray-600">Ładowanie wizyt...</p>
        </div>
      `;

      const response = await firebaseService.getAppointments({ 
        status: this.currentFilter,
        limit: 100 
      });
      
      if (response.success) {
        this.appointments = response.appointments;
        await this.renderAppointments();
      } else {
        throw new Error(response.message || 'Failed to load appointments');
      }
      
    } catch (error) {
      console.error('Error loading appointments:', error);
      this.showError('Błąd podczas ładowania wizyt: ' + error.message);
    }
  }

  filterAppointments(status) {
    this.currentFilter = status;
    this.loadAppointments();
    
    // Update button states with colorful design
    const buttons = document.querySelectorAll('#admin-panel button, #appointments-container button');
    const buttonColors = {
      'all': 'bg-blue-500 hover:bg-blue-600',
      'pending': 'bg-yellow-500 hover:bg-yellow-600',
      'confirmed': 'bg-green-500 hover:bg-green-600',
      'completed': 'bg-purple-500 hover:bg-purple-600',
      'cancelled': 'bg-red-500 hover:bg-red-600',
      'archived': 'bg-gray-600 hover:bg-gray-700'
    };
    
    buttons.forEach(btn => {
      if (btn.onclick && btn.onclick.toString().includes('filterAppointments')) {
        // Remove active state
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-white');
        btn.classList.add('opacity-70');
        
        // Remove all color classes and add original color
        Object.values(buttonColors).forEach(colorClass => {
          colorClass.split(' ').forEach(cls => btn.classList.remove(cls));
        });
        
        // Get the status from onclick
        const statusMatch = btn.onclick.toString().match(/filterAppointments\('([^']+)'\)/);
        if (statusMatch) {
          const btnStatus = statusMatch[1];
          const colorClass = buttonColors[btnStatus];
          if (colorClass) {
            colorClass.split(' ').forEach(cls => btn.classList.add(cls));
          }
        }
      }
    });
    
    // Find the clicked button and highlight it
    const clickedButton = Array.from(buttons).find(btn => 
      btn.onclick && btn.onclick.toString().includes(`filterAppointments('${status}')`)
    );
    
    if (clickedButton) {
      clickedButton.classList.remove('opacity-70');
      clickedButton.classList.add('ring-2', 'ring-offset-2', 'ring-white');
    }
  }

  async renderAppointments() {
    const listContainer = document.getElementById('appointments-list');
    
    if (!listContainer) {
      console.error('appointments-list container not found during render');
      return;
    }
    
    if (!this.appointments || this.appointments.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <p>Brak wizyt do wyświetlenia</p>
        </div>
      `;
      return;
    }

    // Render appointments with service names from database
    const appointmentCards = await Promise.all(
      this.appointments.map(appointment => this.renderAppointmentCard(appointment))
    );
    listContainer.innerHTML = appointmentCards.join('');
  }

  // w pliku admin-panel.js
  async renderAppointmentCard(appointment) {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      completed: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    
    const paymentStatusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    };

    const statusLabels = {
      pending: 'Oczekująca',
      confirmed: 'Potwierdzona',
      cancelled: 'Anulowana',
      completed: 'Zakończona'
    };
    
    const paymentLabels = {
      pending: 'Oczekująca płatność',
      paid: 'Opłacone',
      failed: 'Błąd płatności'
    };

    // Ta linijka jest poprawna - pobiera wszystkie dane do jednego obiektu
    const augmentedData = await pricingService.getAugmentedAppointmentData(appointment);

    // PONIŻEJ ZNAJDUJE SIĘ CAŁY, KOMPLETNY I POPRAWIONY SZABLON
    return `
      <div class="bg-gray-50 p-3 sm:p-4 md:p-6 rounded-lg border">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 sm:mb-4 gap-2 sm:gap-3">
          <div class="flex-1 min-w-0">
            <h3 class="text-sm sm:text-base md:text-lg font-semibold text-primary truncate">${augmentedData.name}</h3>
            <p class="text-xs sm:text-sm text-gray-600 truncate">${augmentedData.email}</p>
          </div>
          <span class="px-2 py-1 rounded-full text-xs font-medium border ${statusColors[augmentedData.status]} self-start flex-shrink-0">
            ${statusLabels[augmentedData.status]}
          </span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div class="space-y-1 sm:space-y-2">
            <p class="text-xs sm:text-sm text-gray-600"><strong>Usługa:</strong> <span class="break-words">${augmentedData.serviceName}</span></p>
            <p class="text-xs sm:text-sm text-gray-600"><strong>Preferowany termin:</strong> ${augmentedData.preferredDate || 'Nie podano'}</p>
            <p class="text-xs sm:text-sm text-gray-600"><strong>Preferowana godzina:</strong> ${augmentedData.preferredTime || 'Nie podano'}</p>
          </div>
          <div class="space-y-1 sm:space-y-2">
            <p class="text-xs sm:text-sm text-gray-600"><strong>Zgłoszenie:</strong> ${augmentedData.createdAt?.toLocaleDateString('pl-PL') || 'Nieznana data'}</p>
            <p class="text-xs sm:text-sm text-gray-600"><strong>Ostatnia aktualizacja:</strong> ${augmentedData.updatedAt?.toLocaleDateString('pl-PL') || 'Nieznana data'}</p>
            ${augmentedData.sessionCompleted ? `
              <p class="text-xs md:text-sm text-green-600"><strong>Sesja odbyła się:</strong> ${augmentedData.sessionCompletedDate ? (augmentedData.sessionCompletedDate.toDate ? augmentedData.sessionCompletedDate.toDate().toLocaleDateString('pl-PL') : new Date(augmentedData.sessionCompletedDate).toLocaleDateString('pl-PL')) : 'Tak'}</p>
            ` : ''}
            
            ${augmentedData.priceDisplayHTML}

            ${augmentedData.paymentStatus ? `
              <p class="text-xs md:text-sm">
                <strong>Status płatności:</strong> 
                <span class="px-2 py-1 rounded-full text-xs font-medium ${paymentStatusColors[augmentedData.paymentStatus]}">
                  ${paymentLabels[augmentedData.paymentStatus]}
                </span>
              </p>
            ` : ''}
            ${augmentedData.paymentMethod ? `
              <p class="text-xs md:text-sm text-gray-600"><strong>Metoda płatności:</strong> ${augmentedData.paymentMethod}</p>
            ` : ''}
          </div>
        </div>

        ${augmentedData.message ? `
          <div class="mb-3 sm:mb-4">
            <p class="text-xs sm:text-sm text-gray-600 mb-2"><strong>Wiadomość:</strong></p>
            <p class="text-xs sm:text-sm text-gray-700 bg-white p-2 sm:p-3 rounded border break-words">${augmentedData.message}</p>
          </div>
        ` : ''}

        ${augmentedData.notes ? `
          <div class="mb-4">
            <p class="text-xs md:text-sm text-gray-600 mb-2"><strong>Notatki:</strong></p>
            <p class="text-xs md:text-sm text-gray-700 bg-white p-3 rounded border break-words">${augmentedData.notes}</p>
          </div>
        ` : ''}

        <div class="flex flex-wrap gap-2">
          ${augmentedData.status === 'pending' ? `
            <button onclick="adminPanel.updateAppointmentStatus('${augmentedData.id}', 'confirmed')" 
                    class="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-xs sm:text-sm">
              Potwierdź
            </button>
          ` : ''}
          
          ${augmentedData.status === 'confirmed' && !augmentedData.sessionCompleted ? `
            <button onclick="adminPanel.markSessionCompleted('${augmentedData.id}')" 
                    class="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors text-xs sm:text-sm">
              Oznacz jako odbyła się
            </button>
          ` : ''}
          
          ${augmentedData.status !== 'cancelled' && augmentedData.status !== 'completed' ? `
            <button onclick="adminPanel.updateAppointmentStatus('${augmentedData.id}', 'cancelled')" 
                    class="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs sm:text-sm">
              Anuluj
            </button>
          ` : ''}
          
          ${augmentedData.paymentStatus !== 'paid' && augmentedData.status !== 'cancelled' ? `
            <button onclick="adminPanel.showPaymentDialog('${augmentedData.id}', '${augmentedData.paymentStatus || 'pending'}', '${augmentedData.paymentMethod || ''}')" 
                    class="px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors text-xs sm:text-sm">
              Płatność
            </button>
          ` : ''}
          
          <button onclick="adminPanel.showNotesDialog('${augmentedData.id}', '${augmentedData.notes || ''}')" 
                  class="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs sm:text-sm">
            ${augmentedData.notes ? 'Edytuj notatki' : 'Dodaj notatki'}
          </button>
          
          ${(augmentedData.status === 'confirmed' || augmentedData.status === 'pending') && augmentedData.status !== 'completed' ? `
            <button onclick="adminPanel.showRescheduleDialog('${augmentedData.id}', '${augmentedData.preferredDate}', '${augmentedData.preferredTime}')" 
                    class="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors text-xs md:text-sm">
              Przełóż
            </button>
          ` : ''}
          
          ${!augmentedData.isArchived ? `
            <button onclick="adminPanel.archiveAppointment('${augmentedData.id}')" 
                    class="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs sm:text-sm">
              Archiwizuj
            </button>
          ` : `
            <button onclick="adminPanel.unarchiveAppointment('${augmentedData.id}')" 
                    class="px-3 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors text-xs sm:text-sm">
              Przywróć
            </button>
          `}
        </div>
      </div>
    `;
  }

  // Pozostałe metody bez zmian...
  async updateAppointmentStatus(appointmentId, newStatus) {
    if (!this.verifyAdminAccess()) return;

    try {
      await firebaseService.updateAppointment(appointmentId, { status: newStatus });
      this.loadAppointments();
      this.showSuccess(`Status wizyty został zmieniony na: ${newStatus}`);
    } catch (error) {
      console.error('Error updating appointment:', error);
      this.showError('Błąd podczas aktualizacji wizyty: ' + error.message);
    }
  }

  verifyAdminAccess() {
    const authStatus = authSystem.getAuthStatus();
    if (!authStatus.isAuthenticated || !authStatus.sessionValid) {
      this.showError('Sesja wygasła. Zaloguj się ponownie.');
      this.showAuthRequired();
      return false;
    }
    return true;
  }

  logout() {
    if (confirm('Czy na pewno chcesz się wylogować?')) {
      authSystem.logout();
      this.isAuthenticated = false;
      this.showAuthRequired();
      this.showMessage('Zostałeś wylogowany', 'info');
    }
  }

  showNotesDialog(appointmentId, currentNotes) {
    const notes = prompt('Wprowadź notatki dla tej wizyty:', currentNotes);
    if (notes !== null) {
      this.updateAppointmentNotes(appointmentId, notes);
    }
  }

  async updateAppointmentNotes(appointmentId, notes) {
    try {
      await firebaseService.updateAppointment(appointmentId, { notes });
      this.loadAppointments();
      this.showSuccess('Notatki zostały zaktualizowane');
    } catch (error) {
      console.error('Error updating notes:', error);
      this.showError('Błąd podczas aktualizacji notatek: ' + error.message);
    }
  }

  async markSessionCompleted(appointmentId) {
    if (!this.verifyAdminAccess()) return;

    if (confirm('Czy na pewno chcesz oznaczyć tę sesję jako odbytą?')) {
      try {
        await firebaseService.updateAppointment(appointmentId, { 
          sessionCompleted: true,
          sessionCompletedDate: Date.now()
        });
        this.loadAppointments();
        this.showSuccess('Sesja została oznaczona jako odbyta');
      } catch (error) {
        console.error('Error marking session as completed:', error);
        this.showError('Błąd podczas oznaczania sesji: ' + error.message);
      }
    }
  }

  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 
      'bg-red-100 text-red-800 border border-red-200'
    }`;
    messageDiv.innerHTML = message;

    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 5000);
  }

  showPaymentDialog(appointmentId, currentPaymentStatus, currentPaymentMethod) {
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    dialog.innerHTML = `
      <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Status płatności</h3>
        <form id="payment-form">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">Metoda płatności</label>
            <select id="payment-method" class="w-full border rounded px-3 py-2">
              <option value="paypal" ${currentPaymentMethod === 'paypal' ? 'selected' : ''}>PayPal</option>
              <option value="transfer" ${currentPaymentMethod === 'transfer' ? 'selected' : ''}>Przelew</option>
              <option value="cash" ${currentPaymentMethod === 'cash' ? 'selected' : ''}>Gotówka</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">Status płatności</label>
            <select id="payment-status" class="w-full border rounded px-3 py-2">
              <option value="pending" ${currentPaymentStatus === 'pending' ? 'selected' : ''}>Oczekuje</option>
              <option value="paid" ${currentPaymentStatus === 'paid' ? 'selected' : ''}>Opłacone</option>
              <option value="failed" ${currentPaymentStatus === 'failed' ? 'selected' : ''}>Błąd</option>
            </select>
          </div>
          <div class="flex gap-2">
            <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Zapisz
            </button>
            <button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              Anuluj
            </button>
          </div>
        </form>
      </div>
    `;
    
    dialog.querySelector('#payment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const method = dialog.querySelector('#payment-method').value;
      const status = dialog.querySelector('#payment-status').value;
      
      try {
        await firebaseService.updatePaymentStatus(appointmentId, method, status);
        dialog.remove();
        this.loadAppointments();
        this.showMessage('Status płatności zaktualizowany', 'success');
      } catch (error) {
        this.showMessage('Błąd podczas aktualizacji płatności: ' + error.message, 'error');
      }
    });
    
    document.body.appendChild(dialog);
  }

  showRescheduleDialog(appointmentId, currentDate, currentTime) {
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    dialog.innerHTML = `
      <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Przełóż wizytę</h3>
        <form id="reschedule-form">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">Nowa data</label>
            <input type="date" id="new-date" value="${currentDate}" class="w-full border rounded px-3 py-2" required>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">Nowa godzina</label>
            <select id="new-time" class="w-full border rounded px-3 py-2" required>
              <option value="">Wybierz godzinę</option>
              <option value="09:00" ${currentTime === '09:00' ? 'selected' : ''}>09:00</option>
              <option value="10:00" ${currentTime === '10:00' ? 'selected' : ''}>10:00</option>
              <option value="11:00" ${currentTime === '11:00' ? 'selected' : ''}>11:00</option>
              <option value="12:00" ${currentTime === '12:00' ? 'selected' : ''}>12:00</option>
              <option value="13:00" ${currentTime === '13:00' ? 'selected' : ''}>13:00</option>
              <option value="14:00" ${currentTime === '14:00' ? 'selected' : ''}>14:00</option>
              <option value="15:00" ${currentTime === '15:00' ? 'selected' : ''}>15:00</option>
              <option value="16:00" ${currentTime === '16:00' ? 'selected' : ''}>16:00</option>
              <option value="17:00" ${currentTime === '17:00' ? 'selected' : ''}>17:00</option>
            </select>
          </div>
          <div class="flex gap-2">
            <button type="submit" class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">
              Przełóż
            </button>
            <button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              Anuluj
            </button>
          </div>
        </form>
      </div>
    `;
    
    dialog.querySelector('#reschedule-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const newDate = dialog.querySelector('#new-date').value;
      const newTime = dialog.querySelector('#new-time').value;
      
      try {
        await firebaseService.rescheduleAppointment(appointmentId, newDate, newTime);
        dialog.remove();
        this.loadAppointments();
        this.showMessage('Wizyta została przełożona', 'success');
      } catch (error) {
        this.showMessage('Błąd podczas przełożenia wizyty: ' + error.message, 'error');
      }
    });
    
    document.body.appendChild(dialog);
  }

  async archiveAppointment(appointmentId) {
    if (!this.verifyAdminAccess()) return;

    if (!confirm('Czy na pewno chcesz zarchiwizować tę wizytę?')) return;

    try {
      await firebaseService.archiveAppointment(appointmentId);
      this.loadAppointments();
      this.showMessage('Wizyta została zarchiwizowana', 'success');
    } catch (error) {
      console.error('Error archiving appointment:', error);
      this.showMessage('Błąd podczas archiwizacji wizyty: ' + error.message, 'error');
    }
  }

  async unarchiveAppointment(appointmentId) {
    if (!this.verifyAdminAccess()) return;

    if (!confirm('Czy na pewno chcesz przywrócić tę wizytę z archiwum?')) return;

    try {
      await firebaseService.unarchiveAppointment(appointmentId);
      this.loadAppointments();
      this.showMessage('Wizyta została przywrócona z archiwum', 'success');
    } catch (error) {
      console.error('Error unarchiving appointment:', error);
      this.showMessage('Błąd podczas przywracania wizyty: ' + error.message, 'error');
    }
  }

  async performMaintenanceCleanup() {
    if (!this.verifyAdminAccess()) return;

    if (!confirm('Czy na pewno chcesz uruchomić proces czyszczenia bazy danych?\n\nTa operacja usunie wszystkie wizyty starsze niż 12 miesięcy.')) return;

    try {
      const result = await firebaseService.performDailyMaintenance();
      this.showMessage(`Czyszczenie zakończone. Usunięto ${result.cleanupResults?.appointments?.deletedCount || 0} starych wizyt.`, 'success');
      
      if (document.getElementById('appointments-list')) {
        this.loadAppointments();
      }
    } catch (error) {
      console.error('Error during maintenance cleanup:', error);
      this.showMessage('Błąd podczas czyszczenia bazy danych: ' + error.message, 'error');
    }
  }
}

// Create global instance
window.adminPanel = new AdminPanel();
export default window.adminPanel;