import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ==========================================
// THROWABLE CONSTANTS (Collections & Admin)
// ==========================================
export const APP_COLLECTION_NAME = 'khodni_maak_trips';
export const USERS_COLLECTION = 'khodni_maak_users';
export const STATIONS_COLLECTION = 'khodni_maak_stations';
export const ADMIN_EMAIL = "bassamwaleed2000@gmail.com".toLowerCase();
