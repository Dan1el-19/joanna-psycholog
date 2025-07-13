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

// Email transporter configuration (using Gmail - free option)
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // Gmail address
      pass: process.env.EMAIL_APP_PASSWORD // Gmail app password
    }
  });
};

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

// Get all appointments (for admin use)
app.get('/appointments', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let query = db.collection('appointments').orderBy('createdAt', 'desc');
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    query = query.limit(parseInt(limit));
    
    const snapshot = await query.get();
    const appointments = [];
    
    snapshot.forEach(doc => {
      appointments.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      });
    });

    res.json({
      success: true,
      appointments,
      count: appointments.length
    });

  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      error: 'Failed to fetch appointments'
    });
  }
});

// Update appointment status
app.patch('/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: pending, confirmed, or cancelled'
      });
    }

    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (notes) {
      updateData.notes = notes;
    }

    await db.collection('appointments').doc(id).update(updateData);

    res.json({
      success: true,
      message: 'Appointment updated successfully'
    });

  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      error: 'Failed to update appointment'
    });
  }
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
      Psycholog</p>
      
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
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// Export the Express app as a Firebase Function
exports.api = onRequest(app);