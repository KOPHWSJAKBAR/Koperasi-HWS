import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';

// Firebase configuration from firebase-applet-config.json
export const firebaseConfig = {
  projectId: "gen-lang-client-0761736071",
  appId: "1:697954213543:web:6db9f5f24c364ea8198582",
  apiKey: "AIzaSyAXim9MUr_YKpVJAo6djUmcIF4qya3-mgc",
  authDomain: "gen-lang-client-0761736071.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-koperasihimpunan-610ec60a-11c8-4d4d-b14c-85afbabb0f69",
  storageBucket: "gen-lang-client-0761736071.firebasestorage.app",
  messagingSenderId: "697954213543",
  measurementId: "",
  oAuthClientId: "697954213543-3q3o605nabhq0ogqiapcjjsr9b0ckcub.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// Initialize Firebase App instance
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific database ID if configured, or default
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Safe helper to obtain Cloud Messaging in supported environments (Service Worker / Push)
export async function getFirebaseMessagingSafe() {
  try {
    const supported = await isSupported();
    if (supported && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      return getMessaging(app);
    }
  } catch (err) {
    console.warn('Firebase Messaging is not supported in this runtime environment:', err);
  }
  return null;
}
