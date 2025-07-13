"use strict";
/**
 * Email Logging Service
 * Logs email sending status and provides tracking functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailLoggingService = void 0;
const firestore_1 = require("firebase-admin/firestore");
class EmailLoggingService {
    /**
     * Log email creation (when email is queued)
     */
    static async logEmailQueued(data) {
        try {
            const logEntry = {
                emailId: data.emailId,
                recipientEmail: data.recipientEmail,
                subject: data.subject,
                templateId: data.templateId,
                status: 'queued',
                createdAt: new Date(),
                metadata: data.metadata
            };
            const docRef = await this.firestore
                .collection(this.COLLECTION_NAME)
                .add(logEntry);
            console.log(`Email queued and logged: ${docRef.id}`, {
                emailId: data.emailId,
                recipient: data.recipientEmail
            });
            return docRef.id;
        }
        catch (error) {
            console.error('Error logging queued email:', error);
            throw new Error('Failed to log email queue status');
        }
    }
    /**
     * Update email status to sent
     */
    static async logEmailSent(logId, data) {
        try {
            const updateData = {
                status: 'sent',
                sentAt: (data === null || data === void 0 ? void 0 : data.sentAt) || new Date(),
                ...((data === null || data === void 0 ? void 0 : data.metadata) && { metadata: data.metadata })
            };
            await this.firestore
                .collection(this.COLLECTION_NAME)
                .doc(logId)
                .update(updateData);
            console.log(`Email status updated to sent: ${logId}`);
        }
        catch (error) {
            console.error('Error updating email sent status:', error);
            throw new Error('Failed to update email sent status');
        }
    }
    /**
     * Update email status to failed
     */
    static async logEmailFailed(logId, error, metadata) {
        try {
            const updateData = {
                status: 'failed',
                error: error,
                ...(metadata && { metadata })
            };
            await this.firestore
                .collection(this.COLLECTION_NAME)
                .doc(logId)
                .update(updateData);
            console.error(`Email failed and logged: ${logId}`, { error });
        }
        catch (updateError) {
            console.error('Error logging email failure:', updateError);
            throw new Error('Failed to log email failure');
        }
    }
    /**
     * Update email status to delivered (webhook callback)
     */
    static async logEmailDelivered(emailId, deliveredAt) {
        try {
            // Find log entry by emailId
            const querySnapshot = await this.firestore
                .collection(this.COLLECTION_NAME)
                .where('emailId', '==', emailId)
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();
            if (querySnapshot.empty) {
                console.warn(`No log entry found for emailId: ${emailId}`);
                return;
            }
            const logDoc = querySnapshot.docs[0];
            const updateData = {
                status: 'delivered',
                deliveredAt: deliveredAt || new Date()
            };
            await logDoc.ref.update(updateData);
            console.log(`Email delivery confirmed: ${emailId}`);
        }
        catch (error) {
            console.error('Error logging email delivery:', error);
            throw new Error('Failed to log email delivery');
        }
    }
    /**
     * Update email status to bounced (webhook callback)
     */
    static async logEmailBounced(emailId, reason) {
        try {
            // Find log entry by emailId
            const querySnapshot = await this.firestore
                .collection(this.COLLECTION_NAME)
                .where('emailId', '==', emailId)
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();
            if (querySnapshot.empty) {
                console.warn(`No log entry found for emailId: ${emailId}`);
                return;
            }
            const logDoc = querySnapshot.docs[0];
            const updateData = {
                status: 'bounced',
                error: reason
            };
            await logDoc.ref.update(updateData);
            console.warn(`Email bounced: ${emailId}`, { reason });
        }
        catch (error) {
            console.error('Error logging email bounce:', error);
            throw new Error('Failed to log email bounce');
        }
    }
    /**
     * Get email logs for a specific recipient
     */
    static async getEmailLogs(recipientEmail, limitCount = 50) {
        try {
            const q = query(collection(this.firestore, this.COLLECTION_NAME), where('recipientEmail', '==', recipientEmail), orderBy('createdAt', 'desc'), limit(limitCount));
            const querySnapshot = await getDocs(q);
            const logs = [];
            querySnapshot.forEach((doc) => {
                var _a, _b;
                const data = doc.data();
                logs.push({
                    ...data,
                    createdAt: data.createdAt.toDate(),
                    sentAt: (_a = data.sentAt) === null || _a === void 0 ? void 0 : _a.toDate(),
                    deliveredAt: (_b = data.deliveredAt) === null || _b === void 0 ? void 0 : _b.toDate()
                });
            });
            return logs;
        }
        catch (error) {
            console.error('Error fetching email logs:', error);
            throw new Error('Failed to fetch email logs');
        }
    }
    /**
     * Get email logs by template ID
     */
    static async getEmailLogsByTemplate(templateId, limitCount = 100) {
        try {
            const q = query(collection(this.firestore, this.COLLECTION_NAME), where('templateId', '==', templateId), orderBy('createdAt', 'desc'), limit(limitCount));
            const querySnapshot = await getDocs(q);
            const logs = [];
            querySnapshot.forEach((doc) => {
                var _a, _b;
                const data = doc.data();
                logs.push({
                    ...data,
                    createdAt: data.createdAt.toDate(),
                    sentAt: (_a = data.sentAt) === null || _a === void 0 ? void 0 : _a.toDate(),
                    deliveredAt: (_b = data.deliveredAt) === null || _b === void 0 ? void 0 : _b.toDate()
                });
            });
            return logs;
        }
        catch (error) {
            console.error('Error fetching email logs by template:', error);
            throw new Error('Failed to fetch email logs by template');
        }
    }
    /**
     * Get email statistics
     */
    static async getEmailStats(days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const q = query(collection(this.firestore, this.COLLECTION_NAME), where('createdAt', '>=', startDate), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            let total = 0;
            let sent = 0;
            let failed = 0;
            let delivered = 0;
            let bounced = 0;
            querySnapshot.forEach((doc) => {
                total++;
                const data = doc.data();
                switch (data.status) {
                    case 'sent':
                        sent++;
                        break;
                    case 'failed':
                        failed++;
                        break;
                    case 'delivered':
                        delivered++;
                        break;
                    case 'bounced':
                        bounced++;
                        break;
                }
            });
            const successRate = total > 0 ? ((sent + delivered) / total) * 100 : 0;
            return {
                total,
                sent,
                failed,
                delivered,
                bounced,
                successRate: Math.round(successRate * 100) / 100
            };
        }
        catch (error) {
            console.error('Error calculating email stats:', error);
            throw new Error('Failed to calculate email statistics');
        }
    }
    /**
     * Clean up old logs (older than specified days)
     */
    static async cleanupOldLogs(olderThanDays = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
            const q = query(collection(this.firestore, this.COLLECTION_NAME), where('createdAt', '<', cutoffDate), limit(500) // Process in batches
            );
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                return 0;
            }
            const batch = this.firestore.batch();
            querySnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`Cleaned up ${querySnapshot.size} old email logs`);
            return querySnapshot.size;
        }
        catch (error) {
            console.error('Error cleaning up old email logs:', error);
            throw new Error('Failed to cleanup old email logs');
        }
    }
}
exports.EmailLoggingService = EmailLoggingService;
EmailLoggingService.COLLECTION_NAME = 'emailLogs';
EmailLoggingService.firestore = (0, firestore_1.getFirestore)();
//# sourceMappingURL=email-logging.service.js.map