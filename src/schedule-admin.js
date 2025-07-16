// Admin interface for schedule management
import scheduleService from './schedule-service.js';
import { authSystem } from './auth.js';

class ScheduleAdmin {
  constructor() {
    this.currentView = 'templates'; // templates, monthly, blocked
    this.currentMonth = new Date().getMonth() + 1;
    this.currentYear = new Date().getFullYear();
    this.selectedTemplate = null;
    this.monthlySchedule = null;
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
    // Check authentication
    if (!authSystem.verifyAuth()) {
      this.showAuthRequired();
      return;
    }

    // Check if we're in the new navigation system
    if (window.adminNav) {
      // Navigation system will handle initialization
      return;
    }
    
    // Fallback to old system
    this.createScheduleInterface();
    this.loadInitialData();
  }

  showAuthRequired() {
    const container = document.getElementById('schedule-admin') || this.createContainer();
    container.innerHTML = `
      <div class="bg-white p-8 rounded-lg shadow-lg text-center">
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Dostęp Ograniczony</h2>
        <p class="text-gray-600 mb-4">Wymagana autoryzacja administratora</p>
      </div>
    `;
  }

  createContainer() {
    const container = document.createElement('div');
    container.id = 'schedule-admin';
    container.className = 'container mx-auto px-4 py-8';
    document.body.appendChild(container);
    return container;
  }

  createScheduleInterface() {
    const container = document.getElementById('schedule-admin') || this.createContainer();
    
    container.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg">
        <div class="border-b border-gray-200">
          <nav class="flex space-x-8 px-6">
            <button id="templates-tab" class="py-4 px-1 border-b-2 font-medium text-sm ${this.currentView === 'templates' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
              Szablony grafików
            </button>
            <button id="monthly-tab" class="py-4 px-1 border-b-2 font-medium text-sm ${this.currentView === 'monthly' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
              Grafik miesięczny
            </button>
            <button id="blocked-tab" class="py-4 px-1 border-b-2 font-medium text-sm ${this.currentView === 'blocked' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
              Blokady terminów
            </button>
          </nav>
        </div>
        
        <div class="p-6">
          <div id="schedule-content">
            <div class="text-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p class="mt-2 text-gray-600">Ładowanie...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Set up tab navigation
    document.getElementById('templates-tab').addEventListener('click', () => this.switchView('templates'));
    document.getElementById('monthly-tab').addEventListener('click', () => this.switchView('monthly'));
    document.getElementById('blocked-tab').addEventListener('click', () => this.switchView('blocked'));
  }

  async switchView(view) {
    this.currentView = view;
    this.updateTabStyles();
    
    const content = document.getElementById('schedule-content');
    content.innerHTML = `
      <div class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p class="mt-2 text-gray-600">Ładowanie...</p>
      </div>
    `;

    switch (view) {
      case 'templates':
        await this.loadTemplatesView();
        break;
      case 'monthly':
        await this.loadMonthlyView();
        break;
      case 'blocked':
        await this.loadBlockedView();
        break;
    }
  }

  updateTabStyles() {
    const tabs = ['templates-tab', 'monthly-tab', 'blocked-tab'];
    tabs.forEach(tabId => {
      const tab = document.getElementById(tabId);
      const isActive = tabId === `${this.currentView}-tab`;
      
      if (isActive) {
        tab.className = 'py-4 px-1 border-b-2 border-blue-500 text-blue-600 font-medium text-sm';
      } else {
        tab.className = 'py-4 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium text-sm';
      }
    });
  }

  async loadInitialData() {
    await this.loadTemplatesView();
  }

