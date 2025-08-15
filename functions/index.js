/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */
/* global process, exports */
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// ...existing code...

// Email transporter configuration (using Gmail - free option)
const createEmailTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Gmail address
    pass: process.env.EMAIL_APP_PASSWORD // Gmail app password
  }
});

// Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Appointment booking API is running' });
});

// Submit appointment request
app.post('/appointments', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      service,
      preferredDate,
      preferredTime,
      message
    } = req.body;

    // Validate required fields
    if (!name || !email || !service) {
      return res.status(400).json({
        error: 'Missing required fields: name, email, and service are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Create appointment document
    const appointmentData = {
      name,
      email,
      phone: phone || '',
      service,
      preferredDate: preferredDate || '',
      preferredTime: preferredTime || '',
      message: message || '',
      status: 'pending', // pending, confirmed, cancelled
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to Firestore
    const docRef = await db.collection('appointments').add(appointmentData);
    
    // Send confirmation email to client
    try {
      await sendConfirmationEmail(appointmentData);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the request if email fails
    }

    // Send notification email to therapist
    try {
      await sendNotificationEmail(appointmentData, docRef.id);
    } catch (emailError) {
      console.error('Notification email failed:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Appointment request submitted successfully',
      appointmentId: docRef.id
    });

  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to submit appointment request'
    });
  }
});

// Removed public admin listing endpoint for security: return 404
app.get('/appointments', (req, res) => {
  res.status(404).json({ success: false, error: 'Not available' });
});

// Removed legacy public availability endpoint in favor of secured implementation in the src/ TypeScript function
app.get('/public/availability', (req, res) => {
  res.status(404).json({ success: false, error: 'Not available' });
});

// Removed legacy update endpoint to avoid public modifications; admins should use the admin UI or secured APIs
app.patch('/appointments/:id', (req, res) => {
  res.status(404).json({ success: false, error: 'Not available' });
});

// Email sending functions
async function sendConfirmationEmail(appointmentData) {
  const transporter = createEmailTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: appointmentData.email,
    subject: 'Potwierdzenie zgłoszenia - Joanna Rudzińska-Łodyga',
    html: `
      <h2>Dziękuję za zgłoszenie!</h2>
      <p>Szanowna/Szanowny ${appointmentData.name},</p>
      
      <p>Otrzymałam Twoje zgłoszenie dotyczące umówienia wizyty. Poniżej znajdują się szczegóły:</p>
      
      <ul>
        <li><strong>Rodzaj usługi:</strong> ${getServiceName(appointmentData.service)}</li>
        <li><strong>Preferowany termin:</strong> ${appointmentData.preferredDate || 'Nie podano'}</li>
        <li><strong>Preferowana godzina:</strong> ${appointmentData.preferredTime || 'Nie podano'}</li>
        <li><strong>Telefon:</strong> ${appointmentData.phone || 'Nie podano'}</li>
      </ul>
      
      ${appointmentData.message ? `<p><strong>Dodatkowe informacje:</strong><br>${appointmentData.message}</p>` : ''}
      
      <p>Skontaktuję się z Tobą w ciągu 24 godzin w celu ustalenia szczegółów wizyty.</p>
      
      <p>Pozdrawiam serdecznie,<br>
      Joanna Rudzińska-Łodyga<br>
  Terapeuta</p>
      
      <hr>
      <p style="font-size: 12px; color: #666;">
        Ta wiadomość została wygenerowana automatycznie. Prosimy nie odpowiadać na ten email.
      </p>
    `
  };

  await transporter.sendMail(mailOptions);
}

async function sendNotificationEmail(appointmentData, appointmentId) {
  const transporter = createEmailTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.THERAPIST_EMAIL, // Therapist's email
    subject: `Nowe zgłoszenie wizyty - ${appointmentData.name}`,
    html: `
      <h2>Nowe zgłoszenie wizyty</h2>
      
      <p><strong>ID zgłoszenia:</strong> ${appointmentId}</p>
      <p><strong>Data zgłoszenia:</strong> ${new Date().toLocaleString('pl-PL')}</p>
      
      <h3>Dane klienta:</h3>
      <ul>
        <li><strong>Imię i nazwisko:</strong> ${appointmentData.name}</li>
        <li><strong>Email:</strong> ${appointmentData.email}</li>
        <li><strong>Telefon:</strong> ${appointmentData.phone || 'Nie podano'}</li>
      </ul>
      
      <h3>Szczegóły wizyty:</h3>
      <ul>
        <li><strong>Rodzaj usługi:</strong> ${getServiceName(appointmentData.service)}</li>
        <li><strong>Preferowany termin:</strong> ${appointmentData.preferredDate || 'Nie podano'}</li>
        <li><strong>Preferowana godzina:</strong> ${appointmentData.preferredTime || 'Nie podano'}</li>
      </ul>
      
      ${appointmentData.message ? `
        <h3>Dodatkowe informacje:</h3>
        <p>${appointmentData.message}</p>
      ` : ''}
      
      <p>Pamiętaj, aby skontaktować się z klientem w ciągu 24 godzin.</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

function getServiceName(serviceKey) {
  const services = {
    'terapia-indywidualna': 'Terapia indywidualna',
    'terapia-par': 'Terapia par i małżeństw',
    'konsultacje-online': 'Konsultacje online'
  };
  return services[serviceKey] || serviceKey;
}

// Error handling middleware
app.use((error, req, res) => {
  // keep minimal logging
  console.error('Unhandled error:', { message: String(error && error.message || error) });
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// Export the Express app as a Firebase Function
exports.api = onRequest(app);