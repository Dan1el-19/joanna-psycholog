// src/main.js - Główny punkt wejścia aplikacji

// KROK 1: Inicjalizacja Firebase PRZED WSZYSTKIM INNYM
// Ten import gwarantuje, że konfiguracja Firebase zostanie załadowana
// i będzie gotowa, zanim jakakolwiek inna część aplikacji spróbuje jej użyć.
import './firebase-config.js';
import { app } from './app.js';

// --- Funkcja do obsługi mobilnego menu (hamburger) ---
const initMobileMenu = () => {
  const menuBtn = document.getElementById("menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("max-h-0");
      mobileMenu.classList.toggle("max-h-96");
      mobileMenu.classList.toggle("opacity-0");
      mobileMenu.classList.toggle("opacity-100");
    });
  }
};

// Funkcja do ładowania statycznych komponentów HTML (header, footer)
const loadComponent = async (selector, url) => {
  const element = document.querySelector(selector);
  if (element) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        element.innerHTML = await response.text();
        if (selector === "#header-container") {
          initMobileMenu();
        }
      }
    } catch (error) {
      console.error(`Błąd ładowania komponentu z ${url}:`, error);
    }
  }
};

// Główna funkcja inicjalizująca stronę
const initializePage = async () => {
  // Ładujemy statyczne części strony, jeśli istnieją odpowiednie kontenery
  if (document.querySelector("#header-container")) {
    await loadComponent("#header-container", "/partials/_header.html");
  }
  if (document.querySelector("#footer-container")) {
    await loadComponent("#footer-container", "/partials/_footer.html");
  }

  // Inicjalizujemy animacje (AOS)
  const initAOS = async () => {
    try {
        const { default: AOS } = await import("aos");
        await import("aos/dist/aos.css");
        AOS.init({ duration: 700, once: true });
    } catch (e) {
        console.warn("Could not initialize AOS for animations.", e);
    }
  };
  setTimeout(initAOS, 100);

  // KROK 3: Uruchamiamy logikę aplikacji
  // Teraz ta funkcja zostanie wywołana z gwarancją, że Firebase jest gotowe.
  app.start();
};

// Dynamic, warunkowe ładowanie modułów strony aby uniknąć kolizji i wyścigów
async function loadPageModules() {
  // Formularz kontaktowy
  if (document.getElementById('contact-form')) {
    import('./contact-form.js');
  }

  // Strona rezerwacji (umów wizytę)
  if (document.getElementById('preferred-date') && document.getElementById('service')) {
    try {
      const [{ publicAuth }, { firebaseService }] = await Promise.all([
        import('./public-auth.js'),
        import('./firebase-service.js')
      ]);
      await publicAuth.ensureAuthenticated();
      // Najpierw kalendarz, potem logika formularza (kolejność ważna)
      await import('./calendar-interface.js');
      await import('./appointment.js');

      // Ładowanie usług do selecta (przeniesione z umow-wizyte.html)
      const serviceSelect = document.getElementById('service');
      const serviceDurations = document.getElementById('service-durations');
      const servicePrices = document.getElementById('service-prices');
      if (serviceSelect) {
        try {
          const services = await firebaseService.getServices();
          if (services.length > 0) {
            serviceSelect.innerHTML = '<option value="">Wybierz rodzaj usługi</option>' + services.map(s => {
              const priceText = s.price ? `${s.price} PLN / ${s.duration} min` : `${s.duration} min`;
              return `<option value="${s.id}">${s.name} (${priceText})</option>`;
            }).join('');
            if (serviceDurations) {
              serviceDurations.innerHTML = services.map(s => `${s.name}: ${s.duration} min`).join('<br>');
            }
            if (servicePrices) {
              const hasPrice = services.some(s => s.price);
              servicePrices.innerHTML = services.map(s => s.price ? `${s.price} PLN - ${s.name}` : `${s.name} - cena do uzgodnienia`).join('<br>') + (hasPrice ? '<br><span class="text-green-600 font-medium text-sm">Pierwsze spotkanie 50% taniej!</span>' : '');
            }
          } else {
            applyServicesFallback(serviceSelect, serviceDurations, servicePrices);
          }
        } catch (e) {
          console.warn('Błąd ładowania usług (fallback).', e);
          applyServicesFallback(serviceSelect, serviceDurations, servicePrices);
        }
      }
    } catch (err) {
      console.error('Błąd inicjalizacji modułów rezerwacji:', err);
    }
  }

  // Strona oferta
  if (document.getElementById('services-container')) {
    try {
      const [{ publicAuth }, { firebaseService }] = await Promise.all([
        import('./public-auth.js'),
        import('./firebase-service.js')
      ]);
      await publicAuth.ensureAuthenticated();
      await loadOfferServices(firebaseService);
    } catch (e) {
      console.error('Błąd ładowania oferty:', e);
    }
  }

  // Galeria dyplomów
  if (document.getElementById('imageModal')) {
    import('./diploma-gallery.js');
  }

  // Zarządzanie rezerwacją (token)
  if (document.getElementById('reservation-content')) {
    import('./reservation-management.js');
  }
}

