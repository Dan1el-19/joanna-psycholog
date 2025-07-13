/**
 * Firebase Cloud Functions for Appointment Email System
 * Only handles appointment confirmations and admin notifications
 */

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

/**
 * Send appointment confirmation email when appointment is created
 */
export const sendAppointmentConfirmation = onDocumentCreated(
  {
    document: 'appointments/{appointmentId}',
    region: 'europe-west1'
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

      // Send confirmation email to client
      const clientEmailDoc = {
        to: appointmentData.email,
        message: {
          subject: 'Potwierdzenie zgłoszenia wizyty - Joanna Rudzińska',
          html: `
            <h2>Potwierdzenie zgłoszenia wizyty</h2>
            <p>Dzień dobry ${appointmentData.name},</p>
            <p>Dziękuję za zgłoszenie wizyty. Oto szczegóły Twojej prośby:</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Szczegóły wizyty:</h3>
              <p><strong>Usługa:</strong> ${getServiceName(appointmentData.service)}</p>
              <p><strong>Preferowana data:</strong> ${appointmentData.preferredDate}</p>
              <p><strong>Preferowana godzina:</strong> ${appointmentData.preferredTime}</p>
              ${appointmentData.phone ? `<p><strong>Telefon:</strong> ${appointmentData.phone}</p>` : ''}
              ${appointmentData.message ? `<p><strong>Dodatkowe informacje:</strong> ${appointmentData.message}</p>` : ''}
            </div>
            
            <p>Skontaktuję się z Państwem w ciągu 24 godzin w celu potwierdzenia terminu.</p>
            
            <p>Z poważaniem,<br>
            Joanna Rudzińska<br>
            Psycholog</p>
          `,
          text: `Dziękuję za zgłoszenie wizyty. Usługa: ${getServiceName(appointmentData.service)}, Data: ${appointmentData.preferredDate}, Godzina: ${appointmentData.preferredTime}. Skontaktuję się z Państwem w ciągu 24 godzin.`
        }
      };

      // Send notification email to therapist
      const therapistEmailDoc = {
        to: 'j.rudzinska@myreflection.pl', // Zmień na prawdziwy adres email
        message: {
          subject: `Nowa wizyta: ${appointmentData.name} - ${getServiceName(appointmentData.service)}`,
          html: `
            <h2>Nowa wizyta - ${appointmentData.name}</h2>
            
            <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Dane klienta:</h3>
              <p><strong>Imię i nazwisko:</strong> ${appointmentData.name}</p>
              <p><strong>Email:</strong> ${appointmentData.email}</p>
              ${appointmentData.phone ? `<p><strong>Telefon:</strong> ${appointmentData.phone}</p>` : ''}
            </div>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>Szczegóły wizyty:</h3>
              <p><strong>Usługa:</strong> ${getServiceName(appointmentData.service)}</p>
              <p><strong>Preferowana data:</strong> ${appointmentData.preferredDate}</p>
              <p><strong>Preferowana godzina:</strong> ${appointmentData.preferredTime}</p>
              ${appointmentData.message ? `<p><strong>Dodatkowe informacje:</strong> ${appointmentData.message}</p>` : ''}
            </div>
            
            <p><strong>Data zgłoszenia:</strong> ${new Date().toLocaleString('pl-PL')}</p>
          `,
          text: `Nowa wizyta od ${appointmentData.name} (${appointmentData.email}) na ${appointmentData.preferredDate} o ${appointmentData.preferredTime}`
        }
      };

      // Add emails to mail collection (triggers extension)
      await Promise.all([
        db.collection('mail').add(clientEmailDoc),
        db.collection('mail').add(therapistEmailDoc)
      ]);

      // Update appointment with email status
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

/**
 * Send appointment approval email when status changes to 'confirmed'
 */
export const sendAppointmentApproval = onDocumentUpdated(
  {
    document: 'appointments/{appointmentId}',
    region: 'europe-west1'
  },
  async (event) => {
    try {
      const beforeData = event.data?.before.data();
      const afterData = event.data?.after.data();
      const appointmentId = event.params.appointmentId;

      if (!beforeData || !afterData) {
        return;
      }

      // Check if status changed to 'confirmed' and approval email hasn't been sent
      if (
        beforeData.status !== 'confirmed' && 
        afterData.status === 'confirmed' && 
        !afterData.approvalEmailSent
      ) {
        console.log('Sending appointment approval email for:', appointmentId);

        // Send approval email to client
        const approvalEmailDoc = {
          to: afterData.email,
          message: {
            subject: 'Potwierdzenie terminu wizyty - Joanna Rudzińska',
            html: `
              <h2>Termin wizyty został potwierdzony</h2>
              <p>Dzień dobry ${afterData.name},</p>
              <p>Miło mi poinformować, że Twój termin wizyty został potwierdzony:</p>
              
              <div style="background-color: #e7f5e7; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                <h3>Potwierdzone szczegóły wizyty:</h3>
                <p><strong>Usługa:</strong> ${getServiceName(afterData.service)}</p>
                <p><strong>Data:</strong> ${afterData.confirmedDate || afterData.preferredDate}</p>
                <p><strong>Godzina:</strong> ${afterData.confirmedTime || afterData.preferredTime}</p>
                ${afterData.location ? `<p><strong>Miejsce:</strong> ${afterData.location}</p>` : ''}
                ${afterData.adminNotes ? `<p><strong>Dodatkowe informacje:</strong> ${afterData.adminNotes}</p>` : ''}
              </div>
              
              <p>W przypadku pytań lub konieczności zmiany terminu, proszę o kontakt.</p>
              
              <p>Do zobaczenia!<br>
              Joanna Rudzińska<br>
              Psycholog<br>
              j.rudzinska@myreflection.pl</p>
            `,
            text: `Termin wizyty został potwierdzony. Usługa: ${getServiceName(afterData.service)}, Data: ${afterData.confirmedDate || afterData.preferredDate}, Godzina: ${afterData.confirmedTime || afterData.preferredTime}`
          }
        };

        // Add email to mail collection
        await db.collection('mail').add(approvalEmailDoc);

        // Update appointment with approval email status
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

/**
 * Helper function to get service display name
 */
function getServiceName(serviceCode: string): string {
  const services: Record<string, string> = {
    'terapia-indywidualna': 'Terapia indywidualna',
    'terapia-par': 'Terapia par', 
    'konsultacje-online': 'Konsultacje online'
  };
  return services[serviceCode] || serviceCode;
}