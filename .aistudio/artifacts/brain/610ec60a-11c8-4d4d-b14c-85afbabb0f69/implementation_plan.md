# Rencana Implementasi Pembaruan Koperasi HWS

Rencana ini merinci implementasi fitur-fitur baru dan penyempurnaan sistem aplikasi Koperasi Himpunan Wirausaha Sejahtera (HWS) sesuai permintaan pengguna.

---

## 1. Perlindungan & Restorasi Realtime Database (Firebase & Server)
- **Tujuan**: Memastikan integritas data anggota, saldo, mutasi kas, dan surat yang telah diinput tetap aman, tidak ter-reset atau terhapus ketika terjadi upgrade aplikasi.
- **Langkah-langkah**:
  - Konfigurasi logika `mergeServerState` di `server.ts` dan `mergeStates` di `src/lib/storage.ts` agar selalu memprioritaskan data persisten yang sudah ada di Firestore dan `koperasi_db.json`.
  - Mengamankan koleksi Firestore (`members`, `kasList`, `setoranList`, `suratList`, `auditLogs`, `notifications`) dengan sinkronisasi dua arah real-time tanpa operasi penghapusan data otomatis.
  - Memverifikasi koneksi database Firestore `ai-studio-koperasihimpunan-610ec60a-11c8-4d4d-b14c-85afbabb0f69`.

---

## 2. Menu Penyesuaian Saldo Anggota
Menu baru yang dapat diakses oleh Super Admin dan Admin yang berwenang di dalam Dashboard Pengurus:

### A. Submenu 1: Koreksi Saldo
- **Target Penerima**:
  - Pilihan: Seluruh Anggota, Per Wilayah (Cengkareng, Kalideres, Kebon Jeruk, dsb.), atau Perorangan (pilih anggota spesifik).
- **Jenis Transaksi**: Pemasukan (Kredit +) atau Pengeluaran (Debit -).
- **Pilihan Tabungan**: Tabungan Pokok atau Tabungan Umum Bebas.
- **Formulir**: Input Nominal (Rp) dan Keterangan koreksi saldo.
- **Dampak**:
  - Mengupdate saldo anggota secara massal atau perorangan.
  - Menghasilkan riwayat mutasi rekening dengan keterangan koreksi resmi.
  - Mencatat entri penyeimbang otomatis pada Buku Kas Anggota.
  - Mencatat riwayat ke log audit.

### B. Submenu 2: Pembagian Hasil (SHU / Bagi Hasil)
- **Target Penerima**: Seluruh Anggota, Per Wilayah, atau Perorangan.
- **Kalkulasi**: Menampilkan input persentase (`%`). Sistem otomatis mengalikan persentase terhadap Saldo Tabungan Pokok masing-masing anggota target.
  - Rumus: `Bagi Hasil = Saldo Pokok x (Persentase / 100)`.
- **Pilihan Buku Kas**: Pilihan pembebanan buku kas sumber dana (misal: Buku Kas Koperasi - Pos Bagi Hasil).
- **Pilihan Tujuan Kredit**: Fleksibel (dapat dipilih masuk ke Tabungan Umum bebas tarik atau menambah Tabungan Pokok).
- **Konfirmasi & Eksekusi**: Menampilkan kalkulasi total dana yang dibagikan sebelum tombol "Kirim / Proses Bagi Hasil" dieksekusi.

---

## 3. Perbaikan File Mentah & Alur Instalasi Aplikasi
- **Penyempurnaan Posisi Tombol**:
  - Memindahkan tombol "Pasang / Instal Aplikasi" di halaman Login ke **bagian paling bawah formulir login**, menjaga tampilan login tetap rapi dan fokus.
- **Perbaikan Instalasi Langsung (PWA Native Prompt)**:
  - Menyediakan penanganan event `beforeinstallprompt` langsung pada klik tombol pasang, memicu dialog instalasi native di browser Android/Chrome/Edge tanpa redirect yang membingungkan.
- **Paket Mentah & Kompatibilitas Antivirus**:
  - Menyediakan berkas unduhan mandiri yang bersih (PWA WebClip iOS `.mobileconfig`, Android APK wrapper manifest, dan executable installer script `.bat`/`.exe`) dengan metadata resmi dan hash verifikasi agar tidak ditandai sebagai ancaman oleh antivirus Windows Defender atau Play Protect.
- **Alur Persetujuan Syarat & Ketentuan**:
  - Setelah instalasi diproses/diunduh, pengguna disajikan modal persetujuan syarat & ketentuan aplikasi koperasi.
  - Ketika tombol "Setuju & Lanjutkan" diklik, pengguna otomatis diarahkan langsung ke panel login aplikasi.

---

## 4. Komponen 'Pengaturan Keamanan' (Dasbor Anggota & Admin)
- **Antarmuka Baru**:
  - Komponen kartu 'Pengaturan Keamanan Akun' di dalam pengaturan Anggota dan Admin.
  - Toggle switch interaktif: **"Aktifkan Login Biometrik (Sidik Jari / Face ID)"**.
  - Deskripsi panduan keamanan: "Gunakan sensor biometrik perangkat untuk memverifikasi identitas Anda saat masuk ke akun."
