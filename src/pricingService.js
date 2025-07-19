// pricing-service.js
import firebaseService from './firebase-service.js';

class PricingService {
  constructor() {
    this.servicesCache = null;
    this.cacheTimestamp = null;
  }

  /**
   * Pobiera usługi z cache lub z Firebase, żeby nie odpytywać bazy za każdym razem.
   */
  async getServices() {
    const now = Date.now();
    // Cache ważny przez 5 minut
    if (this.servicesCache && this.cacheTimestamp && (now - this.cacheTimestamp < 300000)) {
      return this.servicesCache;
    }

    try {
      const servicesData = await firebaseService.getServices();
      this.servicesCache = servicesData; // Zakładając, że getServices() zwraca tablicę
      this.cacheTimestamp = now;
      return this.servicesCache;
    } catch (error) {
      console.error("Błąd w pricingService podczas pobierania usług:", error);
      return []; // Zwróć pustą tablicę w razie błędu
    }
  }

  /**
   * Główna funkcja, która "wzbogaca" obiekt wizyty o dane usługi i ceny.
   * @param {object} appointment - Surowy obiekt wizyty.
   * @returns {Promise<object>} - Wzbogacony obiekt wizyty.
   */
  async getAugmentedAppointmentData(appointment) {
    const services = await this.getServices();
    const serviceObj = services.find(s => s.id === appointment.service);

    const augmentedData = {
      ...appointment,
      serviceName: appointment.service,
      serviceDuration: 50,
      basePrice: null,
      finalPrice: appointment.calculatedPrice || null, // Fallback na cenę z rezerwacji
      priceSource: 'reservation'
    };

    if (serviceObj) {
      augmentedData.serviceName = serviceObj.name || appointment.service;
      augmentedData.serviceDuration = serviceObj.duration || 50;
      augmentedData.basePrice = serviceObj.price || null;
      augmentedData.priceSource = 'live';

      if (augmentedData.basePrice) {
        if (appointment.isFirstSession) {
          augmentedData.finalPrice = Math.round(augmentedData.basePrice * 0.5);
        } else {
          augmentedData.finalPrice = augmentedData.basePrice;
        }
      }
    }
    
    // Dodajemy też gotowy HTML, żeby nie duplikować logiki widoku
    augmentedData.priceDisplayHTML = this.generatePriceHTML(augmentedData);

    return augmentedData;
  }

  /**
   * Generuje kod HTML do wyświetlania ceny na podstawie wzbogaconych danych.
   * @param {object} augmentedAppointment - Obiekt zwrócony przez getAugmentedAppointmentData.
   * @returns {string} - Kod HTML.
   */
  generatePriceHTML(augmentedData) {
    if (!augmentedData.basePrice && !augmentedData.finalPrice) {
      return '';
    }

    // Jeśli cena pochodzi z aktualnej bazy usług
    if (augmentedData.priceSource === 'live' && augmentedData.basePrice) {
       if (augmentedData.isFirstSession) {
        return `
          <p class="text-xs md:text-sm text-blue-600">
            <strong>Cena:</strong> ${augmentedData.finalPrice} PLN 
            <span class="text-green-600">(50% zniżki - pierwsze spotkanie)</span>
            <br><span class="text-xs text-gray-500">Cena regularna: ${augmentedData.basePrice} PLN</span>
          </p>
        `;
      } else {
        return `
          <p class="text-xs md:text-sm text-blue-600">
            <strong>Cena:</strong> ${augmentedData.finalPrice} PLN
          </p>
        `;
      }
    }

    // Fallback na cenę zapisaną w momencie rezerwacji
    if (augmentedData.finalPrice) {
       return `
          <p class="text-xs md:text-sm text-gray-600">
            <strong>Cena (z dnia rezerwacji):</strong> ${augmentedData.finalPrice} PLN
             ${augmentedData.isFirstSession ? '<span class="text-green-600">(zniżka 50%)</span>' : ''}
          </p>
        `;
    }
    
    return '';
  }
}

// Eksportujemy jedną instancję, żeby była singletonem w całej aplikacji
const pricingService = new PricingService();
export default pricingService;