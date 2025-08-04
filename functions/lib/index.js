"use strict";
/**
 * Firebase Cloud Functions for Appointment Email System
 * VERSION 2.1 - Complete Overhaul with Professional Email Templates for ALL functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAnonymousUsers = exports.deleteCollection = exports.dailyMaintenanceCleanup = exports.sendContactFormEmail = exports.sendPaymentStatusEmail = exports.sendRescheduleEmail = exports.sendCancellationEmail = exports.sendAppointmentReminders = exports.sendAppointmentApproval = exports.sendAppointmentConfirmation = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
// Initialize Firebase Admin
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
// ##################################################################
// # NEW PROFESSIONAL EMAIL TEMPLATE
// ##################################################################
const generateEmailHTML = (title, preheader, content) => {
    return `
  <!DOCTYPE html>
  <html lang="pl">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="ie=edge">
      <title>${title}</title>
      <style>
          body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f4f7f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
          table { border-spacing: 0; }
          td { padding: 0; }
          img { border: 0; }
          .wrapper { width: 100%; table-layout: fixed; background-color: #f4f7f6; padding: 40px 0; }
          .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #4a4a4a; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
          .content { padding: 30px 40px; }
          h1, h2, h3, p { margin: 0; }
          h2 { font-size: 24px; color: #2c3e50; margin-bottom: 20px; }
          p { font-size: 16px; line-height: 1.6; color: #555; }
          .button { background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 5px; font-weight: bold; display: inline-block; }
          .footer { background-color: #2c3e50; color: #ffffff; padding: 30px 40px; text-align: center; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; }
          .footer p { font-size: 12px; color: #bdc3c7; }
          .footer a { color: #3498db; text-decoration: none; }
          .section { padding: 20px; margin: 20px 0; border-radius: 8px; }
          .section-blue { background-color: #eaf2ff; border-left: 4px solid #2563eb; }
          .section-green { background-color: #e6f9f1; border-left: 4px solid #10b981; }
          .section-red { background-color: #fff0f0; border-left: 4px solid #ef4444; }
          .section-orange { background-color: #fff8e1; border-left: 4px solid #f59e0b; }
          .section h3 { font-size: 18px; color: #2c3e50; margin-bottom: 15px; }
          .section p { font-size: 15px; }
      </style>
  </head>
  <body>
      <div class="wrapper">
          <table class="main" align="center">
              <tr>
                  <td class="content">
                      <!-- Main Content Passed Here -->
                      ${content}
                  </td>
              </tr>
              <tr>
                  <td class="footer">
                      <p><strong>Joanna Rudzińska-Łodyga</strong></p>
                      <p><a href="mailto:j.rudzinska@myreflection.pl">j.rudzinska@myreflection.pl</a> | <a href="https://myreflection.pl">myreflection.pl</a></p>
                  </td>
              </tr>
          </table>
      </div>
  </body>
  </html>
  `;
};
// --- Cloud Functions ---
exports.sendAppointmentConfirmation = (0, firestore_1.onDocumentCreated)({
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
}, async (event) => {
    var _a, _b, _c;
    try {
        const appointmentData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
        const appointmentId = event.params.appointmentId;
        if (!appointmentData) {
            console.warn('No appointment data found');
            return;
        }
        console.log('Sending appointment confirmation for:', appointmentId);
        const augmentedData = await getAugmentedAppointmentData(appointmentData);
        const reservationToken = generateUniqueToken();
        const tokenExpiresAt = new Date();
        tokenExpiresAt.setMonth(tokenExpiresAt.getMonth() + 6);
        await ((_b = event.data) === null || _b === void 0 ? void 0 : _b.ref.update({
            calculatedPrice: augmentedData.calculatedPrice,
            originalServicePrice: augmentedData.originalServicePrice,
            basePrice: augmentedData.basePrice,
            isFirstSession: augmentedData.isFirstSession,
            discount: augmentedData.discount,
            discountAmount: augmentedData.discountAmount,
            pricingCalculatedAt: firestore_2.FieldValue.serverTimestamp(),
            reservationToken,
            tokenExpiresAt: firestore_2.Timestamp.fromDate(tokenExpiresAt)
        }));
        await db.collection('reservationTokens').add({
            appointmentId,
            token: reservationToken,
            expiresAt: firestore_2.Timestamp.fromDate(tokenExpiresAt),
            createdAt: firestore_2.FieldValue.serverTimestamp(),
            isUsed: false
        });
        const clientEmailContent = `
        <h2>Dziękuję za zgłoszenie!</h2>
        <p>Dzień dobry ${augmentedData.name},</p>
        <p>Otrzymałam Państwa zgłoszenie wizyty. Poniżej znajdują się jego szczegóły. Skontaktuję się z Państwem w ciągu 24 godzin w celu ustalenia ostatecznego terminu spotkania.</p>
        
        <div class="section section-blue">
          <h3>Szczegóły wizyty</h3>
          <p><strong>Usługa:</strong> ${augmentedData.serviceName}</p>
          <p><strong>Preferowana data:</strong> ${augmentedData.preferredDate || 'Do uzgodnienia'}</p>
          <p><strong>Preferowana godzina:</strong> ${augmentedData.preferredTime || 'Do uzgodnienia'}</p>
        </div>

        <div class="section section-green">
            <h3>Cena wizyty</h3>
            <p style="font-size: 18px; margin: 0;"><strong>Koszt: ${augmentedData.finalPrice} PLN</strong></p>
            ${augmentedData.isFirstSession ? `
              <p style="color: #059669; font-weight: bold; margin: 10px 0 0;">🎉 Pierwsze spotkanie - 50% zniżki!</p>
              <p style="font-size: 14px; color: #555; margin: 5px 0 0;">Regularna cena za ${augmentedData.serviceName}: ${augmentedData.basePrice} PLN</p>
            ` : ``}
            <p style="margin-top: 20px;">
                <a style="color: #ffffff" href="https://www.paypal.com/paypalme/myreflectionjoanna/${augmentedData.finalPrice}PLN" class="button">
                    Zapłać (PayPal)
                </a>
            </p>
        </div>

        <div class="section section-blue">
            <h3>Co dalej?</h3>
            <p>Możesz zarządzać swoją rezerwacją (zmienić termin lub ją anulować) korzystając z poniższego przycisku. Pamiętaj, że anulowanie jest możliwe do 24h przed wizytą.</p>
            <p style="margin-top: 20px;">
                <a style="color: #ffffff" href="https://myreflection.pl/manage-reservation/${reservationToken}" class="button">
                    Zarządzaj rezerwacją
                </a>
            </p>
        </div>

        <p>Serdecznie pozdrawiam,<br><strong>Joanna Rudzińska-Łodyga</strong></p>
      `;
        const clientEmailDoc = {
            to: augmentedData.email,
            message: {
                subject: 'Potwierdzenie zgłoszenia - My Reflection',
                html: generateEmailHTML('Potwierdzenie zgłoszenia', 'Otrzymałam Twoje zgłoszenie wizyty.', clientEmailContent),
            }
        };
        const therapistEmailDoc = {
            to: 'j.rudzinska@myreflection.pl',
            message: {
                subject: `Nowa wizyta: ${augmentedData.name} - ${augmentedData.serviceName}`,
                html: `
            <h2>Nowa wizyta - ${appointmentData.name}</h2>
            <p><strong>Imię i nazwisko:</strong> ${appointmentData.name}</p>
            <p><strong>Email:</strong> ${appointmentData.email}</p>
            ${appointmentData.phone ? `<p><strong>Telefon:</strong> ${appointmentData.phone}</p>` : ''}
            <hr>
            <p><strong>Usługa:</strong> ${augmentedData.serviceName}</p>
            <p><strong>Preferowana data:</strong> ${appointmentData.preferredDate}</p>
            <p><strong>Preferowana godzina:</strong> ${appointmentData.preferredTime}</p>
            <p><strong>Cena:</strong> ${augmentedData.finalPrice} PLN ${augmentedData.isFirstSession ? '(pierwsze spotkanie - 50% taniej)' : '(standardowa cena)'}</p>
            ${appointmentData.message ? `<p><strong>Dodatkowe informacje:</strong> ${appointmentData.message}</p>` : ''}
          `,
            }
        };
        await Promise.all([
            db.collection('mail').add(clientEmailDoc),
            db.collection('mail').add(therapistEmailDoc)
        ]);
        await ((_c = event.data) === null || _c === void 0 ? void 0 : _c.ref.update({
            confirmationEmailSent: true,
            confirmationEmailSentAt: firestore_2.FieldValue.serverTimestamp()
        }));
        console.log('Appointment confirmation emails sent successfully');
    }
    catch (error) {
        console.error('Error sending appointment confirmation:', error);
    }
});
exports.sendAppointmentApproval = (0, firestore_1.onDocumentUpdated)({
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
}, async (event) => {
    var _a, _b, _c;
    try {
        const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
        const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
        if (!beforeData || !afterData)
            return;
        if (beforeData.status !== 'confirmed' &&
            afterData.status === 'confirmed' &&
            !afterData.approvalEmailSent) {
            console.log('Sending appointment approval email for:', event.params.appointmentId);
            const serviceData = await getServiceData(afterData.service);
            const serviceName = (serviceData === null || serviceData === void 0 ? void 0 : serviceData.name) || afterData.service;
            const approvalEmailContent = `
            <h2>Wizyta potwierdzona!</h2>
            <p>Dzień dobry ${afterData.name},</p>
            <p>Z przyjemnością informuję, że Państwa wizyta została potwierdzona. Cieszę się na nasze spotkanie!</p>
            
            <div class="section section-green">
              <h3>Potwierdzone szczegóły wizyty</h3>
              <p><strong>Usługa:</strong> ${serviceName}</p>
              <p><strong>Data:</strong> ${afterData.confirmedDate || afterData.preferredDate}</p>
              <p><strong>Godzina:</strong> ${afterData.confirmedTime || afterData.preferredTime}</p>
              <p><strong>Koszt:</strong> ${afterData.calculatedPrice} PLN</p>
              ${afterData.location ? `<p><strong>Miejsce:</strong> ${afterData.location}</p>` : ''}
              ${afterData.adminNotes ? `<p><strong>Dodatkowe informacje:</strong> ${afterData.adminNotes}</p>` : ''}
              <p style="margin-top: 20px;">
                <a style="color: #ffffff" href="https://www.paypal.com/paypalme/myreflectionjoanna/${afterData.calculatedPrice}PLN" class="button">
                    Zapłać (PayPal)
                </a>
            </div>

            <div class="section section-blue">
                <h3>Zarządzanie rezerwacją</h3>
                <p>W razie potrzeby, możesz zarządzać swoją rezerwacją (np. zmienić termin) korzystając z poniższego przycisku.</p>
                <p style="margin-top: 20px;">
                    <a style="color: #ffffff" href="https://myreflection.pl/manage-reservation/${afterData.reservationToken}" class="button">
                        Zarządzaj rezerwacją
                    </a>
                </p>
            </div>
            <p>Do zobaczenia,<br><strong>Joanna Rudzińska-Łodyga</strong></p>
        `;
            const approvalEmailDoc = {
                to: afterData.email,
                message: {
                    subject: '✅ Wizyta potwierdzona - My Reflection',
                    html: generateEmailHTML('Wizyta Potwierdzona', 'Twoja wizyta została potwierdzona.', approvalEmailContent)
                }
            };
            await db.collection('mail').add(approvalEmailDoc);
            await ((_c = event.data) === null || _c === void 0 ? void 0 : _c.after.ref.update({
                approvalEmailSent: true,
                approvalEmailSentAt: firestore_2.FieldValue.serverTimestamp()
            }));
            console.log('Appointment approval email sent successfully');
        }
    }
    catch (error) {
        console.error('Error sending appointment approval email:', error);
    }
});
exports.sendAppointmentReminders = (0, scheduler_1.onSchedule)({
    schedule: '0 9 * * *',
    timeZone: 'Europe/Warsaw',
    region: 'europe-central2'
}, async () => {
    try {
        console.log('Starting appointment reminder check...');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const appointmentsQuery = db.collection('appointments')
            .where('status', '==', 'confirmed')
            .where('confirmedDate', '==', tomorrowStr)
            .where('reminderEmailSent', '==', false);
        const querySnapshot = await appointmentsQuery.get();
        if (querySnapshot.empty) {
            console.log('No appointments need reminders today');
            return;
        }
        for (const doc of querySnapshot.docs) {
            const appointment = doc.data();
            const serviceData = await getServiceData(appointment.service);
            const reminderContent = `
            <h2>Przypomnienie o wizycie</h2>
            <p>Dzień dobry ${appointment.name},</p>
            <p>Chciałabym przypomnieć o Państwa jutrzejszej wizycie.</p>
            <div class="section section-blue">
                <h3>Szczegóły wizyty</h3>
                <p><strong>Usługa:</strong> ${(serviceData === null || serviceData === void 0 ? void 0 : serviceData.name) || appointment.service}</p>
                <p><strong>Data:</strong> ${appointment.confirmedDate}</p>
                <p><strong>Godzina:</strong> ${appointment.confirmedTime}</p>
            </div>
            <div class="section section-orange">
                <h3>Ważne</h3>
                <p>W razie potrzeby odwołania wizyty, proszę o kontakt najszybciej jak to możliwe. Anulowanie jest możliwe do 24h przed terminem.</p>
                 <p style="margin-top: 20px;">
                    <a href="https://myreflection.pl/manage-reservation/${appointment.reservationToken}" class="button">
                        Zarządzaj rezerwacją
                    </a>
                </p>
            </div>
            <p>Do zobaczenia jutro!<br><strong>Joanna Rudzińska-Łodyga</strong></p>
        `;
            const reminderEmailDoc = {
                to: appointment.email,
                message: {
                    subject: '📅 Przypomnienie o wizycie jutro -My Reflection',
                    html: generateEmailHTML('Przypomnienie o wizycie', `Przypominamy o Twojej wizycie jutro o ${appointment.confirmedTime}.`, reminderContent)
                }
            };
            await db.collection('mail').add(reminderEmailDoc);
            await doc.ref.update({
                reminderEmailSent: true,
                reminderEmailSentAt: firestore_2.FieldValue.serverTimestamp()
            });
            console.log(`Sent reminder for appointment ${doc.id}`);
        }
        console.log(`Sent ${querySnapshot.size} reminder emails`);
    }
    catch (error) {
        console.error('Error sending appointment reminders:', error);
    }
});
exports.sendCancellationEmail = (0, firestore_1.onDocumentUpdated)({
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
}, async (event) => {
    var _a, _b, _c;
    try {
        const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
        const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
        if (!beforeData || !afterData)
            return;
        if (beforeData.status !== 'cancelled' &&
            afterData.status === 'cancelled' &&
            !afterData.cancellationEmailSent) {
            const serviceData = await getServiceData(afterData.service);
            const originalDate = beforeData.preferredDate || beforeData.confirmedDate;
            const originalTime = beforeData.preferredTime || beforeData.confirmedTime;
            const cancellationContent = `
            <h2>Wizyta została anulowana</h2>
            <p>Dzień dobry ${afterData.name},</p>
            <p>Potwierdzam anulowanie Państwa wizyty. Jeśli to pomyłka lub chcieliby Państwo umówić nowy termin, proszę o kontakt.</p>
            <div class="section section-red">
                <h3>Szczegóły anulowanej wizyty</h3>
                <p><strong>Usługa:</strong> ${(serviceData === null || serviceData === void 0 ? void 0 : serviceData.name) || afterData.service}</p>
                <p><strong>Data:</strong> ${originalDate}</p>
                <p><strong>Godzina:</strong> ${originalTime}</p>
            </div>
            <p>Serdecznie pozdrawiam,<br><strong>Joanna Rudzińska-Łodyga</strong></p>
        `;
            const clientEmailDoc = {
                to: afterData.email,
                message: {
                    subject: 'Anulowanie wizyty - My Reflection',
                    html: generateEmailHTML('Anulowanie wizyty', 'Twoja wizyta została anulowana.', cancellationContent)
                }
            };
            await db.collection('mail').add(clientEmailDoc);
            await ((_c = event.data) === null || _c === void 0 ? void 0 : _c.after.ref.update({
                cancellationEmailSent: true,
                cancellationEmailSentAt: firestore_2.FieldValue.serverTimestamp()
            }));
            console.log(`Cancellation email sent for ${event.params.appointmentId}`);
        }
    }
    catch (error) {
        console.error('Error sending cancellation email:', error);
    }
});
exports.sendRescheduleEmail = (0, firestore_1.onDocumentUpdated)({
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
}, async (event) => {
    var _a, _b, _c;
    try {
        const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
        const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
        if (!beforeData || !afterData)
            return;
        const wasRescheduled = ((beforeData.preferredDate !== afterData.preferredDate || beforeData.preferredTime !== afterData.preferredTime) ||
            (beforeData.confirmedDate !== afterData.confirmedDate || beforeData.confirmedTime !== afterData.confirmedTime));
        if (wasRescheduled &&
            (afterData.rescheduleCount || 0) > (beforeData.rescheduleCount || 0) &&
            !afterData.rescheduleEmailSent) {
            console.log('Sending reschedule email for:', event.params.appointmentId);
            const originalDate = afterData.originalDate || beforeData.preferredDate || beforeData.confirmedDate;
            const originalTime = afterData.originalTime || beforeData.preferredTime || beforeData.confirmedTime;
            const newDate = afterData.preferredDate || afterData.confirmedDate;
            const newTime = afterData.preferredTime || afterData.confirmedTime;
            const serviceData = await getServiceData(afterData.service);
            const rescheduleContent = `
            <h2>Zmiana terminu wizyty</h2>
            <p>Dzień dobry ${afterData.name},</p>
            <p>Potwierdzam zmianę terminu Państwa wizyty.</p>
            <div class="section section-orange">
                <h3>Poprzedni termin</h3>
                <p><strong>Data:</strong> ${originalDate}</p>
                <p><strong>Godzina:</strong> ${originalTime}</p>
            </div>
            <div class="section section-green">
                <h3>Nowy, potwierdzony termin</h3>
                <p><strong>Usługa:</strong> ${(serviceData === null || serviceData === void 0 ? void 0 : serviceData.name) || afterData.service}</p>
                <p><strong>Data:</strong> ${newDate}</p>
                <p><strong>Godzina:</strong> ${newTime}</p>
            </div>
            <p>Do zobaczenia w nowym terminie!<br><strong>Joanna Rudzińska-Łodyga</strong></p>
        `;
            const clientEmailDoc = {
                to: afterData.email,
                message: {
                    subject: 'Przełożenie wizyty - My Reflection',
                    html: generateEmailHTML('Zmiana terminu wizyty', `Twoja wizyta została przełożona na ${newDate}.`, rescheduleContent)
                }
            };
            await db.collection('mail').add(clientEmailDoc);
            await ((_c = event.data) === null || _c === void 0 ? void 0 : _c.after.ref.update({
                rescheduleEmailSent: true,
                rescheduleEmailSentAt: firestore_2.FieldValue.serverTimestamp()
            }));
            console.log('Reschedule email sent successfully');
        }
    }
    catch (error) {
        console.error('Error sending reschedule email:', error);
    }
});
exports.sendPaymentStatusEmail = (0, firestore_1.onDocumentUpdated)({
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
}, async (event) => {
    var _a, _b, _c;
    try {
        const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
        const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
        if (!beforeData || !afterData)
            return;
        if (beforeData.paymentStatus !== afterData.paymentStatus &&
            afterData.paymentStatus &&
            !afterData.paymentStatusEmailSent) {
            console.log('Sending payment status email for:', event.params.appointmentId);
            let paymentContent = '';
            let subject = '';
            if (afterData.paymentStatus === 'paid') {
                subject = 'Potwierdzenie płatności - My Reflection';
                paymentContent = `
                <h2>Płatność potwierdzona</h2>
                <p>Dzień dobry ${afterData.name},</p>
                <p>Potwierdzam otrzymanie płatności za wizytę. Dziękuję!</p>
                <div class="section section-green">
                    <h3>Szczegóły płatności</h3>
                    <p><strong>Kwota:</strong> ${afterData.calculatedPrice} PLN</p>
                    <p><strong>Status:</strong> Opłacona</p>
                </div>
                <p>Do zobaczenia na wizycie!<br><strong>Joanna Rudzińska-Łodyga</strong></p>
            `;
            }
            else if (afterData.paymentStatus === 'failed') {
                subject = 'Problem z płatnością - My Reflection';
                paymentContent = `
                <h2>Problem z płatnością</h2>
                <p>Dzień dobry ${afterData.name},</p>
                <p>Informuję o problemie z płatnością za wizytę. Proszę spróbować ponownie lub skontaktować się ze mną w celu wyjaśnienia sytuacji.</p>
                <div class="section section-red">
                    <h3>Szczegóły płatności</h3>
                    <p><strong>Kwota:</strong> ${afterData.calculatedPrice} PLN</p>
                    <p><strong>Status:</strong> Nieudana</p>
                </div>
                <p>Z poważaniem,<br><strong>Joanna Rudzińska-Łodyga</strong></p>
            `;
            }
            if (paymentContent) {
                const clientEmailDoc = {
                    to: afterData.email,
                    message: {
                        subject: subject,
                        html: generateEmailHTML(subject, 'Aktualizacja statusu Twojej płatności.', paymentContent)
                    }
                };
                await db.collection('mail').add(clientEmailDoc);
                await ((_c = event.data) === null || _c === void 0 ? void 0 : _c.after.ref.update({
                    paymentStatusEmailSent: true,
                    paymentStatusEmailSentAt: firestore_2.FieldValue.serverTimestamp()
                }));
                console.log('Payment status email sent successfully');
            }
        }
    }
    catch (error) {
        console.error('Error sending payment status email:', error);
    }
});
// --- Helper Functions (Unchanged) ---
async function getAugmentedAppointmentData(appointmentData) {
    const { service, email } = appointmentData;
    const serviceData = await getServiceData(service);
    const basePrice = (serviceData === null || serviceData === void 0 ? void 0 : serviceData.price) || 150;
    const serviceName = (serviceData === null || serviceData === void 0 ? void 0 : serviceData.name) || service;
    const serviceDuration = (serviceData === null || serviceData === void 0 ? void 0 : serviceData.duration) || 50;
    const hasCompletedBefore = await hasCompletedSession(email);
    const isFirstSession = !hasCompletedBefore;
    const finalPrice = isFirstSession ? Math.round(basePrice * 0.5) : basePrice;
    const discountAmount = isFirstSession ? basePrice - finalPrice : 0;
    return {
        ...appointmentData,
        serviceName,
        serviceDuration,
        basePrice,
        finalPrice,
        isFirstSession,
        discount: isFirstSession ? 50 : 0,
        discountAmount,
        calculatedPrice: finalPrice,
        originalServicePrice: basePrice,
    };
}
async function hasCompletedSession(email) {
    try {
        const querySnapshot = await db.collection('appointments')
            .where('email', '==', email.toLowerCase())
            .where('sessionCompleted', '==', true)
            .limit(1)
            .get();
        return !querySnapshot.empty;
    }
    catch (error) {
        console.error('Error checking completed sessions:', error);
        return true;
    }
}
async function getServiceData(serviceId) {
    try {
        const servicesSnapshot = await db.collection('services').get();
        const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const serviceObj = services.find(s => s.id === serviceId);
        if (serviceObj) {
            return {
                name: serviceObj.name || serviceId,
                price: serviceObj.price || null,
                duration: serviceObj.duration || 50
            };
        }
    }
    catch (error) {
        console.error('Błąd podczas pobierania usług z bazy danych:', error);
    }
    return null;
}
function generateUniqueToken() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
// --- Contact Form Function ---
exports.sendContactFormEmail = (0, firestore_1.onDocumentCreated)({
    document: 'contactMessages/{messageId}',
    region: 'europe-central2'
}, async (event) => {
    var _a, _b, _c;
    try {
        const messageData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
        const messageId = event.params.messageId;
        if (!messageData) {
            console.warn('No contact message data found');
            return;
        }
        console.log('Processing contact form submission:', messageId);
        const { name, email, phone, subject, message, createdAt } = messageData;
        // Email to the therapist (Joanna)
        const therapistEmailContent = `
        <h2>Nowa wiadomość z formularza kontaktowego</h2>
        <div class="section section-blue">
          <h3>Dane nadawcy</h3>
          <p><strong>Imię i nazwisko:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${phone ? `<p><strong>Telefon:</strong> ${phone}</p>` : ''}
          <p><strong>Temat:</strong> ${getSubjectLabel(subject)}</p>
        </div>
        <div class="section section-green">
          <h3>Treść wiadomości</h3>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        <p><strong>Data wysłania:</strong> ${new Date(createdAt === null || createdAt === void 0 ? void 0 : createdAt.toDate()).toLocaleString('pl-PL')}</p>
        <p style="margin-top: 30px;">
          <a href="mailto:${email}" class="button">Odpowiedz bezpośrednio</a>
        </p>
      `;
        // Confirmation email to the sender
        const confirmationEmailContent = `
        <h2>Dziękuję za wiadomość!</h2>
        <p>Dzień dobry ${name},</p>
        <p>Otrzymałam Państwa wiadomość wysłaną przez formularz kontaktowy na stronie. Dziękuję za zainteresowanie moimi usługami.</p>
        
        <div class="section section-blue">
          <h3>Podsumowanie Państwa wiadomości</h3>
          <p><strong>Temat:</strong> ${getSubjectLabel(subject)}</p>
          <p><strong>Data wysłania:</strong> ${new Date(createdAt === null || createdAt === void 0 ? void 0 : createdAt.toDate()).toLocaleString('pl-PL')}</p>
        </div>

        <div class="section section-green">
          <h3>Co dalej?</h3>
          <p>Postaram się odpowiedzieć na Państwa wiadomość w ciągu <strong>24 godzin</strong>. W przypadku pilnych spraw, proszę o bezpośredni kontakt telefoniczny.</p>
          <p>Jeśli chcieliby Państwo od razu umówić wizytę, mogą to Państwo zrobić przez system rezerwacji online:</p>
          <p style="margin-top: 20px;">
            <a href="https://myreflection.pl/umow-wizyte" class="button">Umów wizytę online</a>
          </p>
        </div>

        <p>Serdecznie pozdrawiam,<br><strong>Joanna Rudzińska-Łodyga</strong><br>Psycholog</p>
      `;
        // Send email to therapist
        const therapistEmailDoc = {
            to: 'j.rudzinska@myreflection.pl',
            message: {
                subject: `Formularz kontaktowy: ${getSubjectLabel(subject)} - ${name}`,
                html: generateEmailHTML('Nowa wiadomość kontaktowa', `Otrzymałaś nową wiadomość od ${name}.`, therapistEmailContent),
                replyTo: email
            }
        };
        // Send confirmation email to sender
        const confirmationEmailDoc = {
            to: email,
            message: {
                subject: 'Potwierdzenie otrzymania wiadomości - My Reflection',
                html: generateEmailHTML('Dziękuję za wiadomość', 'Otrzymałam Twoją wiadomość i odpowiem wkrótce.', confirmationEmailContent)
            }
        };
        // Send both emails
        await Promise.all([
            db.collection('mail').add(therapistEmailDoc),
            db.collection('mail').add(confirmationEmailDoc)
        ]);
        // Mark as processed
        await ((_b = event.data) === null || _b === void 0 ? void 0 : _b.ref.update({
            emailsSent: true,
            emailsSentAt: firestore_2.FieldValue.serverTimestamp(),
            processed: true
        }));
        console.log('Contact form emails sent successfully for:', messageId);
    }
    catch (error) {
        console.error('Error processing contact form:', error);
        // Mark as failed
        await ((_c = event.data) === null || _c === void 0 ? void 0 : _c.ref.update({
            emailsSent: false,
            emailError: error instanceof Error ? error.message : String(error),
            processed: true
        }));
    }
});
function getSubjectLabel(subject) {
    const subjects = {
        'appointment': 'Umówienie wizyty',
        'question': 'Pytanie o terapię',
        'info': 'Informacje o usługach',
        'other': 'Inne'
    };
    return subjects[subject] || subject || 'Nie określono';
}
// --- Maintenance Functions (Unchanged) ---
exports.dailyMaintenanceCleanup = (0, scheduler_1.onSchedule)({
    schedule: '0 3 * * *',
    timeZone: 'Europe/Warsaw',
    region: 'europe-central2'
}, async () => {
    try {
        console.log('Starting daily maintenance cleanup...');
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        const cutoffTimestamp = firestore_2.Timestamp.fromDate(twelveMonthsAgo);
        console.log(`Deleting appointments older than: ${twelveMonthsAgo.toISOString()}`);
        const oldAppointmentsQuery = db.collection('appointments')
            .where('createdAt', '<', cutoffTimestamp);
        const oldAppointmentsSnapshot = await oldAppointmentsQuery.get();
        if (oldAppointmentsSnapshot.empty) {
            console.log('No old appointments found for cleanup');
            return;
        }
        console.log(`Found ${oldAppointmentsSnapshot.size} appointments to delete`);
        const batchSize = 500;
        const batches = [];
        for (let i = 0; i < oldAppointmentsSnapshot.docs.length; i += batchSize) {
            const batch = db.batch();
            const batchDocs = oldAppointmentsSnapshot.docs.slice(i, i + batchSize);
            batchDocs.forEach(doc => {
                batch.delete(doc.ref);
            });
            batches.push(batch);
        }
        await Promise.all(batches.map(batch => batch.commit()));
        console.log(`Successfully deleted ${oldAppointmentsSnapshot.size} old appointments`);
    }
    catch (error) {
        console.error('Error during daily maintenance cleanup:', error);
        throw error;
    }
});
// --- Database Management Functions ---
exports.deleteCollection = (0, https_1.onCall)({
    region: 'europe-central2'
}, async (request) => {
    try {
        // Verify admin authentication
        if (!request.auth || request.auth.token.firebase.sign_in_provider === 'anonymous') {
            throw new Error('Unauthorized: Admin access required');
        }
        const { collectionName } = request.data;
        if (!collectionName) {
            throw new Error('Collection name is required');
        }
        // Security check - prevent deletion of critical collections
        const allowedCollections = [
            'appointments',
            'services',
            'reservationTokens',
            'scheduleTemplates',
            'monthlySchedules',
            'blockedSlots',
            'templateAssignments',
            'mail',
            'contactMessages'
        ];
        if (!allowedCollections.includes(collectionName)) {
            throw new Error(`Collection "${collectionName}" is not allowed to be deleted`);
        }
        console.log(`Starting deletion of collection: ${collectionName}`);
        const collectionRef = db.collection(collectionName);
        const snapshot = await collectionRef.get();
        if (snapshot.empty) {
            return {
                success: true,
                deletedCount: 0,
                message: `Collection "${collectionName}" was already empty`
            };
        }
        console.log(`Found ${snapshot.size} documents to delete in collection: ${collectionName}`);
        // Delete in batches to avoid timeout
        const batchSize = 500;
        let deletedCount = 0;
        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
            const batch = db.batch();
            const batchDocs = snapshot.docs.slice(i, i + batchSize);
            batchDocs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += batchDocs.length;
            console.log(`Deleted batch: ${deletedCount}/${snapshot.size} documents`);
        }
        console.log(`Successfully deleted all ${deletedCount} documents from collection: ${collectionName}`);
        return {
            success: true,
            deletedCount,
            message: `Successfully deleted ${deletedCount} documents from collection "${collectionName}"`
        };
    }
    catch (error) {
        console.error('Error deleting collection:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
});
exports.deleteAnonymousUsers = (0, https_1.onCall)({
    region: 'europe-central2'
}, async (request) => {
    try {
        // Verify admin authentication
        if (!request.auth || request.auth.token.firebase.sign_in_provider === 'anonymous') {
            throw new Error('Unauthorized: Admin access required');
        }
        console.log('Starting deletion of anonymous users...');
        const auth = (0, auth_1.getAuth)();
        let deletedCount = 0;
        let nextPageToken;
        do {
            // List users in batches
            const listUsersResult = await auth.listUsers(1000, nextPageToken);
            // Filter anonymous users
            const anonymousUsers = listUsersResult.users.filter(user => user.providerData.length === 0 ||
                user.providerData.every(provider => provider.providerId === 'anonymous'));
            if (anonymousUsers.length > 0) {
                console.log(`Found ${anonymousUsers.length} anonymous users in this batch`);
                // Delete anonymous users in smaller batches
                const deletePromises = anonymousUsers.map(user => auth.deleteUser(user.uid).catch(error => {
                    console.warn(`Failed to delete user ${user.uid}:`, error);
                    return null;
                }));
                const results = await Promise.allSettled(deletePromises);
                const successfulDeletions = results.filter(result => result.status === 'fulfilled').length;
                deletedCount += successfulDeletions;
                console.log(`Deleted ${successfulDeletions} anonymous users from this batch`);
            }
            nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);
        console.log(`Successfully deleted ${deletedCount} anonymous users`);
        return {
            success: true,
            deletedCount,
            message: `Successfully deleted ${deletedCount} anonymous users`
        };
    }
    catch (error) {
        console.error('Error deleting anonymous users:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
});
//# sourceMappingURL=index.js.map