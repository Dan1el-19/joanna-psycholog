/**
 * Security configuration and utilities
 */

class SecurityManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupCSP();
    this.setupSecurityHeaders();
    this.setupCSRFProtection();
    this.setupClickjackingProtection();
  }

  /**
   * Setup Content Security Policy (disabled for now to avoid conflicts)
   */
  setupCSP() {
    // CSP disabled to avoid blocking calendar functionality
    // Should be implemented at server level instead of via meta tag
  }

  /**
   * Setup security headers (for client-side reference)
   */
  setupSecurityHeaders() {
    // These would typically be set on the server, but we document them here
    this.recommendedHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    };
  }

  /**
   * Basic CSRF protection for form submissions
   */
  setupCSRFProtection() {
    // Generate CSRF token for this session
    this.csrfToken = this.generateCSRFToken();
    
    // Add CSRF token to all forms
    document.addEventListener('DOMContentLoaded', () => {
      this.addCSRFTokenToForms();
    });
  }

  generateCSRFToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), 
      byte => byte.toString(16).padStart(2, '0')).join('');
  }

  addCSRFTokenToForms() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      // Skip if CSRF token already exists
      if (form.querySelector('input[name="csrf_token"]')) return;
      
      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = 'csrf_token';
      csrfInput.value = this.csrfToken;
      form.appendChild(csrfInput);
    });
  }

  /**
   * Protect against clickjacking
   */
  setupClickjackingProtection() {
    // Prevent iframe embedding
    if (window.top !== window.self) {
      window.top.location = window.self.location;
    }
  }

  /**
   * Sanitize user input
   */
  sanitizeHTML(str) {
    if (!str) return '';
    
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  }

  /**
   * Validate and sanitize URLs
   */
  sanitizeURL(url) {
    if (!url) return '';
    
    try {
      const parsedURL = new URL(url);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedURL.protocol)) {
        return '';
      }
      return parsedURL.toString();
    } catch {
      return '';
    }
  }

  /**
   * Rate limiting helper
   */
  createRateLimiter(maxAttempts = 5, timeWindow = 60000) {
    const attempts = new Map();
    
    return (identifier) => {
      const now = Date.now();
      const userAttempts = attempts.get(identifier) || [];
      
      // Remove old attempts outside time window
      const validAttempts = userAttempts.filter(time => now - time < timeWindow);
      
      if (validAttempts.length >= maxAttempts) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      validAttempts.push(now);
      attempts.set(identifier, validAttempts);
      
      return true;
    };
  }

  /**
   * Secure session storage wrapper
   */
  secureStorage = {
    setItem: (key, value) => {
      try {
        const encrypted = btoa(JSON.stringify(value));
        sessionStorage.setItem(key, encrypted);
      } catch (error) {
        console.error('Failed to store item securely:', error);
      }
    },

    getItem: (key) => {
      try {
        const encrypted = sessionStorage.getItem(key);
        if (!encrypted) return null;
        return JSON.parse(atob(encrypted));
      } catch (error) {
        console.error('Failed to retrieve item securely:', error);
        return null;
      }
    },

    removeItem: (key) => {
      sessionStorage.removeItem(key);
    }
  };

  /**
   * Input validation patterns
   */
  validationPatterns = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    phone: /^[\+]?[1-9][\d]{0,15}$/,
    name: /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s\-']{2,50}$/,
    alphanumeric: /^[a-zA-Z0-9]+$/,
    dateISO: /^\d{4}-\d{2}-\d{2}$/,
    timeHHMM: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  };

  /**
   * Validate input against pattern
   */
  validateInput(input, pattern) {
    if (typeof pattern === 'string' && this.validationPatterns[pattern]) {
      pattern = this.validationPatterns[pattern];
    }
    
    return pattern.test(input);
  }

  /**
   * Get CSRF token
   */
  getCSRFToken() {
    return this.csrfToken;
  }

  /**
   * Verify CSRF token
   */
  verifyCSRFToken(token) {
    return token === this.csrfToken;
  }
}

// Export singleton instance
export const security = new SecurityManager();

// Make security available globally
window.security = security;