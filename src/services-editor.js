// src/services-editor.js
// Ten plik jest dedykowany tylko do zarządzania usługami (CRUD)

import { showConfirmation } from './ui-service.js';

class ServicesEditor {
  constructor() {
    this.services = [];
    this.firebaseService = null;
    this.app = null; // Referencja do App Core, zostanie wstrzyknięta
    this.init();
  }

  init() {
    document.body.addEventListener('click', (event) => {
      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;

      // Sprawdzamy czy akcja jest w kontenerze services-editor lub czy to akcja hide-service-modal
      const isInServicesContainer = actionElement.closest('#services-editor-container');
      const isServiceModalAction = actionElement.dataset.action === 'hide-service-modal';
      
      if (!isInServicesContainer && !isServiceModalAction) return;

      const action = actionElement.dataset.action;
      const serviceId = actionElement.dataset.serviceId;

      switch (action) {
        case 'show-add-service-modal': this.showAddServiceModal(); break;
        case 'hide-service-modal': this.hideServiceModal(); break;
        case 'edit-service': this.showEditServiceModal(serviceId); break;
        case 'delete-service': this.deleteService(serviceId); break;
      }
    });

    document.body.addEventListener('submit', (event) => {
        if (event.target.id === 'service-form') {
            event.preventDefault();
            this.saveService();
        }
    });
  }

  async getFirebaseService() {
    if (!this.firebaseService) {
      const { default: firebaseService } = await import('./firebase-service.js');
      this.firebaseService = firebaseService;
    }
    return this.firebaseService;
  }

  async renderServicesEditor() {
    // NOWOŚĆ: Dodajemy style, które zamienią tabelę w karty na urządzeniach mobilnych
    const responsiveTableStyles = `
      <style>
        @media (max-width: 768px) {
          #services-table thead {
            display: none;
          }
          #services-table, #services-table tbody, #services-table tr, #services-table td {
            display: block;
            width: 100%;
          }
          #services-table tr {
            margin-bottom: 1rem;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            overflow: hidden;
          }
          #services-table td {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            text-align: right;
            border-bottom: 1px solid #f3f4f6;
          }
          #services-table td:last-child {
            border-bottom: none;
          }
          #services-table td::before {
            content: attr(data-label);
            font-weight: 600;
            text-align: left;
            padding-right: 1rem;
            color: #4b5563;
          }
        }
      </style>
    `;

    return `
      ${responsiveTableStyles}
      <div id="services-editor-container" class="space-y-6">
        <div class="bg-white shadow rounded-lg p-4 sm:p-6">
          <div class="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h2 class="text-lg font-medium text-gray-900">Zarządzanie usługami</h2>
            <button data-action="show-add-service-modal" class="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center">
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
              Dodaj usługę
            </button>
          </div>
          <div class="overflow-x-auto">
            <table id="services-table" class="min-w-full divide-y divide-gray-200">
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
                <tr><td colspan="5" class="text-center py-8 text-gray-500">Ładowanie usług...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div id="service-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div class="px-6 py-4 border-b border-gray-200"><h3 id="service-modal-title" class="text-lg font-medium text-gray-900">Dodaj usługę</h3></div>
          <form id="service-form" class="p-6 space-y-4">
            <input type="hidden" id="service-id" value="">
            <div><label for="service-name" class="block text-sm font-medium text-gray-700">Nazwa usługi *</label><input type="text" id="service-name" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"></div>
            <div><label for="service-description" class="block text-sm font-medium text-gray-700">Opis</label><textarea id="service-description" rows="3" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"></textarea></div>
            <div><label for="service-duration" class="block text-sm font-medium text-gray-700">Czas trwania (minuty) *</label><input type="number" id="service-duration" required min="5" max="180" step="1" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"><p class="text-xs text-gray-500 mt-1">Zakres: 5-180 minut</p></div>
            <div><label for="service-price" class="block text-sm font-medium text-gray-700">Cena (zł)</label><input type="number" id="service-price" min="0" step="0.01" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"></div>
            <div class="grid grid-cols-2 gap-4">
              <div><label for="service-border-color" class="block text-sm font-medium text-gray-700">Kolor ramki</label><input type="color" id="service-border-color" value="#1F2937" class="mt-1 block w-full h-10 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"></div>
              <div><label for="service-price-color" class="block text-sm font-medium text-gray-700">Kolor ceny</label><input type="color" id="service-price-color" value="#FFFFFF" class="mt-1 block w-full h-10 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"></div>
            </div>
            <div><label for="service-icon" class="block text-sm font-medium text-gray-700">Ikona SVG (opcjonalne)</label><textarea id="service-icon" rows="3" placeholder='Wklej cały kod SVG lub tylko zawartość...' class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"></textarea><p class="text-xs text-gray-500 mt-1">Możesz wkleić cały kod SVG - system automatycznie wyciągnie potrzebną część: <a href="https://iconsvg.xyz/" target="_blank" class="text-blue-600 hover:text-blue-800 underline">Kreator Ikon</a></p></div>
            <div><label for="service-slug" class="block text-sm font-medium text-gray-700">Identyfikator (slug) *</label><input type="text" id="service-slug" required pattern="[a-z0-9\\-]+" placeholder="np. terapia-indywidualna" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"><p class="text-xs text-gray-500 mt-1">Tylko małe litery, cyfry i myślniki</p></div>
            <div class="pt-4 flex justify-end space-x-3">
              <button type="button" data-action="hide-service-modal" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Anuluj</button>
              <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Zapisz</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  async loadServices() {
    const tableBody = document.getElementById('services-table-body');
    if (!tableBody) return;

    try {
      const firebaseService = await this.getFirebaseService();
      this.services = await firebaseService.getServices();
      
      if (this.services.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">Brak zdefiniowanych usług.</td></tr>`;
        return;
      }

