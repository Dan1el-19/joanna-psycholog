// Client calendar interface for appointment booking
// VERSION 2.0 - Responsive Fix & Logic Cleanup
import firebaseService from './firebase-service.js';
import { publicAuth } from './public-auth.js';

class CalendarInterface {
  constructor() {
    this.currentMonth = new Date().getMonth() + 1;
    this.currentYear = new Date().getFullYear();
    this.selectedDate = null;
    this.selectedTime = null;
    this.availableSlots = [];
    this.slotsCache = new Map();
    this.init();
  }

  async init() {
    try {
      await publicAuth.init();
    } catch (error) {
      console.error('Failed to initialize authentication for calendar:', error);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async setup() {
    await publicAuth.ensureAuthenticated();
    this.createCalendarInterface();
    this.loadAvailableSlots();
  }

  createCalendarInterface() {
    const existingCalendar = document.getElementById('appointment-calendar');
    if (existingCalendar) existingCalendar.remove();

    const dateInput = document.getElementById('preferred-date');
    const timeSelect = document.getElementById('preferred-time');
    
    if (!dateInput || !timeSelect) {
      console.warn('Date input or time select not found');
      return;
    }

    const calendarContainer = document.createElement('div');
    calendarContainer.id = 'appointment-calendar';
    calendarContainer.className = 'mb-6';

    calendarContainer.innerHTML = `
      <div class="bg-gray-50 p-3 sm:p-4 rounded-lg border">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-primary mb-2">Wybierz termin wizyty</h3>
          <div class="flex items-center justify-between mb-4">
            <button type="button" data-action="prev-month" class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <h4 class="text-base sm:text-lg font-medium text-primary text-center" id="calendar-title">${this.getMonthName(this.currentMonth)} ${this.currentYear}</h4>
            <button type="button" data-action="next-month" class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>
          <div id="calendar-grid" class="bg-white border rounded-lg overflow-hidden">
            <div class="text-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              <p class="mt-2 text-sm text-gray-600">Ładowanie dostępnych terminów...</p>
            </div>
          </div>
        </div>
        <div id="time-selection" class="hidden">
          <h4 class="text-md font-medium text-primary mb-3">Dostępne godziny na <span id="selected-date-display"></span></h4>
          <div id="time-slots" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mb-4"></div>
          <div class="flex flex-wrap gap-2 items-center">
            <button type="button" data-action="change-date" class="text-sm text-blue-600 hover:text-blue-800">← Wybierz inną datę</button>
            <button type="button" data-action="refresh-time-slots" class="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors">🔄 Odśwież godziny</button>
          </div>
        </div>
        <div class="mt-4 text-center">
          <button type="button" data-action="refresh-calendar" class="text-sm bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors">🔄 Odśwież kalendarz</button>
          <p class="text-xs text-gray-500 mt-1">Kliknij aby odświeżyć dostępne terminy</p>
        </div>
      </div>
    `;

    dateInput.parentNode.insertBefore(calendarContainer, dateInput);
    dateInput.type = 'hidden';
    dateInput.removeAttribute('required');

    const timeInput = document.createElement('input');
    timeInput.type = 'hidden';
    timeInput.id = 'preferred-time';
    timeInput.name = 'preferred-time';
    timeSelect.parentNode.replaceChild(timeInput, timeSelect);
    
    document.querySelector('label[for="preferred-date"]')?.style.setProperty('display', 'none', 'important');
    document.querySelector('label[for="preferred-time"]')?.style.setProperty('display', 'none', 'important');

    this.setupEventListeners();
  }

  setupEventListeners() {
    const calendarContainer = document.getElementById('appointment-calendar');
    if (!calendarContainer || calendarContainer.dataset.eventsAttached) return;
    calendarContainer.dataset.eventsAttached = 'true';

    calendarContainer.addEventListener('click', (event) => {
      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;

      const action = actionElement.dataset.action;
      const date = actionElement.dataset.date;
      const time = actionElement.dataset.time;

      switch (action) {
        case 'prev-month': this.changeMonth(-1); break;
        case 'next-month': this.changeMonth(1); break;
        case 'change-date': this.showCalendarView(); break;
        case 'refresh-calendar': this.refreshCalendar(); break;
        case 'refresh-time-slots': this.refreshTimeSlots(); break;
        case 'reload-slots': this.loadAvailableSlots(); break;
        case 'select-date': this.selectDate(date); break;
        case 'select-time': this.selectTime(time); break;
      }
    });
  }

  async changeMonth(direction) {
    this.currentMonth += direction;
    if (this.currentMonth > 12) {
      this.currentMonth = 1;
      this.currentYear++;
    } else if (this.currentMonth < 1) {
      this.currentMonth = 12;
      this.currentYear--;
    }
    document.getElementById('calendar-title').textContent = `${this.getMonthName(this.currentMonth)} ${this.currentYear}`;
    await this.loadAvailableSlots();
  }

  async loadAvailableSlots() {
    const grid = document.getElementById('calendar-grid');
    try {
      const cacheKey = `${this.currentYear}-${this.currentMonth}`;
      if (this.slotsCache.has(cacheKey)) {
        this.availableSlots = this.slotsCache.get(cacheKey);
        this.renderCalendar();
        return;
      }

      grid.innerHTML = `<div class="text-center py-4"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div><p class="mt-2 text-sm text-gray-600">Ładowanie dostępnych terminów...</p></div>`;

      // ✅ FIXED LOGIC: Fetch pre-calculated availability for the entire month.
      const daysInMonth = this.getDaysInMonth(this.currentYear, this.currentMonth);
      const dailySlotPromises = [];
      for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          dailySlotPromises.push(firebaseService.getAvailableTimeSlots(dateStr));
      }
      
      const monthlySlotsArrays = await Promise.all(dailySlotPromises);
      this.availableSlots = monthlySlotsArrays.flat();
      
      this.slotsCache.set(cacheKey, this.availableSlots);
      this.renderCalendar();
    } catch (error) {
      console.error('Error loading available slots:', error);
      grid.innerHTML = `<div class="text-center py-4 text-red-600"><p>Błąd podczas ładowania terminów</p><button data-action="reload-slots" class="mt-2 text-sm text-blue-600 hover:text-blue-800">Spróbuj ponownie</button></div>`;
    }
  }

  renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const daysInMonth = this.getDaysInMonth(this.currentYear, this.currentMonth);
    const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1).getDay();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

