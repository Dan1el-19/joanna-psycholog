// Admin panel for managing appointments
import firebaseService from './firebase-service.js';
import { authSystem } from './auth.js';
import pricingService from './pricing-service.js';

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
    const authStatus = authSystem.getAuthStatus();
    if (!authStatus.isAuthenticated || !authStatus.sessionValid) {
      this.showAuthRequired();
      return;
    }
    this.isAuthenticated = true;
    if (window.adminNav) return; // Handled by the main navigation router

    // Fallback for standalone usage
    this.createAdminInterface();
    this.loadAppointments();
  }
  
  // This method is now called by admin-navigation to set up the view
  async renderView(container) {
      this.setupEventListeners(container);
      await this.loadAppointments();
  }

  setupEventListeners(container) {
    if (!container || container.dataset.listenersAttached) return;
    container.dataset.listenersAttached = 'true';

    // Use document.body for global event delegation to catch modal clicks
    document.body.addEventListener('click', async (event) => {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;
        
        // Only handle actions related to appointments or admin-panel dialogs
        const isAppointmentAction = actionElement.closest('#appointments-container') || 
                                   actionElement.closest('.dialog-container');
        if (!isAppointmentAction) return;

        event.preventDefault();
        const action = actionElement.dataset.action;
        const id = actionElement.dataset.id;
        const status = actionElement.dataset.status;
        const notes = actionElement.dataset.notes;
        const date = actionElement.dataset.date;
        const time = actionElement.dataset.time;
        const method = actionElement.dataset.method;

        switch (action) {
            case 'update-status': await this.updateAppointmentStatus(id, status); break;
            case 'mark-completed': await this.markSessionCompleted(id); break;
            case 'show-payment-dialog': this.showPaymentDialog(id, status, method); break;
            case 'show-notes-dialog': this.showNotesDialog(id, notes); break;
            case 'show-reschedule-dialog': this.showRescheduleDialog(id, date, time); break;
            case 'archive': await this.archiveAppointment(id); break;
            case 'unarchive': await this.unarchiveAppointment(id); break;
            case 'close-dialog': actionElement.closest('.dialog-container')?.remove(); break;
        }
    });

    document.body.addEventListener('submit', async (event) => {
        const form = event.target;
        
        // Only handle admin-panel forms
        if (!['payment-form', 'reschedule-form'].includes(form.id)) return;
        
        event.preventDefault();
        const id = form.dataset.id;

        switch (form.id) {
            case 'payment-form':
                await this.handlePaymentUpdate(id, new FormData(form));
                form.closest('.dialog-container')?.remove();
                break;
            case 'reschedule-form':
                await this.handleRescheduleUpdate(id, new FormData(form));
                form.closest('.dialog-container')?.remove();
                break;
        }
    });
  }

  showAuthRequired() {
    const container = document.getElementById('admin-panel') || this.createAdminContainer();
    container.innerHTML = `<div class="bg-white p-8 rounded-lg shadow-lg text-center"><div class="mb-6"><div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V9m0 0V7m0 2H10m2 0h2"></path></svg></div><h2 class="text-2xl font-bold text-gray-800 mb-2">Dostęp Ograniczony</h2><p class="text-gray-600">Ta strona wymaga autoryzacji administratora.</p></div><button data-action="show-login" class="bg-primary text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors">Zaloguj się jako Administrator</button></div>`;
  }

  createAdminContainer() {
    const container = document.createElement('div');
    container.id = 'admin-panel';
    container.className = 'container mx-auto px-4 py-8';
    document.body.appendChild(container);
    return container;
  }

  async loadAppointments() {
    if (!this.verifyAdminAccess()) return;
    const listContainer = document.getElementById('appointments-list');
    if (!listContainer) return;
    listContainer.innerHTML = `<div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div><p class="mt-2 text-gray-600">Ładowanie wizyt...</p></div>`;
    try {
      const response = await firebaseService.getAppointments({ status: this.currentFilter, limit: 100 });
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
    
    const buttons = document.querySelectorAll('[data-action="filter-appointments"]');
    buttons.forEach(btn => {
        const isActive = btn.dataset.filter === status;
        btn.classList.toggle('ring-2', isActive);
        btn.classList.toggle('ring-offset-2', isActive);
        btn.classList.toggle('ring-white', isActive);
        btn.classList.toggle('opacity-70', !isActive);
    });
  }

  async renderAppointments() {
    const listContainer = document.getElementById('appointments-list');
    if (!listContainer) return;
    if (!this.appointments || this.appointments.length === 0) {
      listContainer.innerHTML = `<div class="text-center py-8 text-gray-500"><p>Brak wizyt do wyświetlenia dla filtru: ${this.currentFilter}</p></div>`;
      return;
    }
    const appointmentCards = await Promise.all(this.appointments.map(app => this.renderAppointmentCard(app)));
    listContainer.innerHTML = appointmentCards.join('');
  }

  async renderAppointmentCard(appointment) {
    const statusClasses = { pending: 'bg-yellow-100 text-yellow-800 border-yellow-200', confirmed: 'bg-green-100 text-green-800 border-green-200', cancelled: 'bg-red-100 text-red-800 border-red-200', completed: 'bg-blue-100 text-blue-800 border-blue-200' };
    const paymentStatusClasses = { pending: 'bg-yellow-100 text-yellow-800', paid: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800' };
    const statusLabels = { pending: 'Oczekująca', confirmed: 'Potwierdzona', cancelled: 'Anulowana', completed: 'Zakończona' };
    const paymentLabels = { pending: 'Oczekująca', paid: 'Opłacone', failed: 'Błąd' };

    const augmentedData = await pricingService.getAugmentedAppointmentData(appointment);
    const notesAttr = augmentedData.notes ? `data-notes="${encodeURIComponent(augmentedData.notes)}"` : 'data-notes=""';

    return `
      <div class="bg-gray-50 p-3 sm:p-4 md:p-6 rounded-lg border">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 sm:mb-4 gap-2 sm:gap-3">
          <div class="flex-1 min-w-0">
            <h3 class="text-sm sm:text-base md:text-lg font-semibold text-primary truncate">${augmentedData.name}</h3>
            <p class="text-xs sm:text-sm text-gray-600 truncate">${augmentedData.email}</p>
          </div>
          <span class="px-2 py-1 rounded-full text-xs font-medium border ${statusClasses[augmentedData.status]} self-start flex-shrink-0">${statusLabels[augmentedData.status]}</span>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div class="space-y-1 sm:space-y-2">
            <p class="text-xs sm:text-sm text-gray-600"><strong>Usługa:</strong> <span class="break-words">${augmentedData.serviceName}</span></p>
            <p class="text-xs sm:text-sm text-gray-600"><strong>Termin:</strong> ${augmentedData.preferredDate || 'Brak'} o ${augmentedData.preferredTime || 'Brak'}</p>
            <p class="text-xs sm:text-sm text-gray-600"><strong>Zgłoszenie:</strong> ${augmentedData.createdAt?.toLocaleDateString('pl-PL') || 'N/A'}</p>
          </div>
          <div class="space-y-1 sm:space-y-2">
            ${augmentedData.priceDisplayHTML}
            ${augmentedData.paymentStatus ? `<p class="text-xs md:text-sm"><strong>Płatność:</strong> <span class="px-2 py-1 rounded-full text-xs font-medium ${paymentStatusClasses[augmentedData.paymentStatus]}">${paymentLabels[augmentedData.paymentStatus]}</span></p>` : ''}
            ${augmentedData.paymentMethod ? `<p class="text-xs md:text-sm text-gray-600"><strong>Metoda:</strong> ${augmentedData.paymentMethod}</p>` : ''}
          </div>
        </div>
        ${augmentedData.message ? `<div class="mb-3 sm:mb-4"><p class="text-xs sm:text-sm text-gray-600 mb-2"><strong>Wiadomość:</strong></p><p class="text-xs sm:text-sm text-gray-700 bg-white p-2 sm:p-3 rounded border break-words">${augmentedData.message}</p></div>` : ''}
        ${augmentedData.notes ? `<div class="mb-4"><p class="text-xs md:text-sm text-gray-600 mb-2"><strong>Notatki:</strong></p><p class="text-xs md:text-sm text-gray-700 bg-white p-3 rounded border break-words">${augmentedData.notes}</p></div>` : ''}
        <div class="flex flex-wrap gap-2">
          ${augmentedData.status === 'pending' ? `<button data-action="update-status" data-id="${augmentedData.id}" data-status="confirmed" class="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-xs sm:text-sm">Potwierdź</button>` : ''}
          ${augmentedData.status === 'confirmed' && !augmentedData.sessionCompleted ? `<button data-action="mark-completed" data-id="${augmentedData.id}" class="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors text-xs sm:text-sm">Oznacz jako odbyła się</button>` : ''}
          ${augmentedData.status !== 'cancelled' && augmentedData.status !== 'completed' ? `<button data-action="update-status" data-id="${augmentedData.id}" data-status="cancelled" class="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs sm:text-sm">Anuluj</button>` : ''}
          ${augmentedData.paymentStatus !== 'paid' && augmentedData.status !== 'cancelled' ? `<button data-action="show-payment-dialog" data-id="${augmentedData.id}" data-status="${augmentedData.paymentStatus || 'pending'}" data-method="${augmentedData.paymentMethod || ''}" class="px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors text-xs sm:text-sm">Płatność</button>` : ''}
          <button data-action="show-notes-dialog" data-id="${augmentedData.id}" ${notesAttr} class="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs sm:text-sm">${augmentedData.notes ? 'Edytuj notatki' : 'Dodaj notatki'}</button>
          ${(augmentedData.status === 'confirmed' || augmentedData.status === 'pending') ? `<button data-action="show-reschedule-dialog" data-id="${augmentedData.id}" data-date="${augmentedData.preferredDate}" data-time="${augmentedData.preferredTime}" class="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors text-xs md:text-sm">Przełóż</button>` : ''}
          ${!augmentedData.isArchived ? `<button data-action="archive" data-id="${augmentedData.id}" class="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs sm:text-sm">Archiwizuj</button>` : `<button data-action="unarchive" data-id="${augmentedData.id}" class="px-3 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors text-xs sm:text-sm">Przywróć</button>`}
        </div>
      </div>`;
  }

  async updateAppointmentStatus(appointmentId, newStatus) {
    if (!this.verifyAdminAccess()) return;
    try {
      await firebaseService.updateAppointment(appointmentId, { status: newStatus });
      this.loadAppointments();
      this.showSuccess(`Status wizyty został zmieniony.`);
    } catch (error) { this.showError('Błąd podczas aktualizacji wizyty: ' + error.message); }
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

  showNotesDialog(appointmentId, currentNotes) {
    const notes = prompt('Wprowadź notatki dla tej wizyty:', decodeURIComponent(currentNotes));
    if (notes !== null) this.updateAppointmentNotes(appointmentId, notes);
  }

  async updateAppointmentNotes(appointmentId, notes) {
    try {
      await firebaseService.updateAppointment(appointmentId, { notes });
      this.loadAppointments();
      this.showSuccess('Notatki zostały zaktualizowane');
    } catch (error) { this.showError('Błąd podczas aktualizacji notatek: ' + error.message); }
  }

  async markSessionCompleted(appointmentId) {
    if (!this.verifyAdminAccess() || !confirm('Czy na pewno chcesz oznaczyć tę sesję jako odbytą?')) return;
    try {
      await firebaseService.updateAppointment(appointmentId, { sessionCompleted: true, sessionCompletedDate: Date.now() });
      this.loadAppointments();
      this.showSuccess('Sesja została oznaczona jako odbyta');
    } catch (error) { this.showError('Błąd podczas oznaczania sesji: ' + error.message); }
  }

  showPaymentDialog(appointmentId, currentPaymentStatus, currentPaymentMethod) {
    const dialog = document.createElement('div');
    dialog.className = 'dialog-container fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    dialog.innerHTML = `
      <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Status płatności</h3>
        <form id="payment-form" data-id="${appointmentId}">
          <div class="mb-4"><label class="block text-sm font-medium mb-2">Metoda płatności</label><select name="paymentMethod" class="w-full border rounded px-3 py-2"><option value="paypal" ${currentPaymentMethod === 'paypal' ? 'selected' : ''}>PayPal</option><option value="transfer" ${currentPaymentMethod === 'transfer' ? 'selected' : ''}>Przelew</option><option value="cash" ${currentPaymentMethod === 'cash' ? 'selected' : ''}>Gotówka</option></select></div>
          <div class="mb-4"><label class="block text-sm font-medium mb-2">Status płatności</label><select name="paymentStatus" class="w-full border rounded px-3 py-2"><option value="pending" ${currentPaymentStatus === 'pending' ? 'selected' : ''}>Oczekuje</option><option value="paid" ${currentPaymentStatus === 'paid' ? 'selected' : ''}>Opłacone</option><option value="failed" ${currentPaymentStatus === 'failed' ? 'selected' : ''}>Błąd</option></select></div>
          <div class="flex gap-2"><button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Zapisz</button><button type="button" data-action="close-dialog" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Anuluj</button></div>
        </form>
      </div>`;
    document.body.appendChild(dialog);
  }

  async handlePaymentUpdate(appointmentId, formData) {
      const method = formData.get('paymentMethod');
      const status = formData.get('paymentStatus');
      try {
        await firebaseService.updatePaymentStatus(appointmentId, method, status);
        this.loadAppointments();
        this.showMessage('Status płatności zaktualizowany', 'success');
      } catch (error) {
        this.showMessage('Błąd podczas aktualizacji płatności: ' + error.message, 'error');
      }
  }

  showRescheduleDialog(appointmentId, currentDate, currentTime) {
    const dialog = document.createElement('div');
    dialog.className = 'dialog-container fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    const timeOptions = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(t => `<option value="${t}" ${currentTime === t ? 'selected' : ''}>${t}</option>`).join('');
    dialog.innerHTML = `
      <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Przełóż wizytę</h3>
        <form id="reschedule-form" data-id="${appointmentId}">
          <div class="mb-4"><label class="block text-sm font-medium mb-2">Nowa data</label><input type="date" name="newDate" value="${currentDate}" class="w-full border rounded px-3 py-2" required></div>
          <div class="mb-4"><label class="block text-sm font-medium mb-2">Nowa godzina</label><select name="newTime" class="w-full border rounded px-3 py-2" required><option value="">Wybierz godzinę</option>${timeOptions}</select></div>
          <div class="flex gap-2"><button type="submit" class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">Przełóż</button><button type="button" data-action="close-dialog" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Anuluj</button></div>
        </form>
      </div>`;
    document.body.appendChild(dialog);
  }

  async handleRescheduleUpdate(appointmentId, formData) {
      const newDate = formData.get('newDate');
      const newTime = formData.get('newTime');
      try {
        await firebaseService.rescheduleAppointment(appointmentId, newDate, newTime);
        this.loadAppointments();
        this.showMessage('Wizyta została przełożona', 'success');
      } catch (error) {
        this.showMessage('Błąd podczas przełożenia wizyty: ' + error.message, 'error');
      }
  }

  async archiveAppointment(appointmentId) {
    if (!this.verifyAdminAccess() || !confirm('Czy na pewno chcesz zarchiwizować tę wizytę?')) return;
    try {
      await firebaseService.archiveAppointment(appointmentId);
      this.loadAppointments();
      this.showMessage('Wizyta została zarchiwizowana', 'success');
    } catch (error) { this.showMessage('Błąd podczas archiwizacji wizyty: ' + error.message, 'error'); }
  }

  async unarchiveAppointment(appointmentId) {
    if (!this.verifyAdminAccess() || !confirm('Czy na pewno chcesz przywrócić tę wizytę z archiwum?')) return;
    try {
      await firebaseService.unarchiveAppointment(appointmentId);
      this.loadAppointments();
      this.showMessage('Wizyta została przywrócona z archiwum', 'success');
    } catch (error) { this.showMessage('Błąd podczas przywracania wizyty: ' + error.message, 'error'); }
  }

  async performMaintenanceCleanup() {
    if (!this.verifyAdminAccess() || !confirm('Czy na pewno chcesz uruchomić proces czyszczenia bazy danych?\n\nTa operacja usunie wszystkie wizyty starsze niż 12 miesięcy.')) return;
    try {
      const result = await firebaseService.performDailyMaintenance();
      this.showMessage(`Czyszczenie zakończone. Usunięto ${result.cleanupResults?.appointments?.deletedCount || 0} starych wizyt.`, 'success');
      if (document.getElementById('appointments-list')) this.loadAppointments();
    } catch (error) { this.showMessage('Błąd podczas czyszczenia bazy danych: ' + error.message, 'error'); }
  }

  showSuccess = (message) => this.showMessage(message, 'success');
  showError = (message) => this.showMessage(message, 'error');

  showMessage(message, type) {
    const messageDiv = document.createElement('div');
    const typeClasses = { success: 'bg-green-100 text-green-800 border border-green-200', error: 'bg-red-100 text-red-800 border border-red-200' };
    messageDiv.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${typeClasses[type] || 'bg-blue-100 text-blue-800 border-blue-200'}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 5000);
  }
}

// Create global instance
window.adminPanel = new AdminPanel();
export default window.adminPanel;
