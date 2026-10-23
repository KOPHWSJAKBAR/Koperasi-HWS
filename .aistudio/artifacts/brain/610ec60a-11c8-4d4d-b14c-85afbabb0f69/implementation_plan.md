# Rencana & Status Penyelesaian: Perbaikan Pendaftaran Anggota, Hapus Mutasi Rekening, dan Edit Rekening Penampungan

Dokumen ini merangkum penyelesaian masalah dan penguatan sistem pada aplikasi Koperasi HWS.

---

## 1. Masalah yang Ditemukan & Solusi

### A. Anggota yang Mendaftar (dari Login Mandiri maupun Tambah Admin) Hilang / Terhapus
- **Penyebab**:
  Fungsi penggabungan data (`mergeServerState` pada `server.ts` dan `mergeStates` pada `storage.ts`) sebelumnya menggunakan mapping `incoming.members.map(...)`. Jika klien/perangkat lain yang belum menerima data anggota terbaru mengirimkan sinkronisasi ke server, anggota baru tersebut ditimpa dan hilang dari daftar.
- **Solusi**:
  1. Mengubah penggabungan anggota menjadi **Union Map Berdasarkan ID** (`Map<string, MemberUser>`). Semua anggota yang terdaftar pada `current` maupun `incoming` dipertahankan secara utuh.
  2. Anggota hanya dapat dihapus jika secara eksplisit terdapat pada `deletedMemberIds`.
  3. Menambahkan *endpoint* otoritatif `POST /api/members/register` pada `server.ts` yang langsung mencatat anggota baru ke `data/koperasi_db.json`, menyiarkan event realtime `STATE_UPDATED`, dan meneruskan penyimpanan ke Firestore.
  4. Memperbarui `handleRegisterSubmit` di `LoginView.tsx` dan `handleAddMemberSubmit` di `MemberListView.tsx` agar memanggil *endpoint* registrasi server dan memastikan nilai saldo awal (`totalSimpanan: 0`) terisi lengkap.

### B. Hapus Mutasi Rekening Anggota pada Super Admin
- **Penyebab**:
  1. Validasi modal `HapusTransaksiAnggotaModal.tsx` sebelumnya menolak aksi jika `matchingTransactions.length === 0`, sehingga Super Admin tidak dapat mereset saldo simpanan anggota ke Rp 0 jika mutasi kosong atau tidak cocok dengan filter.
  2. ID mutasi yang dihapus belum dicatat ke dalam `deletedTransactionIds`, sehingga saat sinkronisasi background Firestore atau polling berikutnya berjalan, mutasi lama bisa bangkit kembali (*resurrect*).
- **Solusi**:
  1. Memperbolehkan Super Admin mengeksekusi penghapusan dan reset saldo ke Rp 0 meskipun `matchingTransactions.length === 0` selama opsi "Reset Saldo Simpanan" dicentang.
  2. Mencatat setiap transaksi yang dihapus ke dalam array `deletedTransactionIds` baik pada klien maupun server (`/api/transactions/delete-selective` dan `/api/transactions/delete-single`).
  3. Menyaring mutasi terhadap `deletedTransactionIds` di `mergeServerState` dan `mergeStates` agar mutasi yang sudah dihapus tidak pernah muncul kembali.

### C. Edit Rekening Bank Penampungan Koperasi
- **Penyebab**:
  Formulir edit rekening penampungan di `SettingModal.tsx` sebelumnya menggunakan tata letak `grid-cols-3` yang kaku dan sempit di layar mobile/tablet, tidak memiliki opsi pilihan bank cepat, belum mendukung pergantian status Rekening Utama (*Primary*), serta belum memiliki *endpoint* server khusus.
- **Solusi**:
  1. Membuat *endpoint* `POST /api/profile/rekening-penampungan` pada `server.ts` untuk menyimpan perubahan rekening penampungan secara langsung ke disk dan disiarkan ke semua perangkat.
  2. Memperbarui formulir edit rekening penampungan dengan tata letak responsif (`grid-cols-1 sm:grid-cols-3`), pilihan dropdown bank-bank nasional (BCA, Mandiri, BRI, BNI, BSI, CIMB Niaga, Permata, Danamon, BTN, DKI, BJB, Neo Commerce, Jago, Seabank) serta opsi input manual.
  3. Menambahkan fitur centang **"Jadikan Rekening Utama (Primary) untuk Pembayaran"** dengan lencana visual `UTAMA` pada kartu rekening.
  4. Mengintegrasikan penyimpanan langsung ke server dan Firestore saat edit, penambahan, maupun penghapusan rekening dilakukan.

---

## 2. Status Verifikasi

- **TypeScript Linting**: `tsc --noEmit` lolos tanpa *error* (`lint_applet` sukses).
- **Build & Compilation**: `vite build` lolos tanpa *error* (`compile_applet` sukses).
- **Dev Server**: Server berhasil dijalankan ulang dengan status aktif dan siap melayani permintaan.
