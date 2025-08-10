/**
 * Firebase Authentication System for Admin Panel
 * Wersja ostateczna, uproszczona i reaktywna.
 */

import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import app from './firebase-config.js';

// Lista dozwolonych administratorów (konfigurowalna przez env)
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

class AdminAuthSystem {
  constructor() {
    this.auth = getAuth(app);
    this.currentUser = null;
    this._isAuthorized = false;
    this._logoutInProgress = false;
    onAuthStateChanged(this.auth, (user) => {
      this._processAuthState(user);
    });
  }
  _processAuthState(user) {
    this.currentUser = user;
    this._isAuthorized = this.isAuthorizedAdmin(user);
    // NIE pokazujemy automatycznie formularza logowania
    // Formularz będzie pokazany tylko gdy zostanie jawnie wywołany i tylko na stronie admina
  }
  onAuthStateChanged(callback) {
    return onAuthStateChanged(this.auth, (user) => {
      this._processAuthState(user);
      callback(this._isAuthorized ? user : null);
    });
  }
  async authenticate(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(this.auth, email, password);
      if (!this.isAuthorizedAdmin(cred.user)) {
        await signOut(this.auth);
        throw new Error('Brak uprawnień do panelu administracyjnego');
      }
      return cred.user;
    } catch (error) {
      let errorMessage = 'Błąd logowania';
      switch (error.code) {
        case 'auth/invalid-email': errorMessage = 'Nieprawidłowy adres email'; break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': errorMessage = 'Nieprawidłowe dane logowania'; break;
        default: errorMessage = error.message || `Błąd logowania: ${error.code}`;
      }
      throw new Error(errorMessage);
    }
  }
  isAuthorizedAdmin(user) {
    if (!user || !user.email) return false;
    if (ADMIN_EMAILS.length === 0) {
      console.error('Lista ADMIN_EMAILS jest pusta – dostęp zablokowany. Skonfiguruj VITE_ADMIN_EMAILS.');
      return false;
    }
    return ADMIN_EMAILS.includes(user.email.toLowerCase());
  }
  async logout() {
    if (this._logoutInProgress) return;
    this._logoutInProgress = true;
    try { await signOut(this.auth); } finally { this._logoutInProgress = false; }
  }
  async forceLogout(message) {
    await this.logout();
    this.wipeAdminDom();
    this.showLoginForm(message);
  }
  wipeAdminDom() {
    // Sprawdź czy jesteśmy na stronie admina
    const isAdminPage = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/schedule-admin');
    if (!isAdminPage) {
      console.warn('wipeAdminDom called on non-admin page, ignoring');
      return;
    }
    
    const panel = document.getElementById('admin-panel') || document.querySelector('main');
    if (panel) panel.innerHTML = '<div class="p-6 text-center text-red-600 text-sm">Czyszczenie interfejsu…</div>';
  }
  isAuthenticated() { return !!this.currentUser && this._isAuthorized; }
  getAuthStatus() { return { isAuthenticated: this.isAuthenticated(), sessionValid: this.isAuthenticated(), user: this._isAuthorized ? this.currentUser : null }; }
  enforce() {
    // Sprawdź czy jesteśmy na stronie admina
    const isAdminPage = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/schedule-admin');
    if (!isAdminPage) {
      return; // Nie wykonuj enforce na stronach publicznych
    }
    if (!this.isAuthenticated() && (this.currentUser || !this.currentUser)) {
      if (document.getElementById('admin-header')) {
        this.wipeAdminDom();
        this.showLoginForm();
      }
    }
  }
  // Metoda do pokazywania formularza logowania - z zabezpieczeniem
  showLoginForm(initialMessage) {
    // Sprawdź czy jesteśmy na stronie admina
    const isAdminPage = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/schedule-admin');
    if (!isAdminPage) {
      console.warn('showLoginForm called on non-admin page, ignoring');
      return;
    }
    if (document.querySelector('.auth-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-modal">
        <div class="auth-header"><h2>Panel Administracyjny</h2><p>Zaloguj się używając konta administratora</p></div>
        <form class="auth-form">
          <div class="form-group"><label for="admin-email">Email:</label><input type="email" id="admin-email" class="form-control" required autofocus autocomplete="username"></div>
          <div class="form-group"><label for="admin-password">Hasło:</label><input type="password" id="admin-password" class="form-control" required autocomplete="current-password"></div>
          <div class="form-actions"><button type="submit" class="btn-primary">Zaloguj się</button></div>
          <div class="auth-message">${initialMessage ? `<span class='error'>${initialMessage}</span>` : ''}</div>
        </form>
      </div>`;
    const style = document.createElement('style');
    style.textContent = `
      .auth-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;}
      .auth-modal{background:white;padding:2rem;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);max-width:400px;width:90%;}
      .auth-header{text-align:center;margin-bottom:2rem;} .auth-header h2{color:#333;margin-bottom:0.5rem;} .auth-header p{color:#666;font-size:0.9rem;}
      .form-group{margin-bottom:1.5rem;} .form-group label{display:block;margin-bottom:0.5rem;color:#333;font-weight:500;}
      .form-control{width:100%;padding:0.75rem;border:1px solid #ddd;border-radius:4px;font-size:1rem;box-sizing:border-box;}
      .form-control:focus{outline:none;border-color:#4a90e2;box-shadow:0 0 0 2px rgba(74,144,226,0.2);}
      .form-actions{text-align:center;}
      .btn-primary{background:#4a90e2;color:white;border:none;padding:0.75rem 2rem;border-radius:4px;font-size:1rem;cursor:pointer;transition:background 0.2s;}
      .btn-primary:hover{background:#357abd;} .btn-primary:disabled{background:#ccc;cursor:not-allowed;}
      .auth-message{margin-top:1rem;text-align:center;font-size:0.9rem;} .auth-message.error{color:#d32f2f;} .auth-message.info{color:#1976d2;}
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    const form = overlay.querySelector('.auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('.btn-primary');
      const messageDiv = form.querySelector('.auth-message');
      submitBtn.disabled = true; submitBtn.textContent = 'Logowanie...';
      try {
        await this.authenticate(form.querySelector('#admin-email').value, form.querySelector('#admin-password').value);
        overlay.remove();
      } catch (error) {
        messageDiv.className = 'auth-message error';
        messageDiv.textContent = error.message;
        submitBtn.disabled = false; submitBtn.textContent = 'Zaloguj się';
      }
    });
  }
}

export const adminAuth = new AdminAuthSystem();
