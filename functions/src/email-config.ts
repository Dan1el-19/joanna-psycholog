// Email configuration for Firebase Functions
// Uses environment variables to switch between dev and production emails

// Production emails (safe for public repo)
const PROD_EMAILS = {
  contact: 'kontakt@myreflection.pl',
  support: 'kontakt@myreflection.pl'
};

// Development/Real emails from environment variables
const DEV_EMAILS = {
  contact: process.env.CONTACT_EMAIL_DEV || PROD_EMAILS.contact,
  support: process.env.SUPPORT_EMAIL_DEV || PROD_EMAILS.support
};

// Determine environment - Functions run in production unless explicitly dev
const isProduction = !process.env.FUNCTIONS_EMULATOR || process.env.NODE_ENV === 'production';

const emailConfig = {
  contact: isProduction ? PROD_EMAILS.contact : DEV_EMAILS.contact,
  support: isProduction ? PROD_EMAILS.support : DEV_EMAILS.support,
  
  // Helper methods
  getContactEmail: () => isProduction ? PROD_EMAILS.contact : DEV_EMAILS.contact,
  getSupportEmail: () => isProduction ? PROD_EMAILS.support : DEV_EMAILS.support,
  
  // For backward compatibility
  get contactEmail() { return this.getContactEmail(); },
  get supportEmail() { return this.getSupportEmail(); }
};

// Export individual emails for easy use
export const contactEmail = emailConfig.contact;
export const supportEmail = emailConfig.support;
export { emailConfig };
export default emailConfig;
