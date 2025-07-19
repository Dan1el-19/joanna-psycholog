// Admin navigation system
import { adminAuth } from './admin-auth.js';
// Usunęliśmy stąd statyczny import firebaseService, bo będzie ładowany na żądanie

class AdminNavigation {
  constructor() {
    this.currentView = null;
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
    // Wait for Firebase Auth to initialize instead of checking immediately
    adminAuth.onAuthStateChanged((user) => {
      if (user) {
        // User is authenticated
        this.isAuthenticated = true;
        this.createAdminNavigation();
        this.determineCurrentView();
      } else {
        // User is not authenticated
        this.showAuthRequired();
      }
    });
    
    // Set up global auth success handler as fallback
    window.onAdminAuthSuccess = () => {
      this.isAuthenticated = true;
      this.createAdminNavigation();
      this.determineCurrentView();
    };
  }

  async determineCurrentView() {
    const path = window.location.pathname;
    if (path.includes('/admin-schedule')) {
      this.currentView = 'schedule';
    } else if (path.includes('/admin-appointments')) {
      this.currentView = 'appointments';
    } else if (path.includes('/admin-settings')) {
      this.currentView = 'settings';
    } else if (path.includes('/schedule-admin')) {
      this.currentView = 'schedule';
    } else if (path.includes('/admin')) {
      this.currentView = 'appointments';
    } else {
      this.currentView = 'appointments'; // default
    }
    
    this.updateActiveNavigation();
    
    // Automatically load the determined view
    await this.switchToView(this.currentView);
  }

