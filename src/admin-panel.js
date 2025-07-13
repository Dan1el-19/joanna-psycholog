// Admin panel for managing appointments
import firebaseService from './firebase-service.js';

class AdminPanel {
  constructor() {
    this.appointments = [];
    this.currentFilter = 'all';
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
    this.createAdminInterface();
    this.loadAppointments();
  }

  createAdminInterface() {
    // Check if we're on an admin page or create a simple admin interface
    const adminContainer = document.getElementById('admin-panel') || this.createAdminContainer();
    
    adminContainer.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl font-bold text-primary mb-6">Panel Administracyjny - Wizyty</h2>
        
        <div class="mb-6 flex gap-4 flex-wrap">
          <button onclick="adminPanel.filterAppointments('all')" 
                  class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors">
            Wszystkie
          </button>
          <button onclick="adminPanel.filterAppointments('pending')" 
                  class="px-4 py-2 bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300 transition-colors">
            Oczekujące
          </button>
          <button onclick="adminPanel.filterAppointments('confirmed')" 
                  class="px-4 py-2 bg-green-200 text-green-800 rounded hover:bg-green-300 transition-colors">
            Potwierdzone
          </button>
          <button onclick="adminPanel.filterAppointments('cancelled')" 
                  class="px-4 py-2 bg-red-200 text-red-800 rounded hover:bg-red-300 transition-colors">
            Anulowane
          </button>
          <button onclick="adminPanel.loadAppointments()" 
                  class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
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
    try {
      const listContainer = document.getElementById('appointments-list');
      listContainer.innerHTML = `
        <div class="text-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
          <p class="mt-2 text-gray-600">Ładowanie wizyt...</p>
        </div>
      `;

      const response = await firebaseService.getAppointments({ 
        status: this.currentFilter === 'all' ? null : this.currentFilter,
        limit: 100 
      });
      
      this.appointments = response.appointments;
      this.renderAppointments();
      
    } catch (error) {
      console.error('Error loading appointments:', error);
      this.showError('Błąd podczas ładowania wizyt: ' + error.message);
    }
  }

  filterAppointments(status) {
    this.currentFilter = status;
    this.loadAppointments();
    
    // Update button states
    const buttons = document.querySelectorAll('#admin-panel button');
    buttons.forEach(btn => {
      btn.classList.remove('bg-accent', 'text-white');
      btn.classList.add('bg-gray-200', 'text-gray-800');
    });
    
    event.target.classList.remove('bg-gray-200', 'text-gray-800');
    event.target.classList.add('bg-accent', 'text-white');
  }

  renderAppointments() {
    const listContainer = document.getElementById('appointments-list');
    
    if (this.appointments.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <p>Brak wizyt do wyświetlenia</p>
        </div>
      `;
      return;
    }

    const appointmentsHtml = this.appointments.map(appointment => this.renderAppointmentCard(appointment)).join('');
    listContainer.innerHTML = appointmentsHtml;
  }

  renderAppointmentCard(appointment) {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };

    const statusLabels = {
      pending: 'Oczekująca',
      confirmed: 'Potwierdzona',
      cancelled: 'Anulowana'
    };

    const serviceLabels = {
      'terapia-indywidualna': 'Terapia indywidualna',
      'terapia-par': 'Terapia par i małżeństw',
      'konsultacje-online': 'Konsultacje online'
    };

    return `
      <div class="bg-gray-50 p-6 rounded-lg border">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-lg font-semibold text-primary">${appointment.name}</h3>
            <p class="text-gray-600">${appointment.email}</p>
            ${appointment.phone ? `<p class="text-gray-600">${appointment.phone}</p>` : ''}
          </div>
          <span class="px-3 py-1 rounded-full text-sm font-medium border ${statusColors[appointment.status]}">
            ${statusLabels[appointment.status]}
          </span>
        </div>

        <div class="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <p class="text-sm text-gray-600"><strong>Usługa:</strong> ${serviceLabels[appointment.service] || appointment.service}</p>
            <p class="text-sm text-gray-600"><strong>Preferowany termin:</strong> ${appointment.preferredDate || 'Nie podano'}</p>
            <p class="text-sm text-gray-600"><strong>Preferowana godzina:</strong> ${appointment.preferredTime || 'Nie podano'}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600"><strong>Zgłoszenie:</strong> ${appointment.createdAt?.toLocaleDateString('pl-PL') || 'Nieznana data'}</p>
            <p class="text-sm text-gray-600"><strong>Ostatnia aktualizacja:</strong> ${appointment.updatedAt?.toLocaleDateString('pl-PL') || 'Nieznana data'}</p>
          </div>
        </div>

        ${appointment.message ? `
          <div class="mb-4">
            <p class="text-sm text-gray-600"><strong>Wiadomość:</strong></p>
            <p class="text-sm text-gray-700 bg-white p-3 rounded border">${appointment.message}</p>
          </div>
        ` : ''}

        ${appointment.notes ? `
          <div class="mb-4">
            <p class="text-sm text-gray-600"><strong>Notatki:</strong></p>
            <p class="text-sm text-gray-700 bg-white p-3 rounded border">${appointment.notes}</p>
          </div>
        ` : ''}

        <div class="flex gap-2 flex-wrap">
          ${appointment.status === 'pending' ? `
            <button onclick="adminPanel.updateAppointmentStatus('${appointment.id}', 'confirmed')" 
                    class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm">
              Potwierdź
            </button>
          ` : ''}
          
          ${appointment.status !== 'cancelled' ? `
            <button onclick="adminPanel.updateAppointmentStatus('${appointment.id}', 'cancelled')" 
                    class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm">
              Anuluj
            </button>
          ` : ''}
          
          <button onclick="adminPanel.showNotesDialog('${appointment.id}', '${appointment.notes || ''}')" 
                  class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm">
            ${appointment.notes ? 'Edytuj notatki' : 'Dodaj notatki'}
          </button>
        </div>
      </div>
    `;
  }

  async updateAppointmentStatus(appointmentId, newStatus) {
    try {
      await firebaseService.updateAppointment(appointmentId, { status: newStatus });
      this.loadAppointments(); // Refresh the list
      this.showSuccess(`Status wizyty został zmieniony na: ${newStatus}`);
    } catch (error) {
      console.error('Error updating appointment:', error);
      this.showError('Błąd podczas aktualizacji wizyty: ' + error.message);
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
      this.loadAppointments(); // Refresh the list
      this.showSuccess('Notatki zostały zaktualizowane');
    } catch (error) {
      console.error('Error updating notes:', error);
      this.showError('Błąd podczas aktualizacji notatek: ' + error.message);
    }
  }

  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  showMessage(message, type) {
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 
      'bg-red-100 text-red-800 border border-red-200'
    }`;
    messageDiv.innerHTML = message;

    document.body.appendChild(messageDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }
}

// Create global instance
window.adminPanel = new AdminPanel();
export default window.adminPanel;