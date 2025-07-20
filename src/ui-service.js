// src/ui-service.js

/**
 * Wyświetla powiadomienie typu "toast" w rogu ekranu.
 * Zastępuje powielony kod showMessage z różnych modułów.
 * @param {string} message - Treść wiadomości.
 * @param {'info'|'success'|'error'} type - Typ powiadomienia, wpływa na kolorystykę.
 */
export function showToast(message, type = 'info') {
    // Usuń istniejące powiadomienia, aby uniknąć bałaganu
    document.querySelectorAll('.app-toast-message').forEach(toast => toast.remove());

    const icons = {
        success: `<svg class="w-5 h-5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>`,
        error: `<svg class="w-5 h-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>`,
        info: `<svg class="w-5 h-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>`
    };

    const typeClasses = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800'
    };

    const toastDiv = document.createElement('div');
    toastDiv.className = `app-toast-message fixed top-5 right-5 p-4 rounded-lg shadow-lg border ${typeClasses[type] || typeClasses.info}`;
    toastDiv.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 9999 !important;
        max-width: 400px !important;
        min-width: 300px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
    `;
    toastDiv.innerHTML = `
      <div style="display: flex; align-items: flex-start;">
        <div style="flex-shrink: 0;">${icons[type] || icons.info}</div>
        <div style="margin-left: 12px; flex: 1; padding-top: 2px;">
          <p style="margin: 0; font-size: 14px; font-weight: 500; line-height: 1.4;">${message}</p>
        </div>
        <div style="margin-left: 16px; flex-shrink: 0;">
          <button style="display: inline-flex; color: #9ca3af; background: none; border: none; cursor: pointer; padding: 0;">
            <span style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;">Close</span>
            <svg style="height: 20px; width: 20px;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>`;
    
    const closeButton = toastDiv.querySelector('button');
    closeButton.addEventListener('click', () => toastDiv.remove());

    document.body.appendChild(toastDiv);

    setTimeout(() => {
        if (toastDiv.parentNode) {
            toastDiv.remove();
        }
    }, 6000);
}

/**
 * Wyświetla modal z potwierdzeniem i zwraca Promise.
 * Zastępuje natywne, brzydkie i blokujące okno `confirm()`.
 * @param {string} title - Tytuł okna dialogowego.
 * @param {string} text - Główna treść pytania.
 * @param {string} [confirmText='Potwierdź'] - Tekst na przycisku potwierdzającym.
 * @param {string} [cancelText='Anuluj'] - Tekst na przycisku anulującym.
 * @returns {Promise<boolean>} - Rozwiązuje się do `true` przy potwierdzeniu, `false` przy anulowaniu.
 */
export function showConfirmation(title, text, confirmText = 'Potwierdź', cancelText = 'Anuluj') {
    return new Promise((resolve) => {
        // Usuń istniejący modal, jeśli jest
        document.querySelector('.confirmation-modal-overlay')?.remove();

        const modalHTML = `
            <div class="confirmation-modal-overlay fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-[999]">
                <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm transform transition-all" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                    <h3 id="modal-title" class="text-lg font-bold text-gray-900 mb-2">${title}</h3>
                    <p class="text-sm text-gray-600 mb-6">${text}</p>
                    <div class="flex justify-end space-x-3">
                        <button id="confirm-cancel-btn" class="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">${cancelText}</button>
                        <button id="confirm-ok-btn" class="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const confirmBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        const modalEl = document.querySelector('.confirmation-modal-overlay');

        const cleanup = (result) => {
            modalEl.remove();
            resolve(result);
        };

        confirmBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
        // Pozwól na zamknięcie modala klikając tło
        modalEl.onclick = (e) => {
            if (e.target === modalEl) {
                cleanup(false);
            }
        };
    });
}