  showAuthRequired() {
    const container = this.getMainContainer();
    if (container) {
      container.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-gray-50">
          <div class="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
            <div class="mb-6">
              <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V9m0 0V7m0 2H10m2 0h2"></path>
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-gray-800 mb-2">Dostęp Ograniczony</h2>
              <p class="text-gray-600 mb-4">Panel administracyjny wymaga autoryzacji</p>
              <button onclick="window.location.href='/'" class="text-blue-600 hover:text-blue-800">
                Wróć do strony głównej
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }

  createAdminNavigation() {
    const container = this.getMainContainer();
    if (!container) return;

    // Create admin layout with navigation
    container.innerHTML = `
      <div class="min-h-screen bg-gray-50">
        <!-- Admin Navigation Header -->
        <header class="bg-white shadow-sm border-b border-gray-200">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
              <div class="flex items-center">
                <h1 class="text-lg sm:text-xl font-semibold text-gray-900">Panel Administracyjny</h1>
              </div>
              
              <!-- Mobile menu button -->
              <div class="flex items-center lg:hidden">
                <button id="mobile-menu-button" 
                        class="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                        onclick="adminNav.toggleMobileMenu()">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path id="menu-icon" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                    <path id="close-icon" class="hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <!-- Desktop navigation -->
              <nav class="hidden lg:flex lg:items-center lg:space-x-6">
                <button id="nav-appointments" 
                        class="nav-link px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                        onclick="adminNav.switchToView('appointments')">
                  <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  Wizyty
                </button>
                
                <button id="nav-schedule" 
                        class="nav-link px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                        onclick="adminNav.switchToView('schedule')">
                  <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Grafik
                </button>
                
                <button id="nav-services" 
                        class="nav-link px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                        onclick="adminNav.switchToView('services')">
                  <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                  </svg>
                  Usługi
                </button>
                
                <button id="nav-settings" 
                        class="nav-link px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                        onclick="adminNav.switchToView('settings')">
                  <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  Ustawienia
                </button>
                
                <div class="flex items-center space-x-4 ml-6 pl-6 border-l border-gray-200">
                  <span class="text-sm text-gray-500">${adminAuth.getCurrentUser()?.email || 'Admin'}</span>
                  <button onclick="adminNav.logout()" 
                          class="text-sm text-red-600 hover:text-red-800 transition-colors">
                    Wyloguj
                  </button>
                </div>
              </nav>
            </div>
            
            <!-- Mobile navigation menu -->
            <div id="mobile-menu" class="hidden lg:hidden border-t border-gray-200 py-4">
              <div class="space-y-2">
                <button id="nav-appointments-mobile" 
                        class="nav-link-mobile w-full text-left px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 flex items-center"
                        onclick="adminNav.switchToView('appointments'); adminNav.closeMobileMenu();">
                  <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  Wizyty
                </button>
                
                <button id="nav-schedule-mobile" 
                        class="nav-link-mobile w-full text-left px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 flex items-center"
                        onclick="adminNav.switchToView('schedule'); adminNav.closeMobileMenu();">
                  <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Grafik
                </button>
                
                <button id="nav-services-mobile" 
                        class="nav-link-mobile w-full text-left px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 flex items-center"
                        onclick="adminNav.switchToView('services'); adminNav.closeMobileMenu();">
                  <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                  </svg>
                  Usługi
                </button>
                
                <button id="nav-settings-mobile" 
                        class="nav-link-mobile w-full text-left px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 flex items-center"
                        onclick="adminNav.switchToView('settings'); adminNav.closeMobileMenu();">
                  <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  Ustawienia
                </button>
                
                <div class="border-t border-gray-200 pt-4 mt-4">
                  <div class="px-3 py-2">
                    <span class="text-sm text-gray-500">Zalogowany jako: ${adminAuth.getCurrentUser()?.email || 'Admin'}</span>
                  </div>
                  <button onclick="adminNav.logout()" 
                          class="w-full text-left px-3 py-3 rounded-md text-base font-medium text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors flex items-center">
                    <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                    Wyloguj
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- Main Content Area -->
        <main class="max-w-7xl mx-auto py-3 sm:py-6 px-4 sm:px-6 lg:px-8">
          <div id="admin-content" class="py-3 sm:py-6">
            <div class="text-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p class="mt-2 text-gray-600">Ładowanie...</p>
            </div>
          </div>
        </main>
      </div>
    `;

    this.updateActiveNavigation();
  }

  getMainContainer() {
    return document.getElementById('admin-panel') || 
           document.getElementById('schedule-admin') || 
           document.querySelector('main') ||
           document.querySelector('#app') ||
           document.body;
  }

  updateActiveNavigation() {
    // Desktop navigation
    const navAppointments = document.getElementById('nav-appointments');
    const navSchedule = document.getElementById('nav-schedule');
    const navServices = document.getElementById('nav-services');
    const navSettings = document.getElementById('nav-settings');
    
    // Mobile navigation
    const navAppointmentsMobile = document.getElementById('nav-appointments-mobile');
    const navScheduleMobile = document.getElementById('nav-schedule-mobile');
    const navServicesMobile = document.getElementById('nav-services-mobile');
    const navSettingsMobile = document.getElementById('nav-settings-mobile');
    
    const allNavs = [navAppointments, navSchedule, navServices, navSettings, navAppointmentsMobile, navScheduleMobile, navServicesMobile, navSettingsMobile].filter(Boolean);
    
    if (allNavs.length === 0) return;

    // Reset all nav links
    allNavs.forEach(nav => {
      nav.classList.remove('bg-blue-100', 'text-blue-700', 'bg-gray-100', 'text-gray-900');
      if (nav.id.includes('-mobile')) {
        nav.classList.add('text-gray-600', 'hover:text-gray-900', 'hover:bg-gray-100');
      } else {
        nav.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-100');
      }
    });

    // Set active nav link
    const activeNavs = {
      appointments: [navAppointments, navAppointmentsMobile],
      schedule: [navSchedule, navScheduleMobile],
      services: [navServices, navServicesMobile],
      settings: [navSettings, navSettingsMobile]
    };

    if (activeNavs[this.currentView]) {
        activeNavs[this.currentView].forEach(nav => {
            if (nav) {
                nav.classList.remove('text-gray-500', 'text-gray-600', 'hover:text-gray-700', 'hover:text-gray-900', 'hover:bg-gray-100');
                nav.classList.add('bg-blue-100', 'text-blue-700');
            }
        });
    }
  }

  toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');
    const closeIcon = document.getElementById('close-icon');
    
    if (mobileMenu && menuIcon && closeIcon) {
      const isHidden = mobileMenu.classList.contains('hidden');
      
      mobileMenu.classList.toggle('hidden', !isHidden);
      menuIcon.classList.toggle('hidden', isHidden);
      closeIcon.classList.toggle('hidden', !isHidden);
    }
  }

  closeMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');
    const closeIcon = document.getElementById('close-icon');
    
