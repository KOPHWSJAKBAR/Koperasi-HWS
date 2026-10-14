// Firebase Cloud Messaging Service Worker for Koperasi HWS
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "gen-lang-client-0761736071",
  appId: "1:697954213543:web:6db9f5f24c364ea8198582",
  apiKey: "AIzaSyAXim9MUr_YKpVJAo6djUmcIF4qya3-mgc",
  authDomain: "gen-lang-client-0761736071.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-koperasihimpunan-610ec60a-11c8-4d4d-b14c-85afbabb0f69",
  storageBucket: "gen-lang-client-0761736071.firebasestorage.app",
  messagingSenderId: "697954213543"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background message received:', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Notifikasi Koperasi HWS';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'Pemberitahuan transaksi atau verifikasi baru.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: payload.data?.tag || `hws-notif-${Date.now()}`,
      data: payload.data || {},
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Firebase messaging init warning:', err);
}

// Background push event fallback for standard web push
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || data.notification?.title || 'Koperasi HWS Realtime';
    const options = {
      body: data.body || data.notification?.body || 'Anda menerima notifikasi baru.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Koperasi HWS', {
        body: text,
        icon: '/icon-192.png',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