function applyServicesFallback(serviceSelect, serviceDurations, servicePrices) {
  if (serviceSelect) {
    serviceSelect.innerHTML = `
      <option value="">Wybierz rodzaj usługi</option>
      <option value="terapia-indywidualna">Terapia Indywidualna (150 PLN / 50 min)</option>
      <option value="terapia-par">Terapia Par (220 PLN / 90 min)</option>
      <option value="terapia-rodzinna">Terapia Rodzinna (230 PLN / 90 min)</option>
    `;
  }
  if (serviceDurations) {
    serviceDurations.innerHTML = 'Terapia:<br>Indywidualna: 50 min<br>Par/Rodzinna: 90 min';
  }
  if (servicePrices) {
    servicePrices.innerHTML = `150 PLN - Terapia Indywidualna<br>220 PLN - Terapia Par<br>230 PLN - Terapia Rodzinna<br><span class="text-green-600 font-medium text-sm">Pierwsze spotkanie 50% taniej!</span>`;
  }
}

async function loadOfferServices(firebaseService) {
  const container = document.getElementById('services-container');
  if (!container) return;
  try {
    const services = await firebaseService.getServices();
    if (services.length === 0) {
      container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500"><p class="text-lg">Brak dostępnych usług</p><p class="text-sm">Skontaktuj się bezpośrednio w celu uzyskania informacji</p></div>';
      return;
    }
    const getGridClasses = (count) => {
      if (count === 1) return 'grid-cols-1 max-w-md mx-auto';
      if (count === 2) return 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto';
      if (count === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      if (count === 4) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4';
      return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    };
    container.className = `grid gap-8 ${getGridClasses(services.length)}`;
    const servicesHtml = services.map((service, index) => {
      const icon = service.customIcon || '';
      const delay = 200 + (index * 100);
      const firstSessionPrice = service.price ? Math.round(service.price * 0.5) : null;
      const borderColor = service.borderColor || '#1F2937';
      const priceColor = service.priceColor || '#FFFFFF';
      return `
        <div class="bg-surface p-6 sm:p-8 rounded-lg shadow-lg text-center transition-transform duration-300 hover:-translate-y-2 w-full" data-aos="fade-up" data-aos-delay="${delay}">
          <div class="flex justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12" style="color: ${borderColor};">${icon}</svg>
          </div>
          <h3 class="font-display text-xl sm:text-2xl font-bold mb-2 service-title-wrap" style="color: ${borderColor};">${service.name}</h3>
          <p class="font-sans text-secondary mb-4 text-sm sm:text-base">${service.description || ''}</p>
          ${service.price ? `
            <div class="p-3 rounded-lg" style="background-color: ${borderColor};">
              <div class="text-center">
                <span class="font-semibold text-base sm:text-lg block" style="color: ${priceColor};">${service.price} PLN / ${service.duration} min</span>
                ${firstSessionPrice ? `<span class="text-xs sm:text-sm px-2 py-1 rounded font-medium mt-1 inline-block" style="background-color: ${borderColor}; color: ${priceColor};">Pierwsze spotkanie: ${firstSessionPrice} PLN (50% taniej)</span>` : ''}
              </div>
            </div>` : `
            <div class="p-3 rounded-lg" style="background-color: ${borderColor};">
              <div class="text-center">
                <span class="font-semibold text-base sm:text-lg block" style="color: ${priceColor};">Czas trwania: ${service.duration} min</span>
                <span class="text-xs sm:text-sm mt-1 inline-block" style="color: ${priceColor}; opacity: 0.8;">Skontaktuj się w celu ustalenia ceny</span>
              </div>
            </div>`}
        </div>`;
    }).join('');
    container.innerHTML = servicesHtml;
    if (window.AOS && typeof window.AOS.refresh === 'function') window.AOS.refresh();
  } catch (e) {
    console.error('Błąd ładowania usług (oferta) – fallback.', e);
    container.className = 'grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">Błąd ładowania usług</div>';
  }
}

// Rejestracja Service Worker dla PWA
const registerServiceWorker = async () => {
  // Tymczasowo wyłącz Service Worker w development, aby sprawdzić HMR
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.log('Service Worker disabled in development mode for HMR testing');
    return null;
  }

  if ('serviceWorker' in navigator) {
    try {
      // Sprawdź czy Service Worker jest już zarejestrowany
      const existingRegistration = await navigator.serviceWorker.getRegistration();
      
      if (existingRegistration) {
        console.log('Service Worker already registered:', existingRegistration);
        return existingRegistration;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', registration);
      
      // Obsługa aktualizacji Service Worker
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nowa wersja Service Worker jest dostępna
            console.log('New Service Worker available');
            // Tutaj można dodać powiadomienie o aktualizacji
          }
        });
      });

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  } else {
    console.log('Service Worker not supported');
    return null;
  }
};

// Nasłuchujemy na załadowanie DOM i uruchamiamy cały proces
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Rejestrujemy Service Worker w tle (nie blokuje ładowania strony)
    registerServiceWorker();
    
    // Inicjalizujemy stronę
    await initializePage();
    await loadPageModules();
  } catch (error) {
    console.error('Error during page initialization:', error);
  }
});
