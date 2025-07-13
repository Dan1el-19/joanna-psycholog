# Joanna Rudzińska-Łodyga - Psychologist Website

A professional website for a psychologist practice with appointment booking functionality.

## Features

- Responsive design with Tailwind CSS
- Appointment booking system
- Firebase hosting and backend
- Email notifications
- Modern UI with animations

## Tech Stack

- **Frontend**: HTML, CSS (Tailwind), JavaScript, AOS animations
- **Backend**: Node.js, Express.js, Firebase Functions
- **Database**: Firestore (NoSQL)
- **Hosting**: Firebase Hosting
- **Email**: Nodemailer with Gmail

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Firebase CLI
- Gmail account for email notifications

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Install Firebase CLI globally:
```bash
npm install -g firebase-tools
```

3. Login to Firebase:
```bash
firebase login
```

4. Initialize Firebase project:
```bash
firebase init
```
Select:
- Functions (Node.js)
- Firestore
- Hosting

5. Install function dependencies:
```bash
cd functions
npm install
```

### Configuration

1. Set up Firebase configuration:
   - Copy `src/firebase-config.example.js` to `src/firebase-config.js`
   - Get your Firebase config from Firebase Console
   - Replace the configuration object with your actual values

2. Set up email configuration:
   - Copy `functions/.env.example` to `functions/.env`
   - Configure Gmail credentials:
     - Enable 2-factor authentication in Gmail
     - Generate an app password
     - Update `.env` with your credentials

3. Update Firebase project ID in `.firebaserc` (create this file):
```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

### Development

1. Start local development server:
```bash
npm run dev
```

2. Start Firebase emulators for testing functions:
```bash
firebase emulators:start
```

### Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy to Firebase:
```bash
firebase deploy
```

## Project Structure

```
├── src/                    # Frontend source files
│   ├── style.css          # Main styles
│   ├── main.js           # Main JavaScript
│   └── appointment.js    # Appointment booking logic
├── main/                  # HTML pages
│   ├── o-mnie.html       # About page
│   ├── oferta.html       # Services page
│   ├── umow-wizyte.html  # Appointment booking page
│   └── kontakt.html      # Contact page
├── public/               # Static assets
│   └── partials/         # Reusable HTML components
├── functions/            # Firebase Functions (backend)
│   ├── index.js         # Main API endpoints
│   └── package.json     # Function dependencies
├── dist/                # Built files for deployment
└── firebase.json        # Firebase configuration
```

## API Endpoints

### POST /api/appointments
Submit a new appointment request.

**Request Body:**
```json
{
  "name": "Jan Kowalski",
  "email": "jan@example.com",
  "phone": "+48123456789",
  "service": "terapia-indywidualna",
  "preferredDate": "2024-01-15",
  "preferredTime": "14:00",
  "message": "Dodatkowe informacje"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Appointment request submitted successfully",
  "appointmentId": "doc_id"
}
```

### GET /api/appointments
Get all appointments (admin use).

**Query Parameters:**
- `status`: Filter by status (pending, confirmed, cancelled)
- `limit`: Limit number of results (default: 50)

### PATCH /api/appointments/:id
Update appointment status.

**Request Body:**
```json
{
  "status": "confirmed",
  "notes": "Confirmed for tomorrow at 2 PM"
}
```

## Cost Optimization

This setup uses free/low-cost services:

- **Firebase Hosting**: Free tier (10 GB storage, 1 GB/month transfer)
- **Firebase Functions**: Pay-as-you-go (first 2M invocations/month free)
- **Firestore**: Free tier (1 GB storage, 50K reads, 20K writes/day)
- **Gmail**: Free email sending (app password required)

Expected monthly costs: $0-5 for typical small practice usage.

## Email Setup

1. Create Gmail account or use existing
2. Enable 2-factor authentication
3. Generate app password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
4. Use this password in `EMAIL_APP_PASSWORD` environment variable

## Security

- Firestore rules allow public appointment creation
- Email credentials stored in environment variables
- CORS enabled for frontend domain
- Input validation and sanitization
- Rate limiting through Firebase Functions

## Support

For issues or questions, please check the code comments or create an issue in the repository.

## License

Private project - All rights reserved.