// src/admin-navigation.js

import { app } from './app.js';
import { showToast, showConfirmation } from './ui-service.js';
import { adminAuth } from './admin-auth.js';

class AdminNavigation {
  constructor() {
    this.currentView = null;
    this.app = null; // Wstrzykiwane przez app.register
  }

  /**
   * ZMIANA: init jest teraz prostsze i wywoływane PO potwierdzeniu logowania.
   * @param {import('firebase/auth').User} user - Obiekt zalogowanego użytkownika.
   */
  init(user) {
    this.listenForEvents();
    
    // Nie musimy już nasłuchiwać na onAuthStateChanged, bo wiemy, że jesteśmy zalogowani
    this.setupUI(user);
  }

  listenForEvents() {
    this.app.events.on('showToast', (data) => {
        showToast(data.message, data.type);
    });
  }
  
  /**
   * Metoda, która buduje interfejs po potwierdzeniu autentykacji.
   */
  setupUI(user) {
    this.createAdminNavigation(user);
    this.determineCurrentView();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const body = document.body;
    if (body.dataset.adminListenersAttached) return;
    body.dataset.adminListenersAttached = 'true';

    body.addEventListener('click', async (event) => {
      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;

      const action = actionElement.dataset.action;
      const view = actionElement.dataset.view;
      const filter = actionElement.dataset.filter;

      switch (action) {
        case 'switch-view':
          await this.switchToView(view);
          if (actionElement.closest('#mobile-menu')) this.closeMobileMenu();
          break;
        case 'toggle-mobile-menu': this.toggleMobileMenu(); break;
        case 'logout': await this.logout(); break;
        case 'go-home': window.location.href = '/'; break;
        case 'filter-appointments': app.get('adminPanel')?.filterAppointments(filter); break;
        case 'load-appointments': app.get('adminPanel')?.loadAppointments(); break;
        case 'maintenance-cleanup': app.get('adminPanel')?.performMaintenanceCleanup(); break;
      }
    });
  }

  async determineCurrentView() {
    const path = window.location.pathname;
    const viewMap = {
      '/admin-schedule': 'schedule',
      '/admin-appointments': 'appointments',
      '/admin-settings': 'settings',
      '/schedule-admin': 'schedule',
      '/admin-services': 'services',
      '/admin': 'appointments'
    };
    this.currentView = viewMap[path] || 'appointments';
    await this.switchToView(this.currentView);
  }

  createAdminNavigation(user) {
    const container = this.getMainContainer();
    container.innerHTML = '';
    const userEmail = user?.email || 'Admin';
    container.innerHTML = `
      <div class="min-h-screen bg-gray-50">
        <header id="admin-header" class="bg-white shadow-sm border-b border-gray-200">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
              <div class="flex items-center"><h1 class="text-lg sm:text-xl font-semibold text-gray-900">Panel Administracyjny</h1></div>
              <div class="flex items-center lg:hidden">
                <button data-action="toggle-mobile-menu" class="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
                  <svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path id="menu-icon" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                    <path id="close-icon" class="hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              <nav class="hidden lg:flex lg:items-center lg:space-x-6">
                <button data-action="switch-view" data-view="appointments" id="nav-appointments" class="nav-link px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">
                  <svg class="w-4 h-4 inline mr-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>Wizyty
                </button>
                <button data-action="switch-view" data-view="schedule" id="nav-schedule" class="nav-link px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">
                  <svg class="w-4 h-4 inline mr-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>Grafik
                </button>
                <button data-action="switch-view" data-view="services" id="nav-services" class="nav-link px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">
                  <svg class="w-4 h-4 inline mr-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                  </svg>Usługi
                </button>
                <button data-action="switch-view" data-view="settings" id="nav-settings" class="nav-link px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">
                  <svg class="w-4 h-4 inline mr-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>Ustawienia
                </button>
                <div class="flex items-center space-x-4 ml-6 pl-6 border-l border-gray-200">
                  <span class="text-sm text-gray-500">${userEmail}</span>
                  <button data-action="logout" class="text-sm text-red-600 hover:text-red-800 transition-colors">Wyloguj</button>
                </div>
              </nav>
            </div>
            <div id="mobile-menu" class="hidden lg:hidden border-t border-gray-200 py-4">
              <div class="space-y-2">
                <button data-action="switch-view" data-view="appointments" id="nav-appointments-mobile" class="nav-link-mobile w-full text-left px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 flex items-center">
                  <svg class="w-5 h-5 mr-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>Wizyty
                </button>
                <button data-action="switch-view" data-view="schedule" id="nav-schedule-mobile" class="nav-link-mobile w-full text-left px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 flex items-center">
                  <svg class="w-5 h-5 mr-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>Grafik
                </button>
                <button data-action="switch-view" data-view="services" id="nav-services-mobile" class="nav-link-mobile w-full text-left px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 flex items-center">
                  <svg class="w-5 h-5 mr-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                  </svg>Usługi
                </button>
                <button data-action="switch-view" data-view="settings" id="nav-settings-mobile" class="nav-link-mobile w-full text-left px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 flex items-center">
                  <svg class="w-5 h-5 mr-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>Ustawienia
                </button>
                <div class="border-t border-gray-200 pt-4 mt-4">
                  <div class="px-3 py-2"><span class="text-sm text-gray-500">Zalogowany jako: ${userEmail}</span></div>
                  <button data-action="logout" class="w-full text-left px-3 py-3 rounded-md text-base font-medium text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors flex items-center">
                    <svg class="w-5 h-5 mr-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>Wyloguj
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main class="max-w-7xl mx-auto py-3 sm:py-6 px-4 sm:px-6 lg:px-8">
          <div id="admin-content" class="py-3 sm:py-6">
            <div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div><p class="mt-2 text-gray-600">Ładowanie...</p></div>
          </div>
        </main>
      </div>
    `;
    this.updateActiveNavigation();
  }

