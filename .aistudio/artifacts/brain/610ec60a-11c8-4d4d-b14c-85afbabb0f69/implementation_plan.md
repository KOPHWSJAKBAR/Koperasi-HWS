# Rekap Implementasi & Penyempurnaan Sistem Koperasi HWS

## 1. Rumus Saldo & Buku Kas (Realtime Dashboard & Menu)
1. **Saldo Buku Kas Anggota**:
   - Total seluruh transaksi setoran anggota yang telah diverifikasi / disetujui (status: `'approved'` / `'disetujui'`).
   - Sesuai setoran anggota aktif saat ini (20 kewajiban senilai Rp 240.000, 1 tabungan umum Rp 50.000, dan 1 sedekah Rp 10.000 = **Rp 300.000**).
2. **Saldo Buku Kas Koperasi**:
   - Total dari seluruh transaksi aktif pada Buku Kas Koperasi (**Rp 0** saat ini: Penyertaan Modal Investor Rp 6.000.000 dikurangi Pengadaan Perlengkapan Rp 4.500.000 dan Stok Awal Rp 1.500.000).
3. **Saldo Kas Berjalan**:
   - **`Saldo Kas Berjalan = Saldo Buku Kas Anggota + Saldo Buku Kas Koperasi`**
   - Menghasilkan total **Rp 300.000** yang seragam dan tersinkronisasi 100% pada Dashboard Admin, Buku Kas, dan Dashboard Menu Anggota.

## 2. Aturan Input & Hapus Transaksi Buku Kas
1. **Pencegahan Tampilan Data Terhapus**:
   - Transaksi kas, mutasi rekening, dan riwayat yang telah dihapus disaring permanen dengan `deletedKasIds`, `deletedTransactionIds`, dan `deletedSetoranIds` sehingga tidak ditampilkan di Buku Kas, Mutasi Rekening, maupun Dashboard.
2. **Sinkronisasi Otomatis Tabungan Pokok & Tabungan Bebas**:
   - Transaksi anggota yang ditambahkan atau dihapus pada Buku Kas langsung menyesuaikan saldo anggota, daftar anggota, mutasi rekening, dan dashboard admin/anggota secara otomatis tanpa selisih.
3. **Sinkronisasi Otomatis Donasi Sedekah**:
   - Transaksi sedekah anggota yang ditambahkan atau dihapus pada Buku Kas otomatis memperbarui saldo sedekah anggota, total kas sedekah dashboard, daftar sedekah, dan mutasi anggota tanpa mengganggu saldo tabungan umum.

## 3. Penyesuaian Saldo Tabungan Pokok (Kelipatan 2.000 / Hari)
1. **Aturan Pembagian Otomatis**:
   - Setiap kelipatan Rp 2.000 per hari otomatis terbagi:
     - **Rp 1.000 (50%)** masuk ke Tabungan Pokok.
     - **Rp 500 (25%)** masuk ke Tabungan Qurban.
     - **Rp 500 (25%)** masuk ke Tabungan Zakat.
   - Dilengkapi tombol preset hari (1, 5, 10, 15, 30 hari) serta pratinjau pembagian persentase (50/25/25) secara visual.
2. **Penyederhanaan Menu Penyesuaian Saldo**:
   - Tab "Riwayat" pada menu Penyesuaian Saldo telah dihilangkan sesuai permintaan, menyisakan tab **1. Koreksi Saldo** dan **2. Pembagian Hasil Usaha**.

## 4. Input Transaksi Kas Multi-Buku (Anggota & Koperasi)
- Tombol aksi utama diperbarui menjadi `+ Input Transaksi Kas` dengan modal berfitur tab ganda:
  - **Kas Koperasi**: Untuk input pemasukan/pengeluaran operasional koperasi.
  - **Kas Anggota**: Dilengkapi pemilihan anggota, kategori (Pokok 50/25/25, Tabungan Bebas, Sedekah Berbagi), kalkulasi kelipatan 2.000/hari, dan sinkronisasi saldo instan ke server disk dan realtime SSE channel.