- **Penyimpanan Status**:
  - Tersimpan di `localStorage` per ID pengguna: `hws_biometric_enabled_<userId>`.
  - Default status: `false` (harus diaktifkan pengguna terlebih dahulu di dalam dasbor demi keamanan).

---

## 5. Logika Autentikasi `android.biometric` pada LoginView
- **Alur Keamanan Sebelum Autentikasi**:
  - Ketika pengguna menekan tombol "Masuk dengan Biometrik", sistem pertama-tama memeriksa:
    1. Apakah akun yang dipilih/diinput telah mengaktifkan opsi biometrik di Pengaturan Keamanan (`localStorage.getItem('hws_biometric_enabled_...') === 'true'`).
    2. Jika **belum aktif**: Tampilkan peringatan bahwa login biometrik belum diaktifkan di akun ini, dan arahkan pengguna untuk masuk terlebih dahulu menggunakan password/PIN untuk mengaktifkannya di menu Pengaturan Keamanan.
    3. Jika **sudah aktif**: Lanjutkan proses autentikasi biometrik melalui API sistem keamanan perangkat (`navigator.credentials` / WebAuthn / Touch/Face scan).

---

## 6. Laporan Kas Bulanan Multi-Halaman & Filter Periode Fleksibel
- **Halaman Depan (Ringkasan Keuangan Laba / Rugi)**:
  - Rekap Total Pemasukan vs Total Pengeluaran periode berjalan.
  - Posisi Surplus / Defisit (Laba / Rugi Bersih).
  - Ringkasan Saldo Buku Kas Anggota dan Buku Kas Koperasi.
- **Halaman Selanjutnya (Perincian Kategori & Rincian Transaksi)**:
  - Pengelompokan pemasukan dan pengeluaran berdasarkan kategori (Iuran Pokok, Zakat, Qurban, Operasional, dsb.).
  - Tabel rincian tanggal, referensi, nama anggota/penerima, nominal debit/kredit, dan saldo akhir.
- **Filter Periode Fleksibel**:
  - Opsi filter: Harian, Bulanan (pilihan bulan & tahun), Tahunan, dan Rentang Tanggal Kustom (Start Date s/d End Date).
  - Tombol Cetak PDF Berhalaman Resmi (dengan kop surat Koperasi HWS) dan Unduh Excel/CSV.

---

## 7. Penyempurnaan Logo Icon Android & iOS
- Memastikan berkas icon (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) beresolusi tinggi, berpusat sempurna, dengan rasio aman maskable untuk Android adaptive icon dan rounded corner iOS Safari WebClip.
- Memperbarui manifest.json dengan konfigurasi `maskable` dan `any` yang valid.

---

## 8. Penegasan Hak Akses (RBAC) 4 Peran Admin
Memperbarui pembatasan antarmuka dan fungsi aksi sesuai hierarki:
1. **Super Admin**: Akses penuh ke seluruh fitur (Buku Kas, Penyesuaian Saldo, Anggota, Approval, Verifikasi, Pengaturan Sistem, Hapus Data Permanen).
2. **Admin Write**:
   - Dapat menginput transaksi pengeluaran kas, zakat, qurban.
   - Dapat menambah anggota baru.
   - Perubahan data anggota / penghapusan berstatus pengajuan (memerlukan persetujuan Admin Approval / Super Admin).
   - Dapat mengunduh seluruh laporan.
   - Tidak dapat langsung menyetujui penghapusan/koreksi permanen tanpa approval.
3. **Admin Approval**:
   - Dapat menyetujui/menolak pengajuan edit dan hapus anggota.
   - Dapat menyetujui verifikasi penyaluran qurban & zakat.
   - Tidak dapat membuat entri transaksi kas baru secara mandiri.
   - Dapat melihat dan mencetak laporan.
4. **Admin Laporan**:
   - Khusus peran pembacaan dan pelaporan: hanya dapat melihat dan mengunduh laporan anggota, laporan zakat/qurban, serta laporan buku kas & neraca.
   - Tombol input, edit, hapus, dan approval disembunyikan.

---

## Tahapan Eksekusi
1. Konfigurasi penyimpanan aman dan preservasi database di `server.ts` & `src/lib/storage.ts`.
2. Pembuatan komponen `PenyesuaianSaldoModal` / View di dalam menu Admin.
3. Pembuatan komponen `PengaturanKeamanan` di dalam `SettingModal.tsx` / Dashboard.
4. Pembaruan alur biometrik dan posisi tombol pasang di `LoginView.tsx`.
5. Pembaruan tampilan laporan kas multi-halaman di `BukuKasView.tsx` dan `exportPdf.ts`.
6. Penyesuaian akses peran admin (RBAC) di `AdminDashboard.tsx`, `MemberListView.tsx`, dan `BukuKasView.tsx`.
7. Verifikasi kompilasi (`compile_applet`) dan pengujian menyeluruh.
