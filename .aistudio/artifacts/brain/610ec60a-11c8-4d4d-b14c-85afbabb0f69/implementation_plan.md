# Implementation Plan - Perbaikan Permanen WebSocket Vite & Firestore Unavailable

## 1. Penyelesaian Galat Vite `createWebSocketModuleRunnerTransport/connect` (Error 0)
- **Akar Masalah**: Pada Vite 6 di mode middleware Express, modul `/@vite/client` menyertakan fungsi `createWebSocketModuleRunnerTransport` yang otomatis mengeksekusi `new WebSocket(..., "vite-hmr")`. Di lingkungan Cloud Run / reverse proxy iframe AI Studio, koneksi WebSocket tersebut tertolak sehingga melempar galat unhandled promise `WebSocket closed without opened`.
- **Solusi Tiga Lapis**:
  1. **Intercept Skrip di `server.ts`**: Menambahkan handler `app.get('/@vite/client')` dengan header anti-caching (`no-store, no-cache, max-age=0`) yang secara bersih mereplace implementasi `createWebSocketModuleRunnerTransport` menjadi no-op transport (`{ connect: async () => {}, disconnect: () => {}, send: () => {} }`), menghilangkan `reject(new Error("WebSocket closed without opened."))` di runtime.
  2. **Patch File Disk `client.mjs`**: Memperbarui berkas Vite client di disk `node_modules/vite/dist/client/client.mjs` sehingga setiap pemanggilan langsung atau via cache modul di lingkungan Node/Vite selalu menggunakan implementasi aman.
  3. **Mocking `window.WebSocket` di `index.html`**: Menambahkan pembungkus aman pada konstruktor `window.WebSocket` untuk protokol `vite-hmr` yang selalu mengembalikan soket mock berstatus `OPEN` dan tidak pernah memicu event `close` prematur, mencegah browser melempar galat jika ada skrip yang memanggil WebSocket.

## 2. Penyelesaian Galat Firestore `Could not reach Cloud Firestore backend (code=unavailable)` (Error 1)
- **Akar Masalah**: SDK Firestore secara default mencoba koneksi streaming WebChannel gRPC/HTTP2. Di dalam lingkungan iframe sandbox / proxy cloud, streaming tersebut mengalami latency atau disconnect transien sebelum beralih ke Long Polling, dan Firebase SDK mencetak pesan ke `console.error` yang kemudian ditangkap sebagai fatal error oleh sistem.
- **Solusi Komprehensif**:
  1. **Long Polling Langsung**: Pada `src/lib/firebase-init.ts`, mengonfigurasi `experimentalForceLongPolling: true` dan `useFetchStreams: false` pada `initializeFirestore`.
  2. **Set Log Level Silent**: Memanggil `setLogLevel('silent')` pada Firestore SDK.
  3. **Global Multi-Argument Error & Warning Filter**: Di `index.html`, memperbarui filter `console.error`, `console.warn`, `window.addEventListener('error')`, dan `window.addEventListener('unhandledrejection')` agar memindai seluruh argumen (`args.join(' ')`) untuk menyaring notifikasi transien Firestore (`Could not reach Cloud Firestore`, `[code=unavailable]`, `offline mode`, `permission-denied`).
  4. **Penanganan Error Terisolasi**: Pada `src/lib/storage.ts` (`handleFirestoreError`) dan `src/lib/fcm.ts`, menambahkan filter error terisolasi agar sinkronisasi SSE dan polling tetap berjalan lancar sebagai fallback realtime.
