import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Centralized Firebase configuration for multi-platform sync (Web, Android, iOS, PC, AI Studio)
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

// Singleton instances to guarantee no double-initialization
let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!cachedApp) {
    if (getApps().length > 0) {
      cachedApp = getApp();
    } else {
      cachedApp = initializeApp(firebaseConfig);
    }
  }
  return cachedApp;
}

export function getFirebaseFirestore(): Firestore {
  if (!cachedDb) {
    const currentApp = getFirebaseApp();
    // Use long-polling transport to guarantee resilient realtime sync across Cloud Run proxies and iframe sandboxes
    const firestoreSettings = {
      experimentalForceLongPolling: true,
    };

    if (firebaseConfig.firestoreDatabaseId) {
      try {
        cachedDb = initializeFirestore(currentApp, firestoreSettings, firebaseConfig.firestoreDatabaseId);
      } catch (err) {
        try {
          cachedDb = getFirestore(currentApp, firebaseConfig.firestoreDatabaseId);
        } catch {
          cachedDb = getFirestore(currentApp);
        }
      }
    } else {
      try {
        cachedDb = initializeFirestore(currentApp, firestoreSettings);
      } catch {
        cachedDb = getFirestore(currentApp);
      }
    }
  }
  return cachedDb;
}

import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, isSupported as isAnalyticsSupported, logEvent, Analytics } from 'firebase/analytics';

export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseApp());
  }
  return cachedAuth;
}

let cachedStorage: FirebaseStorage | null = null;
export function getFirebaseStorage(): FirebaseStorage {
  if (!cachedStorage) {
    const currentApp = getFirebaseApp();
    cachedStorage = getStorage(currentApp, firebaseConfig.storageBucket);
  }
  return cachedStorage;
}

let cachedAnalytics: Analytics | null = null;
export async function getFirebaseAnalyticsSafe(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  if (!cachedAnalytics) {
    try {
      const supported = await isAnalyticsSupported();
      if (supported) {
        cachedAnalytics = getAnalytics(getFirebaseApp());
      }
    } catch {}
  }
  return cachedAnalytics;
}

export async function logAnalyticsEvent(eventName: string, params?: Record<string, any>) {
  try {
    const a = await getFirebaseAnalyticsSafe();
    if (a) {
      logEvent(a, eventName, params);
    }
  } catch {}
}

// Singletons exported directly for convenience and backwards-compatibility
export const app: FirebaseApp = getFirebaseApp();
export const db: Firestore = getFirebaseFirestore();
export const auth: Auth = getFirebaseAuth();
export const storage: FirebaseStorage = getFirebaseStorage();

export default {
  app,
  db,
  auth,
  storage,
  firebaseConfig,
  getFirebaseApp,
  getFirebaseFirestore,
  getFirebaseAuth,
  getFirebaseStorage,
  getFirebaseAnalyticsSafe,
  logAnalyticsEvent,
};
