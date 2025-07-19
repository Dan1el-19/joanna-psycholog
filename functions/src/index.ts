/**
 * Firebase Cloud Functions for Appointment Email System
 * Only handles appointment confirmations and admin notifications
 */

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

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

      // UŻYWAMY NASZEJ NOWEJ FUNKCJI
      const augmentedData = await getAugmentedAppointmentData(appointmentData);

      // Generujemy token
      const reservationToken = generateUniqueToken();
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setMonth(tokenExpiresAt.getMonth() + 6);

      // Zapisujemy wzbogacone dane w bazie
      await event.data?.ref.update({
        calculatedPrice: augmentedData.calculatedPrice,
        originalServicePrice: augmentedData.originalServicePrice,
        basePrice: augmentedData.basePrice, // Dla kompatybilności
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
      
      // Tworzymy maile używając danych z `augmentedData`
      const clientEmailDoc = {
        to: augmentedData.email,
        message: {
          subject: 'Potwierdzenie zgłoszenia - Joanna Rudzińska Psycholog',
          html: `
            <h2>Dziękuję za zgłoszenie!</h2>
            <p>Dzień dobry ${augmentedData.name},</p>
            <p>Otrzymałam Państwa zgłoszenie wizyty. Poniżej znajdą Państwo szczegóły:</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
              <h3 style="color: #007bff; margin-top: 0;">Szczegóły wizyty</h3>
              <p><strong>Usługa:</strong> ${augmentedData.serviceName}</p>
              <p><strong>Preferowana data:</strong> ${augmentedData.preferredDate || 'Do uzgodnienia'}</p>
              <p><strong>Preferowana godzina:</strong> ${augmentedData.preferredTime || 'Do uzgodnienia'}</p>
            </div>
            
            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="color: #155724; margin-top: 0;">Cena wizyty</h3>
              <p style="font-size: 18px; margin: 0;"><strong>Koszt: ${augmentedData.finalPrice} PLN</strong></p>
              ${augmentedData.isFirstSession ? `
                <p style="color: #28a745; font-weight: bold; margin: 10px 0;">🎉 Pierwsze spotkanie - 50% zniżki!</p>
                <p style="font-size: 14px; color: #6c757d; margin: 5px 0;">Regularna cena za ${augmentedData.serviceName}: ${augmentedData.basePrice} PLN</p>
              ` : `
                <p style="font-size: 14px; color: #6c757d; margin: 5px 0;">Regularna cena za ${augmentedData.serviceName}: ${augmentedData.basePrice} PLN</p>
              `}
            </div>
            
            <p><strong>Następne kroki:</strong> Skontaktuję się z Państwem w ciągu 24 godzin w celu ustalenia ostatecznego terminu spotkania.</p>
            
            <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
              <p style="text-align: center; margin: 15px 0;">
                <a href="https://myreflection.pl/manage-reservation/${reservationToken}" style="background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Zarządzaj rezerwacją
                </a>
              </p>
            </div>
            
            <p>Serdecznie pozdrawiam,<br><strong>Joanna Rudzińska</strong></p>
          `,
        }
      };
      // Send notification email to therapist
      const therapistEmailDoc = {
        to: 'j.rudzinska@myreflection.pl',
        message: {
              subject: `Nowa wizyta: ${augmentedData.name} - ${augmentedData.serviceName}`,
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
              <p><strong>Usługa:</strong> ${augmentedData.serviceName}</p>
              <p><strong>Preferowana data:</strong> ${appointmentData.preferredDate}</p>
              <p><strong>Preferowana godzina:</strong> ${appointmentData.preferredTime}</p>
              <p><strong>Cena:</strong> ${augmentedData.finalPrice} PLN ${augmentedData.isFirstSession ? '(pierwsze spotkanie - 50% taniej)' : '(standardowa cena)'}</p>
              ${appointmentData.message ? `<p><strong>Dodatkowe informacje:</strong> ${appointmentData.message}</p>` : ''}
            </div>
            
            <p><strong>Data zgłoszenia:</strong> ${new Date().toLocaleString('pl-PL')}</p>
          `,
          text: `Nowa wizyta od ${appointmentData.name} (${appointmentData.email}) na ${appointmentData.preferredDate} o ${appointmentData.preferredTime}`
        }
      };

      // Wysyłamy maile i aktualizujemy status
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

/**
 * Send appointment approval email when status changes to 'confirmed'
 */
export const sendAppointmentApproval = onDocumentUpdated(
  {
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
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

        // Use stored pricing information (calculated when appointment was created)
        const finalPrice = afterData.calculatedPrice || afterData.basePrice || 'do ustalenia';
        const originalPrice = afterData.originalServicePrice || afterData.basePrice;
        const isFirstSession = afterData.isFirstSession || false;

        // Get service data for email templates (single database call)
        const serviceData = await getServiceData(afterData.service);
        const serviceName = serviceData?.name || afterData.service;
        const serviceDuration = serviceData?.duration || 50;

        // Send approval email to client
        const approvalEmailDoc = {
          to: afterData.email,
          message: {
            subject: '✅ Wizyta potwierdzona - Joanna Rudzińska Psycholog',
            html: `
              <h2>Świetnie! Twoja wizyta została potwierdzona</h2>
              <p>Dzień dobry ${afterData.name},</p>
              <p>Z przyjemnością informuję, że Państwa wizyta została potwierdzona!</p>
              
              <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                <h3 style="color: #155724; margin-top: 0;">📅 Szczegóły potwierdzonej wizyty</h3>
                <p><strong>Usługa:</strong> ${serviceName}</p>
                <p><strong>📅 Data:</strong> ${afterData.confirmedDate || afterData.preferredDate}</p>
                <p><strong>🕐 Godzina:</strong> ${afterData.confirmedTime || afterData.preferredTime}</p>
                <p><strong>💰 Cena:</strong> ${finalPrice} PLN${isFirstSession ? ' <span style="color: #28a745;">(pierwsze spotkanie - 50% zniżki)</span>' : ''}</p>
                ${isFirstSession && originalPrice ? `<p style="font-size: 14px; color: #6c757d;"><strong>Regularna cena:</strong> ${originalPrice} PLN</p>` : ''}
                ${afterData.location ? `<p><strong>📍 Miejsce:</strong> ${afterData.location}</p>` : '<p><strong>📍 Miejsce:</strong> Informacje zostały przesłane oddzielnie</p>'}
                ${afterData.adminNotes ? `<p><strong>📝 Dodatkowe informacje:</strong> ${afterData.adminNotes}</p>` : ''}
              </div>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>⚠️ Ważne przypomnienia:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Wizyta trwa ${serviceDuration} minut</li>
                  <li>W razie potrzeby odwołania, proszę o kontakt minimum 24h wcześniej</li>
                  <li>Wszystkie rozmowy objęte są tajemnicą zawodową</li>
                </ul>
              </div>
              
              <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
                <h3 style="color: #1976d2; margin-top: 0;">🔗 Zarządzanie rezerwacją</h3>
                <p style="margin: 10px 0;">Możesz zmienić termin lub anulować wizytę klikając w poniższy link:</p>
                <p style="text-align: center; margin: 15px 0;">
                  <a href="https://myreflection.pl/manage-reservation/${afterData.reservationToken}" 
                     style="background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                    Zarządzaj rezerwacją
                  </a>
                </p>
                <p style="font-size: 12px; color: #666; margin: 10px 0;">
                  Anulowanie możliwe do 24h przed wizytą.
                </p>
              </div>
              
              <p>W razie pytań lub potrzeby zmiany terminu, proszę o kontakt pod tym adresem email.</p>
              
              <p>Cieszę się na nasze spotkanie!<br><br>
              <strong>Joanna Rudzińska</strong><br>
              Psycholog<br>
              📧 j.rudzinska@myreflection.pl</p>
            `,
            text: `Termin wizyty został potwierdzony. Usługa: ${serviceName}, Data: ${afterData.confirmedDate || afterData.preferredDate}, Godzina: ${afterData.confirmedTime || afterData.preferredTime}`
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
 * Pobiera pełne, wzbogacone dane wizyty.
 * Centralne miejsce dla logiki pobierania usług i kalkulacji ceny na backendzie.
 * @param {object} appointmentData Surowe dane wizyty z dokumentu Firestore.
 * @returns {Promise<object>} Obiekt z wszystkimi danymi potrzebnymi do zapisu w bazie i wysłania maila.
 */
async function getAugmentedAppointmentData(appointmentData: any) {
  // Pobieramy podstawowe dane z dokumentu wizyty
  const { service, email } = appointmentData;

  // 1. Pobierz dane usługi (korzystając z istniejącej funkcji pomocniczej getServiceData)
  const serviceData = await getServiceData(service);
  const basePrice = serviceData?.price || 150; // Cena bazowa z fallbackiem
  const serviceName = serviceData?.name || service;
  const serviceDuration = serviceData?.duration || 50;

  // 2. Sprawdź, czy to pierwsza sesja (korzystając z istniejącej funkcji pomocniczej hasCompletedSession)
  const hasCompletedBefore = await hasCompletedSession(email);
  const isFirstSession = !hasCompletedBefore;

  // 3. Oblicz ostateczną cenę
  const finalPrice = isFirstSession ? Math.round(basePrice * 0.5) : basePrice;
  const discountAmount = isFirstSession ? basePrice - finalPrice : 0;

  // 4. Zwróć jeden, spójny, wzbogacony obiekt
  return {
    ...appointmentData, // Zachowaj wszystkie oryginalne dane
    // Dodaj wzbogacone dane
    serviceName,
    serviceDuration,
    basePrice,
    finalPrice,
    isFirstSession,
    discount: isFirstSession ? 50 : 0,
    discountAmount,
    // Pola do zapisu w bazie
    calculatedPrice: finalPrice,
    originalServicePrice: basePrice,
  };
}

/**
 * Check if user has completed sessions before
 */
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
    return true; // If error, assume no discount
  }
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  // Tutaj możesz dodać inne pola, jeśli istnieją w kolekcji 'services'
}

/**
 * Get service data from database (similar to admin panel logic)
 */
async function getServiceData(serviceId: string): Promise<{ name: string; price: number | null; duration: number; } | null> {
  try {
    const servicesSnapshot = await db.collection('services').get();
    
    // Mapujemy dokumenty, jawnie tworząc obiekt zgodny z interfejsem Service
    const services: Service[] = servicesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '', // Dajemy domyślne wartości na wypadek braku danych
        price: data.price || 0,
        duration: data.duration || 50
      };
    });
    
    console.log('Dostępne usługi:', services);
    
    // Teraz TypeScript wie, że 's' jest typu Service, więc nie potrzebujemy ': any'
    const serviceObj = services.find(s => s.id === serviceId);
    
    if (serviceObj) {
      // Błędów już nie ma! TypeScript wie, że te pola istnieją.
      console.log(`Znaleziono usługę: ${serviceObj.name}, cena: ${serviceObj.price}`);
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

/**
 * Generate unique token for reservation management
 */
function generateUniqueToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Send reminder emails for appointments (runs daily at 9 AM)
 */
export const sendAppointmentReminders = onSchedule(
  {
    schedule: '0 9 * * *', // Every day at 9 AM
    timeZone: 'Europe/Warsaw',
    region: 'europe-central2'
  },
  async (event) => {
    try {
      console.log('Starting appointment reminder check...');
      
      // Get appointments for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      // Query for confirmed appointments tomorrow that haven't received reminders
      const appointmentsQuery = db.collection('appointments')
        .where('status', '==', 'confirmed')
        .where('confirmedDate', '==', tomorrowStr)
        .where('reminderEmailSent', '==', false);
      
      const querySnapshot = await appointmentsQuery.get();
      
      if (querySnapshot.empty) {
        console.log('No appointments need reminders today');
        return;
      }
      
      const emailPromises: Promise<any>[] = [];
      
      for (const doc of querySnapshot.docs) {
        const appointment = doc.data();
        const appointmentId = doc.id;
        
        console.log(`Sending reminder for appointment ${appointmentId}`);
        
        // Get service details (single database call)
        const serviceData = await getServiceData(appointment.service);
        const serviceName = serviceData?.name || appointment.service;
        const serviceDuration = serviceData?.duration || 50;
        
        // Create reminder email
        const reminderEmailDoc = {
          to: appointment.email,
          message: {
            subject: '📅 Przypomnienie o wizycie jutro - Joanna Rudzińska Psycholog',
            html: `
              <h2>Przypomnienie o wizycie</h2>
              <p>Dzień dobry ${appointment.name},</p>
              <p>Przypominam o jutrzejszej wizycie:</p>
              
              <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
                <h3 style="color: #1976d2; margin-top: 0;">📅 Szczegóły wizyty</h3>
                <p><strong>Usługa:</strong> ${serviceName}</p>
                <p><strong>📅 Data:</strong> ${appointment.confirmedDate}</p>
                <p><strong>🕐 Godzina:</strong> ${appointment.confirmedTime}</p>
                <p><strong>💰 Cena:</strong> ${appointment.calculatedPrice || appointment.basePrice || 'do ustalenia'} PLN</p>
                ${appointment.location ? `<p><strong>📍 Miejsce:</strong> ${appointment.location}</p>` : ''}
                ${appointment.adminNotes ? `<p><strong>📝 Dodatkowe informacje:</strong> ${appointment.adminNotes}</p>` : ''}
              </div>
              
              <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
                <p><strong>⚠️ Przypomnienia:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Wizyta trwa ${serviceDuration} minut</li>
                  <li>W razie potrzeby odwołania, proszę o kontakt do godz. ${appointment.confirmedTime}</li>
                  <li>Proszę być na czas lub kilka minut wcześniej</li>
                </ul>
              </div>
              
              <p>W razie pytań lub problemów z dotarciem, proszę o kontakt pod tym adresem email.</p>
              
              <p>Do zobaczenia jutro!<br><br>
              <strong>Joanna Rudzińska</strong><br>
              Psycholog<br>
              📧 j.rudzinska@myreflection.pl</p>
            `,
            text: `Przypomnienie o wizycie jutro (${appointment.confirmedDate} o ${appointment.confirmedTime}). ${serviceName}. Do zobaczenia!`
          }
        };
        
        // Add email to mail collection and update appointment
        emailPromises.push(
          Promise.all([
            db.collection('mail').add(reminderEmailDoc),
            doc.ref.update({
              reminderEmailSent: true,
              reminderEmailSentAt: FieldValue.serverTimestamp()
            })
          ])
        );
      }
      
      await Promise.all(emailPromises);
      
      console.log(`Sent ${emailPromises.length} reminder emails`);
      
    } catch (error) {
      console.error('Error sending appointment reminders:', error);
    }
  }
);

/**
 * Manual function to send appointment reminders (for testing)
 */
export const sendAppointmentRemindersManual = onDocumentCreated(
  {
    document: 'triggers/sendReminders',
    region: 'europe-central2'
  },
  async (event) => {
    try {
      console.log('Manual reminder trigger activated');
      
      // Get appointments for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      // Query for confirmed appointments tomorrow that haven't received reminders
      const appointmentsQuery = db.collection('appointments')
        .where('status', '==', 'confirmed')
        .where('confirmedDate', '==', tomorrowStr)
        .where('reminderEmailSent', '!=', true);
      
      const querySnapshot = await appointmentsQuery.get();
      
      if (querySnapshot.empty) {
        console.log('No appointments need reminders');
        return;
      }
      
      const emailPromises: Promise<any>[] = [];
      
      for (const doc of querySnapshot.docs) {
        const appointment = doc.data();
        const appointmentId = doc.id;
        
        console.log(`Sending manual reminder for appointment ${appointmentId}`);
        
        // Get service details (single database call)
        const serviceData = await getServiceData(appointment.service);
        const serviceName = serviceData?.name || appointment.service;
        const serviceDuration = serviceData?.duration || 50;
        
        // Create reminder email (same as scheduled version)
        const reminderEmailDoc = {
          to: appointment.email,
          message: {
            subject: '📅 Przypomnienie o wizycie jutro - Joanna Rudzińska Psycholog',
            html: `
              <h2>Przypomnienie o wizycie</h2>
              <p>Dzień dobry ${appointment.name},</p>
              <p>Przypominam o jutrzejszej wizycie:</p>
              
              <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
                <h3 style="color: #1976d2; margin-top: 0;">📅 Szczegóły wizyty</h3>
                <p><strong>Usługa:</strong> ${serviceName}</p>
                <p><strong>📅 Data:</strong> ${appointment.confirmedDate}</p>
                <p><strong>🕐 Godzina:</strong> ${appointment.confirmedTime}</p>
                <p><strong>💰 Cena:</strong> ${appointment.calculatedPrice || appointment.basePrice || 'do ustalenia'} PLN</p>
                ${appointment.location ? `<p><strong>📍 Miejsce:</strong> ${appointment.location}</p>` : ''}
                ${appointment.adminNotes ? `<p><strong>📝 Dodatkowe informacje:</strong> ${appointment.adminNotes}</p>` : ''}
              </div>
              
              <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
                <p><strong>⚠️ Przypomnienia:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Wizyta trwa ${serviceDuration} minut</li>
                  <li>W razie potrzeby odwołania, proszę o kontakt do godz. ${appointment.confirmedTime}</li>
                  <li>Proszę być na czas lub kilka minut wcześniej</li>
                </ul>
              </div>
              
              <p>W razie pytań lub problemów z dotarciem, proszę o kontakt pod tym adresem email.</p>
              
              <p>Do zobaczenia jutro!<br><br>
              <strong>Joanna Rudzińska</strong><br>
              Psycholog<br>
              📧 j.rudzinska@myreflection.pl</p>
            `,
            text: `Przypomnienie o wizycie jutro (${appointment.confirmedDate} o ${appointment.confirmedTime}). ${serviceName}. Do zobaczenia!`
          }
        };
        
        // Add email to mail collection and update appointment
        emailPromises.push(
          Promise.all([
            db.collection('mail').add(reminderEmailDoc),
            doc.ref.update({
              reminderEmailSent: true,
              reminderEmailSentAt: FieldValue.serverTimestamp()
            })
          ])
        );
      }
      
      await Promise.all(emailPromises);
      
      console.log(`Sent ${emailPromises.length} manual reminder emails`);
      
    } catch (error) {
      console.error('Error sending manual appointment reminders:', error);
    }
  }
);

/**
 * Send email when appointment is cancelled
 */
export const sendCancellationEmail = onDocumentUpdated(
  {
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
  },
  async (event) => {
    try {
      const beforeData = event.data?.before.data();
      const afterData = event.data?.after.data();
      const appointmentId = event.params.appointmentId;

      if (!beforeData || !afterData) {
        return;
      }

      // Check if status changed to 'cancelled' and cancellation email hasn't been sent
      if (
        beforeData.status !== 'cancelled' && 
        afterData.status === 'cancelled' && 
        !afterData.cancellationEmailSent
      ) {
        console.log('Sending cancellation email for:', appointmentId);

        const cancellationReason = afterData.cancellationReason || 'Brak podanego powodu';
        const cancelledBy = afterData.cancelledBy || 'system';
        const originalDate = beforeData.preferredDate || beforeData.confirmedDate;
        const originalTime = beforeData.preferredTime || beforeData.confirmedTime;

        // Get service name for email templates
        const serviceData = await getServiceData(afterData.service);
        const serviceName = serviceData?.name || afterData.service;

        // Send cancellation email to client
        const clientEmailDoc = {
          to: afterData.email,
          message: {
            subject: 'Anulowanie wizyty - Joanna Rudzińska',
            html: `
              <h2>Anulowanie wizyty</h2>
              <p>Dzień dobry ${afterData.name},</p>
              <p>Informuję, że wizyta została anulowana.</p>
              
              <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
                <h3 style="color: #d32f2f; margin-top: 0;">❌ Anulowana wizyta</h3>
                <p><strong>Usługa:</strong> ${serviceName}</p>
                <p><strong>📅 Data:</strong> ${originalDate}</p>
                <p><strong>🕐 Godzina:</strong> ${originalTime}</p>
                <p><strong>Anulowane przez:</strong> ${cancelledBy === 'client' ? 'Klienta' : 'Terapeutę'}</p>
                ${cancellationReason !== 'Brak podanego powodu' ? `<p><strong>Powód:</strong> ${cancellationReason}</p>` : ''}
              </div>
              
              <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
                <p><strong>💡 Co dalej?</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>W razie pytań lub chęci umówienia nowej wizyty, proszę o kontakt</li>
                  <li>Jeśli dokonano płatności, zostanie zwrócona w ciągu 3-5 dni roboczych</li>
                  <li>Zapraszam do skorzystania z moich usług w przyszłości</li>
                </ul>
              </div>
              
              <p>Serdecznie pozdrawiam,<br>
              <strong>Joanna Rudzińska</strong><br>
              Psycholog<br>
              📧 j.rudzinska@myreflection.pl</p>
            `,
            text: `Wizyta ${serviceName} na ${originalDate} o ${originalTime} została anulowana. Powód: ${cancellationReason}`
          }
        };

        // Send notification to therapist
        const therapistEmailDoc = {
          to: 'j.rudzinska@myreflection.pl',
          message: {
            subject: `ANULOWANIE: ${afterData.name} - ${serviceName}`,
            html: `
              <h2>Anulowanie wizyty</h2>
              
              <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Anulowana wizyta:</h3>
                <p><strong>Klient:</strong> ${afterData.name} (${afterData.email})</p>
                <p><strong>Usługa:</strong> ${serviceName}</p>
                <p><strong>Data:</strong> ${originalDate} o ${originalTime}</p>
                <p><strong>Anulowane przez:</strong> ${cancelledBy === 'client' ? 'Klienta' : 'Administratora'}</p>
                <p><strong>Powód:</strong> ${cancellationReason}</p>
              </div>
              
              <p><strong>Data anulowania:</strong> ${new Date().toLocaleString('pl-PL')}</p>
            `,
            text: `Anulowanie wizyty: ${afterData.name} - ${originalDate} o ${originalTime}. Powód: ${cancellationReason}`
          }
        };

        // Add emails to mail collection and update appointment
        await Promise.all([
          db.collection('mail').add(clientEmailDoc),
          db.collection('mail').add(therapistEmailDoc),
          event.data?.after.ref.update({
            cancellationEmailSent: true,
            cancellationEmailSentAt: FieldValue.serverTimestamp()
          })
        ]);

        console.log('Cancellation emails sent successfully');
      }

    } catch (error) {
      console.error('Error sending cancellation email:', error);
    }
  }
);

/**
 * Send email when appointment is rescheduled
 */
export const sendRescheduleEmail = onDocumentUpdated(
  {
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
  },
  async (event) => {
    try {
      const beforeData = event.data?.before.data();
      const afterData = event.data?.after.data();
      const appointmentId = event.params.appointmentId;

      if (!beforeData || !afterData) {
        return;
      }

      // Check if appointment was rescheduled (date or time changed) and reschedule email hasn't been sent
      const wasRescheduled = (
        (beforeData.preferredDate !== afterData.preferredDate || beforeData.preferredTime !== afterData.preferredTime) ||
        (beforeData.confirmedDate !== afterData.confirmedDate || beforeData.confirmedTime !== afterData.confirmedTime)
      );

      if (
        wasRescheduled && 
        afterData.rescheduleCount > (beforeData.rescheduleCount || 0) &&
        !afterData.rescheduleEmailSent
      ) {
        console.log('Sending reschedule email for:', appointmentId);

        const originalDate = afterData.originalDate || beforeData.preferredDate || beforeData.confirmedDate;
        const originalTime = afterData.originalTime || beforeData.preferredTime || beforeData.confirmedTime;
        const newDate = afterData.preferredDate || afterData.confirmedDate;
        const newTime = afterData.preferredTime || afterData.confirmedTime;

        // Get service name for email templates
        const serviceData = await getServiceData(afterData.service);
        const serviceName = serviceData?.name || afterData.service;

        // Send reschedule email to client
        const clientEmailDoc = {
          to: afterData.email,
          message: {
            subject: 'Przełożenie wizyty - Joanna Rudzińska',
            html: `
              <h2>Przełożenie wizyty</h2>
              <p>Dzień dobry ${afterData.name},</p>
              <p>Informuję o przełożeniu Państwa wizyty na nowy termin.</p>
              
              <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
                <h3 style="color: #f57c00; margin-top: 0;">📅 Poprzedni termin</h3>
                <p><strong>Data:</strong> ${originalDate}</p>
                <p><strong>Godzina:</strong> ${originalTime}</p>
              </div>
              
              <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
                <h3 style="color: #2e7d32; margin-top: 0;">✅ Nowy termin</h3>
                <p><strong>Usługa:</strong> ${serviceName}</p>
                <p><strong>📅 Data:</strong> ${newDate}</p>
                <p><strong>🕐 Godzina:</strong> ${newTime}</p>
                <p><strong>💰 Cena:</strong> ${afterData.calculatedPrice || afterData.basePrice || 'do ustalenia'} PLN</p>
              </div>
              
              <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
                <p><strong>ℹ️ Ważne informacje:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Proszę zaktualizować swój kalendarz</li>
                  <li>W razie pytań lub problemów, proszę o kontakt</li>
                  <li>Przypomnienie zostanie wysłane dzień przed wizytą</li>
                </ul>
              </div>
              
              <p>Dziękuję za zrozumienie i do zobaczenia w nowym terminie!<br><br>
              <strong>Joanna Rudzińska</strong><br>
              Psycholog<br>
              📧 j.rudzinska@myreflection.pl</p>
            `,
            text: `Wizyta ${serviceName} została przełożona z ${originalDate} ${originalTime} na ${newDate} ${newTime}.`
          }
        };

        // Send notification to therapist
        const therapistEmailDoc = {
          to: 'j.rudzinska@myreflection.pl',
          message: {
            subject: `PRZEŁOŻENIE: ${afterData.name} - ${serviceName}`,
            html: `
              <h2>Przełożenie wizyty</h2>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Przełożona wizyta:</h3>
                <p><strong>Klient:</strong> ${afterData.name} (${afterData.email})</p>
                <p><strong>Usługa:</strong> ${serviceName}</p>
                <p><strong>Poprzedni termin:</strong> ${originalDate} o ${originalTime}</p>
                <p><strong>Nowy termin:</strong> ${newDate} o ${newTime}</p>
                <p><strong>Liczba przełożeń:</strong> ${afterData.rescheduleCount}</p>
              </div>
              
              <p><strong>Data przełożenia:</strong> ${new Date().toLocaleString('pl-PL')}</p>
            `,
            text: `Przełożenie wizyty: ${afterData.name} z ${originalDate} ${originalTime} na ${newDate} ${newTime}`
          }
        };

        // Add emails to mail collection and update appointment
        await Promise.all([
          db.collection('mail').add(clientEmailDoc),
          db.collection('mail').add(therapistEmailDoc),
          event.data?.after.ref.update({
            rescheduleEmailSent: true,
            rescheduleEmailSentAt: FieldValue.serverTimestamp()
          })
        ]);

        console.log('Reschedule emails sent successfully');
      }

    } catch (error) {
      console.error('Error sending reschedule email:', error);
    }
  }
);

/**
 * Send email when payment status is updated
 */
export const sendPaymentStatusEmail = onDocumentUpdated(
  {
    document: 'appointments/{appointmentId}',
    region: 'europe-central2'
  },
  async (event) => {
    try {
      const beforeData = event.data?.before.data();
      const afterData = event.data?.after.data();
      const appointmentId = event.params.appointmentId;

      if (!beforeData || !afterData) {
        return;
      }

      // Check if payment status changed and payment email hasn't been sent for this status
      if (
        beforeData.paymentStatus !== afterData.paymentStatus && 
        afterData.paymentStatus && 
        !afterData.paymentStatusEmailSent
      ) {
        console.log('Sending payment status email for:', appointmentId);

        const paymentMethod = afterData.paymentMethod || 'nie określono';
        const appointmentDate = afterData.confirmedDate || afterData.preferredDate;
        const appointmentTime = afterData.confirmedTime || afterData.preferredTime;
        const price = afterData.calculatedPrice || afterData.basePrice || 'do ustalenia';

        // Get service name for email templates
        const serviceData = await getServiceData(afterData.service);
        const serviceName = serviceData?.name || afterData.service;

        let clientEmailDoc;

        if (afterData.paymentStatus === 'paid') {
          // Payment confirmed
          clientEmailDoc = {
            to: afterData.email,
            message: {
              subject: 'Potwierdzenie płatności - Joanna Rudzińska',
              html: `
                <h2>Płatność potwierdzona ✅</h2>
                <p>Dzień dobry ${afterData.name},</p>
                <p>Potwierdzam otrzymanie płatności za wizytę.</p>
                
                <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
                  <h3 style="color: #2e7d32; margin-top: 0;">💳 Szczegóły płatności</h3>
                  <p><strong>Kwota:</strong> ${price} PLN</p>
                  <p><strong>Sposób płatności:</strong> ${paymentMethod}</p>
                  <p><strong>Status:</strong> Opłacona ✅</p>
                  <p><strong>Data potwierdzenia:</strong> ${new Date().toLocaleDateString('pl-PL')}</p>
                </div>
                
                <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
                  <h3 style="color: #1976d2; margin-top: 0;">📅 Szczegóły wizyty</h3>
                  <p><strong>Usługa:</strong> ${serviceName}</p>
                  <p><strong>📅 Data:</strong> ${appointmentDate}</p>
                  <p><strong>🕐 Godzina:</strong> ${appointmentTime}</p>
                </div>
                
                <p>Dziękuję za płatność. Do zobaczenia na wizycie!<br><br>
                <strong>Joanna Rudzińska</strong><br>
                Psycholog<br>
                📧 j.rudzinska@myreflection.pl</p>
              `,
              text: `Płatność ${price} PLN za wizytę ${serviceName} została potwierdzona.`
            }
          };
        } else if (afterData.paymentStatus === 'failed') {
          // Payment failed
          clientEmailDoc = {
            to: afterData.email,
            message: {
              subject: 'Problem z płatnością - Joanna Rudzińska',
              html: `
                <h2>Problem z płatnością ⚠️</h2>
                <p>Dzień dobry ${afterData.name},</p>
                <p>Informuję o problemie z płatnością za wizytę.</p>
                
                <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
                  <h3 style="color: #d32f2f; margin-top: 0;">❌ Status płatności</h3>
                  <p><strong>Kwota:</strong> ${price} PLN</p>
                  <p><strong>Sposób płatności:</strong> ${paymentMethod}</p>
                  <p><strong>Status:</strong> Nieudana ❌</p>
                </div>
                
                <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
                  <p><strong>🔄 Co robić dalej?</strong></p>
                  <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Proszę spróbować ponownie dokonać płatności</li>
                    <li>Sprawdź dane karty i dostępne środki</li>
                    <li>W przypadku dalszych problemów, proszę o kontakt</li>
                    <li>Możliwa jest płatność gotówką na miejscu</li>
                  </ul>
                </div>
                
                <p>Proszę o kontakt w przypadku pytań.<br><br>
                <strong>Joanna Rudzińska</strong><br>
                Psycholog<br>
                📧 j.rudzinska@myreflection.pl</p>
              `,
              text: `Problem z płatnością ${price} PLN za wizytę ${serviceName}. Proszę spróbować ponownie.`
            }
          };
        }

        if (clientEmailDoc) {
          // Send notification to therapist
          const therapistEmailDoc = {
            to: 'j.rudzinska@myreflection.pl',
            message: {
              subject: `PŁATNOŚĆ ${afterData.paymentStatus.toUpperCase()}: ${afterData.name}`,
              html: `
                <h2>Aktualizacja płatności</h2>
                
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3>Status płatności:</h3>
                  <p><strong>Klient:</strong> ${afterData.name} (${afterData.email})</p>
                  <p><strong>Usługa:</strong> ${serviceName}</p>
                  <p><strong>Kwota:</strong> ${price} PLN</p>
                  <p><strong>Status:</strong> ${afterData.paymentStatus}</p>
                  <p><strong>Sposób płatności:</strong> ${paymentMethod}</p>
                </div>
                
                <p><strong>Data aktualizacji:</strong> ${new Date().toLocaleString('pl-PL')}</p>
              `,
              text: `Płatność ${afterData.paymentStatus}: ${afterData.name} - ${price} PLN`
            }
          };

          // Add emails to mail collection and update appointment
          await Promise.all([
            db.collection('mail').add(clientEmailDoc),
            db.collection('mail').add(therapistEmailDoc),
            event.data?.after.ref.update({
              paymentStatusEmailSent: true,
              paymentStatusEmailSentAt: FieldValue.serverTimestamp()
            })
          ]);

          console.log('Payment status emails sent successfully');
        }
      }

    } catch (error) {
      console.error('Error sending payment status email:', error);
    }
  }
);

/**
 * Daily cleanup job - runs every day at 3 AM CET
 * Removes appointments older than 12 months
 */
export const dailyMaintenanceCleanup = onSchedule(
  {
    schedule: '0 3 * * *',  // Every day at 3 AM
    timeZone: 'Europe/Warsaw',
    region: 'europe-central2'
  },
  async () => {
    try {
      console.log('Starting daily maintenance cleanup...');
      
      // Calculate date 12 months ago
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const cutoffTimestamp = Timestamp.fromDate(twelveMonthsAgo);
      
      console.log(`Deleting appointments older than: ${twelveMonthsAgo.toISOString()}`);
      
      // Query for old appointments
      const oldAppointmentsQuery = db.collection('appointments')
        .where('createdAt', '<', cutoffTimestamp);
      
      const oldAppointmentsSnapshot = await oldAppointmentsQuery.get();
      
      if (oldAppointmentsSnapshot.empty) {
        console.log('No old appointments found for cleanup');
        return;
      }
      
      console.log(`Found ${oldAppointmentsSnapshot.size} appointments to delete`);
      
      // Delete in batches to avoid timeout
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
      
      // Execute all batches
      await Promise.all(batches.map(batch => batch.commit()));
      
      console.log(`Successfully deleted ${oldAppointmentsSnapshot.size} old appointments`);
      
      // Also cleanup expired temporary blocks
      const expiredBlocksQuery = db.collection('temporaryBlocks')
        .where('expiresAt', '<', Timestamp.now());
      
      const expiredBlocksSnapshot = await expiredBlocksQuery.get();
      
      if (!expiredBlocksSnapshot.empty) {
        console.log(`Found ${expiredBlocksSnapshot.size} expired blocks to delete`);
        
        const blockBatches = [];
        for (let i = 0; i < expiredBlocksSnapshot.docs.length; i += batchSize) {
          const batch = db.batch();
          const batchDocs = expiredBlocksSnapshot.docs.slice(i, i + batchSize);
          
          batchDocs.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          blockBatches.push(batch);
        }
        
        await Promise.all(blockBatches.map(batch => batch.commit()));
        console.log(`Successfully deleted ${expiredBlocksSnapshot.size} expired temporary blocks`);
      }
      
      console.log('Daily maintenance cleanup completed successfully');
      
    } catch (error) {
      console.error('Error during daily maintenance cleanup:', error);
      throw error;
    }
  }
);