      // NOWOŚĆ: Dodajemy atrybuty data-label do komórek dla widoku mobilnego
      tableBody.innerHTML = this.services.map(service => `
        <tr>
          <td data-label="Nazwa" class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${service.name}</td>
          <td data-label="Opis" class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">${service.description || '-'}</td>
          <td data-label="Czas trwania" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${service.duration} min</td>
          <td data-label="Cena" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${service.price ? service.price + ' zł' : '-'}</td>
          <td data-label="Akcje" class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <div class="flex items-center justify-end space-x-2">
              <button data-action="edit-service" data-service-id="${service.id}" class="text-blue-600 hover:text-blue-900">Edytuj</button>
              <button data-action="delete-service" data-service-id="${service.id}" class="text-red-600 hover:text-red-900">Usuń</button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading services table:', error);
      tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500">Błąd podczas ładowania usług.</td></tr>`;
    }
  }

  showAddServiceModal() {
    const modal = document.getElementById('service-modal');
    const title = document.getElementById('service-modal-title');
    const form = document.getElementById('service-form');
    
    title.textContent = 'Dodaj usługę';
    form.reset();
    document.getElementById('service-id').value = '';
    document.getElementById('service-border-color').value = '#1F2937';
    document.getElementById('service-price-color').value = '#FFFFFF';
    document.getElementById('service-icon').value = '';
    modal.classList.remove('hidden');
  }

  showEditServiceModal(serviceId) {
    const service = this.services.find(s => s.id === serviceId);
    if (!service) {
      this.app.events.emit('showToast', { message: 'Nie znaleziono usługi', type: 'error' });
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
    document.getElementById('service-border-color').value = service.borderColor || '#1F2937';
    document.getElementById('service-price-color').value = service.priceColor || '#FFFFFF';
    document.getElementById('service-icon').value = service.customIcon || '';
    document.getElementById('service-slug').value = service.id;
    
    modal.classList.remove('hidden');
  }

  hideServiceModal() {
    document.getElementById('service-modal').classList.add('hidden');
  }

  async saveService() {
    try {
      const firebaseService = await this.getFirebaseService();
      const serviceId = document.getElementById('service-id').value;
      const name = document.getElementById('service-name').value.trim();
      const description = document.getElementById('service-description').value.trim();
      const duration = parseInt(document.getElementById('service-duration').value);
      const price = parseFloat(document.getElementById('service-price').value) || null;
      const borderColor = document.getElementById('service-border-color').value;
      const priceColor = document.getElementById('service-price-color').value;
      let customIcon = document.getElementById('service-icon').value.trim();
      
      // Automatyczne formatowanie SVG - wyciągnij zawartość z tagów <svg>
      if (customIcon.includes('<svg')) {
        const svgMatch = customIcon.match(/<svg[^>]*>(.*?)<\/svg>/s);
        if (svgMatch) {
          customIcon = svgMatch[1].trim();
        }
      }
      const slug = document.getElementById('service-slug').value.trim();
      
      if (!name || !duration || !slug) { this.app.events.emit('showToast', { message: 'Wypełnij wszystkie wymagane pola', type: 'error' }); return; }
      if (duration < 5 || duration > 180) { this.app.events.emit('showToast', { message: 'Czas trwania musi być między 5 a 180 minut', type: 'error' }); return; }
      if (!/^[a-z0-9\\-]+$/.test(slug)) { this.app.events.emit('showToast', { message: 'Identyfikator może zawierać tylko małe litery, cyfry i myślniki', type: 'error' }); return; }
      
      const serviceData = { name, description: description || null, duration, price, borderColor, priceColor, customIcon: customIcon || null, id: slug };
      
      if (serviceId && serviceId !== slug) {
        await firebaseService.deleteService(serviceId);
        await firebaseService.addService(serviceData);
      } else if (serviceId) {
        await firebaseService.updateService(serviceId, serviceData);
      } else {
        await firebaseService.addService(serviceData);
      }
      
      this.hideServiceModal();
      this.app.events.emit('showToast', { message: 'Usługa została zapisana', type: 'success' });
      await this.loadServices();
    } catch (error) {
      console.error('Error saving service:', error);
      this.app.events.emit('showToast', { message: 'Błąd podczas zapisywania usługi', type: 'error' });
    }
  }

  async deleteService(serviceId) {
    const confirmed = await showConfirmation(
        'Usuwanie usługi',
        'Czy na pewno chcesz usunąć tę usługę? Ta operacja jest nieodwracalna.',
        'Tak, usuń'
    );
    if (!confirmed) return;
    
    try {
      const firebaseService = await this.getFirebaseService();
      await firebaseService.deleteService(serviceId);
      this.app.events.emit('showToast', { message: 'Usługa została usunięta', type: 'success' });
      await this.loadServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      this.app.events.emit('showToast', { message: 'Błąd podczas usuwania usługi', type: 'error' });
    }
  }
}

export default new ServicesEditor();
