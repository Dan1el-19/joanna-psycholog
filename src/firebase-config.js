// Firebase configuration using environment variables
// ⚠️ BEZPIECZEŃSTWO: Klucze API są teraz w zmiennych środowiskowych

import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getPerformance } from "firebase/performance";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate required environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN', 
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  console.error('Please create .env.local file with Firebase configuration');
  throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Suppress BloomFilter errors in console
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args.some(arg => 
    typeof arg === 'string' && 
    arg.includes('BloomFilter error')
  )) {
    return; // Suppress BloomFilter errors
  }
  originalConsoleError.apply(console, args);
};

// Initialize Cloud Functions
export const functions = getFunctions(app);

// Initialize Performance Monitoring (configurable)
export const perf = import.meta.env.VITE_ENABLE_PERFORMANCE === 'true' 
  ? getPerformance(app) 
  : null;

// Connect to emulators in development
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  // Only connect to emulators if they haven't been connected already
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
    connectFunctionsEmulator(functions, "localhost", 5001);
    console.log("🔧 Connected to Firebase emulators");
  } catch (error) {
    // Emulators already connected
    console.log("Firebase emulators already connected");
  }
}

export default app;

/* 
SECURITY SETUP INSTRUCTIONS:

1. Create .env.local file in project root
2. Copy values from env.example and fill with your actual Firebase config
3. NEVER commit .env.local to Git (it's already in .gitignore)
4. For production, set environment variables in your hosting platform

ENVIRONMENT VARIABLES:
- VITE_FIREBASE_API_KEY: Your Firebase API key
- VITE_FIREBASE_AUTH_DOMAIN: Your Firebase auth domain
- VITE_FIREBASE_PROJECT_ID: Your Firebase project ID
- VITE_FIREBASE_STORAGE_BUCKET: Your Firebase storage bucket
- VITE_FIREBASE_MESSAGING_SENDER_ID: Your Firebase messaging sender ID
- VITE_FIREBASE_APP_ID: Your Firebase app ID

SECURITY NOTES:
- API keys in frontend are safe for Firebase (they're project identifiers)
- Real security comes from Firestore security rules
- Always use proper authentication and authorization
- Monitor Firebase usage and costs regularly
*/
