"use strict";
/**
 * Main Email Service
 * Handles sending emails using Firebase Trigger Email extension
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const email_templates_service_1 = require("./email-templates.service");
const email_validation_service_1 = require("./email-validation.service");
const email_logging_service_1 = require("./email-logging.service");
class EmailService {
    /**
     * Send email using Firebase Trigger Email extension
     */
    static async sendEmail(emailData) {
        try {
            // Validate recipient email
            const validation = email_validation_service_1.EmailValidationService.validateEmail(typeof emailData.to === 'string' ? emailData.to : emailData.to.email);
            if (!validation.isValid) {
                throw new Error(`Invalid email address: ${validation.errors.join(', ')}`);
            }
            // Check for disposable email
            const recipientEmail = validation.email;
            if (email_validation_service_1.EmailValidationService.isDisposableEmail(recipientEmail)) {
                console.warn('Disposable email detected:', recipientEmail);
                // You might want to reject or flag these emails
            }
            // Process template if templateId is provided
            let processedEmailData = { ...emailData };
            if (emailData.templateId) {
                const template = email_templates_service_1.EmailTemplatesService.getTemplate(emailData.templateId);
                if (!template) {
                    throw new Error(`Template not found: ${emailData.templateId}`);
                }
                // Merge default variables with provided variables
                const variables = {
                    ...this.CONFIG,
                    userEmail: recipientEmail,
                    ...emailData.variables
                };
                processedEmailData.subject = email_templates_service_1.EmailTemplatesService.processTemplate(template.subject, variables);
                processedEmailData.html = email_templates_service_1.EmailTemplatesService.processTemplate(template.htmlTemplate, variables);
                processedEmailData.text = email_templates_service_1.EmailTemplatesService.processTemplate(template.textTemplate, variables);
            }
            // Prepare email document for Firebase extension
            const mailDoc = {
                to: recipientEmail,
                message: {
                    subject: processedEmailData.subject,
                    html: processedEmailData.html,
                    text: processedEmailData.text
                }
            };
            // Add CC and BCC if provided
            if (emailData.cc && emailData.cc.length > 0) {
                mailDoc.cc = Array.isArray(emailData.cc)
                    ? emailData.cc.map(addr => typeof addr === 'string' ? addr : addr.email)
                    : [emailData.cc];
            }
            if (emailData.bcc && emailData.bcc.length > 0) {
                mailDoc.bcc = Array.isArray(emailData.bcc)
                    ? emailData.bcc.map(addr => typeof addr === 'string' ? addr : addr.email)
                    : [emailData.bcc];
            }
            // Add scheduled delivery if provided
            if (emailData.scheduledFor) {
                mailDoc.delivery = {
                    startTime: emailData.scheduledFor
                };
            }
            // Add email to Firestore (triggers the extension)
            const docRef = await (0, firestore_1.addDoc)((0, firestore_1.collection)(this.firestore, this.MAIL_COLLECTION), mailDoc);
            // Log the email
            const logId = await email_logging_service_1.EmailLoggingService.logEmailQueued({
                emailId: docRef.id,
                recipientEmail,
                subject: processedEmailData.subject,
                templateId: emailData.templateId,
                metadata: {
                    priority: emailData.priority || 'normal',
                    ...(emailData.variables && { variables: emailData.variables })
                }
            });
            console.log('Email queued successfully:', {
                emailId: docRef.id,
                logId,
                recipient: recipientEmail,
                subject: processedEmailData.subject
            });
            return {
                success: true,
                emailId: docRef.id,
                logId,
                message: 'Email queued successfully'
            };
        }
        catch (error) {
            console.error('Error sending email:', error);
            return {
                success: false,
                message: 'Failed to send email',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Send welcome email to new user
     */
    static async sendWelcomeEmail(userData) {
        var _a;
        try {
            const emailData = {
                to: userData.email,
                templateId: 'welcome',
                variables: {
                    firstName: userData.firstName || ((_a = userData.displayName) === null || _a === void 0 ? void 0 : _a.split(' ')[0]) || 'Użytkowniku',
                    userEmail: userData.email,
                    registrationDate: userData.registrationDate.toLocaleDateString('pl-PL')
                },
                priority: 'normal'
            };
            const result = await this.sendEmail(emailData);
            if (result.success) {
                console.log('Welcome email sent successfully:', {
                    userId: userData.uid,
                    email: userData.email
                });
            }
            return result;
        }
        catch (error) {
            console.error('Error sending welcome email:', error);
            return {
                success: false,
                message: 'Failed to send welcome email',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Send order confirmation email
     */
    static async sendOrderConfirmation(orderData) {
        try {
            const emailData = {
                to: orderData.customerEmail,
                templateId: 'order-confirmation',
                variables: {
                    customerName: orderData.customerName,
                    orderId: orderData.orderId,
                    orderDate: orderData.createdAt.toLocaleDateString('pl-PL'),
                    orderStatus: this.getOrderStatusDisplayName(orderData.status),
                    items: orderData.items,
                    totalAmount: orderData.totalAmount.toFixed(2),
                    currency: orderData.currency.toUpperCase()
                },
                priority: 'high'
            };
            const result = await this.sendEmail(emailData);
            if (result.success) {
                console.log('Order confirmation email sent:', {
                    orderId: orderData.orderId,
                    email: orderData.customerEmail
                });
            }
            return result;
        }
        catch (error) {
            console.error('Error sending order confirmation:', error);
            return {
                success: false,
                message: 'Failed to send order confirmation',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Send cart abandonment reminder email
     */
    static async sendCartReminderEmail(reminderData) {
        try {
            const daysLeft = 7 - Math.floor((Date.now() - reminderData.abandonedAt.getTime()) / (1000 * 60 * 60 * 24));
            const emailData = {
                to: reminderData.customerEmail,
                templateId: 'cart-reminder',
                variables: {
                    customerName: reminderData.customerName,
                    items: reminderData.cartItems,
                    checkoutUrl: `${this.CONFIG.appUrl}/checkout/${reminderData.orderId}`,
                    reminderCount: reminderData.reminderCount,
                    daysLeft: Math.max(daysLeft, 1),
                    currency: 'PLN' // Default currency
                },
                priority: 'low'
            };
            const result = await this.sendEmail(emailData);
            if (result.success) {
                console.log('Cart reminder email sent:', {
                    orderId: reminderData.orderId,
                    email: reminderData.customerEmail,
                    reminderCount: reminderData.reminderCount
                });
            }
            return result;
        }
        catch (error) {
            console.error('Error sending cart reminder:', error);
            return {
                success: false,
                message: 'Failed to send cart reminder',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Send bulk emails (with rate limiting)
     */
    static async sendBulkEmails(emails, batchSize = 10, delayMs = 1000) {
        let successful = 0;
        let failed = 0;
        const errors = [];
        // Process emails in batches to avoid rate limits
        for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);
            const promises = batch.map(async (emailData) => {
                try {
                    const result = await this.sendEmail(emailData);
                    if (result.success) {
                        successful++;
                    }
                    else {
                        failed++;
                        errors.push(`${emailData.to}: ${result.error || result.message}`);
                    }
                }
                catch (error) {
                    failed++;
                    errors.push(`${emailData.to}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            });
            await Promise.all(promises);
            // Delay between batches
            if (i + batchSize < emails.length) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        console.log('Bulk email sending completed:', {
            total: emails.length,
            successful,
            failed
        });
        return { successful, failed, errors };
    }
    /**
     * Helper method to get order status display name
     */
    static getOrderStatusDisplayName(status) {
        const statusMap = {
            'pending': 'Oczekujące',
            'confirmed': 'Potwierdzone',
            'shipped': 'Wysłane',
            'delivered': 'Dostarczone',
            'cancelled': 'Anulowane'
        };
        return statusMap[status] || status;
    }
}
exports.EmailService = EmailService;
EmailService.MAIL_COLLECTION = 'mail';
EmailService.firestore = (0, firestore_1.getFirestore)();
// Configuration - should be moved to environment variables
EmailService.CONFIG = {
    companyName: 'Joanna Rudzińska Psycholog',
    companyAddress: 'ul. Przykładowa 123, 00-000 Warszawa',
    supportEmail: 'j.rudzinska@myreflection.pl',
    appUrl: 'https://joanna-psycholog.web.app',
    unsubscribeUrl: 'https://joanna-psycholog.web.app/unsubscribe'
};
//# sourceMappingURL=email.service.js.map