  async switchToView(view) {
    if (!adminAuth.isAuthenticated()) { this.showAuthRequired(); return; }
    this.currentView = view;
    this.updateActiveNavigation();
    const content = document.getElementById('admin-content');
    if (!content) return;
    content.innerHTML = `<div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div><p class="mt-2 text-gray-600">Ładowanie widoku: ${view}...</p></div>`;
    
    try {
      switch (view) {
        case 'appointments': await this.loadAppointmentsView(); break;
        case 'schedule': await this.loadScheduleView(); break;
        case 'services': await this.loadServicesView(); break;
        case 'settings': await this.loadSettingsView(); break;
      }
    } catch (error) {
      console.error(`Error switching to view ${view}:`, error);
      content.innerHTML = `<div class="text-center py-8 text-red-500"><p>Błąd podczas ładowania widoku.</p><button data-action="switch-view" data-view="${view}" class="mt-2 text-blue-600 hover:text-blue-800">Odśwież</button></div>`;
    }
  }

  async loadAppointmentsView() {
    const content = document.getElementById('admin-content');
    const { default: adminPanelInstance } = await import('./admin-panel.js');
    app.register('adminPanel', adminPanelInstance);
    await adminPanelInstance.renderView(content);
  }

  async loadScheduleView() {
    const content = document.getElementById('admin-content');
    const { default: scheduleEditorInstance } = await import('./schedule-editor.js');
    app.register('scheduleEditor', scheduleEditorInstance);
    const editorContent = await scheduleEditorInstance.renderScheduleEditor();
    content.innerHTML = editorContent.html || editorContent;
    if (typeof editorContent.postRenderSetup === 'function') {
        editorContent.postRenderSetup();
    }
  }

  async loadServicesView() {
    const content = document.getElementById('admin-content');
    const { default: servicesEditorInstance } = await import('./services-editor.js');
    app.register('servicesEditor', servicesEditorInstance);
    content.innerHTML = await servicesEditorInstance.renderServicesEditor();
    await servicesEditorInstance.loadServices();
  }

  async loadSettingsView() {
    const content = document.getElementById('admin-content');
    if (!content) return;
    try {
        const { default: slotBlockingInstance } = await import('./slot-blocking.js');
        app.register('slotBlocking', slotBlockingInstance);
        const blockingInterface = await slotBlockingInstance.renderBlockingInterface();
        content.innerHTML = `
            <div class="space-y-6">${blockingInterface}
                <div class="bg-white shadow rounded-lg p-4 sm:p-6">
                    <h2 class="text-lg font-medium text-gray-900 mb-4">Ustawienia systemu</h2>
                    <div class="space-y-4">
                        <div class="border-b border-gray-200 pb-4">
                            <h3 class="text-md font-medium text-gray-700 mb-2">Czyszczenie bazy danych</h3>
                            <button data-action="maintenance-cleanup" class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">Usuń stare wizyty (12+ miesięcy)</button>
                            <p class="text-sm text-gray-600 mt-2">Automatycznie usuwa wizyty starsze niż 12 miesięcy. Ta operacja jest nieodwracalna.</p>
                        </div>
                        <div>
                            <h3 class="text-md font-medium text-gray-700 mb-2">Informacje o systemie</h3>
                            <div class="text-sm text-gray-600 space-y-1">
                                <p>Wersja: 2.2.0 (Refactored)</p>
                                <p>Ostatnia aktualizacja: ${new Date().toLocaleDateString('pl-PL')}</p>
                                <p>Status Firebase: <span class="text-green-600">Połączony</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        await slotBlockingInstance.loadBlocks();
    } catch (error) {
        console.error('Error loading settings view:', error);
        content.innerHTML = `<div class="text-center py-8 text-red-500"><p>Błąd podczas ładowania ustawień.</p></div>`;
    }
  }
  
  showAuthRequired() {
    const container = this.getMainContainer();
    if (container.querySelector('#admin-header')) {
        container.innerHTML = '';
    }
    adminAuth.showLoginForm();
  }

  getMainContainer = () => document.getElementById('admin-panel') || document.getElementById('schedule-admin') || document.querySelector('main') || document.querySelector('#app') || document.body;

  updateActiveNavigation() {
    ['appointments', 'schedule', 'services', 'settings'].forEach(view => {
      [document.getElementById(`nav-${view}`), document.getElementById(`nav-${view}-mobile`)].forEach(btn => {
        if (btn) {
          const isActive = this.currentView === view;
          btn.classList.toggle('bg-blue-100', isActive);
          btn.classList.toggle('text-blue-700', isActive);
          btn.classList.toggle(btn.id.includes('-mobile') ? 'text-gray-600' : 'text-gray-500', !isActive);
        }
      });
    });
  }

  toggleMobileMenu() {
    document.getElementById('mobile-menu')?.classList.toggle('hidden');
    document.getElementById('menu-icon')?.classList.toggle('hidden');
    document.getElementById('close-icon')?.classList.toggle('hidden');
  }

  closeMobileMenu() {
    document.getElementById('mobile-menu')?.classList.add('hidden');
    document.getElementById('menu-icon')?.classList.remove('hidden');
    document.getElementById('close-icon')?.classList.add('hidden');
  }

  async logout() {
    const confirmed = await showConfirmation(
        'Potwierdzenie wylogowania',
        'Czy na pewno chcesz się wylogować z panelu administracyjnego?'
    );
    if (confirmed) {
      try {
        await adminAuth.logout();
        window.location.href = '/';
      } catch (error) {
        console.error('Error during logout:', error);
        window.location.href = '/';
      }
    }
  }
}

export default AdminNavigation;