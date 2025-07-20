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
    if (!authSystem.verifyAuth()) {
      this.showAuthRequired();
      return;
    }
    if (window.adminNav) return; // New navigation system handles this

    this.createScheduleInterface();
    this.loadInitialData();
    this.setupEventListeners(); // Setup the main event listeners
  }

  setupEventListeners() {
    const container = document.getElementById('schedule-admin');
    if (!container) return;

    // Central click handler
    container.addEventListener('click', (event) => {
      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;

      const action = actionElement.dataset.action;
      const id = actionElement.dataset.id;
      const view = actionElement.dataset.view;
      const direction = actionElement.dataset.direction;

      switch (action) {
        case 'switch-view': this.switchView(view); break;
        case 'show-create-template-dialog': this.showCreateTemplateDialog(); break;
        case 'edit-template': this.editTemplate(id); break;
        case 'delete-template': this.deleteTemplate(id); break;
        case 'use-template-for-month': this.useTemplateForMonth(id); break;
        case 'change-month': this.changeMonth(parseInt(direction, 10)); break;
        case 'show-edit-schedule-dialog': this.showEditScheduleDialog(); break;
        case 'show-generate-schedule-dialog': this.showGenerateScheduleDialog(); break;
        case 'show-create-block-dialog': this.showCreateBlockDialog(); break;
        case 'edit-block': this.editBlock(id); break;
        case 'delete-block': this.deleteBlock(id); break;
      }
    });

    // Central dialog/form handler
    document.body.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-action="close-dialog"]');
        if (actionElement) {
            actionElement.closest('.dialog-container')?.remove();
        }
    });

    document.body.addEventListener('submit', (event) => {
        if (event.target.id === 'template-form') {
            event.preventDefault();
            const dialog = event.target.closest('.dialog-container');
            this.saveTemplate(dialog);
        } else if (event.target.id === 'edit-block-form') {
            event.preventDefault();
            const blockId = event.target.dataset.blockId;
            const dialog = event.target.closest('.dialog-container');
            this.updateBlock(blockId, dialog);
        } else if (event.target.id === 'edit-template-form') {
            event.preventDefault();
            const templateId = event.target.dataset.templateId;
            const dialog = event.target.closest('.dialog-container');
            this.updateTemplate(templateId, dialog);
        }
    });

    // Handle checkbox changes for all-day blocks
    document.body.addEventListener('change', (event) => {
      if (event.target.id === 'edit-block-all-day') {
        const dialog = event.target.closest('.dialog-container');
        const startTimeInput = dialog?.querySelector('#edit-block-start-time');
        const endTimeInput = dialog?.querySelector('#edit-block-end-time');
        
        if (event.target.checked) {
          startTimeInput.disabled = true;
          endTimeInput.disabled = true;
          startTimeInput.value = '';
          endTimeInput.value = '';
        } else {
          startTimeInput.disabled = false;
          endTimeInput.disabled = false;
        }
      }
    });
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
            <button data-action="switch-view" data-view="templates" class="py-4 px-1 border-b-2 font-medium text-sm border-blue-500 text-blue-600">Szablony grafików</button>
            <button data-action="switch-view" data-view="monthly" class="py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Grafik miesięczny</button>
            <button data-action="switch-view" data-view="blocked" class="py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Blokady terminów</button>
          </nav>
        </div>
        <div class="p-6">
          <div id="schedule-content"></div>
        </div>
      </div>
    `;
  }

  async switchView(view) {
    this.currentView = view;
    this.updateTabStyles();
    
    const content = document.getElementById('schedule-content');
    content.innerHTML = `<div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div><p class="mt-2 text-gray-600">Ładowanie...</p></div>`;

    switch (view) {
      case 'templates': await this.loadTemplatesView(); break;
      case 'monthly': await this.loadMonthlyView(); break;
      case 'blocked': await this.loadBlockedView(); break;
    }
  }

  updateTabStyles() {
    document.querySelectorAll('[data-action="switch-view"]').forEach(tab => {
      const isActive = tab.dataset.view === this.currentView;
      tab.className = `py-4 px-1 border-b-2 font-medium text-sm ${isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`;
    });
  }

  async loadInitialData() {
    await this.loadTemplatesView();
  }

  async loadTemplatesView() {
    try {
      const result = await scheduleService.getScheduleTemplates();
      if (!result.success) throw new Error(result.message || 'Failed to load templates');
      const templates = result.templates || [];
      const content = document.getElementById('schedule-content');
      content.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
          <h2 class="text-lg sm:text-xl font-semibold text-gray-900">Szablony grafików</h2>
          <button data-action="show-create-template-dialog" class="bg-blue-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm sm:text-base w-full sm:w-auto">Nowy szablon</button>
        </div>
        <div class="grid gap-3 sm:gap-4">
          ${templates.length === 0 ? `<div class="text-center py-6 sm:py-8 text-gray-500"><p class="text-sm sm:text-base">Brak szablonów grafików</p></div>` : templates.map(template => this.renderTemplateCard(template)).join('')}
        </div>`;
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
            <button data-action="edit-template" data-id="${template.id}" class="text-blue-600 hover:text-blue-800 text-xs sm:text-sm px-2 py-1 rounded border border-blue-200 hover:bg-blue-50">Edytuj</button>
            <button data-action="delete-template" data-id="${template.id}" class="text-red-600 hover:text-red-800 text-xs sm:text-sm px-2 py-1 rounded border border-red-200 hover:bg-red-50">Usuń</button>
          </div>
        </div>
        <div class="text-xs sm:text-sm text-gray-600 mb-3">
          <p>Łącznie terminów: ${totalSlots}</p>
          <p>Utworzono: ${new Date(template.createdAt).toLocaleDateString('pl-PL')}</p>
        </div>
        <div class="grid grid-cols-7 gap-2 text-xs">
          ${Object.entries(template.schedule).map(([day, times]) => `<div class="text-center"><div class="font-medium text-gray-700 mb-1">${this.getDayLabel(day)}</div><div class="space-y-1">${times.length === 0 ? '<div class="text-gray-400">Brak</div>' : times.map(time => `<div class="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">${time}</div>`).join('')}</div></div>`).join('')}
        </div>
        <div class="mt-4 pt-3 border-t border-gray-200">
          <button data-action="use-template-for-month" data-id="${template.id}" class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors">Użyj dla bieżącego miesiąca</button>
        </div>
      </div>`;
  }

  getDayLabel = (day) => ({ monday: 'Pon', tuesday: 'Wt', wednesday: 'Śr', thursday: 'Czw', friday: 'Pt', saturday: 'Sob', sunday: 'Nd' }[day] || day);

  showCreateTemplateDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'dialog-container fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    dialog.innerHTML = `
      <div class="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold mb-4">Nowy szablon grafiku</h3>
        <form id="template-form">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div><label class="block text-sm font-medium mb-2">Nazwa szablonu</label><input type="text" id="template-name" class="w-full border rounded px-3 py-2" required></div>
            <div><label class="block text-sm font-medium mb-2">Opis (opcjonalnie)</label><input type="text" id="template-description" class="w-full border rounded px-3 py-2"></div>
          </div>
          <div class="mb-6"><label class="flex items-center"><input type="checkbox" id="template-default" class="mr-2"> Ustaw jako domyślny szablon</label></div>
          <div class="mb-6"><h4 class="font-medium mb-3">Godziny pracy w poszczególne dni</h4><div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${this.renderDayScheduleInputs()}</div></div>
          <div class="flex gap-2">
            <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Zapisz szablon</button>
            <button type="button" data-action="close-dialog" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Anuluj</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(dialog);
  }

  renderDayScheduleInputs() {
    const days = [{ key: 'monday', label: 'Poniedziałek' }, { key: 'tuesday', label: 'Wtorek' }, { key: 'wednesday', label: 'Środa' }, { key: 'thursday', label: 'Czwartek' }, { key: 'friday', label: 'Piątek' }, { key: 'saturday', label: 'Sobota' }, { key: 'sunday', label: 'Niedziela' }];
    const timeOptions = this.generateTimeOptions();
    return days.map(day => `<div class="border rounded p-3"><label class="block text-sm font-medium mb-2">${day.label}</label><select multiple id="schedule-${day.key}" class="w-full border rounded px-3 py-2 h-32" size="8">${timeOptions.map(time => `<option value="${time}">${time}</option>`).join('')}</select><p class="text-xs text-gray-500 mt-1">Przytrzymaj Ctrl/Cmd aby wybrać wiele godzin</p></div>`).join('');
  }

  generateTimeOptions() {
    const times = [];
    for (let hour = 8; hour <= 20; hour++) {
      times.push(`${String(hour).padStart(2, '0')}:00`);
      if (hour < 20) times.push(`${String(hour).padStart(2, '0')}:30`);
    }
    return times;
  }

  async saveTemplate(dialog) {
    try {
      const schedule = {};
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
        schedule[day] = Array.from(dialog.querySelector(`#schedule-${day}`).selectedOptions).map(o => o.value);
      });
      const templateData = {
        name: dialog.querySelector('#template-name').value,
        description: dialog.querySelector('#template-description').value,
        isDefault: dialog.querySelector('#template-default').checked,
        schedule
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
      const generateButton = this.monthlySchedule 
        ? `<button data-action="show-edit-schedule-dialog" class="bg-blue-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm sm:text-base w-full sm:w-auto">Edytuj grafik</button>`
        : `<button data-action="show-generate-schedule-dialog" class="bg-green-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-green-600 transition-colors text-sm sm:text-base w-full sm:w-auto">Wygeneruj grafik</button>`;
      
      content.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h2 class="text-lg sm:text-xl font-semibold text-gray-900">Grafik miesięczny</h2>
            <div class="flex items-center gap-2 justify-center sm:justify-start">
              <button data-action="change-month" data-direction="-1" class="p-1 text-gray-500 hover:text-gray-700"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg></button>
              <span class="font-medium text-sm sm:text-base">${this.getMonthName(this.currentMonth)} ${this.currentYear}</span>
              <button data-action="change-month" data-direction="1" class="p-1 text-gray-500 hover:text-gray-700"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></button>
            </div>
          </div>
          ${generateButton}
        </div>
        ${this.monthlySchedule ? await this.renderMonthlyCalendar() : this.renderNoScheduleMessage()}`;
    } catch (error) {
      this.showError('Błąd podczas ładowania grafiku miesięcznego: ' + error.message);
    }
  }

  renderNoScheduleMessage() {
    return `<div class="text-center py-8 sm:py-12 bg-gray-50 rounded-lg px-4"><h3 class="text-base sm:text-lg font-medium text-gray-900 mb-2">Brak grafiku dla tego miesiąca</h3><p class="text-sm sm:text-base text-gray-600 mb-4">Wygeneruj grafik na podstawie szablonu lub utwórz go ręcznie</p><button data-action="show-generate-schedule-dialog" class="bg-green-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-green-600 transition-colors text-sm sm:text-base">Wygeneruj grafik</button></div>`;
  }

  async renderMonthlyCalendar() {
    try {
      const slotsResult = await scheduleService.getAvailableSlotsForMonth(this.currentYear, this.currentMonth);
      if (!slotsResult.success) return '<div class="text-center py-8 text-red-600">Błąd podczas ładowania harmonogramu</div>';
      
      const slots = slotsResult.slots || [];
      const slotsByDate = {};
      slots.forEach(slot => {
        if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
        slotsByDate[slot.date].push(slot);
      });

      const daysInMonth = scheduleService.getDaysInMonth(this.currentYear, this.currentMonth);
      const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1).getDay();
      const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

      let calendarHtml = `<div class="bg-white border rounded-lg overflow-hidden"><div class="grid grid-cols-7 bg-gray-50">${['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'].map(day => `<div class="p-3 text-center font-medium text-gray-700 border-r border-gray-200 last:border-r-0">${day}</div>`).join('')}</div><div class="grid grid-cols-7">`;
      for (let i = 0; i < adjustedFirstDay; i++) calendarHtml += '<div class="p-3 h-24 border-r border-b border-gray-200"></div>';

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const daySlots = slotsByDate[dateStr] || [];
        const availableSlots = daySlots.filter(slot => slot.isAvailable);
        const blockedSlots = daySlots.filter(slot => slot.isBlocked);
        calendarHtml += `<div class="p-3 h-24 border-r border-b border-gray-200 last:border-r-0 ${daySlots.length > 0 ? 'bg-green-50' : 'bg-gray-50'}"><div class="font-medium text-sm mb-1">${day}</div>${daySlots.length > 0 ? `<div class="text-xs space-y-1">${availableSlots.length > 0 ? `<div class="text-green-600">${availableSlots.length} dostępne</div>` : ''}${blockedSlots.length > 0 ? `<div class="text-gray-500">${blockedSlots.length} zablokowane</div>` : ''}</div>` : ''}</div>`;
      }
      calendarHtml += `</div></div>`;
      return calendarHtml;
    } catch (error) {
      console.error('Error rendering monthly calendar:', error);
      return '<div class="text-center py-8 text-red-600">Błąd podczas renderowania kalendarza</div>';
    }
  }

  changeMonth(direction) {
    this.currentMonth += direction;
    if (this.currentMonth > 12) { this.currentMonth = 1; this.currentYear++; }
    if (this.currentMonth < 1) { this.currentMonth = 12; this.currentYear--; }
    this.loadMonthlyView();
  }

  getMonthName(month) {
    return new Date(2000, month - 1, 1).toLocaleString('pl-PL', { month: 'long' });
  }

  showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 5000);
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
          <button data-action="show-create-block-dialog" class="bg-red-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-red-600 transition-colors text-sm sm:text-base w-full sm:w-auto">Nowa blokada</button>
        </div>
        <div class="grid gap-3 sm:gap-4">
          ${blockedSlots.length === 0 ? `<div class="text-center py-6 sm:py-8 text-gray-500"><p class="text-sm sm:text-base">Brak blokad terminów</p></div>` : blockedSlots.map(block => this.renderBlockCard(block)).join('')}
        </div>`;
    } catch (error) {
      this.showError('Błąd podczas ładowania blokad: ' + error.message);
    }
  }

  renderBlockCard(block) {
    const startDate = new Date(block.startDate).toLocaleDateString('pl-PL');
    const endDate = block.endDate ? new Date(block.endDate).toLocaleDateString('pl-PL') : null;
    return `
      <div class="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2 sm:gap-0">
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900 text-sm sm:text-base">${block.reason || 'Blokada terminu'}</h3>
            <div class="text-xs sm:text-sm text-gray-600 mt-1">
              <p><strong>Data:</strong> ${startDate}${endDate && endDate !== startDate ? ` - ${endDate}` : ''}</p>
              ${!block.isAllDay ? `<p><strong>Godziny:</strong> ${block.startTime || '00:00'} - ${block.endTime || '23:59'}</p>` : '<p><strong>Typ:</strong> Całodniowa</p>'}
            </div>
          </div>
          <div class="flex gap-2 sm:gap-3 self-start">
            <button data-action="edit-block" data-id="${block.id}" class="text-blue-600 hover:text-blue-800 text-xs sm:text-sm px-2 py-1 rounded border border-blue-200 hover:bg-blue-50">Edytuj</button>
            <button data-action="delete-block" data-id="${block.id}" class="text-red-600 hover:text-red-800 text-xs sm:text-sm px-2 py-1 rounded border border-red-200 hover:bg-red-50">Usuń</button>
          </div>
        </div>
        <div class="text-xs sm:text-sm text-gray-500"><p>Utworzone: ${new Date(block.createdAt).toLocaleDateString('pl-PL')}</p></div>
      </div>`;
  }

  showCreateBlockDialog() {
    const reason = prompt('Podaj powód blokady:'); if (!reason) return;
    const startDate = prompt('Podaj datę rozpoczęcia (YYYY-MM-DD):'); if (!startDate) return;
    const isAllDay = confirm('Czy blokada ma dotyczyć całego dnia?');
    let startTime, endTime;
    if (!isAllDay) {
      startTime = prompt('Podaj godzinę rozpoczęcia (HH:MM):') || '09:00';
      endTime = prompt('Podaj godzinę zakończenia (HH:MM):') || '17:00';
    }
    this.createBlock({ reason, startDate, endDate: startDate, startTime, endTime, isAllDay });
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
    try {
      const result = await scheduleService.getBlockedSlot(blockId);
      if (!result.success) throw new Error(result.message || 'Failed to load block');
      
      const block = result.blockedSlot;
      const dialog = document.createElement('div');
      dialog.className = 'dialog-container fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      dialog.innerHTML = `
        <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
          <h3 class="text-lg font-semibold mb-4">Edytuj blokadę</h3>
          <form id="edit-block-form" data-block-id="${blockId}">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-2">Powód blokady</label>
                <input type="text" id="edit-block-reason" class="w-full border rounded px-3 py-2" value="${block.reason || ''}" required>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Data rozpoczęcia</label>
                <input type="date" id="edit-block-start-date" class="w-full border rounded px-3 py-2" value="${block.startDate}" required>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Data zakończenia</label>
                <input type="date" id="edit-block-end-date" class="w-full border rounded px-3 py-2" value="${block.endDate || block.startDate}">
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-2">Godzina od</label>
                  <input type="time" id="edit-block-start-time" class="w-full border rounded px-3 py-2" value="${block.startTime || ''}">
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">Godzina do</label>
                  <input type="time" id="edit-block-end-time" class="w-full border rounded px-3 py-2" value="${block.endTime || ''}">
                </div>
              </div>
              <div>
                <label class="flex items-center">
                  <input type="checkbox" id="edit-block-all-day" class="mr-2" ${block.isAllDay ? 'checked' : ''}> 
                  Blokada całodniowa
                </label>
              </div>
            </div>
            <div class="flex gap-2 mt-6">
              <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Zapisz zmiany</button>
              <button type="button" data-action="close-dialog" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Anuluj</button>
            </div>
          </form>
        </div>`;
      
      document.body.appendChild(dialog);
      
      // Set initial state for all-day checkbox
      const allDayCheckbox = dialog.querySelector('#edit-block-all-day');
      const startTimeInput = dialog.querySelector('#edit-block-start-time');
      const endTimeInput = dialog.querySelector('#edit-block-end-time');
      
      if (allDayCheckbox.checked) {
        startTimeInput.disabled = true;
        endTimeInput.disabled = true;
      }
      
    } catch (error) {
      this.showMessage('Błąd podczas ładowania blokady: ' + error.message, 'error');
    }
  }

  async updateBlock(blockId, dialog) {
    try {
      const isAllDay = dialog.querySelector('#edit-block-all-day').checked;
      const blockData = {
        reason: dialog.querySelector('#edit-block-reason').value,
        startDate: dialog.querySelector('#edit-block-start-date').value,
        endDate: dialog.querySelector('#edit-block-end-date').value,
        startTime: isAllDay ? null : dialog.querySelector('#edit-block-start-time').value,
        endTime: isAllDay ? null : dialog.querySelector('#edit-block-end-time').value,
        isAllDay: isAllDay
      };
      
      if (blockData.endDate < blockData.startDate) {
        this.showMessage('Data zakończenia nie może być wcześniejsza od daty rozpoczęcia', 'error');
        return;
      }
      
      if (!isAllDay && blockData.startTime && blockData.endTime && blockData.startTime >= blockData.endTime) {
        this.showMessage('Godzina zakończenia musi być późniejsza od godziny rozpoczęcia', 'error');
        return;
      }
      
      await scheduleService.updateBlockedSlot(blockId, blockData);
      dialog.remove();
      await this.loadBlockedView();
      this.showMessage('Blokada została zaktualizowana', 'success');
    } catch (error) {
      this.showMessage('Błąd podczas aktualizacji blokady: ' + error.message, 'error');
    }
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
  showGenerateScheduleDialog() { this.showMessage('Funkcja generowania grafiku będzie dostępna wkrótce', 'info'); }
  showEditScheduleDialog() { this.showMessage('Funkcja edycji grafiku będzie dostępna wkrótce', 'info'); }
  renderEditDayScheduleInputs(schedule) {
    const days = [{ key: 'monday', label: 'Poniedziałek' }, { key: 'tuesday', label: 'Wtorek' }, { key: 'wednesday', label: 'Środa' }, { key: 'thursday', label: 'Czwartek' }, { key: 'friday', label: 'Piątek' }, { key: 'saturday', label: 'Sobota' }, { key: 'sunday', label: 'Niedziela' }];
    const timeOptions = this.generateTimeOptions();
    return days.map(day => {
      const selectedTimes = schedule[day.key] || [];
      return `<div class="border rounded p-3"><label class="block text-sm font-medium mb-2">${day.label}</label><select multiple id="edit-schedule-${day.key}" class="w-full border rounded px-3 py-2 h-32" size="8">${timeOptions.map(time => `<option value="${time}" ${selectedTimes.includes(time) ? 'selected' : ''}>${time}</option>`).join('')}</select><p class="text-xs text-gray-500 mt-1">Przytrzymaj Ctrl/Cmd aby wybrać wiele godzin</p></div>`;
    }).join('');
  }

  async updateTemplate(templateId, dialog) {
    try {
      const schedule = {};
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
        const selectElement = dialog.querySelector(`#edit-schedule-${day}`);
        schedule[day] = selectElement ? Array.from(selectElement.selectedOptions).map(o => o.value) : [];
      });
      const templateData = {
        name: dialog.querySelector('#edit-template-name').value,
        description: dialog.querySelector('#edit-template-description').value,
        isDefault: dialog.querySelector('#edit-template-default').checked,
        schedule
      };
      await scheduleService.updateScheduleTemplate(templateId, templateData);
      dialog.remove();
      await this.loadTemplatesView();
      this.showMessage('Szablon został zaktualizowany', 'success');
    } catch (error) {
      this.showMessage('Błąd podczas aktualizacji szablonu: ' + error.message, 'error');
    }
  }

  async editTemplate(templateId) {
    try {
      const result = await scheduleService.getScheduleTemplate(templateId);
      if (!result.success) throw new Error(result.message || 'Failed to load template');
      
      const template = result.template;
      const dialog = document.createElement('div');
      dialog.className = 'dialog-container fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      dialog.innerHTML = `
        <div class="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-semibold mb-4">Edytuj szablon grafiku</h3>
          <form id="edit-template-form" data-template-id="${templateId}">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label class="block text-sm font-medium mb-2">Nazwa szablonu</label>
                <input type="text" id="edit-template-name" class="w-full border rounded px-3 py-2" value="${template.name}" required>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Opis (opcjonalnie)</label>
                <input type="text" id="edit-template-description" class="w-full border rounded px-3 py-2" value="${template.description || ''}">
              </div>
            </div>
            <div class="mb-6">
              <label class="flex items-center">
                <input type="checkbox" id="edit-template-default" class="mr-2" ${template.isDefault ? 'checked' : ''}> 
                Ustaw jako domyślny szablon
              </label>
            </div>
            <div class="mb-6">
              <h4 class="font-medium mb-3">Godziny pracy w poszczególne dni</h4>
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                ${this.renderEditDayScheduleInputs(template.schedule)}
              </div>
            </div>
            <div class="flex gap-2">
              <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Zapisz zmiany</button>
              <button type="button" data-action="close-dialog" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Anuluj</button>
            </div>
          </form>
        </div>`;
      
      document.body.appendChild(dialog);
      
    } catch (error) {
      this.showMessage('Błąd podczas ładowania szablonu: ' + error.message, 'error');
    }
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

window.scheduleAdmin = new ScheduleAdmin();
export default window.scheduleAdmin;