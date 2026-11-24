import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  setLogLevel,
  doc,
  setDoc,
  getDocFromServer,
  enableNetwork,
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import appletFirebaseConfig from '../../firebase-applet-config.json';

// Centralized Firebase configuration sourced directly from firebase-applet-config.json
export const firebaseConfig = appletFirebaseConfig;

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
    const isBrowser = typeof window !== 'undefined';
    try {
      cachedDb = initializeFirestore(
        currentApp,
        isBrowser
          ? {
              // Long polling avoids WebChannel HTTP/2 stream stalls in sandboxed iframes, proxies, and mobile WebViews
              experimentalForceLongPolling: true,
              experimentalLongPollingOptions: { timeoutSeconds: 15 },
              ignoreUndefinedProperties: true,
            }
          : {
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
let hasTestedStartupConnection = false;

async function probeFirestoreServerWithRecovery(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    lastOnlineCheckResult = false;
    return false;
  }

  const readOnce = () =>
    Promise.race([
      getDocFromServer(doc(db, 'koperasi_state', 'main_database')),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
    ]);

  try {
    await readOnce();
    lastOnlineCheckTime = Date.now();
    lastOnlineCheckResult = true;
    return true;
  } catch (firstErr) {
    const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    // Only invoke enableNetwork if SDK explicitly entered offline state while browser reports online
    if (firstMsg.includes('client is offline') || firstMsg.includes('unavailable') || firstMsg === 'timeout') {
      try {
        if (firstMsg.includes('client is offline')) {
          await enableNetwork(db).catch(() => {});
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
        await readOnce();
        lastOnlineCheckTime = Date.now();
        lastOnlineCheckResult = true;
        return true;
      } catch {
        // Fallback: verify Firestore REST API reachability quietly so transient WebChannel/long-poll warmup never emits false offline warnings
        try {
          const restUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/koperasi_state/main_database?key=${firebaseConfig.apiKey}`;
          const res = await fetch(restUrl, { method: 'GET', cache: 'no-store' });
          if (res.ok) {
            lastOnlineCheckTime = Date.now();
            lastOnlineCheckResult = true;
            return true;
          }
        } catch {}
      }
    } else if (firstMsg.includes('permission-denied') || firstMsg.includes('Missing or insufficient permissions')) {
      console.error('Firestore configuration/rules check failed:', firstMsg);
    }

    lastOnlineCheckTime = Date.now();
    lastOnlineCheckResult = typeof navigator !== 'undefined' ? navigator.onLine : false;
    return lastOnlineCheckResult;
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (hasTestedStartupConnection) return lastOnlineCheckResult;
  hasTestedStartupConnection = true;
  return ensureFirestoreOnline(true);
}

// Deduplicated server reachability check: only wakes Firestore network if client actually stalled offline
export async function ensureFirestoreOnline(force = false): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    lastOnlineCheckResult = false;
    return false;
  }
  const now = Date.now();
  if (!force && now - lastOnlineCheckTime < 5000 && lastOnlineCheckResult) {
    return true;
  }
  if (activeOnlineCheckPromise) {
    return activeOnlineCheckPromise;
  }

  activeOnlineCheckPromise = probeFirestoreServerWithRecovery().finally(() => {
    activeOnlineCheckPromise = null;
  });

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
      msg.includes('client is offline') ||
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
