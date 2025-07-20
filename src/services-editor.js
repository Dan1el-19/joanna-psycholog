// src/services-editor.js
// Ten plik jest dedykowany tylko do zarządzania usługami (CRUD)

class ServicesEditor {
  constructor() {
    this.services = [];
    this.firebaseService = null; // Będzie ładowany dynamicznie
    this.init(); // Uruchomienie nasłuchiwania zdarzeń
  }

  // Inicjalizacja centralnego handlera zdarzeń
  init() {
    document.body.addEventListener('click', (event) => {
      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;

      const action = actionElement.dataset.action;
      const serviceId = actionElement.dataset.serviceId;

      switch (action) {
        case 'show-add-service-modal':
          this.showAddServiceModal();
          break;
        case 'hide-service-modal':
          this.hideServiceModal();
          break;
        case 'edit-service':
          this.showEditServiceModal(serviceId);
          break;
        case 'delete-service':
          this.deleteService(serviceId);
          break;
      }
    });

    // Obsługa formularza przez zdarzenie 'submit'
    document.body.addEventListener('submit', (event) => {
        if (event.target.id === 'service-form') {
            event.preventDefault();
            this.saveService();
        }
    });
  }

  // Metoda do dynamicznego ładowania firebaseService, żeby nie importować go na starcie
  async getFirebaseService() {
    if (!this.firebaseService) {
      const { default: firebaseService } = await import('./firebase-service.js');
      this.firebaseService = firebaseService;
    }
    return this.firebaseService;
  }

  // Główna metoda, która renderuje cały interfejs tej sekcji
  async renderServicesEditor() {
    return `
      <div class="space-y-6">
        <div class="bg-white shadow rounded-lg p-4 sm:p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-medium text-gray-900">Zarządzanie usługami</h2>
            <button data-action="show-add-service-modal" 
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
                <tr><td colspan="5" class="text-center py-8 text-gray-500">Ładowanie usług...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <!-- Modal do dodawania/edycji usług -->
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
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button type="button" data-action="hide-service-modal" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Anuluj</button>
              <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Zapisz</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Metoda do załadowania danych i wstrzyknięcia ich do tabeli
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

      tableBody.innerHTML = this.services.map(service => `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${service.name}</td>
          <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">${service.description || '-'}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${service.duration} min</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${service.price ? service.price + ' zł' : '-'}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
            <button data-action="edit-service" data-service-id="${service.id}" class="text-blue-600 hover:text-blue-900">Edytuj</button>
            <button data-action="delete-service" data-service-id="${service.id}" class="text-red-600 hover:text-red-900">Usuń</button>
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
    modal.classList.remove('hidden');
  }

  showEditServiceModal(serviceId) {
    const service = this.services.find(s => s.id === serviceId);
    if (!service) {
      window.adminNav.showMessage('Nie znaleziono usługi', 'error');
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
      const slug = document.getElementById('service-slug').value.trim();
      
      if (!name || !duration || !slug) { window.adminNav.showMessage('Wypełnij wszystkie wymagane pola', 'error'); return; }
      if (duration < 15 || duration > 240) { window.adminNav.showMessage('Czas trwania musi być między 15 a 240 minut', 'error'); return; }
      if (!/^[a-z0-9\\-]+$/.test(slug)) { window.adminNav.showMessage('Identyfikator może zawierać tylko małe litery, cyfry i myślniki', 'error'); return; }
      
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
      window.adminNav.showMessage('Usługa została zapisana', 'success');
      await this.loadServices(); // Odświeżenie tabeli
    } catch (error) {
      console.error('Error saving service:', error);
      window.adminNav.showMessage('Błąd podczas zapisywania usługi', 'error');
    }
  }

  async deleteService(serviceId) {
    if (!confirm('Czy na pewno chcesz usunąć tę usługę? Ta operacja jest nieodwracalna.')) {
      return;
    }
    
    try {
      const firebaseService = await this.getFirebaseService();
      await firebaseService.deleteService(serviceId);
      window.adminNav.showMessage('Usługa została usunięta', 'success');
      await this.loadServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      window.adminNav.showMessage('Błąd podczas usuwania usługi', 'error');
    }
  }
}

// Eksportujemy jedną instancję, żeby była singletonem w całej aplikacji
export default new ServicesEditor();