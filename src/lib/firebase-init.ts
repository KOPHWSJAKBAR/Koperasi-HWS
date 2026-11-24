import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  setLogLevel,
  doc,
  setDoc,
  getDocFromServer,
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Centralized Firebase configuration for multi-platform sync (Web, Android, iOS, PC, AI Studio)
export const firebaseConfig = {
  projectId: "gen-lang-client-0761736071",
  appId: "1:697954213543:web:6db9f5f24c364ea8198582",
  apiKey: "AIzaSyAXim9MUr_YKpVJAo6djUmcIF4qya3-mgc",
  authDomain: "gen-lang-client-0761736071.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-koperasihimpunan-610ec60a-11c8-4d4d-b14c-85afbabb0f69",
  storageBucket: "gen-lang-client-0761736071.firebasestorage.app",
  messagingSenderId: "697954213543",
  measurementId: "G-7PGPBDM652",
  oAuthClientId: "697954213543-3q3o605nabhq0ogqiapcjjsr9b0ckcub.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// Singleton instances to guarantee no double-initialization
let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedStorage: FirebaseStorage | null = null;

// Suppress verbose Firebase SDK logs in browser / iframe
try {
  setLogLevel('silent');
} catch {}

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
    try {
      cachedDb = initializeFirestore(
        currentApp,
        {
          experimentalForceLongPolling: true,
          ignoreUndefinedProperties: true,
        },
        firebaseConfig.firestoreDatabaseId || undefined
      );
    } catch {
      cachedDb = firebaseConfig.firestoreDatabaseId
        ? getFirestore(currentApp, firebaseConfig.firestoreDatabaseId)
        : getFirestore(currentApp);
    }
  }
  return cachedDb;
}

export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseApp());
  }
  return cachedAuth;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!cachedStorage) {
    const currentApp = getFirebaseApp();
    cachedStorage = getStorage(currentApp, firebaseConfig.storageBucket);
  }
  return cachedStorage;
}

// Avoid calling firebase/analytics getAnalytics() which fetches firebase.googleapis.com/.../webConfig
// and throws NetworkError inside sandboxed iframes / Cloud Run previews.
export async function getFirebaseAnalyticsSafe(): Promise<null> {
  return null;
}

let lastAnalyticsKey = '';
let lastAnalyticsTime = 0;

export async function logAnalyticsEvent(eventName: string, params?: Record<string, any>) {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const serializedParams = params ? JSON.parse(JSON.stringify(params)) : {};
    const dedupeKey = `${eventName}:${JSON.stringify(serializedParams)}`;
    const nowMs = Date.now();
    if (dedupeKey === lastAnalyticsKey && nowMs - lastAnalyticsTime < 3000) {
      return;
    }
    lastAnalyticsKey = dedupeKey;
    lastAnalyticsTime = nowMs;

    const firestoreDb = getFirebaseFirestore();
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const platform = /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua)
      ? 'iOS'
      : /Windows|Macintosh|Linux/i.test(ua)
      ? 'PC / Web'
      : 'Web';
    await setDoc(
      doc(firestoreDb, 'settings', 'analytics_realtime'),
      {
        id: 'analytics_realtime',
        lastEventName: eventName,
        lastEventParams: serializedParams,
        lastEventPlatform: platform,
        lastEventTime: new Date().toISOString(),
        measurementId: firebaseConfig.measurementId,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
      },
      { merge: true }
    ).catch(() => {});
  } catch {}
}

// Singletons exported directly for convenience and backwards-compatibility
export const app: FirebaseApp = getFirebaseApp();
export const db: Firestore = getFirebaseFirestore();
export const auth: Auth = getFirebaseAuth();
export const storage: FirebaseStorage = getFirebaseStorage();

let activeOnlineCheckPromise: Promise<boolean> | null = null;
let lastOnlineCheckTime = 0;
let lastOnlineCheckResult = true;

async function verifyFirestoreRestReachability(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const dbId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || '(default)');
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/${dbId}/documents/koperasi_state/main_database?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    return res.ok || res.status === 404 || res.status === 403;
  } catch {
    return false;
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  return ensureFirestoreOnline();
}

// Passive server reachability check: NEVER invokes enableNetwork(db) or disableNetwork(db),
// because mutating network state mid-stream triggers PersistentWriteStream.onNext assertion failures.
export async function ensureFirestoreOnline(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    lastOnlineCheckResult = false;
    return false;
  }
  const now = Date.now();
  if (now - lastOnlineCheckTime < 5000 && lastOnlineCheckResult) {
    return true;
  }
  if (activeOnlineCheckPromise) {
    return activeOnlineCheckPromise;
  }

  activeOnlineCheckPromise = (async () => {
    try {
      await Promise.race([
        getDocFromServer(doc(db, 'koperasi_state', 'main_database')),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ]);
      lastOnlineCheckTime = Date.now();
      lastOnlineCheckResult = true;
      return true;
    } catch {
      const restOk = await verifyFirestoreRestReachability();
      lastOnlineCheckTime = Date.now();
      lastOnlineCheckResult = restOk || (typeof navigator !== 'undefined' ? navigator.onLine : false);
      return lastOnlineCheckResult;
    } finally {
      activeOnlineCheckPromise = null;
    }
  })();

  return activeOnlineCheckPromise;
}

let isSystemErrorGuardInstalled = false;

// Guard browser runtime against transient Firebase internal stream rejections so the app never crashes
export function installFirestoreSystemErrorGuard() {
  if (typeof window === 'undefined' || isSystemErrorGuardInstalled) return;
  isSystemErrorGuardInstalled = true;

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || '');
    const stack = String(reason?.stack || '');
    const isTransientFirestoreInternal =
      msg.includes('INTERNAL ASSERTION FAILED') ||
      msg.includes('49232') ||
      msg.includes('47125') ||
      msg.includes('12678') ||
      msg.includes('55816') ||
      msg.includes('31322') ||
      stack.includes('firebase_firestore') ||
      stack.includes('PersistentWriteStream') ||
      stack.includes('__PRIVATE_fromVersion') ||
      stack.includes('__PRIVATE_hardAssert');

    if (isTransientFirestoreInternal) {
      event.preventDefault();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hws:firestore_stream_recovered'));
      }
    }
  });
}

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
  testFirestoreConnection,
  ensureFirestoreOnline,
  installFirestoreSystemErrorGuard,
};
