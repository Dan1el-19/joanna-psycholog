/**
 * Firebase Cloud Functions for Appointment Email System
 * VERSION 2.1 - Complete Overhaul with Professional Email Templates for ALL functions
 */

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// --- Interfaces (Unchanged) ---

interface Appointment {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  service: string;
  preferredDate: string;
  preferredTime: string;
  confirmedDate?: string;
  confirmedTime?: string;
  message?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  isFirstSession: boolean;
  calculatedPrice?: number;
  basePrice?: number;
  originalServicePrice?: number;
  discount?: number;
  discountAmount?: number;
  reservationToken?: string;
  approvalEmailSent?: boolean;
  reminderEmailSent?: boolean;
  cancellationEmailSent?: boolean;
  rescheduleEmailSent?: boolean;
  paymentStatusEmailSent?: boolean;
  location?: string;
  adminNotes?: string;
  rescheduleCount?: number;
  originalDate?: string;
  originalTime?: string;
  cancelledBy?: 'client' | 'therapist' | 'system';
  cancellationReason?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  paymentMethod?: 'paypal' | 'transfer' | 'cash';
  sessionCompleted?: boolean;
  sessionCompletedDate?: Timestamp;
  isArchived?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

// ##################################################################
// # NEW PROFESSIONAL EMAIL TEMPLATE
// ##################################################################

const generateEmailHTML = (title: string, preheader: string, content: string): string => {
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
                      <p><strong>Joanna Rudzińska - Psycholog</strong></p>
                      <p>ul. Przykładowa 1, 90-001 Łódź</p>
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

export const sendAppointmentConfirmation = onDocumentCreated(
  {
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
  },
  async (event) => {
    try {
      const appointmentData = event.data?.data();
      const appointmentId = event.params.appointmentId;

      if (!appointmentData) {
        console.warn('No appointment data found');
        return;
      }

      console.log('Sending appointment confirmation for:', appointmentId);

      const augmentedData = await getAugmentedAppointmentData(appointmentData as Appointment);

      const reservationToken = generateUniqueToken();
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setMonth(tokenExpiresAt.getMonth() + 6);

      await event.data?.ref.update({
        calculatedPrice: augmentedData.calculatedPrice,
        originalServicePrice: augmentedData.originalServicePrice,
        basePrice: augmentedData.basePrice,
        isFirstSession: augmentedData.isFirstSession,
        discount: augmentedData.discount,
        discountAmount: augmentedData.discountAmount,
        pricingCalculatedAt: FieldValue.serverTimestamp(),
        reservationToken,
        tokenExpiresAt: Timestamp.fromDate(tokenExpiresAt)
      });
      
      await db.collection('reservationTokens').add({
        appointmentId,
        token: reservationToken,
        expiresAt: Timestamp.fromDate(tokenExpiresAt),
        createdAt: FieldValue.serverTimestamp(),
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
            ` : `
              <p style="font-size: 14px; color: #555; margin: 5px 0 0;">Regularna cena za ${augmentedData.serviceName}: ${augmentedData.basePrice} PLN</p>
            `}
        </div>

        <div class="section section-blue">
            <h3>Co dalej?</h3>
            <p>Możesz zarządzać swoją rezerwacją (zmienić termin lub ją anulować) korzystając z poniższego przycisku. Pamiętaj, że anulowanie jest możliwe do 24h przed wizytą.</p>
            <p style="margin-top: 20px;">
                <a href="https://myreflection.pl/manage-reservation/${reservationToken}" class="button">
                    Zarządzaj rezerwacją
                </a>
            </p>
        </div>

        <p>Serdecznie pozdrawiam,<br><strong>Joanna Rudzińska</strong></p>
      `;

      const clientEmailDoc = {
        to: augmentedData.email,
        message: {
          subject: 'Potwierdzenie zgłoszenia - Joanna Rudzińska Psycholog',
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

      await event.data?.ref.update({
        confirmationEmailSent: true,
        confirmationEmailSentAt: FieldValue.serverTimestamp()
      });

      console.log('Appointment confirmation emails sent successfully');

    } catch (error) {
      console.error('Error sending appointment confirmation:', error);
    }
  }
);

export const sendAppointmentApproval = onDocumentUpdated(
  {
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
  },
  async (event) => {
    try {
      const beforeData = event.data?.before.data() as Appointment;
      const afterData = event.data?.after.data() as Appointment;

      if (!beforeData || !afterData) return;

      if (
        beforeData.status !== 'confirmed' && 
        afterData.status === 'confirmed' && 
        !afterData.approvalEmailSent
      ) {
        console.log('Sending appointment approval email for:', event.params.appointmentId);

        const serviceData = await getServiceData(afterData.service);
        const serviceName = serviceData?.name || afterData.service;
        
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
            </div>

            <div class="section section-blue">
                <h3>Zarządzanie rezerwacją</h3>
                <p>W razie potrzeby, możesz zarządzać swoją rezerwacją (np. zmienić termin) korzystając z poniższego przycisku.</p>
                <p style="margin-top: 20px;">
                    <a href="https://myreflection.pl/manage-reservation/${afterData.reservationToken}" class="button">
                        Zarządzaj rezerwacją
                    </a>
                </p>
            </div>
            <p>Do zobaczenia,<br><strong>Joanna Rudzińska</strong></p>
        `;

        const approvalEmailDoc = {
          to: afterData.email,
          message: {
            subject: '✅ Wizyta potwierdzona - Joanna Rudzińska Psycholog',
            html: generateEmailHTML('Wizyta Potwierdzona', 'Twoja wizyta została potwierdzona.', approvalEmailContent)
          }
        };

        await db.collection('mail').add(approvalEmailDoc);

        await event.data?.after.ref.update({
          approvalEmailSent: true,
          approvalEmailSentAt: FieldValue.serverTimestamp()
        });

        console.log('Appointment approval email sent successfully');
      }
    } catch (error) {
      console.error('Error sending appointment approval email:', error);
    }
  }
);

export const sendAppointmentReminders = onSchedule(
  {
    schedule: '0 9 * * *',
    timeZone: 'Europe/Warsaw',
    region: 'europe-central2'
  },
  async () => {
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
        const appointment = doc.data() as Appointment;
        const serviceData = await getServiceData(appointment.service);
        
        const reminderContent = `
            <h2>Przypomnienie o wizycie</h2>
            <p>Dzień dobry ${appointment.name},</p>
            <p>Chciałabym przypomnieć o Państwa jutrzejszej wizycie.</p>
            <div class="section section-blue">
                <h3>Szczegóły wizyty</h3>
                <p><strong>Usługa:</strong> ${serviceData?.name || appointment.service}</p>
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
            <p>Do zobaczenia jutro!<br><strong>Joanna Rudzińska</strong></p>
        `;

        const reminderEmailDoc = {
          to: appointment.email,
          message: {
            subject: '📅 Przypomnienie o wizycie jutro - Joanna Rudzińska Psycholog',
            html: generateEmailHTML('Przypomnienie o wizycie', `Przypominamy o Twojej wizycie jutro o ${appointment.confirmedTime}.`, reminderContent)
          }
        };
        
        await db.collection('mail').add(reminderEmailDoc);
        await doc.ref.update({
          reminderEmailSent: true,
          reminderEmailSentAt: FieldValue.serverTimestamp()
        });
        console.log(`Sent reminder for appointment ${doc.id}`);
      }
      
      console.log(`Sent ${querySnapshot.size} reminder emails`);
      
    } catch (error) {
      console.error('Error sending appointment reminders:', error);
    }
  }
);

export const sendCancellationEmail = onDocumentUpdated(
  {
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
  },
  async (event) => {
    try {
      const beforeData = event.data?.before.data() as Appointment;
      const afterData = event.data?.after.data() as Appointment;

      if (!beforeData || !afterData) return;

      if (
        beforeData.status !== 'cancelled' && 
        afterData.status === 'cancelled' && 
        !afterData.cancellationEmailSent
      ) {
        const serviceData = await getServiceData(afterData.service);
        const originalDate = beforeData.preferredDate || beforeData.confirmedDate;
        const originalTime = beforeData.preferredTime || beforeData.confirmedTime;

        const cancellationContent = `
            <h2>Wizyta została anulowana</h2>
            <p>Dzień dobry ${afterData.name},</p>
            <p>Potwierdzam anulowanie Państwa wizyty. Jeśli to pomyłka lub chcieliby Państwo umówić nowy termin, proszę o kontakt.</p>
            <div class="section section-red">
                <h3>Szczegóły anulowanej wizyty</h3>
                <p><strong>Usługa:</strong> ${serviceData?.name || afterData.service}</p>
                <p><strong>Data:</strong> ${originalDate}</p>
                <p><strong>Godzina:</strong> ${originalTime}</p>
            </div>
            <p>Serdecznie pozdrawiam,<br><strong>Joanna Rudzińska</strong></p>
        `;

        const clientEmailDoc = {
          to: afterData.email,
          message: {
            subject: 'Anulowanie wizyty - Joanna Rudzińska',
            html: generateEmailHTML('Anulowanie wizyty', 'Twoja wizyta została anulowana.', cancellationContent)
          }
        };

        await db.collection('mail').add(clientEmailDoc);
        await event.data?.after.ref.update({
          cancellationEmailSent: true,
          cancellationEmailSentAt: FieldValue.serverTimestamp()
        });
        console.log(`Cancellation email sent for ${event.params.appointmentId}`);
      }
    } catch (error) {
      console.error('Error sending cancellation email:', error);
    }
  }
);

export const sendRescheduleEmail = onDocumentUpdated(
  {
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
  },
  async (event) => {
    try {
      const beforeData = event.data?.before.data() as Appointment;
      const afterData = event.data?.after.data() as Appointment;

      if (!beforeData || !afterData) return;

      const wasRescheduled = (
        (beforeData.preferredDate !== afterData.preferredDate || beforeData.preferredTime !== afterData.preferredTime) ||
        (beforeData.confirmedDate !== afterData.confirmedDate || beforeData.confirmedTime !== afterData.confirmedTime)
      );

      if (
        wasRescheduled && 
        (afterData.rescheduleCount || 0) > (beforeData.rescheduleCount || 0) &&
        !afterData.rescheduleEmailSent
      ) {
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
                <p><strong>Usługa:</strong> ${serviceData?.name || afterData.service}</p>
                <p><strong>Data:</strong> ${newDate}</p>
                <p><strong>Godzina:</strong> ${newTime}</p>
            </div>
            <p>Do zobaczenia w nowym terminie!<br><strong>Joanna Rudzińska</strong></p>
        `;

        const clientEmailDoc = {
          to: afterData.email,
          message: {
            subject: 'Przełożenie wizyty - Joanna Rudzińska',
            html: generateEmailHTML('Zmiana terminu wizyty', `Twoja wizyta została przełożona na ${newDate}.`, rescheduleContent)
          }
        };

        await db.collection('mail').add(clientEmailDoc);
        await event.data?.after.ref.update({
          rescheduleEmailSent: true,
          rescheduleEmailSentAt: FieldValue.serverTimestamp()
        });
        console.log('Reschedule email sent successfully');
      }
    } catch (error) {
      console.error('Error sending reschedule email:', error);
    }
  }
);

export const sendPaymentStatusEmail = onDocumentUpdated(
  {
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
  },
  async (event) => {
    try {
      const beforeData = event.data?.before.data() as Appointment;
      const afterData = event.data?.after.data() as Appointment;

      if (!beforeData || !afterData) return;

      if (
        beforeData.paymentStatus !== afterData.paymentStatus && 
        afterData.paymentStatus && 
        !afterData.paymentStatusEmailSent
      ) {
        console.log('Sending payment status email for:', event.params.appointmentId);

        let paymentContent = '';
        let subject = '';

        if (afterData.paymentStatus === 'paid') {
            subject = 'Potwierdzenie płatności - Joanna Rudzińska';
            paymentContent = `
                <h2>Płatność potwierdzona</h2>
                <p>Dzień dobry ${afterData.name},</p>
                <p>Potwierdzam otrzymanie płatności za wizytę. Dziękuję!</p>
                <div class="section section-green">
                    <h3>Szczegóły płatności</h3>
                    <p><strong>Kwota:</strong> ${afterData.calculatedPrice} PLN</p>
                    <p><strong>Status:</strong> Opłacona</p>
                </div>
                <p>Do zobaczenia na wizycie!<br><strong>Joanna Rudzińska</strong></p>
            `;
        } else if (afterData.paymentStatus === 'failed') {
            subject = 'Problem z płatnością - Joanna Rudzińska';
            paymentContent = `
                <h2>Problem z płatnością</h2>
                <p>Dzień dobry ${afterData.name},</p>
                <p>Informuję o problemie z płatnością za wizytę. Proszę spróbować ponownie lub skontaktować się ze mną w celu wyjaśnienia sytuacji.</p>
                <div class="section section-red">
                    <h3>Szczegóły płatności</h3>
                    <p><strong>Kwota:</strong> ${afterData.calculatedPrice} PLN</p>
                    <p><strong>Status:</strong> Nieudana</p>
                </div>
                <p>Z poważaniem,<br><strong>Joanna Rudzińska</strong></p>
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
            await event.data?.after.ref.update({
                paymentStatusEmailSent: true,
                paymentStatusEmailSentAt: FieldValue.serverTimestamp()
            });
            console.log('Payment status email sent successfully');
        }
      }
    } catch (error) {
      console.error('Error sending payment status email:', error);
    }
  }
);


// --- Helper Functions (Unchanged) ---

async function getAugmentedAppointmentData(appointmentData: Appointment) {
  const { service, email } = appointmentData;
  const serviceData = await getServiceData(service);
  const basePrice = serviceData?.price || 150;
  const serviceName = serviceData?.name || service;
  const serviceDuration = serviceData?.duration || 50;
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

async function hasCompletedSession(email: string): Promise<boolean> {
  try {
    const querySnapshot = await db.collection('appointments')
      .where('email', '==', email.toLowerCase())
      .where('sessionCompleted', '==', true)
      .limit(1)
      .get();
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking completed sessions:', error);
    return true;
  }
}

async function getServiceData(serviceId: string): Promise<{ name: string; price: number | null; duration: number; } | null> {
  try {
    const servicesSnapshot = await db.collection('services').get();
    const services: Service[] = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
    const serviceObj = services.find(s => s.id === serviceId);
    if (serviceObj) {
      return {
        name: serviceObj.name || serviceId,
        price: serviceObj.price || null,
        duration: serviceObj.duration || 50
      };
    }
  } catch (error) {
    console.error('Błąd podczas pobierania usług z bazy danych:', error);
  }
  return null;
}

function generateUniqueToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// --- Maintenance Functions (Unchanged) ---
export const dailyMaintenanceCleanup = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Europe/Warsaw',
    region: 'europe-central2'
  },
  async () => {
    try {
      console.log('Starting daily maintenance cleanup...');
      
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const cutoffTimestamp = Timestamp.fromDate(twelveMonthsAgo);
      
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
      
    } catch (error) {
      console.error('Error during daily maintenance cleanup:', error);
      throw error;
    }
  }
);
