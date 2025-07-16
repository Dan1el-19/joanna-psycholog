/**
 * Simple Authentication System for Admin Panel
 */

class AuthSystem {
  constructor() {
    this.isAuthenticated = false;
    this.sessionTimeout = 2 * 60 * 60 * 1000; // 2 hours
    this.maxAttempts = 3;
    this.lockoutTime = 15 * 60 * 1000; // 15 minutes
    this.lastActivity = Date.now();
    this.init();
  }

  init() {
    this.checkExistingSession();
    this.setupAutoLogout();
    this.setupActivityTracking();
  }

  /**
   * Simple password verification (you should use more secure method in production)
   */
  async authenticate(password) {
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

    // Simple password check - in production use proper authentication
    const correctPassword = 'Herkules1$'; // Change this to a secure password
    
    if (password === correctPassword) {
      this.isAuthenticated = true;
      this.setSession();
      this.resetLoginAttempts();
      return true;
    } else {
      this.incrementLoginAttempts();
      throw new Error('Nieprawidłowe hasło');
    }
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
      lastActivity: this.lastActivity
    };
    
    localStorage.setItem('adminSession', JSON.stringify(sessionData));
    
    // Set session cookie as backup
    const expires = new Date(Date.now() + this.sessionTimeout);
    document.cookie = `adminAuth=true; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`;
  }

  /**
   * Check for existing valid session
   */
  checkExistingSession() {
    try {
      const sessionData = localStorage.getItem('adminSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.authenticated && Date.now() < session.expires) {
          this.isAuthenticated = true;
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
    this.isAuthenticated = false;
    localStorage.removeItem('adminSession');
    document.cookie = 'adminAuth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }

  /**
   * Logout and clear session
   */
  logout() {
    this.clearSession();
    
    // Redirect to login if on admin page
    if (window.location.pathname.includes('admin')) {
      this.showLoginForm();
    }
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
      if (this.isAuthenticated && !this.checkExistingSession()) {
        this.logout();
      }
    }, 600000); // Check every 10 minutes

    // Logout on window close/refresh
    window.addEventListener('beforeunload', () => {
      if (this.isAuthenticated) {
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
      if (this.isAuthenticated) {
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
    if (this.isAuthenticated) {
      const sessionData = {
        authenticated: true,
        timestamp: Date.now(),
        expires: Date.now() + this.sessionTimeout,
        lastActivity: this.lastActivity
      };
      
      localStorage.setItem('adminSession', JSON.stringify(sessionData));
      
      // Update session cookie
      const expires = new Date(Date.now() + this.sessionTimeout);
      document.cookie = `adminAuth=true; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`;
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
          <p>Wprowadź hasło aby uzyskać dostęp</p>
        </div>
        <form class="auth-form">
          <div class="form-group">
            <label for="admin-password">Hasło:</label>
            <input 
              type="password" 
              id="admin-password" 
              class="form-control" 
              required 
              autofocus
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
    const passwordInput = overlay.querySelector('#admin-password');
    const messageDiv = overlay.querySelector('.auth-message');
    const submitBtn = overlay.querySelector('.btn-primary');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const password = passwordInput.value;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sprawdzanie...';
      messageDiv.textContent = '';

      try {
        await this.authenticate(password);
        messageDiv.className = 'auth-message info';
        messageDiv.textContent = 'Logowanie pomyślne...';
        
        setTimeout(() => {
          overlay.remove();
          this.onAuthSuccess();
          // Force reload of admin interface
          if (window.location.pathname.includes('admin')) {
            window.location.reload();
          }
        }, 500);

      } catch (error) {
        messageDiv.className = 'auth-message error';
        messageDiv.textContent = error.message;
        passwordInput.value = '';
        passwordInput.focus();
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
    if (!this.isAuthenticated) {
      if (this.checkExistingSession()) {
        return true;
      }
      this.showLoginForm();
      return false;
    }
    
    if (!this.checkExistingSession()) {
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
      isAuthenticated: this.isAuthenticated,
      sessionValid: this.checkExistingSession()
    };
  }
}

// Export singleton instance
export const authSystem = new AuthSystem();

// Make authSystem available globally
window.authSystem = authSystem;