  async loadTemplatesView() {
    try {
      console.log('Loading templates...'); // DEBUG
      const result = await scheduleService.getScheduleTemplates();
      console.log('Templates result:', result); // DEBUG
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to load templates');
      }
      
      const templates = result.templates || [];
      console.log('Templates:', templates); // DEBUG

      const content = document.getElementById('schedule-content');
      content.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
          <h2 class="text-lg sm:text-xl font-semibold text-gray-900">Szablony grafików</h2>
          <button onclick="scheduleAdmin.showCreateTemplateDialog()" class="bg-blue-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm sm:text-base w-full sm:w-auto">
            Nowy szablon
          </button>
        </div>

        <div class="grid gap-3 sm:gap-4">
          ${templates.length === 0 ? `
            <div class="text-center py-6 sm:py-8 text-gray-500">
              <p class="text-sm sm:text-base">Brak szablonów grafików</p>
            </div>
          ` : templates.map(template => this.renderTemplateCard(template)).join('')}
        </div>
      `;
    } catch (error) {
      this.showError('Błąd podczas ładowania szablonów: ' + error.message);
    }
  }

  renderTemplateCard(template) {
    const totalSlots = Object.values(template.schedule).flat().length;
    
    return `
      <div class="bg-gray-50 p-3 sm:p-4 rounded-lg border">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2 sm:gap-0">
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900 text-sm sm:text-base">${template.name}</h3>
            ${template.description ? `<p class="text-xs sm:text-sm text-gray-600 mt-1">${template.description}</p>` : ''}
            ${template.isDefault ? `<span class="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mt-1">Domyślny</span>` : ''}
          </div>
          <div class="flex gap-2 sm:gap-3 self-start">
            <button onclick="scheduleAdmin.editTemplate('${template.id}')" class="text-blue-600 hover:text-blue-800 text-xs sm:text-sm px-2 py-1 rounded border border-blue-200 hover:bg-blue-50">
              Edytuj
            </button>
            <button onclick="scheduleAdmin.deleteTemplate('${template.id}')" class="text-red-600 hover:text-red-800 text-xs sm:text-sm px-2 py-1 rounded border border-red-200 hover:bg-red-50">
              Usuń
            </button>
          </div>
        </div>
        
        <div class="text-xs sm:text-sm text-gray-600 mb-3">
          <p>Łącznie terminów: ${totalSlots}</p>
          <p>Utworzono: ${template.createdAt.toLocaleDateString('pl-PL')}</p>
        </div>
        
        <div class="grid grid-cols-7 gap-2 text-xs">
          ${Object.entries(template.schedule).map(([day, times]) => `
            <div class="text-center">
              <div class="font-medium text-gray-700 mb-1">${this.getDayLabel(day)}</div>
              <div class="space-y-1">
                ${times.length === 0 ? 
                  '<div class="text-gray-400">Brak</div>' : 
                  times.map(time => `<div class="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">${time}</div>`).join('')
                }
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="mt-4 pt-3 border-t border-gray-200">
          <button onclick="scheduleAdmin.useTemplateForMonth('${template.id}')" class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors">
            Użyj dla bieżącego miesiąca
          </button>
        </div>
      </div>
    `;
  }

  getDayLabel(day) {
    const labels = {
      monday: 'Pon',
      tuesday: 'Wt',
      wednesday: 'Śr',
      thursday: 'Czw',
      friday: 'Pt',
      saturday: 'Sob',
      sunday: 'Nd'
    };
    return labels[day] || day;
  }

  showCreateTemplateDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    dialog.innerHTML = `
      <div class="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold mb-4">Nowy szablon grafiku</h3>
        
        <form id="template-form">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label class="block text-sm font-medium mb-2">Nazwa szablonu</label>
              <input type="text" id="template-name" class="w-full border rounded px-3 py-2" required>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Opis (opcjonalnie)</label>
              <input type="text" id="template-description" class="w-full border rounded px-3 py-2">
            </div>
          </div>
          
          <div class="mb-6">
            <label class="flex items-center">
              <input type="checkbox" id="template-default" class="mr-2">
              Ustaw jako domyślny szablon
            </label>
          </div>
          
          <div class="mb-6">
            <h4 class="font-medium mb-3">Godziny pracy w poszczególne dni</h4>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              ${this.renderDayScheduleInputs()}
            </div>
          </div>
          
          <div class="flex gap-2">
            <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Zapisz szablon
            </button>
            <button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              Anuluj
            </button>
          </div>
        </form>
      </div>
    `;
    
    dialog.querySelector('#template-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveTemplate(dialog);
    });
    
    document.body.appendChild(dialog);
  }

  renderDayScheduleInputs() {
    const days = [
      { key: 'monday', label: 'Poniedziałek' },
      { key: 'tuesday', label: 'Wtorek' },
      { key: 'wednesday', label: 'Środa' },
      { key: 'thursday', label: 'Czwartek' },
      { key: 'friday', label: 'Piątek' },
      { key: 'saturday', label: 'Sobota' },
      { key: 'sunday', label: 'Niedziela' }
    ];

    const timeOptions = this.generateTimeOptions();

    return days.map(day => `
      <div class="border rounded p-3">
        <label class="block text-sm font-medium mb-2">${day.label}</label>
        <select multiple id="schedule-${day.key}" class="w-full border rounded px-3 py-2 h-32" size="8">
          ${timeOptions.map(time => `<option value="${time}">${time}</option>`).join('')}
        </select>
        <p class="text-xs text-gray-500 mt-1">Przytrzymaj Ctrl/Cmd aby wybrać wiele godzin</p>
      </div>
    `).join('');
  }

