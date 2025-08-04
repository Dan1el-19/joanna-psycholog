// src/main.js - Główny punkt wejścia aplikacji

// KROK 1: Inicjalizacja Firebase PRZED WSZYSTKIM INNYM
// Ten import gwarantuje, że konfiguracja Firebase zostanie załadowana
// i będzie gotowa, zanim jakakolwiek inna część aplikacji spróbuje jej użyć.
import './firebase-config.js';

// KROK 2: Importujemy rdzeń aplikacji
// Teraz mamy pewność, że gdy app.js będzie chciał użyć Firebase,
// będzie on już w pełni zainicjalizowany.
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

// Nasłuchujemy na załadowanie DOM i uruchamiamy cały proces
document.addEventListener("DOMContentLoaded", initializePage);
