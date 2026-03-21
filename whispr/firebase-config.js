/* ============================================================
   firebase-config.js
   REPLACE with your own Firebase project credentials.
   Go to: https://console.firebase.google.com/
   Create a project → Add web app → Copy the config below.
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
  measurementId:     "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();

// Optional: enable analytics
try { firebase.analytics(); } catch(e) {}
