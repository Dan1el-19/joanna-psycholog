// Client calendar interface for appointment booking
import scheduleService from './schedule-service.js';
import firebaseService from './firebase-service.js';

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

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.createCalendarInterface();
    this.loadAvailableSlots();
  }

  createCalendarInterface() {
    const existingCalendar = document.getElementById('appointment-calendar');
    if (existingCalendar) {
      existingCalendar.remove();
    }

    // Find the preferred date input and replace it with calendar
    const dateInput = document.getElementById('preferred-date');
    const timeSelect = document.getElementById('preferred-time');
    
    if (!dateInput || !timeSelect) {
      console.warn('Date input or time select not found');
      return;
    }

    // Create calendar container
    const calendarContainer = document.createElement('div');
    calendarContainer.id = 'appointment-calendar';
    calendarContainer.className = 'mb-6';

    calendarContainer.innerHTML = `
      <div class="bg-gray-50 p-4 rounded-lg border">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-primary mb-2">Wybierz termin wizyty</h3>
          <div class="flex items-center justify-between mb-4">
            <button type="button" id="prev-month" class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
            <h4 class="text-lg font-medium text-primary" id="calendar-title">
              ${this.getMonthName(this.currentMonth)} ${this.currentYear}
            </h4>
            <button type="button" id="next-month" class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
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
          <div id="time-slots" class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
          </div>
          <div class="flex flex-wrap gap-2 items-center">
            <button type="button" id="change-date" class="text-sm text-blue-600 hover:text-blue-800">
              ← Wybierz inną datę
            </button>
            <button type="button" id="refresh-time-slots" class="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors">
              🔄 Odśwież godziny
            </button>
          </div>
        </div>
        
        <!-- Calendar refresh button -->
        <div class="mt-4 text-center">
          <button type="button" id="refresh-calendar" class="text-sm bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors">
            🔄 Odśwież kalendarz
          </button>
          <p class="text-xs text-gray-500 mt-1">Kliknij aby odświeżyć dostępne terminy</p>
        </div>
      </div>
    `;

    // Insert calendar before the original date input
    dateInput.parentNode.insertBefore(calendarContainer, dateInput);

    // Hide original inputs
    dateInput.style.display = 'none';
    timeSelect.style.display = 'none';
    
    // Hide labels too
    const dateLabel = document.querySelector('label[for="preferred-date"]');
    const timeLabel = document.querySelector('label[for="preferred-time"]');
    if (dateLabel) dateLabel.style.display = 'none';
    if (timeLabel) timeLabel.style.display = 'none';

    // Set up event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));
    document.getElementById('change-date').addEventListener('click', () => this.showCalendarView());
    document.getElementById('refresh-calendar').addEventListener('click', () => this.refreshCalendar());
    document.getElementById('refresh-time-slots').addEventListener('click', () => this.refreshTimeSlots());
  }

  async changeMonth(direction) {
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
    
    document.getElementById('calendar-title').textContent = `${this.getMonthName(this.currentMonth)} ${this.currentYear}`;
    await this.loadAvailableSlots();
  }

  async loadAvailableSlots() {
    try {
      // Check cache first
      const cacheKey = `${this.currentYear}-${this.currentMonth}`;
      if (this.slotsCache.has(cacheKey)) {
        this.availableSlots = this.slotsCache.get(cacheKey);
        this.renderCalendar();
        return;
      }

      // Show loading state only briefly
      const grid = document.getElementById('calendar-grid');
      grid.innerHTML = `
        <div class="text-center py-4">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
          <p class="mt-2 text-sm text-gray-600">Ładowanie dostępnych terminów...</p>
        </div>
      `;

      // Use Promise.all to parallelize admin schedule and default slots loading
      const [scheduleResult] = await Promise.allSettled([
        scheduleService.getAvailableSlotsForMonth(this.currentYear, this.currentMonth)
      ]);

      if (scheduleResult.status === 'fulfilled' && scheduleResult.value.success && scheduleResult.value.slots?.length > 0) {
        // Admin has defined a schedule, check availability with Firebase in batches
        this.availableSlots = await this.checkSlotsAvailabilityOptimized(scheduleResult.value.slots);
      } else {
        // Fall back to default working hours
        this.availableSlots = await this.generateDefaultSlots();
      }
      
      // Cache the result
      this.slotsCache.set(cacheKey, this.availableSlots);
      
      this.renderCalendar();
    } catch (error) {
      console.error('Error loading available slots:', error);
      const grid = document.getElementById('calendar-grid');
      grid.innerHTML = `
        <div class="text-center py-4 text-red-600">
          <p>Błąd podczas ładowania terminów</p>
          <button onclick="calendarInterface.loadAvailableSlots()" class="mt-2 text-sm text-blue-600 hover:text-blue-800">
            Spróbuj ponownie
          </button>
        </div>
      `;
    }
  }

  // Optimized availability checking with batched requests
  async checkSlotsAvailabilityOptimized(adminSlots) {
    const slotsWithAvailability = [];
    
    // Group slots by date to minimize Firebase calls
    const slotsByDate = {};
    adminSlots.forEach(slot => {
      if (!slotsByDate[slot.date]) {
        slotsByDate[slot.date] = [];
      }
      slotsByDate[slot.date].push(slot);
    });
    
    // Process all dates in parallel for faster loading
    const dateProcessingPromises = Object.entries(slotsByDate).map(async ([date, dateSlots]) => {
      try {
        // Get Firebase availability for this entire date once
        const firebaseSlots = await firebaseService.getAvailableTimeSlots(date);
        
        // Process all slots for this date
        for (const slot of dateSlots) {
          const firebaseSlot = firebaseSlots.find(fs => fs.time === slot.time);
          
          if (firebaseSlot) {
            // Merge admin schedule info with Firebase availability
            slotsWithAvailability.push({
              ...slot,
              isAvailable: firebaseSlot.isAvailable && slot.isAvailable,
              isBooked: firebaseSlot.isBooked,
              isTemporarilyBlocked: firebaseSlot.isTemporarilyBlocked,
              serviceAvailability: firebaseSlot.serviceAvailability,
              unavailableReason: !firebaseSlot.isAvailable ? firebaseSlot.unavailableReason : 
                                (!slot.isAvailable ? (slot.blockReason || 'admin_blocked') : null)
            });
          } else if (slot.isAvailable && !slot.isBlocked) {
            // Admin allows this slot but Firebase doesn't have it in working hours
            const isBooked = await this.checkIfSlotIsBooked(slot.date, slot.time);
            slotsWithAvailability.push({
              ...slot,
              isAvailable: !isBooked,
              isBooked,
              isTemporarilyBlocked: false,
              serviceAvailability: {
                'terapia-indywidualna': !isBooked,
                'terapia-par': !isBooked,
                'terapia-rodzinna': !isBooked
              },
              unavailableReason: isBooked ? 'booked' : null
            });
          }
        }
      } catch (error) {
        console.warn(`Error checking availability for date ${date}:`, error);
        // Keep admin slots but mark as potentially unavailable
        dateSlots.forEach(slot => {
          slotsWithAvailability.push({
            ...slot,
            isAvailable: slot.isAvailable && !slot.isBlocked,
            isBooked: false,
            isTemporarilyBlocked: false,
            unavailableReason: !slot.isAvailable ? (slot.blockReason || 'admin_blocked') : null
          });
        });
      }
    });
    
    // Wait for all dates to be processed
    await Promise.all(dateProcessingPromises);
    
    return slotsWithAvailability;
  }

  // Legacy method for backwards compatibility
  async checkSlotsAvailability(adminSlots) {
    const slotsWithAvailability = [];
    
    // Group slots by date to minimize Firebase calls
    const slotsByDate = {};
    adminSlots.forEach(slot => {
      if (!slotsByDate[slot.date]) {
        slotsByDate[slot.date] = [];
      }
      slotsByDate[slot.date].push(slot);
    });
    
    // Process each date only once
    for (const [date, dateSlots] of Object.entries(slotsByDate)) {
      try {
        // Get Firebase availability for this entire date once
        const firebaseSlots = await firebaseService.getAvailableTimeSlots(date);
        
        // Process all slots for this date
        for (const slot of dateSlots) {
          const firebaseSlot = firebaseSlots.find(fs => fs.time === slot.time);
          
          if (firebaseSlot) {
            // Merge admin schedule info with Firebase availability
            slotsWithAvailability.push({
              ...slot,
              isAvailable: firebaseSlot.isAvailable && slot.isAvailable,
              isBooked: firebaseSlot.isBooked,
              isTemporarilyBlocked: firebaseSlot.isTemporarilyBlocked,
              serviceAvailability: firebaseSlot.serviceAvailability,
              unavailableReason: !firebaseSlot.isAvailable ? firebaseSlot.unavailableReason : 
                                (!slot.isAvailable ? (slot.blockReason || 'admin_blocked') : null)
            });
          } else if (slot.isAvailable && !slot.isBlocked) {
            // Admin allows this slot but Firebase doesn't have it in working hours
            // This means it's outside standard working hours but admin specifically enabled it
            // Check if this specific slot is booked by looking at appointments directly
            const isBooked = await this.checkIfSlotIsBooked(slot.date, slot.time);
            slotsWithAvailability.push({
              ...slot,
              isAvailable: !isBooked,
              isBooked,
              isTemporarilyBlocked: false,
              serviceAvailability: {
                'terapia-indywidualna': !isBooked,
                'terapia-par': !isBooked,
                'terapia-rodzinna': !isBooked
              },
              unavailableReason: isBooked ? 'booked' : null
            });
          }
        }
      } catch (error) {
        console.warn(`Error checking availability for date ${date}:`, error);
        // Keep admin slots but mark as potentially unavailable
        dateSlots.forEach(slot => {
          slotsWithAvailability.push({
            ...slot,
            isAvailable: slot.isAvailable && !slot.isBlocked,
            isBooked: false,
            isTemporarilyBlocked: false,
            unavailableReason: !slot.isAvailable ? (slot.blockReason || 'admin_blocked') : null
          });
        });
      }
    }
    
    return slotsWithAvailability;
  }

  // Generate default slots when no admin schedule exists
  async generateDefaultSlots() {
    const slots = [];
    const daysInMonth = this.getDaysInMonth(this.currentYear, this.currentMonth);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const date = new Date(dateStr);
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      // Skip past dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) continue;
      
      try {
        // Get available time slots for this date
        const daySlots = await firebaseService.getAvailableTimeSlots(dateStr);
        slots.push(...daySlots);
      } catch (error) {
        console.warn(`Error loading slots for ${dateStr}:`, error);
      }
    }
    
    return slots;
  }

  // Check if a specific slot is booked in Firebase
  async checkIfSlotIsBooked(date, time) {
    try {
      const isAvailable = await firebaseService.isTimeSlotAvailable(date, time);
      return !isAvailable;
    } catch (error) {
      console.warn(`Error checking if slot ${date} ${time} is booked:`, error);
      return false; // Assume available if we can't check
    }
  }

  renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const daysInMonth = this.getDaysInMonth(this.currentYear, this.currentMonth);
    const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1).getDay();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Monday = 0

    // Group slots by date
    const slotsByDate = {};
    this.availableSlots.forEach(slot => {
      if (!slotsByDate[slot.date]) {
        slotsByDate[slot.date] = [];
      }
      slotsByDate[slot.date].push(slot);
    });

    let calendarHtml = `
      <div class="grid grid-cols-7 bg-gray-50 border-b">
        ${['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'].map(day => 
          `<div class="p-2 text-center font-medium text-gray-700 text-sm border-r last:border-r-0">${day}</div>`
        ).join('')}
      </div>
      <div class="grid grid-cols-7">
    `;

    // Empty cells for days before month start
    for (let i = 0; i < adjustedFirstDay; i++) {
      calendarHtml += '<div class="p-2 h-16 border-r border-b border-gray-200"></div>';
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const daySlots = slotsByDate[dateStr] || [];
      const availableSlots = daySlots.filter(slot => slot.isAvailable && !slot.isBlocked);
      const hasSlots = availableSlots.length > 0;
      const isToday = this.isToday(dateStr);
      const isPast = this.isPastDate(dateStr);

      let cellClass = 'p-2 h-16 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-50';
      let cellContent = `<div class="font-medium text-sm ${isPast ? 'text-gray-400' : 'text-gray-900'}">${day}</div>`;

      if (isPast) {
        cellClass += ' bg-gray-100 cursor-not-allowed';
        cellContent += '<div class="text-xs text-gray-400 mt-1">Minął</div>';
      } else if (hasSlots) {
        cellClass += ' bg-green-50 hover:bg-green-100';
        cellContent += `<div class="text-xs text-green-600 mt-1">${availableSlots.length} wolne</div>`;
      } else {
        cellClass += ' bg-gray-50';
        cellContent += '<div class="text-xs text-gray-400 mt-1">Brak</div>';
      }

      if (isToday) {
        cellClass += ' ring-2 ring-blue-400';
      }

      calendarHtml += `
        <div class="${cellClass}" ${hasSlots && !isPast ? `onclick="calendarInterface.selectDate('${dateStr}')"` : ''}>
          ${cellContent}
        </div>
      `;
    }

    calendarHtml += '</div>';
    grid.innerHTML = calendarHtml;
  }

  selectDate(dateStr) {
    this.selectedDate = dateStr;
    this.selectedTime = null;
    
    // Get available times for this date
    const daySlots = this.availableSlots.filter(slot => 
      slot.date === dateStr && slot.isAvailable && !slot.isBlocked
    );

    // Show time selection
    this.showTimeSelection(daySlots);
  }

  showTimeSelection(slots) {
    const calendarView = document.getElementById('calendar-grid');
    const timeSelection = document.getElementById('time-selection');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const timeSlotsContainer = document.getElementById('time-slots');

    // Hide calendar and show time selection
    calendarView.parentElement.style.display = 'none';
    timeSelection.classList.remove('hidden');

    // Format date for display
    const date = new Date(this.selectedDate);
    const formattedDate = date.toLocaleDateString('pl-PL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    selectedDateDisplay.textContent = formattedDate;

    // Render time slots
    timeSlotsContainer.innerHTML = slots.map(slot => `
      <button type="button" 
              class="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onclick="calendarInterface.selectTime('${slot.time}')">
        ${slot.time}
      </button>
    `).join('');

    if (slots.length === 0) {
      timeSlotsContainer.innerHTML = '<div class="col-span-full text-center py-4 text-gray-500">Brak dostępnych godzin na ten dzień</div>';
    }
  }

  selectTime(time) {
    this.selectedTime = time;
    
    // Update the original form inputs with proper validation
    const dateInput = document.getElementById('preferred-date');
    const timeSelect = document.getElementById('preferred-time');
    
    if (dateInput) {
      dateInput.value = this.selectedDate;
      // Trigger change event to ensure form validation
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    if (timeSelect) {
      // For select element, we need to ensure the option exists
      timeSelect.value = this.selectedTime;
      
      // If the option doesn't exist, create it
      if (timeSelect.value !== this.selectedTime) {
        const option = document.createElement('option');
        option.value = this.selectedTime;
        option.textContent = this.selectedTime;
        option.selected = true;
        timeSelect.appendChild(option);
      }
      
      // Trigger change event
      timeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Debug logging
    console.log('Time selected:', time);
    console.log('Date input value:', dateInput?.value);
    console.log('Time select value:', timeSelect?.value);

    // Visual feedback
    const timeButtons = document.querySelectorAll('#time-slots button');
    timeButtons.forEach(btn => {
      btn.classList.remove('bg-blue-500', 'text-white', 'border-blue-500');
      btn.classList.add('border-gray-300');
    });

    const selectedButton = Array.from(timeButtons).find(btn => btn.textContent.trim() === time);
    if (selectedButton) {
      selectedButton.classList.add('bg-blue-500', 'text-white', 'border-blue-500');
      selectedButton.classList.remove('border-gray-300');
    }

    // Show confirmation
    this.showSelectionConfirmation();
  }

  showSelectionConfirmation() {
    const timeSelection = document.getElementById('time-selection');
    
    // Remove existing confirmation if any
    const existingConfirmation = timeSelection.querySelector('.selection-confirmation');
    if (existingConfirmation) {
      existingConfirmation.remove();
    }

    const confirmationDiv = document.createElement('div');
    confirmationDiv.className = 'selection-confirmation mt-4 p-3 bg-green-50 border border-green-200 rounded-lg';
    
    const date = new Date(this.selectedDate);
    const formattedDate = date.toLocaleDateString('pl-PL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    confirmationDiv.innerHTML = `
      <div class="flex items-center">
        <svg class="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <div>
          <p class="font-medium text-green-800">Termin wybrany!</p>
          <p class="text-sm text-green-700">${formattedDate} o ${this.selectedTime}</p>
        </div>
      </div>
    `;

    timeSelection.appendChild(confirmationDiv);

    // Scroll to form bottom
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 500);
  }

  showCalendarView() {
    const calendarView = document.getElementById('calendar-grid');
    const timeSelection = document.getElementById('time-selection');

    calendarView.parentElement.style.display = 'block';
    timeSelection.classList.add('hidden');
  }

  isToday(dateStr) {
    const today = new Date();
    // Use local timezone instead of UTC
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
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
    const months = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    return months[month - 1];
  }

  getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  // Clear selection
  clearSelection() {
    this.selectedDate = null;
    this.selectedTime = null;
    
    const dateInput = document.getElementById('preferred-date');
    const timeSelect = document.getElementById('preferred-time');
    
    if (dateInput) dateInput.value = '';
    if (timeSelect) timeSelect.value = '';
    
    this.showCalendarView();
  }

  // Refresh calendar data
  async refreshCalendar() {
    this.slotsCache.clear();
    await this.loadAvailableSlots();
  }

  // Method to be called when an appointment is made to refresh the calendar
  async onAppointmentMade() {
    // Clear cache and reload to show updated availability
    this.slotsCache.clear();
    await this.loadAvailableSlots();
  }

  // Refresh time slots for currently selected date
  async refreshTimeSlots() {
    if (!this.selectedDate) {
      return;
    }

    try {
      // Show loading state
      const timeSlotsContainer = document.getElementById('time-slots');
      if (timeSlotsContainer) {
        timeSlotsContainer.innerHTML = `
          <div class="col-span-full text-center py-4">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto"></div>
            <p class="mt-2 text-xs text-gray-600">Odświeżanie...</p>
          </div>
        `;
      }

      // Clear cache for this specific date
      const cacheKey = `${this.currentYear}-${this.currentMonth}`;
      this.slotsCache.delete(cacheKey);

      // Reload slots for current month
      await this.loadAvailableSlots();

      // Re-select the same date to show updated time slots
      this.selectDate(this.selectedDate);

    } catch (error) {
      console.error('Error refreshing time slots:', error);
      const timeSlotsContainer = document.getElementById('time-slots');
      if (timeSlotsContainer) {
        timeSlotsContainer.innerHTML = `
          <div class="col-span-full text-center py-4 text-red-600">
            <p class="text-xs">Błąd podczas odświeżania. Spróbuj ponownie.</p>
          </div>
        `;
      }
    }
  }
}

// Create global instance
window.calendarInterface = new CalendarInterface();
export default window.calendarInterface;