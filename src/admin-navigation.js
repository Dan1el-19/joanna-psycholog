// Admin navigation system
import { authSystem } from './auth.js';

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
    // Check authentication
    if (!authSystem.verifyAuth()) {
      this.showAuthRequired();
      return;
    }

    this.isAuthenticated = true;
    this.createAdminNavigation();
    this.determineCurrentView();
    
    // Set up global auth success handler
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
                  <span class="text-sm text-gray-500">Admin</span>
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
                    <span class="text-sm text-gray-500">Zalogowany jako: Admin</span>
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
    // Try different possible container IDs
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
    const navSettings = document.getElementById('nav-settings');
    
    // Mobile navigation
    const navAppointmentsMobile = document.getElementById('nav-appointments-mobile');
    const navScheduleMobile = document.getElementById('nav-schedule-mobile');
    const navSettingsMobile = document.getElementById('nav-settings-mobile');
    
    const allNavs = [navAppointments, navSchedule, navSettings, navAppointmentsMobile, navScheduleMobile, navSettingsMobile].filter(Boolean);
    
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
    if (this.currentView === 'appointments') {
      [navAppointments, navAppointmentsMobile].forEach(nav => {
        if (nav) {
          nav.classList.remove('text-gray-500', 'text-gray-600', 'hover:text-gray-700', 'hover:text-gray-900', 'hover:bg-gray-100');
          nav.classList.add('bg-blue-100', 'text-blue-700');
        }
      });
    } else if (this.currentView === 'schedule') {
      [navSchedule, navScheduleMobile].forEach(nav => {
        if (nav) {
          nav.classList.remove('text-gray-500', 'text-gray-600', 'hover:text-gray-700', 'hover:text-gray-900', 'hover:bg-gray-100');
          nav.classList.add('bg-blue-100', 'text-blue-700');
        }
      });
    } else if (this.currentView === 'settings') {
      [navSettings, navSettingsMobile].forEach(nav => {
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
      
      if (isHidden) {
        mobileMenu.classList.remove('hidden');
        menuIcon.classList.add('hidden');
        closeIcon.classList.remove('hidden');
      } else {
        mobileMenu.classList.add('hidden');
        menuIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
      }
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
        <p class="mt-2 text-gray-600">Ładowanie...</p>
      </div>
    `;

    try {
      if (view === 'appointments') {
        await this.loadAppointmentsView();
      } else if (view === 'schedule') {
        await this.loadScheduleView();
      } else if (view === 'settings') {
        await this.loadSettingsView();
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
          <p class="text-gray-600">Błąd podczas ładowania. Spróbuj ponownie.</p>
          <button onclick="adminNav.switchToView('${view}')" class="mt-2 text-blue-600 hover:text-blue-800">
            Odśwież
          </button>
        </div>
      `;
    }
  }

  async loadAppointmentsView() {
    const content = document.getElementById('admin-content');
    
    // Create appointments container
    content.innerHTML = `
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-medium text-gray-900">Zarządzanie wizytami</h2>
          <p class="text-sm text-gray-500">Przeglądaj i zarządzaj rezerwacjami klientów</p>
        </div>
        
        <div id="appointments-container" class="p-6">
          <div class="text-center py-8">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            <p class="mt-2 text-sm text-gray-600">Ładowanie wizyt...</p>
          </div>
        </div>
      </div>
    `;

    // Dynamically import and initialize admin panel
    try {
      const { default: AdminPanel } = await import('./admin-panel.js');
      
      // Check if admin panel is already initialized
      if (window.adminPanel && typeof window.adminPanel.loadAppointments === 'function') {
        // Use existing instance
        await this.initializeAppointmentPanel();
      } else {
        // Create new instance
        window.adminPanel = new AdminPanel();
        await this.initializeAppointmentPanel();
      }
    } catch (error) {
      console.error('Error loading admin panel:', error);
      content.innerHTML = `
        <div class="text-center py-8 text-red-600">
          <p>Błąd podczas ładowania panelu wizyt</p>
        </div>
      `;
    }
  }

  async initializeAppointmentPanel() {
    // Wait a bit for the admin panel to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const appointmentsContainer = document.getElementById('appointments-container');
    if (appointmentsContainer && window.adminPanel) {
      // Replace the loading content with admin panel content
      appointmentsContainer.innerHTML = `
        <div class="flex flex-wrap gap-2 mb-6">
          <button onclick="adminPanel.filterAppointments('all')" 
                  class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium">
            Wszystkie
          </button>
          <button onclick="adminPanel.filterAppointments('pending')" 
                  class="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium">
            Oczekujące
          </button>
          <button onclick="adminPanel.filterAppointments('confirmed')" 
                  class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium">
            Potwierdzone
          </button>
          <button onclick="adminPanel.filterAppointments('completed')" 
                  class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium">
            Zakończone
          </button>
          <button onclick="adminPanel.filterAppointments('cancelled')" 
                  class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium">
            Anulowane
          </button>
          <button onclick="adminPanel.filterAppointments('archived')" 
                  class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium">
            Archiwum
          </button>
          <button onclick="adminPanel.loadAppointments()" 
                  class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium">
            🔄 Odśwież
          </button>
        </div>

        <div id="appointments-list" class="space-y-4">
          <div class="text-center py-8">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            <p class="mt-2 text-sm text-gray-600">Ładowanie wizyt...</p>
          </div>
        </div>
      `;

      // Load appointments
      if (typeof window.adminPanel.loadAppointments === 'function') {
        await window.adminPanel.loadAppointments();
      }
    }
  }

  async loadScheduleView() {
    const content = document.getElementById('admin-content');
    if (!content) return;

    try {
      // First, import the schedule editor module
      const scheduleEditorModule = await import('./schedule-editor.js');
      const scheduleEditor = scheduleEditorModule.default;
      
      // Render basic HTML structure immediately
      content.innerHTML = `
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

          ${scheduleEditor.renderModals()}
        </div>
      `;
      
      // Load data asynchronously after HTML is rendered
      setTimeout(async () => {
        try {
          await scheduleEditor.loadTemplates();
          await scheduleEditor.loadAssignments();
        } catch (error) {
          console.error('Error loading schedule data:', error);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error loading schedule editor:', error);
      content.innerHTML = `
        <div class="bg-white shadow rounded-lg p-6">
          <div class="text-center py-8 text-red-600">
            <p>Błąd podczas ładowania edytora harmonogramów</p>
          </div>
        </div>
      `;
    }
  }

  async loadLegacyScheduleView() {
    const content = document.getElementById('admin-content');
    
    // Create schedule container
    content.innerHTML = `
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-medium text-gray-900">Zarządzanie grafikiem</h2>
          <p class="text-sm text-gray-500">Twórz szablony, zarządzaj miesięcznymi grafikami i blokuj terminy</p>
        </div>
        
        <div id="schedule-container" class="p-6">
          <div class="text-center py-8">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            <p class="mt-2 text-sm text-gray-600">Ładowanie grafiku...</p>
          </div>
        </div>
      </div>
    `;

    // Dynamically import and initialize schedule admin
    try {
      const { default: ScheduleAdmin } = await import('./schedule-admin.js');
      
      // Check if schedule admin is already initialized
      if (window.scheduleAdmin && typeof window.scheduleAdmin.switchView === 'function') {
        // Use existing instance
        await this.initializeSchedulePanel();
      } else {
        // Create new instance
        window.scheduleAdmin = new ScheduleAdmin();
        await this.initializeSchedulePanel();
      }
    } catch (error) {
      console.error('Error loading schedule admin:', error);
      content.innerHTML = `
        <div class="text-center py-8 text-red-600">
          <p>Błąd podczas ładowania panelu grafiku</p>
        </div>
      `;
    }
  }

  async loadSettingsView() {
    const content = document.getElementById('admin-content');
    if (!content) return;

    // Import slot blocking module
    try {
      const slotBlockingModule = await import('./slot-blocking.js');
      const slotBlocking = slotBlockingModule.default;
      
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
                <h3 class="text-md font-medium text-gray-700 mb-2">Godziny pracy</h3>
                <p class="text-sm text-gray-600">Zarządzaj standardowymi godzinami pracy w sekcji Grafik</p>
              </div>
              
              <div class="border-b border-gray-200 pb-4">
                <h3 class="text-md font-medium text-gray-700 mb-2">Powiadomienia email</h3>
                <p class="text-sm text-gray-600">Automatyczne powiadomienia są aktywne dla wszystkich nowych rezerwacji</p>
              </div>
              
              <div class="border-b border-gray-200 pb-4">
                <h3 class="text-md font-medium text-gray-700 mb-2">Cache kalendarza</h3>
                <button onclick="window.calendarInterface?.refreshCalendar()" 
                        class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
                  Odśwież cache kalendarza
                </button>
                <p class="text-sm text-gray-600 mt-2">Wyczyść cache i odśwież dostępne terminy</p>
              </div>
              
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
                  <p>Wersja: 1.0.0</p>
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
      console.error('Error loading slot blocking:', error);
      content.innerHTML = `
        <div class="bg-white shadow rounded-lg p-6">
          <div class="text-center py-8 text-red-600">
            <p>Błąd podczas ładowania ustawień</p>
          </div>
        </div>
      `;
    }
  }

  async initializeSchedulePanel() {
    // Wait a bit for the schedule admin to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const scheduleContainer = document.getElementById('schedule-container');
    if (scheduleContainer && window.scheduleAdmin) {
      // Replace the loading content with schedule admin content
      scheduleContainer.innerHTML = `
        <div class="border-b border-gray-200 mb-6">
          <nav class="flex space-x-8">
            <button id="templates-tab" 
                    onclick="scheduleAdmin.switchView('templates')"
                    class="py-4 px-1 border-b-2 border-blue-500 text-blue-600 font-medium text-sm">
              Szablony grafików
            </button>
            <button id="monthly-tab" 
                    onclick="scheduleAdmin.switchView('monthly')"
                    class="py-4 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium text-sm">
              Grafik miesięczny
            </button>
            <button id="blocked-tab" 
                    onclick="scheduleAdmin.switchView('blocked')"
                    class="py-4 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium text-sm">
              Blokady terminów
            </button>
          </nav>
        </div>
        
        <div id="schedule-content">
          <div class="text-center py-8">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            <p class="mt-2 text-sm text-gray-600">Ładowanie...</p>
          </div>
        </div>
      `;

      // Load initial schedule view
      if (typeof window.scheduleAdmin.loadTemplatesView === 'function') {
        await window.scheduleAdmin.loadTemplatesView();
      }
    }
  }

  logout() {
    if (confirm('Czy na pewno chcesz się wylogować?')) {
      authSystem.logout();
      window.location.href = '/';
    }
  }

  // Helper method to show messages
  showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 
      type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
      'bg-blue-100 text-blue-800 border border-blue-200'
    }`;
    messageDiv.innerHTML = message;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }
}

// Create global instance
window.adminNav = new AdminNavigation();
export default window.adminNav;