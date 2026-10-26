import { getMessaging, isSupported } from 'firebase/messaging';
import { app, db, auth, storage, firebaseConfig, getFirebaseApp, getFirebaseFirestore, getFirebaseAuth, getFirebaseStorage, logAnalyticsEvent } from './firebase-init';

export { app, db, auth, storage, firebaseConfig, getFirebaseApp, getFirebaseFirestore, getFirebaseAuth, getFirebaseStorage, logAnalyticsEvent };

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
