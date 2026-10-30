// Firebase Cloud Messaging (FCM) & Real-time Push Notification Client for Koperasi HWS
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { collection, addDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { app, db, firebaseConfig } from './firebase';
import { triggerBrowserNotification, playNotificationSound, sanitizeForFirestore } from './storage';

export interface HwsNotification {
  id?: string;
  recipientId: string; // member.id or 'all' or 'admin'
  recipientNama?: string;
  title: string;
  body: string;
  type: 'setoran_verified' | 'mutasi_baru' | 'surat_baru' | 'info';
  timestamp?: string;
  read?: boolean;
  data?: Record<string, any>;
}

let activeMessaging: any = null;
let currentToken: string | null = null;
let unsubscribeFirestoreListener: (() => void) | null = null;

// Initialize FCM & Real-time Notification Listener
export async function initFCM(
  userId: string,
  userRole: 'member' | 'admin',
  onNotificationReceived?: (notif: HwsNotification) => void
): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // 1. Inisialisasi Service Worker & Web Push / FCM
  try {
    let swReg: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch {
        swReg = await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      }
    }

    const supported = await isSupported().catch(() => false);
    if (supported) {
      activeMessaging = getMessaging(app);

      // Ambil token registrasi FCM hanya jika izin notifikasi sudah disetujui (mencegah error di iframe/cloud)
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          try {
            await Notification.requestPermission();
          } catch {}
        }

        if (Notification.permission === 'granted') {
          try {
            const readyReg = await navigator.serviceWorker.ready.catch(() => swReg);
            const token = await getToken(activeMessaging, {
              vapidKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDZKrxZJGESBuSnjvjFi0KrAFCcKeDTMrTvVIh6p5gu4',
              serviceWorkerRegistration: readyReg || undefined,
            });

            if (token) {
              currentToken = token;
              // Kirim token ke backend
              fetch('/api/fcm/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: userRole, token }),
              }).catch(() => {});
            }
          } catch (tokenErr) {
            // Tangani silent fallback jika push service browser tidak mengizinkan di lingkungan iframe
          }
        }
      }

      // Foreground Message Listener
      onMessage(activeMessaging, (payload) => {
        const title = payload.notification?.title || payload.data?.title || 'Notifikasi Koperasi HWS';
        const body = payload.notification?.body || payload.data?.body || 'Anda menerima pembaruan transaksi.';
        const type = (payload.data?.type as any) || 'info';

        if (type === 'setoran_verified' || type === 'mutasi_baru') {
          playNotificationSound('deposit');
        } else {
          playNotificationSound('chat');
        }

        triggerBrowserNotification(title, body);

        const notifObj: HwsNotification = {
          recipientId: userId,
          title,
          body,
          type,
          timestamp: new Date().toISOString(),
          data: payload.data || {},
        };

        window.dispatchEvent(new CustomEvent('hws:realtime_notification', { detail: notifObj }));
        onNotificationReceived?.(notifObj);
      });
    }
  } catch {}

  // 2. Real-time Firestore Listener (Single-field query tanpa memerlukan composite index manual)
  try {
    if (unsubscribeFirestoreListener) {
      unsubscribeFirestoreListener();
      unsubscribeFirestoreListener = null;
    }

    const notifCol = collection(db, 'notifications');
    const q = query(
      notifCol,
      where('recipientId', 'in', [userId, 'all']),
      limit(20)
    );

    let initialLoadDone = false;
    unsubscribeFirestoreListener = onSnapshot(q, (snapshot) => {
      if (!initialLoadDone) {
        initialLoadDone = true;
        return; // Lewati data lama saat pertama mount
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as any;
          const notif: HwsNotification = {
            id: change.doc.id,
            recipientId: data.recipientId || userId,
            recipientNama: data.recipientNama,
            title: data.title || 'Notifikasi Koperasi HWS',
            body: data.body || 'Pemberitahuan transaksi atau verifikasi baru.',
            type: data.type || 'info',
            timestamp: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
            data: data.data || {},
          };

          // Mainkan suara & browser banner
          if (notif.type === 'setoran_verified' || notif.type === 'mutasi_baru') {
            playNotificationSound('deposit');
          } else {
            playNotificationSound('chat');
          }

          triggerBrowserNotification(notif.title, notif.body);
          window.dispatchEvent(new CustomEvent('hws:realtime_notification', { detail: notif }));
          onNotificationReceived?.(notif);
        }
      });
    }, () => {
      // Silent error handler - realtime SSE & Polling tetap aktif sebagai fallback utama
    });
  } catch {}

  return currentToken;
}

// Function to send real-time notification to member across Server, FCM & Firestore
export async function sendRealtimeNotification(notification: {
  recipientId: string;
  recipientNama?: string;
  title: string;
  body: string;
  type: 'setoran_verified' | 'mutasi_baru' | 'surat_baru' | 'info';
  data?: Record<string, any>;
}): Promise<boolean> {
  let success = false;

  // 1. Kirim via Server Endpoint (Server-Side FCM Broadcast)
  try {
    const res = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
    });
    if (res.ok) success = true;
  } catch (e) {
    console.warn('[Notification API] Call error:', e);
  }

  // 2. Simpan ke Firestore Realtime Collection (Trigger Realtime onSnapshot di perangkat anggota)
  try {
    const notifCol = collection(db, 'notifications');
    const cleanNotif = sanitizeForFirestore({
      ...notification,
      read: false,
    });
    await addDoc(notifCol, {
      ...cleanNotif,
      createdAt: serverTimestamp(),
    });
    success = true;
  } catch (firestoreErr) {
    console.warn('[Firestore] Notification save note:', firestoreErr);
  }

  return success;
}