  generateTimeOptions() {
    const times = [];
    for (let hour = 8; hour <= 20; hour++) {
      times.push(`${String(hour).padStart(2, '0')}:00`);
      if (hour < 20) {
        times.push(`${String(hour).padStart(2, '0')}:30`);
      }
    }
    return times;
  }

  async saveTemplate(dialog) {
    try {
      const name = dialog.querySelector('#template-name').value;
      const description = dialog.querySelector('#template-description').value;
      const isDefault = dialog.querySelector('#template-default').checked;

      const schedule = {
        monday: Array.from(dialog.querySelector('#schedule-monday').selectedOptions).map(o => o.value),
        tuesday: Array.from(dialog.querySelector('#schedule-tuesday').selectedOptions).map(o => o.value),
        wednesday: Array.from(dialog.querySelector('#schedule-wednesday').selectedOptions).map(o => o.value),
        thursday: Array.from(dialog.querySelector('#schedule-thursday').selectedOptions).map(o => o.value),
        friday: Array.from(dialog.querySelector('#schedule-friday').selectedOptions).map(o => o.value),
        saturday: Array.from(dialog.querySelector('#schedule-saturday').selectedOptions).map(o => o.value),
        sunday: Array.from(dialog.querySelector('#schedule-sunday').selectedOptions).map(o => o.value)
      };

      const templateData = {
        name,
        description,
        schedule,
        isDefault
      };

      await scheduleService.createScheduleTemplate(templateData);
      dialog.remove();
      await this.loadTemplatesView();
      this.showMessage('Szablon został utworzony', 'success');
    } catch (error) {
      this.showMessage('Błąd podczas tworzenia szablonu: ' + error.message, 'error');
    }
  }

  async useTemplateForMonth(templateId) {
    try {
      await scheduleService.generateMonthlySchedule(this.currentYear, this.currentMonth, templateId);
      this.showMessage('Grafik miesięczny został wygenerowany', 'success');
      this.switchView('monthly');
    } catch (error) {
      this.showMessage('Błąd podczas generowania grafiku: ' + error.message, 'error');
    }
  }

