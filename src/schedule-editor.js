// Schedule editing functionality
import scheduleService from './schedule-service.js';

class ScheduleEditor {
  constructor() {
    this.currentTemplate = null;
    this.currentAssignments = [];
    this.templates = [];
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
    // This will be called from admin navigation when needed
    // We will set up event listeners when the component is rendered.
  }

  // Central event handler for the entire component
  setupEventListeners(container) {
      if (container.dataset.eventsAttached) return;
      container.dataset.eventsAttached = 'true';

      // Click handler
      container.addEventListener('click', (event) => {
          const actionElement = event.target.closest('[data-action]');
          if (!actionElement) return;

          const action = actionElement.dataset.action;
          const id = actionElement.dataset.id;
          const day = actionElement.dataset.day;

          switch (action) {
              case 'show-create-template-modal': this.showCreateTemplateModal(); break;
              case 'hide-create-template-modal': this.hideCreateTemplateModal(); break;
              case 'show-assign-template-modal': this.showAssignTemplateModal(); break;
              case 'hide-assign-template-modal': this.hideAssignTemplateModal(); break;
              case 'select-all-slots': this.selectAllSlots(day); break;
              case 'clear-all-slots': this.clearAllSlots(day); break;
              case 'edit-template': this.editTemplate(id); break;
              case 'delete-template': this.deleteTemplate(id); break;
              case 'delete-assignment': this.deleteAssignment(id); break;
              case 'close-edit-template-modal': 
                  { const modal = actionElement.closest('.edit-template-modal');
                  if (modal) modal.remove();
                  break; }
              case 'dismiss-message': actionElement.closest('.schedule-editor-message')?.remove(); break;
          }
      });

      // Change handler for toggles and selects
      container.addEventListener('change', (event) => {
          const actionElement = event.target.closest('[data-action]');
          if (!actionElement) return;

          const action = actionElement.dataset.action;
          const day = actionElement.dataset.day;

          switch(action) {
              case 'toggle-day-schedule': this.toggleDaySchedule(day, event.target.checked); break;
              case 'toggle-assignment-mode': this.toggleAssignmentMode(event.target.value); break;
          }
      });

      // Form submission handler
      container.addEventListener('submit', (event) => {
          event.preventDefault();
          const formId = event.target.id;
          if (formId === 'create-template-form') {
              this.handleCreateTemplate(event);
          } else if (formId === 'assign-template-form') {
              this.handleAssignTemplate(event);
          } else if (formId === 'edit-template-form') {
              const templateId = event.target.dataset.templateId;
              const modal = event.target.closest('.modal-overlay');
              this.handleEditTemplate(templateId, modal);
          }
      });
  }


  async renderScheduleEditor() {
    try {
      await this.loadTemplates();
      await this.loadAssignments();

      // The main container will now hold the event listeners
      const containerId = 'schedule-editor-container';
      
      // We need to run the setupEventListeners *after* this HTML is in the DOM.
      // A common way is to return the HTML and a callback to run.
      const html = `
        <div id="${containerId}" class="space-y-6">
          <!-- Header -->
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 class="text-lg font-medium text-gray-900">Edytor harmonogramów</h2>
              <p class="text-sm text-gray-600">Zarządzaj szablonami harmonogramów i przypisaniami do miesięcy</p>
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
              <button data-action="show-create-template-modal"
                      class="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                Nowy szablon
              </button>
              <button data-action="show-assign-template-modal"
                      class="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Przypisz do miesięcy
              </button>
            </div>
          </div>

          <!-- Templates List -->
          <div class="bg-white shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Szablony harmonogramów</h3>
              <div id="templates-list">
                <div class="text-center py-8 text-gray-500"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>Ładowanie szablonów...</div>
              </div>
            </div>
          </div>

          <!-- Template Assignments -->
          <div class="bg-white shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Przypisania szablonów do miesięcy</h3>
              <div id="assignments-list">
                <div class="text-center py-8 text-gray-500"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>Ładowanie przypisań...</div>
              </div>
            </div>
          </div>

          ${this.renderModals()}
        </div>
      `;

        // This is a bit tricky. The function that calls renderScheduleEditor
        // needs to inject the HTML and then call this setup function.
        // For example:
        // const content = await scheduleEditor.renderScheduleEditor();
        // targetElement.innerHTML = content.html;
        // content.postRenderSetup();
        const postRenderSetup = () => {
            const container = document.getElementById(containerId);
            if(container) {
                this.setupEventListeners(container);
                this.renderTemplatesList();
                this.renderAssignmentsList();
            }
        };

        return { html, postRenderSetup };

    } catch (error) {
      console.error('Error rendering schedule editor:', error);
      return { html: `<div class="bg-white shadow rounded-lg p-6"><div class="text-center py-8 text-red-600"><p>Błąd podczas ładowania edytora harmonogramów</p></div></div>`, postRenderSetup: () => {} };
    }
  }

