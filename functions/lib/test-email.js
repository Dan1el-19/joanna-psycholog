"use strict";
/**
 * Test SMTP connection directly
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testEmailConnection = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
exports.testEmailConnection = (0, https_1.onCall)({
    region: 'europe-west1'
}, async (request) => {
    try {
        const db = (0, firestore_1.getFirestore)();
        // Add test email document to trigger extension
        const testEmail = {
            to: 'j.rudzinska@myreflection.pl',
            message: {
                subject: 'Test Email - SMTP Connection',
                text: 'This is a test email to verify SMTP configuration.',
                html: '<p>This is a <strong>test email</strong> to verify SMTP configuration.</p><p>Time: ' + new Date().toISOString() + '</p>'
            }
        };
        const docRef = await db.collection('mail').add(testEmail);
        return {
            success: true,
            message: 'Test email queued successfully',
            emailId: docRef.id
        };
    }
    catch (error) {
        console.error('Error sending test email:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
});
//# sourceMappingURL=test-email.js.map