"use strict";
/**
 * Simplified Email Service without complex logging
 * Uses Firebase Admin SDK v9 syntax
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleEmailService = void 0;
const firestore_1 = require("firebase-admin/firestore");
const email_templates_service_1 = require("./email-templates.service");
const email_validation_service_1 = require("./email-validation.service");
class SimpleEmailService {
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
            const recipientEmail = validation.email;
            // Process template if templateId is provided
            let processedEmailData = { ...emailData };
            if (emailData.templateId) {
                const template = email_templates_service_1.EmailTemplatesService.getTemplate(emailData.templateId);
                if (!template) {
                    throw new Error(`Template not found: ${emailData.templateId}`);
                }
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
            // Add email to Firestore (triggers the extension)
            const docRef = await this.firestore
                .collection(this.MAIL_COLLECTION)
                .add(mailDoc);
            console.log('Email queued successfully:', {
                emailId: docRef.id,
                recipient: recipientEmail,
                subject: processedEmailData.subject
            });
            return {
                success: true,
                emailId: docRef.id,
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
     * Send welcome email
     */
    static async sendWelcomeEmail(userData) {
        var _a;
        const emailData = {
            to: userData.email,
            subject: 'Witamy w naszej aplikacji!',
            templateId: 'welcome',
            variables: {
                firstName: userData.firstName || ((_a = userData.displayName) === null || _a === void 0 ? void 0 : _a.split(' ')[0]) || 'Użytkowniku',
                userEmail: userData.email,
                registrationDate: new Date().toLocaleDateString('pl-PL')
            },
            priority: 'normal'
        };
        return await this.sendEmail(emailData);
    }
    /**
     * Send order confirmation
     */
    static async sendOrderConfirmation(orderData) {
        const emailData = {
            to: orderData.customerEmail,
            subject: `Potwierdzenie zamówienia #${orderData.orderId}`,
            templateId: 'order-confirmation',
            variables: {
                customerName: orderData.customerName,
                orderId: orderData.orderId,
                orderDate: orderData.createdAt.toLocaleDateString('pl-PL'),
                orderStatus: orderData.status,
                items: orderData.items,
                totalAmount: orderData.totalAmount.toFixed(2),
                currency: orderData.currency.toUpperCase()
            },
            priority: 'high'
        };
        return await this.sendEmail(emailData);
    }
}
exports.SimpleEmailService = SimpleEmailService;
SimpleEmailService.MAIL_COLLECTION = 'mail';
SimpleEmailService.firestore = (0, firestore_1.getFirestore)();
SimpleEmailService.CONFIG = {
    companyName: 'Joanna Rudzińska Psycholog',
    companyAddress: 'ul. Przykładowa 123, 00-000 Warszawa',
    supportEmail: 'j.rudzinska@myreflection.pl',
    appUrl: 'https://joanna-psycholog.web.app',
    unsubscribeUrl: 'https://joanna-psycholog.web.app/unsubscribe'
};
//# sourceMappingURL=simple-email.service.js.map