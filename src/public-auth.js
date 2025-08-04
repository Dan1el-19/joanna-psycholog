/**
 * Firebase Anonymous Authentication System for Public Users
 * Handles anonymous authentication for appointment booking
 */

import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import app from './firebase-config.js';

class PublicAuthSystem {
  constructor() {
    this.auth = getAuth(app);
    this.currentUser = null;
    this.authStateListeners = [];
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize anonymous authentication
   */
  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve) => {
      // Setup auth state listener first
      const unsubscribe = onAuthStateChanged(this.auth, async (user) => {
        this.currentUser = user;
        
        if (!user && !this.isInitialized) {
          // No user and not initialized - sign in anonymously
          try {
            await this.signInAnonymously();
            return; // Wait for next auth state change
          } catch (error) {
            console.error('Failed to sign in anonymously:', error);
            // Continue anyway - some functionality might work without auth
          }
        }
        
        if (!this.isInitialized) {
          this.isInitialized = true;
          // Store unsubscribe function for cleanup
          this.unsubscribe = unsubscribe;
          resolve(user);
        }
        
        // Notify listeners
        this.authStateListeners.forEach(listener => listener(user));
      });
    });

    return this.initPromise;
  }

  /**
   * Sign in anonymously
   */
  async signInAnonymously() {
    try {
      const userCredential = await signInAnonymously(this.auth);
      return userCredential.user;
    } catch (error) {
      console.error('Anonymous authentication failed:', error);
      throw new Error('Nie udało się nawiązać połączenia. Spróbuj odświeżyć stronę.');
    }
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
   * Check if user is authenticated (anonymously)
   */
  isAuthenticated() {
    return !!this.currentUser;
  }

  /**
   * Get current anonymous user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Get user UID for session management
   */
  getUserId() {
    return this.currentUser?.uid || null;
  }

  /**
   * Check if current user is anonymous
   */
  isAnonymous() {
    return this.currentUser?.isAnonymous || false;
  }

  /**
   * Get authentication status
   */
  getAuthStatus() {
    return {
      isAuthenticated: this.isAuthenticated(),
      isAnonymous: this.isAnonymous(),
      user: this.currentUser,
      userId: this.getUserId()
    };
  }

  /**
   * Ensure user is authenticated, sign in if needed
   */
  async ensureAuthenticated() {
    if (!this.isAuthenticated()) {
      await this.init();
    }
    return this.currentUser;
  }

  /**
   * Clean up auth listeners
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.authStateListeners = [];
  }
}

// Export singleton instance
export const publicAuth = new PublicAuthSystem();

// Make publicAuth available globally
window.publicAuth = publicAuth;