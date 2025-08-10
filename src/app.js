// src/app.js

import { adminAuth } from './admin-auth.js';
import { default as AdminNavigation } from './admin-navigation.js';

// ... (Klasy EventBus i Store bez zmian) ...
class EventBus {
    constructor() { this.events = {}; }
    on(event, listener) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(listener);
        return () => { this.events[event] = this.events[event].filter(l => l !== listener); };
    }
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(listener => listener(data));
        }
    }
}
class Store {
    constructor(initialState = {}) {
        this.state = initialState;
        this.listeners = new Set();
    }
    getState() { return this.state; }
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.listeners.forEach(listener => listener(this.state));
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

class App {
    constructor() {
        this.events = new EventBus();
        this.store = new Store({ 
            currentUser: null,
            isLoading: false,
            error: null,
            isOnline: navigator.onLine
        });
        this.services = {};
        this.initErrorHandling();
        this.initOnlineStatus();
        console.log('App Core initialized.');
    }

    register(name, instance) {
        if (!name || typeof name !== 'string') {
            throw new Error('Service name must be a non-empty string');
        }
        if (this.services[name]) {
            console.warn(`Service "${name}" is already registered. Overwriting...`);
        }
        this.services[name] = instance;
        instance.app = this;
        console.log(`Service registered: ${name}`);
    }

    get(name) {
        if (!this.services[name]) {
            throw new Error(`Service "${name}" not found. Available services: ${Object.keys(this.services).join(', ')}`);
        }
        return this.services[name];
    }

    // Obsługa błędów globalnych
    initErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.store.setState({ error: event.error.message });
            this.events.emit('error', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.store.setState({ error: event.reason.message || 'Wystąpił nieoczekiwany błąd' });
            this.events.emit('error', event.reason);
        });
    }

    // Obsługa statusu połączenia
    initOnlineStatus() {
        const updateOnlineStatus = () => {
            const isOnline = navigator.onLine;
            this.store.setState({ isOnline });
            this.events.emit('connectionChange', isOnline);
            
            if (!isOnline) {
                console.warn('Application is offline');
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
    }

    // Metoda do czyszczenia błędów
    clearError() {
        this.store.setState({ error: null });
    }

    // Metoda do ustawiania stanu ładowania
    setLoading(isLoading) {
        this.store.setState({ isLoading });
    }

    /**
     * OSTATECZNA, REAKTYWNA METODA STARTOWA
     */
    async start() {
        console.log("Starting application logic...");
        
        try {
            this.setLoading(true);
            
            const isAdminPage = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/schedule-admin');

            if (!isAdminPage) {
                console.log("Public page detected.");
                return;
            }

            console.log("Admin page detected. Initializing auth listener...");
            
            // adminAuth i AdminNavigation już zaimportowane statycznie
            
            // Rejestrujemy nawigację od razu
            const adminNav = new AdminNavigation();
            app.register('navigation', adminNav);

            // KLUCZOWA ZMIANA: Nasłuchujemy na ZMIANY stanu logowania
            adminAuth.onAuthStateChanged((user) => {
                console.log('Auth state changed, user:', user ? user.email : 'null');
                this.store.setState({ currentUser: user });

                if (user) {
                    // Jeśli jest użytkownik, inicjalizujemy pełny interfejs admina
                    adminNav.init(user);
                } else {
                    // Jeśli nie ma użytkownika, pokazujemy formularz logowania
                    adminNav.showAuthRequired();
                }
            });

        } catch (error) {
            console.error("Critical error during app startup:", error);
            this.store.setState({ error: 'Nie udało się uruchomić panelu administracyjnego' });
            document.body.innerHTML = `
                <div style="text-align: center; margin-top: 50px; font-family: sans-serif; color: red;">
                    <h1>Błąd krytyczny</h1>
                    <p>Nie udało się uruchomić panelu administracyjnego.</p>
                    <p>Szczegóły: ${error.message}</p>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Odśwież stronę
                    </button>
                </div>
            `;
        } finally {
            this.setLoading(false);
        }
    }
}

export const app = new App();