    const slotsByDate = {};
    this.availableSlots.forEach(slot => {
      if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
      slotsByDate[slot.date].push(slot);
    });
    
    const dayNames = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
    let calendarHtml = `<div class="grid grid-cols-7 bg-gray-50 border-b">${dayNames.map(day => `<div class="p-1 sm:p-2 text-center font-medium text-gray-700 text-xs sm:text-sm">${day}</div>`).join('')}</div><div class="grid grid-cols-7">`;
    for (let i = 0; i < adjustedFirstDay; i++) calendarHtml += '<div class="border-r border-b border-gray-200"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const daySlots = slotsByDate[dateStr] || [];
      const availableSlots = daySlots.filter(slot => slot.isAvailable);
      const hasSlots = availableSlots.length > 0;
      const isToday = this.isToday(dateStr);
      const isPast = this.isPastDate(dateStr);

      let cellClass = 'p-1 sm:p-2 min-h-[4rem] sm:min-h-[5rem] border-r border-b border-gray-200 flex flex-col';
      let cellContent = `<div class="font-medium text-xs sm:text-sm ${isPast ? 'text-gray-400' : 'text-gray-900'}">${day}</div>`;
      let dataAttrs = '';

      if (isPast) {
        cellClass += ' bg-gray-100 cursor-not-allowed';
      } else if (hasSlots) {
        cellClass += ' bg-green-50 hover:bg-green-100 cursor-pointer';
        cellContent += `<div class="text-[10px] sm:text-xs text-green-700 mt-1 flex-grow">${availableSlots.length} wolne</div>`;
        dataAttrs = `data-action="select-date" data-date="${dateStr}"`;
      } else {
        cellClass += ' bg-gray-50';
      }
      if (isToday) cellClass += ' ring-2 ring-blue-400 z-10';