  async loadMonthlyView() {
    try {
      const result = await scheduleService.getMonthlySchedule(this.currentYear, this.currentMonth);
      this.monthlySchedule = result.schedule;

      const content = document.getElementById('schedule-content');
      content.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h2 class="text-lg sm:text-xl font-semibold text-gray-900">Grafik miesięczny</h2>
            <div class="flex items-center gap-2 justify-center sm:justify-start">
              <button onclick="scheduleAdmin.changeMonth(-1)" class="p-1 text-gray-500 hover:text-gray-700">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
              </button>
              <span class="font-medium text-sm sm:text-base">${this.getMonthName(this.currentMonth)} ${this.currentYear}</span>
              <button onclick="scheduleAdmin.changeMonth(1)" class="p-1 text-gray-500 hover:text-gray-700">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </button>
            </div>
          </div>
          ${this.monthlySchedule ? `
            <button onclick="scheduleAdmin.showEditScheduleDialog()" class="bg-blue-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm sm:text-base w-full sm:w-auto">
              Edytuj grafik
            </button>
          ` : `
            <button onclick="scheduleAdmin.showGenerateScheduleDialog()" class="bg-green-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-green-600 transition-colors text-sm sm:text-base w-full sm:w-auto">
              Wygeneruj grafik
            </button>
          `}
        </div>

        ${this.monthlySchedule ? await this.renderMonthlyCalendar() : this.renderNoScheduleMessage()}
      `;
    } catch (error) {
      this.showError('Błąd podczas ładowania grafiku miesięcznego: ' + error.message);
    }
  }

  renderNoScheduleMessage() {
    return `
      <div class="text-center py-8 sm:py-12 bg-gray-50 rounded-lg px-4">
        <h3 class="text-base sm:text-lg font-medium text-gray-900 mb-2">Brak grafiku dla tego miesiąca</h3>
        <p class="text-sm sm:text-base text-gray-600 mb-4">Wygeneruj grafik na podstawie szablonu lub utwórz go ręcznie</p>
        <button onclick="scheduleAdmin.showGenerateScheduleDialog()" class="bg-green-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-green-600 transition-colors text-sm sm:text-base">
          Wygeneruj grafik
        </button>
      </div>
    `;
  }

  async renderMonthlyCalendar() {
    try {
      const slotsResult = await scheduleService.getAvailableSlotsForMonth(this.currentYear, this.currentMonth);
      
      if (!slotsResult.success) {
        return '<div class="text-center py-8 text-red-600">Błąd podczas ładowania harmonogramu</div>';
      }
      
      const slots = slotsResult.slots || [];

      // Group slots by date
      const slotsByDate = {};
      slots.forEach(slot => {
        if (!slotsByDate[slot.date]) {
          slotsByDate[slot.date] = [];
        }
        slotsByDate[slot.date].push(slot);
      });

      const daysInMonth = scheduleService.getDaysInMonth(this.currentYear, this.currentMonth);
      const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1).getDay();
      const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Monday = 0

      let calendarHtml = `
        <div class="bg-white border rounded-lg overflow-hidden">
          <div class="grid grid-cols-7 bg-gray-50">
            ${['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'].map(day => 
              `<div class="p-3 text-center font-medium text-gray-700 border-r border-gray-200 last:border-r-0">${day}</div>`
            ).join('')}
          </div>
          <div class="grid grid-cols-7">
      `;

      // Empty cells for days before month start
      for (let i = 0; i < adjustedFirstDay; i++) {
        calendarHtml += '<div class="p-3 h-24 border-r border-b border-gray-200"></div>';
      }

      // Days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const daySlots = slotsByDate[dateStr] || [];
        const availableSlots = daySlots.filter(slot => slot.isAvailable);
        const blockedSlots = daySlots.filter(slot => slot.isBlocked);

        calendarHtml += `
          <div class="p-3 h-24 border-r border-b border-gray-200 last:border-r-0 ${daySlots.length > 0 ? 'bg-green-50' : 'bg-gray-50'}">
            <div class="font-medium text-sm mb-1">${day}</div>
            ${daySlots.length > 0 ? `
              <div class="text-xs space-y-1">
                ${availableSlots.length > 0 ? `<div class="text-green-600">${availableSlots.length} dostępne</div>` : ''}
                ${blockedSlots.length > 0 ? `<div class="text-gray-500">${blockedSlots.length} zablokowane</div>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }

      calendarHtml += `
          </div>
        </div>
      `;

      return calendarHtml;
    } catch (error) {
      console.error('Error rendering monthly calendar:', error);
      return '<div class="text-center py-8 text-red-600">Błąd podczas renderowania kalendarza</div>';
    }
  }

  changeMonth(direction) {
    if (direction > 0) {
      if (this.currentMonth === 12) {
        this.currentMonth = 1;
        this.currentYear++;
      } else {
        this.currentMonth++;
      }
    } else {
      if (this.currentMonth === 1) {
        this.currentMonth = 12;
        this.currentYear--;
      } else {
        this.currentMonth--;
      }
    }
    
    this.loadMonthlyView();
  }

  getMonthName(month) {
    const months = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    return months[month - 1];
  }

  showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 
      'bg-red-100 text-red-800 border border-red-200'
    }`;
    messageDiv.innerHTML = message;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  async loadBlockedView() {
    try {
      const result = await scheduleService.getBlockedSlots();
      const blockedSlots = result.blockedSlots || [];

      const content = document.getElementById('schedule-content');
      content.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
          <h2 class="text-lg sm:text-xl font-semibold text-gray-900">Blokady terminów</h2>
          <button onclick="scheduleAdmin.showCreateBlockDialog()" class="bg-red-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-red-600 transition-colors text-sm sm:text-base w-full sm:w-auto">
            Nowa blokada
          </button>
        </div>

        <div class="grid gap-3 sm:gap-4">
          ${blockedSlots.length === 0 ? `
            <div class="text-center py-6 sm:py-8 text-gray-500">
              <p class="text-sm sm:text-base">Brak blokad terminów</p>
            </div>
          ` : blockedSlots.map(block => this.renderBlockCard(block)).join('')}
        </div>
      `;
    } catch (error) {
      this.showError('Błąd podczas ładowania blokad: ' + error.message);
    }
  }

  renderBlockCard(block) {
    const isAllDay = block.isAllDay;
    const startDate = new Date(block.startDate).toLocaleDateString('pl-PL');
    const endDate = block.endDate ? new Date(block.endDate).toLocaleDateString('pl-PL') : null;
    
    return `
      <div class="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2 sm:gap-0">
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900 text-sm sm:text-base">${block.reason || 'Blokada terminu'}</h3>
            <div class="text-xs sm:text-sm text-gray-600 mt-1">
              <p><strong>Data:</strong> ${startDate}${endDate && endDate !== startDate ? ` - ${endDate}` : ''}</p>
              ${!isAllDay ? `<p><strong>Godziny:</strong> ${block.startTime || '00:00'} - ${block.endTime || '23:59'}</p>` : '<p><strong>Typ:</strong> Całodniowa</p>'}
            </div>
          </div>
          <div class="flex gap-2 sm:gap-3 self-start">
            <button onclick="scheduleAdmin.editBlock('${block.id}')" class="text-blue-600 hover:text-blue-800 text-xs sm:text-sm px-2 py-1 rounded border border-blue-200 hover:bg-blue-50">
              Edytuj
            </button>
            <button onclick="scheduleAdmin.deleteBlock('${block.id}')" class="text-red-600 hover:text-red-800 text-xs sm:text-sm px-2 py-1 rounded border border-red-200 hover:bg-red-50">
              Usuń
            </button>
          </div>
        </div>
        
        <div class="text-xs sm:text-sm text-gray-500">
          <p>Utworzone: ${new Date(block.createdAt).toLocaleDateString('pl-PL')}</p>
        </div>
      </div>
    `;
  }

  showCreateBlockDialog() {
    // Simple prompt-based dialog for now
    const reason = prompt('Podaj powód blokady:');
    if (!reason) return;
    
    const startDate = prompt('Podaj datę rozpoczęcia (YYYY-MM-DD):');
    if (!startDate) return;
    
    const isAllDay = confirm('Czy blokada ma dotyczyć całego dnia?');
    
    let startTime, endTime;
    if (!isAllDay) {
      startTime = prompt('Podaj godzinę rozpoczęcia (HH:MM):') || '09:00';
      endTime = prompt('Podaj godzinę zakończenia (HH:MM):') || '17:00';
    }
    
    this.createBlock({
      reason,
      startDate,
      endDate: startDate, // For now, single day blocks
      startTime,
      endTime,
      isAllDay
    });
  }

  async createBlock(blockData) {
    try {
      await scheduleService.createBlockedSlot(blockData);
      await this.loadBlockedView();
      this.showMessage('Blokada została utworzona', 'success');
    } catch (error) {
      this.showMessage('Błąd podczas tworzenia blokady: ' + error.message, 'error');
    }
  }

  async editBlock(blockId) {
    this.showMessage('Funkcja edycji blokady będzie dostępna wkrótce', 'info');
  }

  async deleteBlock(blockId) {
    if (confirm('Czy na pewno chcesz usunąć tę blokadę?')) {
      try {
        await scheduleService.deleteBlockedSlot(blockId);
        await this.loadBlockedView();
        this.showMessage('Blokada została usunięta', 'success');
      } catch (error) {
        this.showMessage('Błąd podczas usuwania blokady: ' + error.message, 'error');
      }
    }
  }

  showGenerateScheduleDialog() {
    // Placeholder for generate schedule dialog
    this.showMessage('Funkcja generowania grafiku będzie dostępna wkrótce', 'info');
  }

  showEditScheduleDialog() {
    // Placeholder for edit schedule dialog
    this.showMessage('Funkcja edycji grafiku będzie dostępna wkrótce', 'info');
  }

  async editTemplate(templateId) {
    // Placeholder for template editing
    this.showMessage('Funkcja edycji szablonu będzie dostępna wkrótce', 'info');
  }

  async deleteTemplate(templateId) {
    if (confirm('Czy na pewno chcesz usunąć ten szablon?')) {
      try {
        await scheduleService.deleteScheduleTemplate(templateId);
        await this.loadTemplatesView();
        this.showMessage('Szablon został usunięty', 'success');
      } catch (error) {
        this.showMessage('Błąd podczas usuwania szablonu: ' + error.message, 'error');
      }
    }
  }
}

// Create global instance
window.scheduleAdmin = new ScheduleAdmin();
export default window.scheduleAdmin;