// src/app.js

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
        this.store = new Store({ currentUser: null });
        this.services = {};
        console.log('App Core initialized.');
    }

    register(name, instance) {
        this.services[name] = instance;
        instance.app = this;
        console.log(`Service registered: ${name}`);
    }

    get(name) {
        if (!this.services[name]) throw new Error(`Service "${name}" not found.`);
        return this.services[name];
    }

    /**
     * OSTATECZNA, REAKTYWNA METODA STARTOWA
     */
    async start() {
        console.log("Starting application logic...");
        const isAdminPage = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/schedule-admin');

        if (!isAdminPage) {
            console.log("Public page detected.");
            return;
        }

        console.log("Admin page detected. Initializing auth listener...");
        
        try {
            const { adminAuth } = await import('./admin-auth.js');
            const { default: AdminNavigation } = await import('./admin-navigation.js');
            
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
            document.body.innerHTML = '<div style="text-align: center; margin-top: 50px; font-family: sans-serif; color: red;"><h1>Błąd krytyczny</h1><p>Nie udało się uruchomić panelu administracyjnego.</p></div>';
        }
    }
}

export const app = new App();