      calendarHtml += `<div class="${cellClass}" ${dataAttrs}>${cellContent}</div>`;
    }
    calendarHtml += '</div>';
    grid.innerHTML = calendarHtml;
  }

  selectDate(dateStr) {
    this.selectedDate = dateStr;
    this.selectedTime = null;
    const daySlots = this.availableSlots.filter(slot => slot.date === dateStr && slot.isAvailable);
    this.showTimeSelection(daySlots);
  }

  showTimeSelection(slots) {
    const calendarView = document.getElementById('calendar-grid');
    const timeSelection = document.getElementById('time-selection');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const timeSlotsContainer = document.getElementById('time-slots');

    calendarView.parentElement.style.display = 'none';
    timeSelection.classList.remove('hidden');

    const date = new Date(this.selectedDate);
    selectedDateDisplay.textContent = date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

    timeSlotsContainer.innerHTML = slots.map(slot => `<button type="button" class="px-2 py-2 border border-gray-300 rounded-lg text-sm hover:bg-blue-50 hover:border-blue-300 transition-colors" data-action="select-time" data-time="${slot.time}">${slot.time}</button>`).join('');
    if (slots.length === 0) timeSlotsContainer.innerHTML = '<div class="col-span-full text-center py-4 text-gray-500">Brak dostępnych godzin na ten dzień</div>';
  }

  selectTime(time) {
    this.selectedTime = time;
    const dateInput = document.getElementById('preferred-date');
    const timeInput = document.getElementById('preferred-time');
    if (dateInput) {
      dateInput.value = this.selectedDate;
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (timeInput) {
      timeInput.value = this.selectedTime;
      timeInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const timeButtons = document.querySelectorAll('#time-slots button');
    timeButtons.forEach(btn => btn.classList.remove('bg-blue-500', 'text-white', 'border-blue-500'));
    const selectedButton = Array.from(timeButtons).find(btn => btn.dataset.time === time);
    if (selectedButton) selectedButton.classList.add('bg-blue-500', 'text-white', 'border-blue-500');

    this.showSelectionConfirmation();
  }

  showSelectionConfirmation() {
    const timeSelection = document.getElementById('time-selection');
    timeSelection.querySelector('.selection-confirmation')?.remove();

    const confirmationDiv = document.createElement('div');
    confirmationDiv.className = 'selection-confirmation mt-4 p-3 bg-green-50 border border-green-200 rounded-lg';
    const date = new Date(this.selectedDate);
    const formattedDate = date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
    confirmationDiv.innerHTML = `<div class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><div><p class="font-medium text-green-800">Termin wybrany!</p><p class="text-sm text-green-700">${formattedDate} o ${this.selectedTime}</p></div></div>`;
    timeSelection.appendChild(confirmationDiv);

    setTimeout(() => document.querySelector('form')?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 500);
  }

  showCalendarView() {
    document.getElementById('calendar-grid').parentElement.style.display = 'block';
    document.getElementById('time-selection').classList.add('hidden');
  }

  isToday(dateStr) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
  }

  isPastDate(dateStr) {
    const today = new Date();
    const date = new Date(dateStr);
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  }

  getMonthName(month) {
    return new Date(2000, month - 1, 1).toLocaleString('pl-PL', { month: 'long' });
  }

  getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  async refreshCalendar() {
    this.slotsCache.clear();
    await this.loadAvailableSlots();
  }

  async onAppointmentMade() {
    this.slotsCache.clear();
    await this.loadAvailableSlots();
  }

  async refreshTimeSlots() {
    if (!this.selectedDate) return;
    const timeSlotsContainer = document.getElementById('time-slots');
    try {
      if (timeSlotsContainer) timeSlotsContainer.innerHTML = `<div class="col-span-full text-center py-4"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto"></div><p class="mt-2 text-xs text-gray-600">Odświeżanie...</p></div>`;
      this.slotsCache.delete(`${this.currentYear}-${this.currentMonth}`);
      await this.loadAvailableSlots();
      this.selectDate(this.selectedDate);
    } catch (error) {
      console.error('Error refreshing time slots:', error);
      if (timeSlotsContainer) timeSlotsContainer.innerHTML = `<div class="col-span-full text-center py-4 text-red-600"><p class="text-xs">Błąd podczas odświeżania. Spróbuj ponownie.</p></div>`;
    }
  }
}

window.calendarInterface = new CalendarInterface();
export default window.calendarInterface;
