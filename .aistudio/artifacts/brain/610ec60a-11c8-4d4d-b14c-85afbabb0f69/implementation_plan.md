# Rencana Implementasi: Sinkronisasi Realtime AI Studio, Alur Buku Kas Koperasi, dan Manajemen Biodata Admin

Dokumen ini merinci rancangan perbaikan dan penyempurnaan sistem aplikasi Koperasi HWS berdasarkan jawaban klarifikasi pengguna.

---

## 1. Ringkasan Kebutuhan & Hasil Klarifikasi

1. **Sinkronisasi Database Realtime ke AI Studio**:
   - Seluruh data transaksi, buku kas, anggota, dan profil disinkronisasikan secara otomatis di latar belakang (*background automatic sync*) ke Google Cloud Firestore AI Studio (`ai-studio-koperasihimpunan-610ec60a-11c8-4d4d-b14c-85afbabb0f69`).
   - Perubahan data di satu perangkat langsung tercermin secara instan di perangkat lain (Android, iOS, PC, dan AI Studio) tanpa memerlukan tombol manual.

2. **Alur Buku Kas Koperasi**:
   - **Admin Write**: Berwenang menulis transaksi kas baru serta mengajukan perubahan/edit transaksi kas koperasi. Transaksi yang ditulis atau diedit oleh Admin Write masuk ke dalam status `pending_approval` (Menunggu Persetujuan).
   - **Admin Approval & Super Admin**: Berwenang langsung memeriksa dan mengesahkan (*approve* / *reject*) transaksi maupun perubahan kas yang diajukan oleh Admin Write.

3. **Perubahan Biodata Admin**:
   - **Setiap Admin (Admin Write, Admin Approval, Admin Laporan)**: Dapat mengedit dan merubah biodata akunnya sendiri (nama, email, nomor WhatsApp, NIK, alamat kantor/domisili, foto profil, dan kata sandi) melalui menu profil.
   - **Super Admin**: Memiliki hak akses penuh untuk mengedit, menambah, dan mengelola biodata seluruh akun administrator di koperasi.

---

## 2. Perubahan Teknis Per Modul

### A. Modul Sinkronisasi Database Realtime (`src/lib/storage.ts`, `server.ts`)
- Memastikan `onSnapshot` Firestore terhubung permanen ke koleksi `koperasi_state/main_database` dengan *database ID* `ai-studio-koperasihimpunan-610ec60a-11c8-4d4d-b14c-85afbabb0f69`.
- Sinkronisasi berjalan otomatis di latar belakang saat terjadi perubahan pada state lokal atau server.
- Mengoptimalkan penanganan data *payload* agar tidak terjadi konflik (*race condition*) antar perangkat yang aktif bersamaan.

### B. Modul Buku Kas Koperasi (`src/components/BukuKasView.tsx`, `server.ts`)
- **Input Transaksi Kas Koperasi**:
  - Admin Write menginput kas (Pemasukan/Pengeluaran, nominal, kategori, keterangan, pihak penerima).
  - Status otomatis diset menjadi `pending_approval` dengan `pendingAction: 'create'`.
- **Edit Transaksi Kas Koperasi**:
  - Jika diedit oleh Admin Write: Transaksi diperbarui dengan status `pending_approval` dan `pendingAction: 'update'`.
  - Jika diedit oleh Admin Approval / Super Admin: Perubahan langsung disetujui (`status: 'approved'`).
- **Persetujuan (Approval)**:
  - Admin Approval dan Super Admin melihat tombol aksi cepat **Setujui ✓** dan **Tolak ✕** pada baris transaksi berstatus *pending*.
  - Riwayat persetujuan dicatat dalam *Audit Log* (waktu, nama petugas approval, dan nominal kas).

### C. Modul Biodata Admin (`src/components/SettingModal.tsx`)
- **Edit Profil Admin Mandiri**:
  - Tombol **"Ubah Data Diri & Password"** pada menu Pengaturan dibuka untuk seluruh admin (`admin_write`, `admin_approval`, `admin_laporan`).
  - Formulir memungkinkan admin memperbarui Nama Lengkap, Email, Nomor WhatsApp, NIK, Alamat, Wilayah Kantor, Pertanyaan/Jawaban Keamanan, dan Password baru mereka sendiri.
- **Kelola Seluruh Admin oleh Super Admin**:
  - Menu **"Kelola Akun Admin"** tetap menjadi wewenang khusus Super Admin untuk mengubah data, role, status aktif/nonaktif/dibekukan, dan kata sandi admin lainnya.

---

## 3. Rencana Verifikasi & Uji Coba

1. **Uji Validasi Kode & Build**:
   - Menjalankan `compile_applet` dan `lint_applet` untuk memastikan tidak ada kesalahan kompilasi TypeScript.
2. **Uji Alur Buku Kas**:
   - Simulasi login sebagai Admin Write: Menulis kas baru dan mengedit transaksi kas -> Memverifikasi status `pending_approval`.
   - Simulasi login sebagai Admin Approval: Menyetujui transaksi kas -> Memverifikasi status berubah menjadi `approved` dan saldo kas koperasi terakumulasi.
3. **Uji Biodata Admin**:
   - Membuka menu profil sebagai Admin Write / Approval -> Memverifikasi formulir edit biodata admin tersimpan dengan benar.
   - Membuka menu kelola admin sebagai Super Admin -> Memverifikasi pengubahan biodata admin lain berhasil.
4. **Uji Realtime Sync**:
   - Memastikan koneksi *background realtime sync* aktif ke Firestore tanpa peringatan atau *error*.