    if (mobileMenu && menuIcon && closeIcon) {
      mobileMenu.classList.add('hidden');
      menuIcon.classList.remove('hidden');
      closeIcon.classList.add('hidden');
    }
  }

  async switchToView(view) {
    if (!this.isAuthenticated) {
      this.showAuthRequired();
      return;
    }

    this.currentView = view;
    this.updateActiveNavigation();

    const content = document.getElementById('admin-content');
    if (!content) return;

    // Show loading state
    content.innerHTML = `
      <div class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p class="mt-2 text-gray-600">Ładowanie widoku: ${view}...</p>
      </div>
    `;

    try {
      if (view === 'appointments') {
        await this.loadAppointmentsView();
      } else if (view === 'schedule') {
        await this.loadScheduleView();
      } else if (view === 'settings') {
        await this.loadSettingsView();
      } else if (view === 'services') {
        await this.loadServicesView();
      }
    } catch (error) {
      console.error('Error switching view:', error);
      content.innerHTML = `
        <div class="text-center py-8">
          <div class="text-red-600 mb-2">
            <svg class="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <p class="text-gray-600">Błąd podczas ładowania widoku. Spróbuj ponownie.</p>
          <button onclick="adminNav.switchToView('${view}')" class="mt-2 text-blue-600 hover:text-blue-800">
            Odśwież
          </button>
        </div>
      `;
    }
  }

  async loadAppointmentsView() {
    const content = document.getElementById('admin-content');
    content.innerHTML = `
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-medium text-gray-900">Zarządzanie wizytami</h2>
          <p class="text-sm text-gray-500">Przeglądaj i zarządzaj rezerwacjami klientów</p>
        </div>
        <div id="appointments-container" class="p-6">
          <!-- Content will be injected by initializeAppointmentPanel -->
        </div>
      </div>
    `;

    try {
      // ✅ DYNAMICZNY IMPORT - moduł jest pobierany DOPIERO TERAZ
      const { default: AdminPanel } = await import('./admin-panel.js');
      
      if (!window.adminPanel) {
        window.adminPanel = new AdminPanel();
      }
      await this.initializeAppointmentPanel();
    } catch (error) {
      console.error('Error loading admin panel:', error);
      document.getElementById('appointments-container').innerHTML = `<div class="text-center py-8 text-red-600"><p>Błąd podczas ładowania panelu wizyt.</p></div>`;
    }
  }

  async initializeAppointmentPanel() {
    const appointmentsContainer = document.getElementById('appointments-container');
    if (appointmentsContainer && window.adminPanel) {
      appointmentsContainer.innerHTML = `
        <div class="flex flex-wrap gap-2 mb-6">
          <button onclick="window.adminPanel.filterAppointments('all')" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium">Wszystkie</button>
          <button onclick="window.adminPanel.filterAppointments('pending')" class="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium">Oczekujące</button>
          <button onclick="window.adminPanel.filterAppointments('confirmed')" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium">Potwierdzone</button>
          <button onclick="window.adminPanel.filterAppointments('completed')" class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium">Zakończone</button>
          <button onclick="window.adminPanel.filterAppointments('cancelled')" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium">Anulowane</button>
          <button onclick="window.adminPanel.filterAppointments('archived')" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium">Archiwum</button>
          <button onclick="window.adminPanel.loadAppointments()" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium">🔄 Odśwież</button>
        </div>
        <div id="appointments-list" class="space-y-4">
          <div class="text-center py-8"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div><p class="mt-2 text-sm text-gray-600">Ładowanie wizyt...</p></div>
        </div>
      `;
      if (typeof window.adminPanel.loadAppointments === 'function') {
        await window.adminPanel.loadAppointments();
      }
    }
  }

  async loadScheduleView() {
    const content = document.getElementById('admin-content');
    if (!content) return;

    try {
      // ✅ DYNAMICZNY IMPORT - moduł jest pobierany DOPIERO TERAZ
      const { default: scheduleEditor } = await import('./schedule-editor.js');
      
      // Render basic HTML structure immediately
      content.innerHTML = await scheduleEditor.renderScheduleEditor();
      
      // Load data asynchronously after HTML is rendered
      setTimeout(async () => {
        try {
          // Make sure the instance is globally available for buttons
          window.scheduleEditor = scheduleEditor;
          await scheduleEditor.loadTemplates();
          await scheduleEditor.loadAssignments();
        } catch (error) {
          console.error('Error loading schedule data:', error);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error loading schedule editor:', error);
      content.innerHTML = `<div class="bg-white shadow rounded-lg p-6"><div class="text-center py-8 text-red-600"><p>Błąd podczas ładowania edytora harmonogramów.</p></div></div>`;
    }
  }

  async loadSettingsView() {
    const content = document.getElementById('admin-content');
    if (!content) return;

    try {
      // ✅ DYNAMICZNY IMPORT - moduł jest pobierany DOPIERO TERAZ
      const { default: slotBlocking } = await import('./slot-blocking.js');
      window.slotBlocking = slotBlocking; // Make it global for buttons
      
      const blockingInterface = await slotBlocking.renderBlockingInterface();
      
      content.innerHTML = `
        <div class="space-y-6">
          <!-- Slot Blocking Section -->
          ${blockingInterface}
          
          <!-- System Settings Section -->
          <div class="bg-white shadow rounded-lg p-4 sm:p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-4">Ustawienia systemu</h2>
            <div class="space-y-4">
              <div class="border-b border-gray-200 pb-4">
                <h3 class="text-md font-medium text-gray-700 mb-2">Czyszczenie bazy danych</h3>
                <button onclick="window.adminPanel?.performMaintenanceCleanup()" 
                        class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">
                  Usuń stare wizyty (12+ miesięcy)
                </button>
                <p class="text-sm text-gray-600 mt-2">Automatycznie usuwa wizyty starsze niż 12 miesięcy. Ta operacja jest nieodwracalna.</p>
              </div>
              <div>
                <h3 class="text-md font-medium text-gray-700 mb-2">Informacje o systemie</h3>
                <div class="text-sm text-gray-600 space-y-1">
                  <p>Wersja: 2.0.0 (Code Splitting)</p>
                  <p>Ostatnia aktualizacja: ${new Date().toLocaleDateString('pl-PL')}</p>
                  <p>Status Firebase: <span class="text-green-600">Połączony</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Load current blocks
      await slotBlocking.loadBlocks();
      
    } catch (error) {
      console.error('Error loading settings view:', error);
      content.innerHTML = `<div class="bg-white shadow rounded-lg p-6"><div class="text-center py-8 text-red-600"><p>Błąd podczas ładowania ustawień.</p></div></div>`;
    }
  }

  async loadServicesView() {
    const content = document.getElementById('admin-content');
    if (!content) return;

    try {
      // ✅ DYNAMICZNY IMPORT - moduł jest pobierany DOPIERO TERAZ
      const { default: firebaseService } = await import('./firebase-service.js');
      const services = await firebaseService.getServices();
      
      content.innerHTML = `
        <div class="space-y-6">
          <div class="bg-white shadow rounded-lg p-4 sm:p-6">
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-lg font-medium text-gray-900">Zarządzanie usługami</h2>
              <button onclick="adminNav.showAddServiceModal()" 
                      class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
                <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                Dodaj usługę
              </button>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nazwa</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opis</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Czas trwania</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cena</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200" id="services-table-body">
                  ${services.map(service => `
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${service.name}</td>
                      <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">${service.description || '-'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${service.duration} min</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${service.price ? service.price + ' zł' : '-'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button onclick="adminNav.showEditServiceModal('${service.id}')" class="text-blue-600 hover:text-blue-900">Edytuj</button>
                        <button onclick="adminNav.deleteService('${service.id}')" class="text-red-600 hover:text-red-900">Usuń</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              ${services.length === 0 ? `<div class="text-center py-8 text-gray-500"><svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg><p>Brak zdefiniowanych usług</p><p class="text-sm">Dodaj pierwszą usługę, aby rozpocząć</p></div>` : ''}
            </div>
          </div>
        </div>
        <div id="service-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div class="px-6 py-4 border-b border-gray-200"><h3 id="service-modal-title" class="text-lg font-medium text-gray-900">Dodaj usługę</h3></div>
            <form id="service-form" class="px-6 py-4 space-y-4">
              <input type="hidden" id="service-id" value="">
              <div><label for="service-name" class="block text-sm font-medium text-gray-700">Nazwa usługi *</label><input type="text" id="service-name" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"></div>
              <div><label for="service-description" class="block text-sm font-medium text-gray-700">Opis</label><textarea id="service-description" rows="3" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"></textarea></div>
              <div><label for="service-duration" class="block text-sm font-medium text-gray-700">Czas trwania (minuty) *</label><input type="number" id="service-duration" required min="15" max="240" step="15" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"></div>
              <div><label for="service-price" class="block text-sm font-medium text-gray-700">Cena (zł)</label><input type="number" id="service-price" min="0" step="0.01" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"></div>
              <div><label for="service-slug" class="block text-sm font-medium text-gray-700">Identyfikator (slug) *</label><input type="text" id="service-slug" required pattern="[a-z0-9\\-]+" placeholder="np. terapia-indywidualna" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"><p class="text-xs text-gray-500 mt-1">Tylko małe litery, cyfry i myślniki</p></div>
            </form>
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button onclick="adminNav.hideServiceModal()" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Anuluj</button>
              <button onclick="adminNav.saveService()" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Zapisz</button>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error loading services:', error);
      content.innerHTML = `<div class="bg-white shadow rounded-lg p-6"><div class="text-center py-8 text-red-600"><p>Błąd podczas ładowania usług</p><button onclick="adminNav.switchToView('services')" class="mt-2 text-blue-600 hover:text-blue-800">Spróbuj ponownie</button></div></div>`;
    }
  }

  showAddServiceModal() {
    const modal = document.getElementById('service-modal');
    const title = document.getElementById('service-modal-title');
    const form = document.getElementById('service-form');
    
    title.textContent = 'Dodaj usługę';
    form.reset();
    document.getElementById('service-id').value = '';
    modal.classList.remove('hidden');
  }

  async showEditServiceModal(serviceId) {
    try {
      const { default: firebaseService } = await import('./firebase-service.js');
      const services = await firebaseService.getServices();
      const service = services.find(s => s.id === serviceId);
      
      if (!service) {
        this.showMessage('Nie znaleziono usługi', 'error');
        return;
      }
      
      const modal = document.getElementById('service-modal');
      const title = document.getElementById('service-modal-title');
      
      title.textContent = 'Edytuj usługę';
      document.getElementById('service-id').value = service.id;
      document.getElementById('service-name').value = service.name;
      document.getElementById('service-description').value = service.description || '';
      document.getElementById('service-duration').value = service.duration;
      document.getElementById('service-price').value = service.price || '';
      document.getElementById('service-slug').value = service.id;
      
      modal.classList.remove('hidden');
    } catch (error) {
      console.error('Error loading service for edit:', error);
      this.showMessage('Błąd podczas ładowania usługi', 'error');
    }
  }

  hideServiceModal() {
    document.getElementById('service-modal').classList.add('hidden');
  }

  async saveService() {
    try {
      const { default: firebaseService } = await import('./firebase-service.js');
      const serviceId = document.getElementById('service-id').value;
      const name = document.getElementById('service-name').value.trim();
      const description = document.getElementById('service-description').value.trim();
      const duration = parseInt(document.getElementById('service-duration').value);
      const price = parseFloat(document.getElementById('service-price').value) || null;
      const slug = document.getElementById('service-slug').value.trim();
      
      if (!name || !duration || !slug) { this.showMessage('Wypełnij wszystkie wymagane pola', 'error'); return; }
      if (duration < 15 || duration > 240) { this.showMessage('Czas trwania musi być między 15 a 240 minut', 'error'); return; }
      if (!/^[a-z0-9\-]+$/.test(slug)) { this.showMessage('Identyfikator może zawierać tylko małe litery, cyfry i myślniki', 'error'); return; }
      
      const serviceData = { name, description: description || null, duration, price, id: slug };
      
      if (serviceId && serviceId !== slug) {
        await firebaseService.deleteService(serviceId);
        await firebaseService.addService(serviceData);
      } else if (serviceId) {
        await firebaseService.updateService(serviceId, serviceData);
      } else {
        await firebaseService.addService(serviceData);
      }
      
      this.hideServiceModal();
      this.showMessage('Usługa została zapisana', 'success');
      await this.loadServicesView();
    } catch (error) {
      console.error('Error saving service:', error);
      this.showMessage('Błąd podczas zapisywania usługi', 'error');
    }
  }

  async deleteService(serviceId) {
    if (!confirm('Czy na pewno chcesz usunąć tę usługę? Ta operacja jest nieodwracalna.')) return;
    
    try {
      const { default: firebaseService } = await import('./firebase-service.js');
      await firebaseService.deleteService(serviceId);
      this.showMessage('Usługa została usunięta', 'success');
      await this.loadServicesView();
    } catch (error) {
      console.error('Error deleting service:', error);
      this.showMessage('Błąd podczas usuwania usługi', 'error');
    }
  }

  async logout() {
    if (confirm('Czy na pewno chcesz się wylogować?')) {
      try {
        await adminAuth.logout();
        window.location.href = '/';
      } catch (error) {
        console.error('Error during logout:', error);
        window.location.href = '/';
      }
    }
  }

  showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    const typeClasses = {
      success: 'bg-green-100 text-green-800 border border-green-200',
      error: 'bg-red-100 text-red-800 border border-red-200',
      info: 'bg-blue-100 text-blue-800 border border-blue-200'
    };
    messageDiv.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${typeClasses[type] || typeClasses.info}`;
    messageDiv.innerHTML = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 5000);
  }
}

// Create global instance
window.adminNav = new AdminNavigation();
export default window.adminNav;
