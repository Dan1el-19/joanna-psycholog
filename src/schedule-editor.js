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
  }

  async renderScheduleEditor() {
    try {
      await this.loadTemplates();
      await this.loadAssignments();

      return `
        <div class="space-y-6">
          <!-- Header -->
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 class="text-lg font-medium text-gray-900">Edytor harmonogramów</h2>
              <p class="text-sm text-gray-600">Zarządzaj szablonami harmonogramów i przypisaniami do miesięcy</p>
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
              <button onclick="scheduleEditor.showCreateTemplateModal()" 
                      class="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Nowy szablon
              </button>
              <button onclick="scheduleEditor.showAssignTemplateModal()" 
                      class="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                Przypisz do miesięcy
              </button>
            </div>
          </div>

          <!-- Templates List -->
          <div class="bg-white shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Szablony harmonogramów</h3>
              <div id="templates-list">
                <div class="text-center py-8 text-gray-500">
                  <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  Ładowanie szablonów...
                </div>
              </div>
            </div>
          </div>

          <!-- Template Assignments -->
          <div class="bg-white shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Przypisania szablonów do miesięcy</h3>
              <div id="assignments-list">
                <div class="text-center py-8 text-gray-500">
                  <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  Ładowanie przypisań...
                </div>
              </div>
            </div>
          </div>

          ${this.renderModals()}
        </div>
      `;
    } catch (error) {
      console.error('Error rendering schedule editor:', error);
      return `
        <div class="bg-white shadow rounded-lg p-6">
          <div class="text-center py-8 text-red-600">
            <p>Błąd podczas ładowania edytora harmonogramów</p>
          </div>
        </div>
      `;
    }
  }

  renderModals() {
    return `
      <!-- Create Template Modal -->
      <div id="create-template-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
        <div class="relative top-10 mx-auto p-5 border w-full max-w-2xl bg-white rounded-md shadow">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Utwórz nowy szablon</h3>
            <button onclick="scheduleEditor.hideCreateTemplateModal()" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <form id="create-template-form" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nazwa szablonu</label>
                <input type="text" id="template-name" name="name" required 
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Opis</label>
                <input type="text" id="template-description" name="description" 
                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
              </div>
            </div>

            <div class="space-y-4">
              <h4 class="text-md font-medium text-gray-900">Harmonogram tygodniowy</h4>
              ${this.renderWeeklyScheduleEditor()}
            </div>

            <div class="flex justify-end space-x-3 mt-6">
              <button type="button" onclick="scheduleEditor.hideCreateTemplateModal()" 
                      class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                Anuluj
              </button>
              <button type="submit" 
                      class="px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors">
                Utwórz szablon
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Assign Template Modal -->
      <div id="assign-template-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
        <div class="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-md shadow">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Przypisz szablon do miesięcy</h3>
            <button onclick="scheduleEditor.hideAssignTemplateModal()" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <form id="assign-template-form" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Szablon</label>
              <select id="assign-template-select" name="templateId" required 
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                <option value="">Wybierz szablon</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Rok</label>
              <input type="number" id="assign-year" name="year" required min="2024" max="2030"
                     class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tryb przypisania</label>
              <select id="assignment-mode" name="assignmentMode" required 
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                <option value="">Wybierz tryb</option>
                <option value="yearly">Cały rok</option>
                <option value="monthly">Wybrane miesiące</option>
              </select>
            </div>

            <div id="months-selection" class="hidden">
              <label class="block text-sm font-medium text-gray-700 mb-2">Wybierz miesiące</label>
              <div class="grid grid-cols-3 gap-2">
                ${this.renderMonthCheckboxes()}
              </div>
            </div>

            <div class="flex justify-end space-x-3 mt-6">
              <button type="button" onclick="scheduleEditor.hideAssignTemplateModal()" 
                      class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                Anuluj
              </button>
              <button type="submit" 
                      class="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors">
                Przypisz
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  renderWeeklyScheduleEditor() {
    const days = [
      { key: 'monday', name: 'Poniedziałek' },
      { key: 'tuesday', name: 'Wtorek' },
      { key: 'wednesday', name: 'Środa' },
      { key: 'thursday', name: 'Czwartek' },
      { key: 'friday', name: 'Piątek' },
      { key: 'saturday', name: 'Sobota' },
      { key: 'sunday', name: 'Niedziela' }
    ];

    // Generate all possible time slots from 7:00 to 20:30
    const timeSlots = this.generateTimeSlots();

    return days.map(day => `
      <div class="border border-gray-200 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h5 class="font-medium text-gray-900">${day.name}</h5>
          <div class="flex items-center space-x-3">
            <button type="button" onclick="scheduleEditor.selectAllSlots('${day.key}')" 
                    class="text-xs text-blue-600 hover:text-blue-800">
              Zaznacz wszystkie
            </button>
            <button type="button" onclick="scheduleEditor.clearAllSlots('${day.key}')" 
                    class="text-xs text-gray-600 hover:text-gray-800">
              Wyczyść
            </button>
            <label class="flex items-center">
              <input type="checkbox" id="enable-${day.key}" checked 
                     class="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                     onchange="scheduleEditor.toggleDaySchedule('${day.key}', this.checked)">
              <span class="text-sm text-gray-600">Dzień roboczy</span>
            </label>
          </div>
        </div>
        <div id="${day.key}-schedule" class="space-y-3">
          <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            ${timeSlots.map(time => `
              <label class="flex items-center text-xs">
                <input type="checkbox" name="${day.key}-times" value="${time}" 
                       class="mr-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 time-slot-checkbox"
                       ${this.isDefaultWorkingHour(time) ? 'checked' : ''}>
                <span class="text-gray-700">${time}</span>
              </label>
            `).join('')}
          </div>
          <div class="text-xs text-gray-500 mt-2">
            <p>Dostępne godziny: pełne godziny i półgodziny od 7:00 do 20:30</p>
          </div>
        </div>
      </div>
    `).join('');
  }

  generateTimeSlots() {
    const slots = [];
    for (let hour = 7; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour <= 20) { // Include 20:30 as the final slot
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }

  isDefaultWorkingHour(time) {
    // Default working hours: 9:00 to 17:00
    const [hour] = time.split(':').map(Number);
    return hour >= 9 && hour <= 17;
  }

  renderMonthCheckboxes() {
    const months = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];

    return months.map((month, index) => `
      <label class="flex items-center">
        <input type="checkbox" name="months" value="${index + 1}" 
               class="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
        <span class="text-sm">${month}</span>
      </label>
    `).join('');
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
      container.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <p class="text-lg font-medium">Brak szablonów</p>
          <p class="text-sm">Utwórz pierwszy szablon harmonogramu</p>
        </div>
      `;
      return;
    }

    const templatesHtml = this.templates.map(template => {
      const workingDays = Object.entries(template.schedule || {})
        .filter(([day, times]) => times && times.length > 0)
        .map(([day, times]) => this.getDayName(day))
        .join(', ');

      return `
        <div class="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <h4 class="font-medium text-gray-900">${template.name}</h4>
                ${template.isDefault ? '<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Domyślny</span>' : ''}
              </div>
              <p class="text-sm text-gray-600 mb-2">${template.description || 'Brak opisu'}</p>
              <div class="text-xs text-gray-500">
                <p>Dni robocze: ${workingDays || 'Brak'}</p>
                <p>Utworzono: ${template.createdAt ? template.createdAt.toLocaleDateString('pl-PL') : 'N/A'}</p>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <button onclick="scheduleEditor.editTemplate('${template.id}')" 
                      class="text-blue-600 hover:text-blue-800 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
              </button>
              <button onclick="scheduleEditor.deleteTemplate('${template.id}')" 
                      class="text-red-600 hover:text-red-800 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="space-y-3">${templatesHtml}</div>`;
  }

  renderAssignmentsList() {
    const container = document.getElementById('assignments-list');
    if (!container) return;

    if (this.currentAssignments.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p class="text-lg font-medium">Brak przypisań</p>
          <p class="text-sm">Przypisz szablony do konkretnych miesięcy</p>
        </div>
      `;
      return;
    }

    const assignmentsHtml = this.currentAssignments.map(assignment => {
      const template = this.templates.find(t => t.id === assignment.templateId);
      const templateName = template ? template.name : 'Szablon usunięty';
      
      let periodDisplay = assignment.year.toString();
      if (assignment.month) {
        periodDisplay = `${this.getMonthName(assignment.month)} ${assignment.year}`;
      }

      return `
        <div class="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <h4 class="font-medium text-gray-900">${templateName}</h4>
                <span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">${periodDisplay}</span>
              </div>
              <p class="text-sm text-gray-600">${assignment.description || 'Brak opisu'}</p>
              <p class="text-xs text-gray-500 mt-1">
                Utworzono: ${assignment.createdAt ? assignment.createdAt.toLocaleDateString('pl-PL') : 'N/A'}
              </p>
            </div>
            <button onclick="scheduleEditor.deleteAssignment('${assignment.id}')" 
                    class="flex-shrink-0 text-red-600 hover:text-red-800 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
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

  showCreateTemplateModal() {
    const modal = document.getElementById('create-template-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.setupCreateTemplateHandlers();
    }
  }

  hideCreateTemplateModal() {
    const modal = document.getElementById('create-template-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.getElementById('create-template-form').reset();
    }
  }

  showAssignTemplateModal() {
    const modal = document.getElementById('assign-template-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.setupAssignTemplateHandlers();
      
      // Set current year as default
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

  setupCreateTemplateHandlers() {
    const form = document.getElementById('create-template-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateTemplate(e);
      });
    }
  }

  setupAssignTemplateHandlers() {
    const form = document.getElementById('assign-template-form');
    const modeSelect = document.getElementById('assignment-mode');
    
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleAssignTemplate(e);
      });
    }

    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        const monthsSelection = document.getElementById('months-selection');
        if (e.target.value === 'monthly') {
          monthsSelection.classList.remove('hidden');
        } else {
          monthsSelection.classList.add('hidden');
        }
      });
    }
  }

  async handleCreateTemplate(event) {
    const formData = new FormData(event.target);
    
    // Collect schedule data from checkboxes
    const schedule = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    days.forEach(day => {
      const dayEnabled = document.getElementById(`enable-${day}`).checked;
      if (dayEnabled) {
        // Get all checked time slots for this day
        const checkedSlots = Array.from(document.querySelectorAll(`input[name="${day}-times"]:checked`))
          .map(checkbox => checkbox.value)
          .sort(); // Sort to ensure consistent order
        
        schedule[day] = checkedSlots;
      } else {
        schedule[day] = [];
      }
    });

    const templateData = {
      name: formData.get('name'),
      description: formData.get('description'),
      schedule
    };

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
      assignments.push({
        year,
        month: null,
        description: `Przypisanie roczne ${year}`
      });
    } else if (assignmentMode === 'monthly') {
      const selectedMonths = Array.from(formData.getAll('months')).map(m => parseInt(m));
      if (selectedMonths.length === 0) {
        this.showError('Wybierz przynajmniej jeden miesiąc');
        return;
      }
      
      assignments = selectedMonths.map(month => ({
        year,
        month,
        description: `${this.getMonthName(month)} ${year}`
      }));
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

  selectAllSlots(day) {
    const checkboxes = document.querySelectorAll(`input[name="${day}-times"]`);
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
    });
  }

  clearAllSlots(day) {
    const checkboxes = document.querySelectorAll(`input[name="${day}-times"]`);
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
  }

  toggleDaySchedule(day, enabled) {
    const scheduleDiv = document.getElementById(`${day}-schedule`);
    if (scheduleDiv) {
      scheduleDiv.style.display = enabled ? 'block' : 'none';
    }
  }

  addTimeSlot(day) {
    const scheduleDiv = document.getElementById(`${day}-schedule`);
    if (scheduleDiv) {
      const newSlot = document.createElement('div');
      newSlot.className = 'flex items-center space-x-2';
      newSlot.innerHTML = `
        <input type="time" value="09:00" 
               class="day-time-input flex-1 px-2 py-1 text-sm border border-gray-300 rounded">
        <input type="time" value="17:00" 
               class="day-time-input flex-1 px-2 py-1 text-sm border border-gray-300 rounded">
        <button type="button" onclick="this.parentElement.remove()" 
                class="text-red-600 hover:text-red-800">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      `;
      scheduleDiv.appendChild(newSlot);
    }
  }

  async editTemplate(templateId) {
    // For now, just show the template details
    const template = this.templates.find(t => t.id === templateId);
    if (template) {
      alert(`Edycja szablonu: ${template.name}\n\nFunkcja w przygotowaniu.`);
    }
  }

  async deleteTemplate(templateId) {
    if (!confirm('Czy na pewno chcesz usunąć ten szablon?')) {
      return;
    }

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
    if (!confirm('Czy na pewno chcesz usunąć to przypisanie?')) {
      return;
    }

    try {
      await scheduleService.deleteTemplateAssignment(assignmentId);
      this.showSuccess('Przypisanie zostało usunięte');
      await this.loadAssignments();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      this.showError('Błąd podczas usuwania przypisania');
    }
  }

  getDayName(dayKey) {
    const names = {
      monday: 'Pon',
      tuesday: 'Wt',
      wednesday: 'Śr',
      thursday: 'Czw',
      friday: 'Pt',
      saturday: 'Sob',
      sunday: 'Nd'
    };
    return names[dayKey] || dayKey;
  }

  getMonthName(monthNumber) {
    const months = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    return months[monthNumber - 1] || 'Nieznany';
  }

  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessage = document.querySelector('.schedule-editor-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `schedule-editor-message fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 ${this.getMessageClasses(type)}`;
    messageDiv.innerHTML = `
      <div class="flex">
        <div class="flex-shrink-0">
          ${this.getMessageIcon(type)}
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium">${message}</p>
        </div>
        <div class="ml-auto pl-3">
          <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(messageDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
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
        return `<svg class="w-5 h-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>`;
      case 'error':
        return `<svg class="w-5 h-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>`;
      default:
        return `<svg class="w-5 h-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>`;
    }
  }
}

// Create global instance
const scheduleEditor = new ScheduleEditor();
window.scheduleEditor = scheduleEditor;
export default scheduleEditor;