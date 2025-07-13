// Firebase configuration template
// Copy this file to firebase-config.js and replace with your actual Firebase project configuration

import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Firebase configuration object
// Get these values from your Firebase project console
const firebaseConfig = {
  apiKey: "AIzaSyA3v9KK7hqhZOv2r1fg3raeCWfOjDYSAKY",
  authDomain: "joanna-psycholog.firebaseapp.com",
  projectId: "joanna-psycholog",
  storageBucket: "joanna-psycholog.firebasestorage.app",
  messagingSenderId: "1064648871285",
  appId: "1:1064648871285:web:50dccd6147aba48571973c",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Cloud Functions
export const functions = getFunctions(app);

// Connect to emulators in development
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  // Only connect to emulators if they haven't been connected already
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
    connectFunctionsEmulator(functions, "localhost", 5001);
  } catch (error) {
    // Emulators already connected
    console.log("Firebase emulators already connected");
  }
}

export default app;

/* 
SETUP INSTRUCTIONS:

1. Go to Firebase Console (https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Go to Project Settings (gear icon)
4. Scroll down to "Your apps" section
5. Click "Add app" and select Web app (</>) 
6. Register your app with a nickname
7. Copy the firebaseConfig object from the setup code
8. Replace the firebaseConfig object above with your values
9. Rename this file from firebase-config.example.js to firebase-config.js
10. Make sure firebase-config.js is in your .gitignore file

SECURITY NOTE:
- The API key in the config is safe to expose in frontend code
- It's used for identifying your Firebase project, not for authentication
- However, make sure to configure Firestore security rules properly
*/
