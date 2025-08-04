// Time slot blocking management
import scheduleService from './schedule-service.js';

class SlotBlocking {
  constructor() {
    this.currentBlocks = [];
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  // Central event handler setup
  setup() {
    document.body.addEventListener('click', (event) => {
      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;

      const action = actionElement.dataset.action;

      switch (action) {
        case 'show-add-block-modal':
          this.showAddBlockModal();
          break;
        case 'hide-add-block-modal':
          this.hideAddBlockModal();
          break;
        case 'remove-block':
          { const blockId = actionElement.dataset.blockId;
          this.removeBlock(blockId);
          break; }
        case 'dismiss-message':
          actionElement.closest('.slot-blocking-message')?.remove();
          break;
      }
    });

    // Handle form submissions
    document.body.addEventListener('submit', (event) => {
      if (event.target.id === 'add-block-form') {
        event.preventDefault();
        this.handleAddBlock(event);
      }
    });

    // Handle select changes
    document.body.addEventListener('change', (event) => {
      if (event.target.id === 'block-type') {
        this.handleBlockTypeChange(event.target.value);
      }
    });
  }

  async renderBlockingInterface() {
    return `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 class="text-lg font-medium text-gray-900">Blokowanie terminów</h2>
            <p class="text-sm text-gray-600">Zarządzaj niedostępnymi terminami w kalendarzu</p>
          </div>
          <button data-action="show-add-block-modal" 
                  class="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Dodaj blokadę
          </button>
        </div>

        <div class="bg-white shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Aktywne blokady</h3>
            <div id="blocks-list">
              <div class="text-center py-8 text-gray-500">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                Ładowanie blokad...
              </div>
            </div>
          </div>
        </div>

        <div id="add-block-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
          <div class="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-md shadow">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-medium text-gray-900">Dodaj blokadę</h3>
              <button data-action="hide-add-block-modal" class="text-gray-400 hover:text-gray-600">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <form id="add-block-form" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Typ blokady</label>
                <select id="block-type" name="blockType" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Wybierz typ</option>
                  <option value="single-day">Pojedynczy dzień</option>
                  <option value="date-range">Zakres dat</option>
                  <option value="time-range">Zakres godzin</option>
                </select>
              </div>

              <div id="date-fields" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Data początkowa</label>
                  <input type="date" id="start-date" name="startDate" required 
                         class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                </div>
                
                <div id="end-date-field" class="hidden">
                  <label class="block text-sm font-medium text-gray-700 mb-1">Data końcowa</label>
                  <input type="date" id="end-date" name="endDate" 
                         class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                </div>
              </div>

              <div id="time-fields" class="hidden space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Godzina początkowa</label>
                  <input type="time" id="start-time" name="startTime" 
                         class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Godzina końcowa</label>
                  <input type="time" id="end-time" name="endTime" 
                         class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Powód blokady</label>
                <input type="text" id="block-reason" name="reason" placeholder="np. urlop, konferencja..."
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <button type="button" data-action="hide-add-block-modal"
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                  Anuluj
                </button>
                <button type="submit" 
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors">
                  Dodaj blokadę
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  async loadBlocks() {
    try {
      // Get blocks for next 3 months
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setMonth(today.getMonth() + 3);
      const endDateStr = endDate.toISOString().split('T')[0];

      const result = await scheduleService.getBlockedSlots(startDate, endDateStr);
      this.currentBlocks = result.blockedSlots || [];
      this.renderBlocksList();
    } catch (error) {
      console.error('Error loading blocks:', error);
      this.showError('Błąd podczas ładowania blokad');
    }
  }

  renderBlocksList() {
    const container = document.getElementById('blocks-list');
    if (!container) return;

    if (this.currentBlocks.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-lg font-medium">Brak aktywnych blokad</p>
          <p class="text-sm">Dodaj blokadę, aby uniemożliwić rezerwację określonych terminów</p>
        </div>
      `;
      return;
    }

    const blocksHtml = this.currentBlocks.map(block => {
      const startDate = new Date(block.startDate).toLocaleDateString('pl-PL');
      const endDate = block.endDate ? new Date(block.endDate).toLocaleDateString('pl-PL') : null;
      
      let dateDisplay = startDate;
      if (endDate && endDate !== startDate) {
        dateDisplay = `${startDate} - ${endDate}`;
      }

      let timeDisplay = '';
      if (block.startTime || block.endTime) {
        timeDisplay = `${block.startTime || '00:00'} - ${block.endTime || '23:59'}`;
      } else {
        timeDisplay = 'Cały dzień';
      }

      return `
        <div class="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-gray-900">${dateDisplay}</span>
                <span class="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Zablokowane</span>
              </div>
              <div class="text-sm text-gray-600 mb-1">
                <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                ${timeDisplay}
              </div>
              ${block.reason ? `<p class="text-sm text-gray-500">${block.reason}</p>` : ''}
            </div>
            <button data-action="remove-block" data-block-id="${block.id}"
                    class="flex-shrink-0 text-red-600 hover:text-red-800 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="space-y-3">${blocksHtml}</div>`;
  }

  showAddBlockModal() {
    const modal = document.getElementById('add-block-modal');
    if (modal) {
      modal.classList.remove('hidden');
      
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('start-date').min = today;
      document.getElementById('end-date').min = today;
    }
  }

  hideAddBlockModal() {
    const modal = document.getElementById('add-block-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.getElementById('add-block-form').reset();
      this.hideTimeFields();
      this.hideEndDateField();
    }
  }


  handleBlockTypeChange(blockType) {
    this.hideTimeFields();
    this.hideEndDateField();

    switch (blockType) {
      case 'date-range':
        this.showEndDateField();
        break;
      case 'time-range':
        this.showTimeFields();
        break;
      case 'single-day':
        // Only start date is needed
        break;
    }
  }

  showTimeFields() {
    const timeFields = document.getElementById('time-fields');
    if (timeFields) {
      timeFields.classList.remove('hidden');
      document.getElementById('start-time').required = true;
      document.getElementById('end-time').required = true;
    }
  }

  hideTimeFields() {
    const timeFields = document.getElementById('time-fields');
    if (timeFields) {
      timeFields.classList.add('hidden');
      document.getElementById('start-time').required = false;
      document.getElementById('end-time').required = false;
    }
  }

  showEndDateField() {
    const endDateField = document.getElementById('end-date-field');
    if (endDateField) {
      endDateField.classList.remove('hidden');
      document.getElementById('end-date').required = true;
    }
  }

  hideEndDateField() {
    const endDateField = document.getElementById('end-date-field');
    if (endDateField) {
      endDateField.classList.add('hidden');
      document.getElementById('end-date').required = false;
    }
  }

  async handleAddBlock(event) {
    const formData = new FormData(event.target);
    const blockData = {
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate') || formData.get('startDate'),
      startTime: formData.get('startTime') || null,
      endTime: formData.get('endTime') || null,
      reason: formData.get('reason') || 'Zablokowane przez administratora',
      isAllDay: !formData.get('startTime') && !formData.get('endTime')
    };

    if (blockData.endDate < blockData.startDate) {
      this.showError('Data końcowa nie może być wcześniejsza od daty początkowej');
      return;
    }

    if (blockData.startTime && blockData.endTime && blockData.startTime >= blockData.endTime) {
      this.showError('Godzina końcowa musi być późniejsza od godziny początkowej');
      return;
    }

    try {
      await scheduleService.createBlockedSlot(blockData);
      this.hideAddBlockModal();
      this.showSuccess('Blokada została dodana pomyślnie');
      await this.loadBlocks();
      
      if (window.calendarInterface) {
        window.calendarInterface.refreshCalendar();
      }
    } catch (error) {
      console.error('Error adding block:', error);
      this.showError('Błąd podczas dodawania blokady');
    }
  }

  async removeBlock(blockId) {
    if (!confirm('Czy na pewno chcesz usunąć tę blokadę?')) {
      return;
    }

    try {
      await scheduleService.deleteBlockedSlot(blockId);
      this.showSuccess('Blokada została usunięta');
      await this.loadBlocks();
      
      if (window.calendarInterface) {
        window.calendarInterface.refreshCalendar();
      }
    } catch (error) {
      console.error('Error removing block:', error);
      this.showError('Błąd podczas usuwania blokady');
    }
  }

  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  showMessage(message, type = 'info') {
    document.querySelector('.slot-blocking-message')?.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `slot-blocking-message fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 ${this.getMessageClasses(type)}`;
    messageDiv.innerHTML = `
      <div class="flex">
        <div class="flex-shrink-0">
          ${this.getMessageIcon(type)}
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium">${message}</p>
        </div>
        <div class="ml-auto pl-3">
          <button data-action="dismiss-message" class="text-gray-400 hover:text-gray-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(messageDiv);

    setTimeout(() => messageDiv.remove(), 5000);
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
        return `<svg class="w-5 h-5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>`;
      case 'error':
        return `<svg class="w-5 h-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>`;
      default:
        return `<svg class="w-5 h-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>`;
    }
  }
}

// Create global instance
const slotBlocking = new SlotBlocking();
window.slotBlocking = slotBlocking;
export default slotBlocking;