// Firebase Cloud Messaging (FCM) & Real-time Push Notification Client for Koperasi HWS
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { collection, addDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { app, db, firebaseConfig } from './firebase';
import { triggerBrowserNotification, playNotificationSound } from './storage';

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
    if ('serviceWorker' in navigator) {
      // Pastikan Service Worker terdaftar
      await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => {
        return navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }

    const supported = await isSupported();
    if (supported) {
      activeMessaging = getMessaging(app);

      // Minta izin Notifikasi Perangkat
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {}
      }

      // Ambil token registrasi FCM
      try {
        const token = await getToken(activeMessaging, {
          vapidKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDZKrxZJGESBuSnjvjFi0KrAFCcKeDTMrTvVIh6p5gu4',
        });

        if (token) {
          currentToken = token;
          console.log('[FCM] Device Token Registered:', token.slice(0, 15) + '...');
          // Kirim token ke backend
          fetch('/api/fcm/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, role: userRole, token }),
          }).catch(() => {});
        }
      } catch (tokenErr) {
        console.warn('[FCM] Token acquisition note:', tokenErr);
      }

      // Foreground Message Listener
      onMessage(activeMessaging, (payload) => {
        console.log('[FCM] Foreground notification received:', payload);
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
  } catch (err) {
    console.warn('[FCM] Init error:', err);
  }

  // 2. Real-time Firestore Listener (Menjamin notifikasi real-time aktif seketika di semua environment)
  try {
    if (unsubscribeFirestoreListener) {
      unsubscribeFirestoreListener();
      unsubscribeFirestoreListener = null;
    }

    const notifCol = collection(db, 'notifications');
    const q = query(
      notifCol,
      where('recipientId', 'in', [userId, 'all']),
      orderBy('createdAt', 'desc'),
      limit(5)
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
            timestamp: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
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
    }, (err) => {
      console.warn('[Firestore Notifications] Snapshot notice:', err.message);
    });
  } catch (firestoreErr) {
    console.warn('[Firestore Notifications] Init notice:', firestoreErr);
  }

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
    await addDoc(notifCol, {
      ...notification,
      createdAt: serverTimestamp(),
      read: false,
    });
    success = true;
  } catch (firestoreErr) {
    console.warn('[Firestore] Notification save note:', firestoreErr);
  }

  return success;
}