  renderModals() {
    return `
      <!-- Create Template Modal -->
      <div id="create-template-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
        <div class="relative top-10 mx-auto p-5 border w-full max-w-2xl bg-white rounded-md shadow">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Utwórz nowy szablon</h3>
            <button data-action="hide-create-template-modal" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <form id="create-template-form" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Nazwa szablonu</label><input type="text" name="name" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Opis</label><input type="text" name="description" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"></div>
            </div>
            <div class="space-y-4"><h4 class="text-md font-medium text-gray-900">Harmonogram tygodniowy</h4>${this.renderWeeklyScheduleEditor()}</div>
            <div class="flex justify-end space-x-3 mt-6">
              <button type="button" data-action="hide-create-template-modal" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">Anuluj</button>
              <button type="submit" class="px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors">Utwórz szablon</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Assign Template Modal -->
      <div id="assign-template-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
        <div class="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-md shadow">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Przypisz szablon do miesięcy</h3>
            <button data-action="hide-assign-template-modal" class="text-gray-400 hover:text-gray-600"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          </div>
          <form id="assign-template-form" class="space-y-4">
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Szablon</label><select id="assign-template-select" name="templateId" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"><option value="">Wybierz szablon</option></select></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Rok</label><input type="number" id="assign-year" name="year" required min="2024" max="2030" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Tryb przypisania</label><select data-action="toggle-assignment-mode" name="assignmentMode" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"><option value="">Wybierz tryb</option><option value="yearly">Cały rok</option><option value="monthly">Wybrane miesiące</option></select></div>
            <div id="months-selection" class="hidden"><label class="block text-sm font-medium text-gray-700 mb-2">Wybierz miesiące</label><div class="grid grid-cols-3 gap-2">${this.renderMonthCheckboxes()}</div></div>
            <div class="flex justify-end space-x-3 mt-6">
              <button type="button" data-action="hide-assign-template-modal" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">Anuluj</button>
              <button type="submit" class="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors">Przypisz</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  renderWeeklyScheduleEditor() {
    const days = [{ key: 'monday', name: 'Poniedziałek' }, { key: 'tuesday', name: 'Wtorek' }, { key: 'wednesday', name: 'Środa' }, { key: 'thursday', name: 'Czwartek' }, { key: 'friday', name: 'Piątek' }, { key: 'saturday', name: 'Sobota' }, { key: 'sunday', name: 'Niedziela' }];
    const timeSlots = this.generateTimeSlots();
    return days.map(day => `
      <div class="border border-gray-200 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h5 class="font-medium text-gray-900">${day.name}</h5>
          <div class="flex items-center space-x-3">
            <button type="button" data-action="select-all-slots" data-day="${day.key}" class="text-xs text-blue-600 hover:text-blue-800">Zaznacz wszystkie</button>
            <button type="button" data-action="clear-all-slots" data-day="${day.key}" class="text-xs text-gray-600 hover:text-gray-800">Wyczyść</button>
            <label class="flex items-center"><input type="checkbox" data-action="toggle-day-schedule" data-day="${day.key}" checked class="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"><span class="text-sm text-gray-600">Dzień roboczy</span></label>
          </div>
        </div>
        <div id="${day.key}-schedule" class="space-y-3">
          <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            ${timeSlots.map(time => `<label class="flex items-center text-xs"><input type="checkbox" name="${day.key}-times" value="${time}" class="mr-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 time-slot-checkbox" ${this.isDefaultWorkingHour(time) ? 'checked' : ''}><span class="text-gray-700">${time}</span></label>`).join('')}
          </div>
        </div>
      </div>`).join('');
  }

  generateTimeSlots() {
    const slots = [];
    for (let hour = 7; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }

  isDefaultWorkingHour = (time) => { const [hour] = time.split(':').map(Number); return hour >= 9 && hour < 17; };

  renderMonthCheckboxes() {
    const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    return months.map((month, index) => `<label class="flex items-center"><input type="checkbox" name="months" value="${index + 1}" class="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"><span class="text-sm">${month}</span></label>`).join('');
  }

  async loadTemplates() {
    try {
      const result = await scheduleService.getScheduleTemplates();
      this.templates = result.templates || [];
      this.renderTemplatesList();
      this.updateTemplateSelect();
    } catch (error) {
      console.error('Error loading templates:', error);
      this.showError('Błąd podczas ładowania szablonów');
    }
  }

  async loadAssignments() {
    try {
      const result = await scheduleService.getTemplateAssignments();
      this.currentAssignments = result.assignments || [];
      this.renderAssignmentsList();
    } catch (error) {
      console.error('Error loading assignments:', error);
      this.showError('Błąd podczas ładowania przypisań');
    }
  }

  renderTemplatesList() {
    const container = document.getElementById('templates-list');
    if (!container) return;
    if (this.templates.length === 0) {
      container.innerHTML = `<div class="text-center py-8 text-gray-500"><svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><p class="text-lg font-medium">Brak szablonów</p><p class="text-sm">Utwórz pierwszy szablon harmonogramu</p></div>`;
      return;
    }
    const templatesHtml = this.templates.map(template => {
      const workingDays = Object.entries(template.schedule || {}).filter(([, times]) => times && times.length > 0).map(([day]) => this.getDayName(day)).join(', ');
      return `
        <div class="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1"><h4 class="font-medium text-gray-900">${template.name}</h4>${template.isDefault ? '<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Domyślny</span>' : ''}</div>
              <p class="text-sm text-gray-600 mb-2">${template.description || 'Brak opisu'}</p>
              <div class="text-xs text-gray-500"><p>Dni robocze: ${workingDays || 'Brak'}</p><p>Utworzono: ${template.createdAt ? new Date(template.createdAt).toLocaleDateString('pl-PL') : 'N/A'}</p></div>
            </div>
            <div class="flex items-center space-x-2">
              <button data-action="edit-template" data-id="${template.id}" class="text-blue-600 hover:text-blue-800 transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
              <button data-action="delete-template" data-id="${template.id}" class="text-red-600 hover:text-red-800 transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div>
          </div>
        </div>`;
    }).join('');
    container.innerHTML = `<div class="space-y-3">${templatesHtml}</div>`;
  }

  renderAssignmentsList() {
    const container = document.getElementById('assignments-list');
    if (!container) return;
    if (this.currentAssignments.length === 0) {
      container.innerHTML = `<div class="text-center py-8 text-gray-500"><svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><p class="text-lg font-medium">Brak przypisań</p><p class="text-sm">Przypisz szablony do konkretnych miesięcy</p></div>`;
      return;
    }
    const assignmentsHtml = this.currentAssignments.map(assignment => {
      const template = this.templates.find(t => t.id === assignment.templateId);
      const templateName = template ? template.name : 'Szablon usunięty';
      const periodDisplay = assignment.month ? `${this.getMonthName(assignment.month)} ${assignment.year}` : assignment.year.toString();
      return `
        <div class="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1"><h4 class="font-medium text-gray-900">${templateName}</h4><span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">${periodDisplay}</span></div>
              <p class="text-sm text-gray-600">${assignment.description || 'Brak opisu'}</p>
              <p class="text-xs text-gray-500 mt-1">Utworzono: ${assignment.createdAt ? new Date(assignment.createdAt).toLocaleDateString('pl-PL') : 'N/A'}</p>
            </div>
            <button data-action="delete-assignment" data-id="${assignment.id}" class="flex-shrink-0 text-red-600 hover:text-red-800 transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
          </div>
        </div>`;
    }).join('');
    container.innerHTML = `<div class="space-y-3">${assignmentsHtml}</div>`;
  }

  updateTemplateSelect() {
    const select = document.getElementById('assign-template-select');
    if (!select) return;
    select.innerHTML = '<option value="">Wybierz szablon</option>';
    this.templates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.name;
      select.appendChild(option);
    });
  }

  showCreateTemplateModal = () => document.getElementById('create-template-modal')?.classList.remove('hidden');
  hideCreateTemplateModal = () => document.getElementById('create-template-modal')?.classList.add('hidden');
  showAssignTemplateModal() {
    const modal = document.getElementById('assign-template-modal');
    if (modal) {
      modal.classList.remove('hidden');
      document.getElementById('assign-year').value = new Date().getFullYear();
    }
  }
  hideAssignTemplateModal() {
    const modal = document.getElementById('assign-template-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.getElementById('assign-template-form').reset();
      document.getElementById('months-selection').classList.add('hidden');
    }
  }

  toggleAssignmentMode(value) {
      const monthsSelection = document.getElementById('months-selection');
      if (value === 'monthly') {
        monthsSelection.classList.remove('hidden');
      } else {
        monthsSelection.classList.add('hidden');
      }
  }

  async handleCreateTemplate(event) {
    const formData = new FormData(event.target);
    const schedule = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
      const dayEnabled = document.querySelector(`[data-action="toggle-day-schedule"][data-day="${day}"]`).checked;
      schedule[day] = dayEnabled ? Array.from(document.querySelectorAll(`input[name="${day}-times"]:checked`)).map(cb => cb.value).sort() : [];
    });
    const templateData = { name: formData.get('name'), description: formData.get('description'), schedule };
    try {
      await scheduleService.createScheduleTemplate(templateData);
      this.hideCreateTemplateModal();
      this.showSuccess('Szablon został utworzony pomyślnie');
      await this.loadTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      this.showError('Błąd podczas tworzenia szablonu');
    }
  }

  async handleAssignTemplate(event) {
    const formData = new FormData(event.target);
    const templateId = formData.get('templateId');
    const year = parseInt(formData.get('year'));
    const assignmentMode = formData.get('assignmentMode');
    let assignments = [];
    if (assignmentMode === 'yearly') {
      assignments.push({ year, month: null, description: `Przypisanie roczne ${year}` });
    } else if (assignmentMode === 'monthly') {
      const selectedMonths = Array.from(formData.getAll('months')).map(m => parseInt(m));
      if (selectedMonths.length === 0) { this.showError('Wybierz przynajmniej jeden miesiąc'); return; }
      assignments = selectedMonths.map(month => ({ year, month, description: `${this.getMonthName(month)} ${year}` }));
    }
    try {
      await scheduleService.assignTemplateToMonths(templateId, assignments);
      this.hideAssignTemplateModal();
      this.showSuccess('Szablon został przypisany pomyślnie');
      await this.loadAssignments();
    } catch (error) {
      console.error('Error assigning template:', error);
      this.showError('Błąd podczas przypisywania szablonu');
    }
  }

  selectAllSlots = (day) => document.querySelectorAll(`input[name="${day}-times"]`).forEach(cb => cb.checked = true);
  clearAllSlots = (day) => document.querySelectorAll(`input[name="${day}-times"]`).forEach(cb => cb.checked = false);
  toggleDaySchedule = (day, enabled) => document.getElementById(`${day}-schedule`).style.display = enabled ? 'block' : 'none';
  
  async editTemplate(templateId) {
    try {
      const result = await scheduleService.getScheduleTemplate(templateId);
      if (!result.success) throw new Error(result.message || 'Failed to load template');
      
      const template = result.template;
      
      // Remove existing modal if any
      document.querySelector('.edit-template-modal')?.remove();
      
      const modal = document.createElement('div');
      modal.className = 'edit-template-modal fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
      modal.innerHTML = `
        <div class="relative top-10 mx-auto p-5 border w-full max-w-4xl bg-white rounded-md shadow">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Edytuj szablon: ${template.name}</h3>
            <button data-action="close-edit-template-modal" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <form id="edit-template-form" class="space-y-6" data-template-id="${templateId}">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nazwa szablonu</label>
                <input type="text" id="edit-template-name" name="templateName" 
                       value="${template.name}" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Opis (opcjonalnie)</label>
                <input type="text" id="edit-template-description" name="templateDescription" 
                       value="${template.description || ''}"
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
              </div>
            </div>
            
            <div>
              <label class="flex items-center">
                <input type="checkbox" id="edit-template-default" name="isDefault" 
                       ${template.isDefault ? 'checked' : ''}
                       class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                <span class="ml-2 text-sm text-gray-700">Ustaw jako domyślny szablon</span>
              </label>
            </div>

            <div>
              <h4 class="text-md font-medium text-gray-900 mb-4">Harmonogram tygodniowy</h4>
              <div class="space-y-4">
                ${this.renderEditScheduleInputs(template.schedule)}
              </div>
            </div>

            <div class="flex justify-end space-x-3">
              <button type="button" data-action="close-edit-template-modal"
                      class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                Anuluj
              </button>
              <button type="submit" 
                      class="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors">
                Zapisz zmiany
              </button>
            </div>
          </form>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Close modal when clicking outside
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          modal.remove();
        }
      });
      
      
    } catch (error) {
      console.error('Error loading template for edit:', error);
      this.showError('Błąd podczas ładowania szablonu do edycji');
    }
  }

  renderEditScheduleInputs(schedule) {
    const days = [
      { key: 'monday', label: 'Poniedziałek' },
      { key: 'tuesday', label: 'Wtorek' },
      { key: 'wednesday', label: 'Środa' },
      { key: 'thursday', label: 'Czwartek' },
      { key: 'friday', label: 'Piątek' },
      { key: 'saturday', label: 'Sobota' },
      { key: 'sunday', label: 'Niedziela' }
    ];

    return days.map(day => {
      const dayTimes = schedule[day.key] || [];
      const timeSlots = this.generateTimeSlots();
      
      return `
        <div class="border rounded-lg p-4">
          <div class="flex justify-between items-center mb-3">
            <label class="flex items-center">
              <input type="checkbox" data-action="toggle-day-schedule" data-day="${day.key}" 
                     ${dayTimes.length > 0 ? 'checked' : ''} 
                     class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
              <span class="font-medium text-gray-700">${day.label}</span>
            </label>
            <div class="space-x-2">
              <button type="button" data-action="select-all-slots" data-day="${day.key}" 
                      class="text-xs text-blue-600 hover:text-blue-800">Zaznacz wszystkie</button>
              <button type="button" data-action="clear-all-slots" data-day="${day.key}" 
                      class="text-xs text-red-600 hover:text-red-800">Wyczyść</button>
            </div>
          </div>
          <div id="${day.key}-schedule" ${dayTimes.length === 0 ? 'style="display: none;"' : ''}>
            <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              ${timeSlots.map(time => `
                <label class="flex items-center text-sm">
                  <input type="checkbox" name="${day.key}-times" value="${time}" 
                         ${dayTimes.includes(time) ? 'checked' : ''}
                         class="mr-1 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                  <span class="text-xs">${time}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async handleEditTemplate(templateId, modal) {
    try {
      const formData = new FormData(modal.querySelector('#edit-template-form'));
      
      // Collect schedule data
      const schedule = {};
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      days.forEach(day => {
        const checkboxes = modal.querySelectorAll(`input[name="${day}-times"]:checked`);
        schedule[day] = Array.from(checkboxes).map(cb => cb.value);
      });

      const templateData = {
        name: formData.get('templateName'),
        description: formData.get('templateDescription') || '',
        isDefault: formData.has('isDefault'),
        schedule: schedule
      };

      await scheduleService.updateScheduleTemplate(templateId, templateData);
      modal.remove();
      await this.loadTemplates();
      this.showSuccess('Szablon został zaktualizowany pomyślnie');
      
    } catch (error) {
      console.error('Error updating template:', error);
      this.showError('Błąd podczas aktualizacji szablonu');
    }
  }
  
  async deleteTemplate(templateId) {
    if (!confirm('Czy na pewno chcesz usunąć ten szablon?')) return;
    try {
      await scheduleService.deleteScheduleTemplate(templateId);
      this.showSuccess('Szablon został usunięty');
      await this.loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      this.showError('Błąd podczas usuwania szablonu');
    }
  }

  async deleteAssignment(assignmentId) {
    if (!confirm('Czy na pewno chcesz usunąć to przypisanie?')) return;
    try {
      await scheduleService.deleteTemplateAssignment(assignmentId);
      this.showSuccess('Przypisanie zostało usunięte');
      await this.loadAssignments();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      this.showError('Błąd podczas usuwania przypisania');
    }
  }

  getDayName = (dayKey) => ({ monday: 'Pon', tuesday: 'Wt', wednesday: 'Śr', thursday: 'Czw', friday: 'Pt', saturday: 'Sob', sunday: 'Nd' }[dayKey] || dayKey);
  getMonthName = (monthNumber) => new Date(2000, monthNumber - 1, 1).toLocaleString('pl-PL', { month: 'long' });

  showSuccess = (message) => this.showMessage(message, 'success');
  showError = (message) => this.showMessage(message, 'error');

  showMessage(message, type = 'info') {
    document.querySelector('.schedule-editor-message')?.remove();
    const messageDiv = document.createElement('div');
    messageDiv.className = `schedule-editor-message fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 ${this.getMessageClasses(type)}`;
    messageDiv.innerHTML = `<div class="flex"><div class="flex-shrink-0">${this.getMessageIcon(type)}</div><div class="ml-3"><p class="text-sm font-medium">${message}</p></div><div class="ml-auto pl-3"><button data-action="dismiss-message" class="text-gray-400 hover:text-gray-600"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div></div>`;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 5000);
  }

  getMessageClasses = (type) => ({ success: 'bg-green-50 border border-green-200 text-green-800', error: 'bg-red-50 border border-red-200 text-red-800' }[type] || 'bg-blue-50 border border-blue-200 text-blue-800');
  getMessageIcon = (type) => ({ success: `<svg class="w-5 h-5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>`, error: `<svg class="w-5 h-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>` }[type] || `<svg class="w-5 h-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>`);
}

// Create global instance
const scheduleEditor = new ScheduleEditor();
window.scheduleEditor = scheduleEditor;
// The main application will need to call renderScheduleEditor and then the postRenderSetup callback.
// e.g.,
// const mainContent = document.getElementById('main-content');
// const editorContent = await scheduleEditor.renderScheduleEditor();
// mainContent.innerHTML = editorContent.html;
// editorContent.postRenderSetup();
export default scheduleEditor;
