/**
 * Firebase Authentication System for Admin Panel
 * Replaces the simple password-based auth with proper Firebase Auth
 */

import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import app from './firebase-config.js';

class AdminAuthSystem {
  constructor() {
    this.auth = getAuth(app);
    this.currentUser = null;
    this.authStateListeners = [];
    this.sessionTimeout = 2 * 60 * 60 * 1000; // 2 hours
    this.maxAttempts = 3;
    this.lockoutTime = 15 * 60 * 1000; // 15 minutes
    this.lastActivity = Date.now();
    this.init();
  }

  init() {
    this.setupAuthStateListener();
    this.setupActivityTracking();
    this.setupAutoLogout();
  }

  /**
   * Setup Firebase Auth state listener
   */
  setupAuthStateListener() {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      
      if (user) {
        // Check if user UID is valid admin
        if (!this.isValidAdminUID()) {
          console.warn('Invalid admin UID detected, logging out:', user.uid);
          this.logout();
          return;
        }
        
        // User is signed in and valid admin
        this.setSession();
        this.lastActivity = Date.now();
        this.onAuthSuccess();
      } else {
        // User is signed out
        this.clearSession();
        if (window.location.pathname.includes('admin')) {
          this.showLoginForm();
        }
      }
      
      // Notify listeners
      this.authStateListeners.forEach(listener => listener(user));
    });
  }

  /**
   * Add auth state change listener
   */
  onAuthStateChanged(callback) {
    this.authStateListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Authenticate with email and password
   */
  async authenticate(email, password) {
    const attempts = this.getLoginAttempts();
    
    if (attempts.count >= this.maxAttempts) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
      if (timeSinceLastAttempt < this.lockoutTime) {
        const remainingTime = Math.ceil((this.lockoutTime - timeSinceLastAttempt) / 60000);
        throw new Error(`Konto zablokowane. Spróbuj ponownie za ${remainingTime} minut.`);
      } else {
        // Reset attempts after lockout period
        this.resetLoginAttempts();
      }
    }

    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      this.resetLoginAttempts();
      return userCredential.user;
    } catch (error) {
      this.incrementLoginAttempts();
      
      // Map Firebase auth errors to user-friendly Polish messages
      let errorMessage = 'Błąd logowania';
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Nieprawidłowy adres email';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Konto zostało wyłączone';
          break;
        case 'auth/user-not-found':
          errorMessage = 'Nie znaleziono użytkownika';
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          errorMessage = 'Nieprawidłowe dane logowania';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Zbyt wiele prób logowania. Spróbuj ponownie później';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Błąd połączenia sieciowego';
          break;
        default:
          errorMessage = `Błąd logowania: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Sign out admin user
   */
  async logout() {
    try {
      await signOut(this.auth);
      this.clearSession();
    } catch (error) {
      console.error('Error signing out:', error);
      // Force local logout even if Firebase signOut fails
      this.clearSession();
    }
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated() {
    return !!this.currentUser && this.checkSessionValid() && this.isValidAdminUID();
  }

  /**
   * Check if current user UID is a valid admin
   */
  isValidAdminUID() {
    if (!this.currentUser) return false;
    
    // List of valid admin UIDs - update this list as needed
    const validAdminUIDs = [
      // Add your admin UIDs here
      // Example: 'abc123xyz456def789'
    ];
    
    // If no UIDs specified, allow any authenticated non-anonymous user (fallback)
    if (validAdminUIDs.length === 0) {
      return this.currentUser.providerData.length > 0 && 
             !this.currentUser.isAnonymous;
    }
    
    return validAdminUIDs.includes(this.currentUser.uid);
  }

  /**
   * Get current admin user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Set authentication session
   */
  setSession() {
    this.lastActivity = Date.now();
    const sessionData = {
      authenticated: true,
      timestamp: Date.now(),
      expires: Date.now() + this.sessionTimeout,
      lastActivity: this.lastActivity,
      uid: this.currentUser?.uid
    };
    
    localStorage.setItem('adminSession', JSON.stringify(sessionData));
    
    // Set session cookie as backup
    const expires = new Date(Date.now() + this.sessionTimeout);
    document.cookie = `adminAuth=true; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`;
  }

  /**
   * Check if session is still valid
   */
  checkSessionValid() {
    try {
      const sessionData = localStorage.getItem('adminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.authenticated && Date.now() < session.expires) {
          this.lastActivity = session.lastActivity || Date.now();
          return true;
        } else {
          this.clearSession();
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
      this.clearSession();
    }
    return false;
  }

  /**
   * Clear session data
   */
  clearSession() {
    localStorage.removeItem('adminSession');
    document.cookie = 'adminAuth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }

  /**
   * Get login attempts from localStorage
   */
  getLoginAttempts() {
    try {
      const attempts = localStorage.getItem('loginAttempts');
      return attempts ? JSON.parse(attempts) : { count: 0, lastAttempt: 0 };
    } catch {
      return { count: 0, lastAttempt: 0 };
    }
  }

  /**
   * Increment login attempts
   */
  incrementLoginAttempts() {
    const attempts = this.getLoginAttempts();
    attempts.count++;
    attempts.lastAttempt = Date.now();
    localStorage.setItem('loginAttempts', JSON.stringify(attempts));
  }

  /**
   * Reset login attempts
   */
  resetLoginAttempts() {
    localStorage.removeItem('loginAttempts');
  }

  /**
   * Setup automatic logout on session expiry
   */
  setupAutoLogout() {
    setInterval(() => {
      if (this.currentUser) {
        // Check session validity and UID validity
        if (!this.checkSessionValid() || !this.isValidAdminUID()) {
          console.warn('Auto logout triggered - invalid session or UID');
          this.logout();
        }
      }
    }, 600000); // Check every 10 minutes

    // Handle page refresh gracefully
    window.addEventListener('beforeunload', () => {
      if (this.currentUser) {
        // Extend session slightly to handle page reloads
        const sessionData = JSON.parse(localStorage.getItem('adminSession') || '{}');
        if (sessionData.authenticated) {
          sessionData.expires = Date.now() + 60000; // 1 minute grace period
          localStorage.setItem('adminSession', JSON.stringify(sessionData));
        }
      }
    });
  }

  /**
   * Setup activity tracking to extend session
   */
  setupActivityTracking() {
    const events = ['click', 'keydown', 'scroll', 'mousemove'];
    let activityTimer;

    const updateActivity = () => {
      if (this.currentUser) {
        const now = Date.now();
        // Only update if it's been more than 5 minutes since last activity
        if (now - this.lastActivity > 5 * 60 * 1000) {
          this.lastActivity = now;
          this.refreshSession();
        }
      }
    };

    const throttledUpdateActivity = () => {
      clearTimeout(activityTimer);
      activityTimer = setTimeout(updateActivity, 1000);
    };

    events.forEach(event => {
      document.addEventListener(event, throttledUpdateActivity, { passive: true });
    });
  }

  /**
   * Refresh session expiry time
   */
  refreshSession() {
    if (this.currentUser) {
      this.setSession();
    }
  }

  /**
   * Show login form
   */
  showLoginForm() {
    const existingForm = document.querySelector('.auth-overlay');
    if (existingForm) return;

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-modal">
        <div class="auth-header">
          <h2>Panel Administracyjny</h2>
          <p>Zaloguj się używając konta administratora</p>
        </div>
        <form class="auth-form">
          <div class="form-group">
            <label for="admin-email">Email:</label>
            <input 
              type="email" 
              id="admin-email" 
              class="form-control" 
              required 
              autofocus
              autocomplete="username"
            >
          </div>
          <div class="form-group">
            <label for="admin-password">Hasło:</label>
            <input 
              type="password" 
              id="admin-password" 
              class="form-control" 
              required
              autocomplete="current-password"
            >
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Zaloguj się</button>
          </div>
          <div class="auth-message"></div>
        </form>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .auth-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }
      
      .auth-modal {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 90%;
      }
      
      .auth-header {
        text-align: center;
        margin-bottom: 2rem;
      }
      
      .auth-header h2 {
        color: #333;
        margin-bottom: 0.5rem;
      }
      
      .auth-header p {
        color: #666;
        font-size: 0.9rem;
      }
      
      .form-group {
        margin-bottom: 1.5rem;
      }
      
      .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        color: #333;
        font-weight: 500;
      }
      
      .form-control {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1rem;
        box-sizing: border-box;
      }
      
      .form-control:focus {
        outline: none;
        border-color: #4a90e2;
        box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
      }
      
      .form-actions {
        text-align: center;
      }
      
      .btn-primary {
        background: #4a90e2;
        color: white;
        border: none;
        padding: 0.75rem 2rem;
        border-radius: 4px;
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .btn-primary:hover {
        background: #357abd;
      }
      
      .btn-primary:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      
      .auth-message {
        margin-top: 1rem;
        text-align: center;
        font-size: 0.9rem;
      }
      
      .auth-message.error {
        color: #d32f2f;
      }
      
      .auth-message.info {
        color: #1976d2;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Handle form submission
    const form = overlay.querySelector('.auth-form');
    const emailInput = overlay.querySelector('#admin-email');
    const passwordInput = overlay.querySelector('#admin-password');
    const messageDiv = overlay.querySelector('.auth-message');
    const submitBtn = overlay.querySelector('.btn-primary');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      if (!email || !password) {
        messageDiv.className = 'auth-message error';
        messageDiv.textContent = 'Wprowadź email i hasło';
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logowanie...';
      messageDiv.textContent = '';

      try {
        await this.authenticate(email, password);
        messageDiv.className = 'auth-message info';
        messageDiv.textContent = 'Logowanie pomyślne...';
        
        setTimeout(() => {
          overlay.remove();
          // Admin interface will load automatically via auth state listener
        }, 500);

      } catch (error) {
        messageDiv.className = 'auth-message error';
        messageDiv.textContent = error.message;
        passwordInput.value = '';
        emailInput.focus();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Zaloguj się';
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.parentNode) {
        window.location.href = '/';
      }
    });
  }

  /**
   * Called after successful authentication
   */
  onAuthSuccess() {
    if (typeof window.onAdminAuthSuccess === 'function') {
      window.onAdminAuthSuccess();
    }
  }

  /**
   * Verify current authentication status
   */
  verifyAuth() {
    if (!this.currentUser) {
      this.showLoginForm();
      return false;
    }
    
    if (!this.checkSessionValid()) {
      this.showLoginForm();
      return false;
    }
    
    return true;
  }

  /**
   * Get current authentication status
   */
  getAuthStatus() {
    return {
      isAuthenticated: this.isAuthenticated(),
      user: this.currentUser,
      sessionValid: this.checkSessionValid(),
      validUID: this.isValidAdminUID()
    };
  }

  /**
   * Update list of valid admin UIDs (for debugging)
   */
  setValidAdminUIDs(uids) {
    console.warn('Updating admin UIDs list. Use with caution.');
    // This would require modifying the hardcoded list
    // For security, the list should be in code, not configurable at runtime
  }

  /**
   * Get current user UID (for adding to admin list)
   */
  getCurrentUID() {
    return this.currentUser?.uid || null;
  }
}

// Export singleton instance
export const adminAuth = new AdminAuthSystem();

// Make adminAuth available globally for compatibility
window.adminAuth = adminAuth;