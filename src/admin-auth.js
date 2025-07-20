/**
 * Firebase Authentication System for Admin Panel
 * Wersja ostateczna, uproszczona i reaktywna.
 */

import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import app from './firebase-config.js';

class AdminAuthSystem {
  constructor() {
    this.auth = getAuth(app);
    this.currentUser = null;
    
    // Prosty listener, który tylko aktualizuje stan
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
    });
  }

  /**
   * ZMIANA: Zamiast skomplikowanego waitForInitialAuth,
   * udostępniamy bezpośredni dostęp do listenera onAuthStateChanged.
   * To jest "reaktywne" serce naszej autentykacji.
   */
  onAuthStateChanged(callback) {
    return onAuthStateChanged(this.auth, callback);
  }

  async authenticate(email, password) {
    // Logika logowania bez zmian
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return userCredential.user;
    } catch (error) {
       let errorMessage = 'Błąd logowania';
       switch (error.code) {
         case 'auth/invalid-email': errorMessage = 'Nieprawidłowy adres email'; break;
         case 'auth/user-not-found':
         case 'auth/wrong-password':
         case 'auth/invalid-credential': errorMessage = 'Nieprawidłowe dane logowania'; break;
         default: errorMessage = `Błąd logowania: ${error.message}`;
       }
       throw new Error(errorMessage);
    }
  }

  async logout() {
    await signOut(this.auth);
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getAuthStatus() {
    return {
      isAuthenticated: !!this.currentUser,
      sessionValid: !!this.currentUser,
      user: this.currentUser
    };
  }
  
  // Metoda do pokazywania formularza logowania - bez zmian
  showLoginForm() {
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
          <div class="auth-message"></div>
        </form>
      </div>
    `;
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
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logowanie...';
      try {
        await this.authenticate(form.querySelector('#admin-email').value, form.querySelector('#admin-password').value);
        // Po udanym logowaniu, listener onAuthStateChanged w app.js sam przebuduje interfejs.
        // Nie musimy już nic więcej robić.
        overlay.remove();
      } catch (error) {
        messageDiv.className = 'auth-message error';
        messageDiv.textContent = error.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Zaloguj się';
      }
    });
  }
}

export const adminAuth = new AdminAuthSystem();
