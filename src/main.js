// src/main.js - Main application entry point

// --- NOWA FUNKCJA DO OBSŁUGI HAMBURGERA ---
const initMobileMenu = () => {
  const menuBtn = document.getElementById("menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", () => {
      // Przełączamy klasy odpowiedzialne za stan "otwarty"
      mobileMenu.classList.toggle("max-h-0");
      mobileMenu.classList.toggle("max-h-96"); // Ustawiamy dużą max-wysokość
      mobileMenu.classList.toggle("opacity-0");
      mobileMenu.classList.toggle("opacity-100");
    });
  }
};

const loadComponent = async (selector, url) => {
  const element = document.querySelector(selector);
  if (element) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        element.innerHTML = await response.text();
        // Jeśli właśnie załadowaliśmy header, inicjujemy jego menu
        if (selector === "#header-container") {
          initMobileMenu();
        }
      }
    } catch (error) {
      console.error(`Błąd ładowania komponentu z ${url}:`, error);
    }
  }
};

const appendToHead = async (url) => {
  // ... (ta funkcja zostaje bez zmian)
};

const initializePage = async () => {
  await Promise.all([
    appendToHead("/partials/_head_links.html"),
    loadComponent("#header-container", "/partials/_header.html"),
    loadComponent("#footer-container", "/partials/_footer.html"),
  ]);

  // Lazy load AOS only when needed
  const initAOS = async () => {
    const { default: AOS } = await import("aos");
    await import("aos/dist/aos.css");
    
    AOS.init({
      duration: 700,
      once: true,
    });
  };
  
  // Initialize AOS after a delay to improve initial load performance
  setTimeout(initAOS, 100);
};

document.addEventListener("DOMContentLoaded", initializePage);
