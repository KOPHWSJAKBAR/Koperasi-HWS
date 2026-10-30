# Implementation Plan - Penyempurnaan Realtime Online, Buku Kas Anggota, FCM & Perbaikan Sistem

Seluruh permintaan perbaikan dan penyempurnaan sistem Koperasi HWS telah selesai diimplementasikan:

## 1. Perbaikan Saldo Berjalan Buku Kas Anggota pada Dashboard Admin & Total Buku Kas
- **Kesesuaian Total Akuntansi**:
  - Saldo Berjalan pada **Card 1: Buku Kas Anggota** kini merefleksikan seluruh simpanan anggota:
    - Total Simpanan Pokok (50%): **Rp 115.000**
    - Total Tabungan Umum: **Rp 50.000**
    - Tabungan Zakat Fitrah (25%): **Rp 57.500**
    - Tabungan Qurban (25%): **Rp 57.500**
    - **Saldo Berjalan Buku Kas Anggota**: **Rp 280.000**
  - Pada pembukuan buku kas (`kasList`), seluruh transaksi anggota kategori Pokok, Zakat, Qurban, dan Bebas tercatat dalam `bukuKas: 'anggota'` dengan total mutasi kas tepat **Rp 280.000**, tersinkronisasi 100% dengan saldo anggota.

## 2. Penyesuaian Saldo Tabungan Pokok Otomatis (50% Pokok, 25% Zakat, 25% Qurban)
- Pada menu **Penyesuaian Saldo Anggota** (`PenyesuaianSaldoView.tsx`) dan backend endpoint (`/api/balance/adjust`), apabila admin melakukan penyesuaian pada Tabungan Pokok (contoh nominal Rp 2.000):
  - Sistem otomatis membagi menjadi:
    - 50% Tabungan Pokok (Rp 1.000)
    - 25% Tabungan Qurban (Rp 500)
    - 25% Tabungan Zakat (Rp 500)
  - Ketiga entri tersebut dicatat langsung ke **Buku Kas Anggota** (`bukuKas: 'anggota'`).

## 3. Perbaikan Bug `Cannot read properties of undefined (reading 'includes')` & ErrorBoundary
- **Akar Masalah**: Pengecekan pencarian anggota (`m.nomorRekening.includes`, `m.whatsapp.includes`) dan filter riwayat audit logs (`log.action.includes`, `log.detail.includes`) mengalami crash ketika ada data yang bernilai `undefined` atau `null`.
- **Solusi**:
  - Menambahkan safe-null handling `(m.nomorRekening || '').toLowerCase().includes(q)` dan `(log.detail || '').toLowerCase().includes(...)`.
  - Membuat komponen `ErrorBoundary.tsx` dan membungkus `<PenyesuaianSaldoView>` untuk menangani galat secara elegan tanpa memutus tampilan antarmuka.

## 4. Penanganan Error Jaringan WebSocket Vite (`WebSocket closed without opened`)
- Pada `vite.config.ts`, opsi `server: { hmr: false, watch: null }` dikonfigurasikan agar browser client tidak memicu koneksi WebSocket HMR yang tertolak oleh proxy container Cloud Run.
- Komunikasi realtime antar-perangkat tetap berjalan kencang dan stabil melalui kombinasi SSE (Server-Sent Events), Firebase Firestore Realtime snapshot listener, dan FCM push notifications.

## 5. Penghapusan Menu Upload File Backup pada Menu Setting Superadmin
- Menghapus tombol menu *"Upload File Backup Database (.json / .bak)"* dan tombol pemulihan JSON dari `SettingModal.tsx`.
- Menghapus sub-modal dialog `upload_backup` sehingga menu pengaturan Super Admin bersih dari opsi pengunggahan berkas backup manual sesuai arahan.
