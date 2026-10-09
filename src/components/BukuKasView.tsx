import React, { useState } from 'react';
import {
  AppState,
  AdminUser,
  KasEntry,
} from '../types';
import { formatRupiah, createAuditLog } from '../lib/storage';
import { downloadExcelCsv, printDocumentHtml } from '../lib/exportPdf';
import {
  BookOpen,
  Building,
  Users,
  PlusCircle,
  FileDown,
  Printer,
  Calendar,
  CheckCircle,
  XCircle,
  Trash2,
  Edit,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldAlert,
  X,
} from 'lucide-react';

interface BukuKasViewProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin: AdminUser;
}

export const BukuKasView: React.FC<BukuKasViewProps> = ({
  state,
  updateState,
  currentAdmin,
}) => {
  const [activeKasTab, setActiveKasTab] = useState<'anggota' | 'koperasi' | 'neraca'>('anggota');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterKategori, setFilterKategori] = useState('semua');

  // Input Kas Koperasi Form State
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [formTipe, setFormTipe] = useState<'masuk' | 'keluar'>('keluar');
  const [formKategori, setFormKategori] = useState('');
  const [formNominal, setFormNominal] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);

  // Tambah Kategori Baru State
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatTipe, setNewCatTipe] = useState<'pemasukan' | 'pengeluaran'>('pengeluaran');
  const [newCatName, setNewCatName] = useState('');

  // Check roles
  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const isPembukuan = currentAdmin.role === 'admin_pembukuan';
  const isWriter = currentAdmin.role === 'admin_write';
  const isLaporan = currentAdmin.role === 'admin_laporan';

  // Can edit/delete directly: Super Admin or Admin Pembukuan
  const canDirectModify = isSuperAdmin || isPembukuan;
  // Can input documents: Super Admin or Admin Write (Admin Pembukuan cannot input per req 6)
  const canInput = isSuperAdmin || isWriter;

  // Calculate Running Saldo Buku Kas Anggota
  let saldoKasAnggota = 0;
  const kasAnggotaList = state.kasList
    .filter((k) => k.bukuKas === 'anggota' && k.status === 'approved')
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  kasAnggotaList.forEach((k) => {
    if (k.tipe === 'masuk') saldoKasAnggota += k.nominal;
    else saldoKasAnggota -= k.nominal;
  });

  // Calculate Running Saldo Buku Kas Koperasi
  let saldoKasKoperasi = 0;
  const kasKoperasiList = state.kasList
    .filter((k) => k.bukuKas === 'koperasi' && k.status === 'approved')
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  kasKoperasiList.forEach((k) => {
    if (k.tipe === 'masuk') saldoKasKoperasi += k.nominal;
    else saldoKasKoperasi -= k.nominal;
  });

  // Filter current displayed list
  const currentList = state.kasList.filter((k) => {
    if (activeKasTab !== 'neraca' && k.bukuKas !== activeKasTab) return false;
    if (filterStartDate && k.tanggal < filterStartDate) return false;
    if (filterEndDate && k.tanggal > filterEndDate) return false;
    if (filterKategori !== 'semua' && k.kategori !== filterKategori) return false;
    return true;
  });

  // Handle Input Transaksi Kas Koperasi
  const handleInputKasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInput) {
      alert('Admin Pembukuan tidak dapat menginput dokumen (hanya approval).');
      return;
    }

    const nominal = Number(formNominal);
    if (!nominal || nominal <= 0) {
      alert('Nominal harus lebih dari 0.');
      return;
    }

    // Check no-minus rule: requirement 47 "Kedua Buku kas tidak bisa minus"
    if (formTipe === 'keluar' && nominal > saldoKasKoperasi) {
      alert(`Transaksi ditolak: Saldo Kas Koperasi tidak mencukupi (Tersedia: ${formatRupiah(saldoKasKoperasi)})`);
      return;
    }

    const newKas: KasEntry = {
      id: `kas-kop-${Date.now()}`,
      bukuKas: 'koperasi',
      tanggal: formTanggal,
      kategori: formKategori || (formTipe === 'masuk' ? 'Pemasukan Lainnya' : 'Pengeluaran Overhead'),
      keterangan: formKeterangan,
      tipe: formTipe,
      nominal,
      saldoKasSetelah: formTipe === 'masuk' ? saldoKasKoperasi + nominal : saldoKasKoperasi - nominal,
      inputBy: currentAdmin.nama,
      status: isSuperAdmin ? 'approved' : 'pending_approval',
      createdAt: new Date().toISOString(),
    };

    const audit = createAuditLog(
      currentAdmin,
      'Input Kas Koperasi',
      `${formTipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran'} ${formatRupiah(nominal)}: ${formKeterangan}`,
      newKas.id
    );

    await updateState((prev) => ({
      ...prev,
      kasList: [newKas, ...prev.kasList],
      auditLogs: [audit, ...prev.auditLogs],
    }));

    setIsInputModalOpen(false);
    setFormNominal('');
    setFormKeterangan('');
    alert(isSuperAdmin ? 'Transaksi kas berhasil dicatat!' : 'Transaksi diajukan, menunggu persetujuan Super Admin / Pembukuan.');
  };

  // Handle Delete Kas Entry
  const handleDeleteKas = async (entry: KasEntry) => {
    if (entry.bukuKas === 'anggota' && !isSuperAdmin) {
      alert('Buku kas anggota tidak dapat diubah sembarangan per SOP koperasi.');
      return;
    }

    if (!canDirectModify) {
      // Writer needs approval
      const confirmReq = confirm('Ajukan penghapusan transaksi ini untuk verifikasi Super Admin / Pembukuan?');
      if (!confirmReq) return;

      await updateState((prev) => ({
        ...prev,
        kasList: prev.kasList.map((k) =>
          k.id === entry.id
            ? { ...k, status: 'pending_approval', pendingAction: 'delete' }
            : k
        ),
      }));
      alert('Pengajuan hapus transaksi berhasil dikirim ke Super Admin.');
      return;
    }

    const confirmDelete = confirm(`Hapus transaksi "${entry.keterangan}" (${formatRupiah(entry.nominal)})? Saldo kas akan otomatis disesuaikan.`);
    if (!confirmDelete) return;

    await updateState((prev) => {
      const filteredKas = prev.kasList.filter((k) => k.id !== entry.id);
      const audit = createAuditLog(
        currentAdmin,
        'Hapus Transaksi Kas',
        `Menghapus transaksi [${entry.bukuKas}] ${entry.keterangan} senilai ${formatRupiah(entry.nominal)}`,
        entry.id
      );
      return {
        ...prev,
        kasList: filteredKas,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Handle Approval for pending kas changes
  const handleApproveKasAction = async (entry: KasEntry, isApproved: boolean) => {
    if (!canDirectModify) return;

    await updateState((prev) => {
      let updatedList = [...prev.kasList];
      if (isApproved) {
        if (entry.pendingAction === 'delete') {
          updatedList = updatedList.filter((k) => k.id !== entry.id);
        } else {
          updatedList = updatedList.map((k) =>
            k.id === entry.id ? { ...k, status: 'approved', approvedBy: currentAdmin.nama, pendingAction: undefined } : k
          );
        }
      } else {
        updatedList = updatedList.map((k) =>
          k.id === entry.id ? { ...k, status: 'rejected', approvedBy: currentAdmin.nama } : k
        );
      }

      const audit = createAuditLog(
        currentAdmin,
        isApproved ? 'Setujui Transaksi Kas' : 'Tolak Transaksi Kas',
        `${isApproved ? 'Menyetujui' : 'Menolak'} perubahan kas ${entry.keterangan}`,
        entry.id
      );

      return {
        ...prev,
        kasList: updatedList,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Add Category Handler
  // Add Category Handler
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    await updateState((prev) => ({
      ...prev,
      categoriesKasKoperasi: {
        ...prev.categoriesKasKoperasi,
        [newCatTipe]: [...prev.categoriesKasKoperasi[newCatTipe], newCatName.trim()],
      },
    }));

    setNewCatName('');
  };

  // Delete Category Handler per User Req
  const handleDeleteCategory = async (tipe: 'pemasukan' | 'pengeluaran', catName: string) => {
    const confirmDel = confirm(`Hapus kategori "${catName}" dari daftar kategori kas koperasi?`);
    if (!confirmDel) return;

    await updateState((prev) => ({
      ...prev,
      categoriesKasKoperasi: {
        ...prev.categoriesKasKoperasi,
        [tipe]: prev.categoriesKasKoperasi[tipe].filter((c) => c !== catName),
      },
    }));
  };

  // Export Kas Report to CSV / PDF with Watermark per User Req
  const handleExportKas = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const rows = currentList.map((k) => ({
        'Koperasi': 'Koperasi Himpunan Wirausaha Sejahtera',
        Tanggal: k.tanggal,
        'Buku Kas': k.bukuKas === 'anggota' ? 'Kas Anggota' : 'Kas Koperasi',
        Kategori: isLaporan ? 'Umum' : k.kategori,
        Keterangan: k.keterangan,
        Tipe: k.tipe === 'masuk' ? 'MASUK (CR)' : 'KELUAR (DB)',
        Nominal: k.nominal,
        'Dibuat Oleh': k.inputBy,
        Status: k.status,
      }));
      downloadExcelCsv(rows, `Buku_Kas_${activeKasTab}_${Date.now()}`);
    } else {
      const tableRows = currentList
        .map(
          (k) => `
        <tr style="border-bottom: 1px solid #ddd; font-size: 11px;">
          <td style="padding: 6px;">${k.tanggal}</td>
          <td style="padding: 6px; font-weight: 700;">${isLaporan ? 'Umum' : k.kategori}</td>
          <td style="padding: 6px;">${k.keterangan}</td>
          <td style="padding: 6px; text-align: right; color: ${k.tipe === 'masuk' ? '#047857' : '#b91c1c'}; font-weight: 700;">
            ${formatRupiah(k.nominal)} ${k.tipe === 'masuk' ? 'CR' : 'DB'}
          </td>
          <td style="padding: 6px;">${k.inputBy}</td>
        </tr>
      `
        )
        .join('');

      const html = `
        <div style="position: relative; padding: 15px;">
          <!-- Watermark Koperasi HWS di PDF -->
          <div style="position: absolute; inset: 0; pointer-events: none; opacity: 0.05; display: grid; grid-template-columns: repeat(3, 1fr); gap: 60px; align-items: center; justify-items: center; z-index: 0;">
            ${Array.from({ length: 12 })
              .map(
                () => `
              <div style="text-align: center; font-weight: 900; font-size: 18px; transform: rotate(-25deg); color: #000;">
                KOPERASI HWS
              </div>
            `
              )
              .join('')}
          </div>

          <div style="position: relative; z-index: 10;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px;">
              <div>
                <h2 style="font-size: 16px; font-weight: 900; margin: 0;">KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA</h2>
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #b45309; margin-top: 2px;">
                  Laporan ${activeKasTab === 'anggota' ? 'Buku Kas Anggota' : 'Buku Kas Koperasi'}
                </div>
                ${filterStartDate || filterEndDate ? `<div style="font-size: 10px; color: #555;">Periode: ${filterStartDate || 'Awal'} s/d ${filterEndDate || 'Sekarang'}</div>` : ''}
              </div>
              <div style="font-size: 10px; text-align: right;">
                <div>Dicetak: ${new Date().toLocaleDateString('id-ID')}</div>
                <div style="font-weight: 700; color: #047857;">Dokumen Resmi Koperasi HWS</div>
              </div>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #ddd;">
              <thead>
                <tr style="background: #f3f4f6; font-size: 11px; text-align: left; border-bottom: 1px solid #ddd;">
                  <th style="padding: 6px;">Tanggal</th>
                  <th style="padding: 6px;">Kategori</th>
                  <th style="padding: 6px;">Keterangan</th>
                  <th style="padding: 6px; text-align: right;">Mutasi</th>
                  <th style="padding: 6px;">Petugas</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </div>
      `;
      printDocumentHtml(html, `Laporan_Buku_Kas_${activeKasTab}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Tabs */}
      <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              Buku Kas & Laporan Neraca Keuangan
            </h3>
            <p className="text-xs text-slate-400">
              Sistem pencatatan ganda Kas Anggota, Kas Koperasi, dan Neraca Laba Rugi
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canInput && activeKasTab === 'koperasi' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsInputModalOpen(true)}
                  className="py-2 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  + Input Kas Koperasi
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddCatModalOpen(true)}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-sky-400 border border-sky-500/30 rounded-xl font-bold flex items-center gap-1.5 transition-all"
                  title="Tambah atau hapus kategori kas koperasi"
                >
                  <Edit className="w-4 h-4 text-sky-400" />
                  Kelola Kategori
                </button>
              </>
            )}

            <button
              onClick={() => handleExportKas('pdf')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 border border-amber-500/30 rounded-xl font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Cetak PDF
            </button>
            <button
              onClick={() => handleExportKas('excel')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-emerald-400 border border-emerald-500/30 rounded-xl font-bold flex items-center gap-1.5"
            >
              <FileDown className="w-4 h-4" />
              Unduh Excel
            </button>
          </div>
        </div>

        {/* 3 Main Tab Buttons */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button
            onClick={() => setActiveKasTab('anggota')}
            className={`py-3 px-3 rounded-2xl text-left border transition-all ${
              activeKasTab === 'anggota'
                ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <Users className="w-4 h-4" />
              1. Buku Kas Anggota
            </div>
            <div className="text-sm font-black text-amber-400 mt-1">
              {formatRupiah(saldoKasAnggota)}
            </div>
            <div className="text-[10px] text-slate-400">Simpanan Pokok & Bebas</div>
          </button>

          <button
            onClick={() => setActiveKasTab('koperasi')}
            className={`py-3 px-3 rounded-2xl text-left border transition-all ${
              activeKasTab === 'koperasi'
                ? 'bg-sky-500/10 border-sky-500 text-sky-300 ring-1 ring-sky-500'
                : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <Building className="w-4 h-4" />
              2. Buku Kas Koperasi
            </div>
            <div className="text-sm font-black text-sky-400 mt-1">
              {formatRupiah(saldoKasKoperasi)}
            </div>
            <div className="text-[10px] text-slate-400">Overhead, Zakat & Qurban</div>
          </button>

          <button
            onClick={() => setActiveKasTab('neraca')}
            className={`py-3 px-3 rounded-2xl text-left border transition-all ${
              activeKasTab === 'neraca'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <Scale className="w-4 h-4" />
              3. Neraca & Laba Rugi
            </div>
            <div className="text-sm font-black text-emerald-400 mt-1">
              {formatRupiah(saldoKasAnggota + saldoKasKoperasi)}
            </div>
            <div className="text-[10px] text-slate-400">Konsolidasi Keuangan</div>
          </button>
        </div>

        {/* Filter Controls (Hidden for Admin Laporan category per req 46) */}
        {activeKasTab !== 'neraca' && (
          <div className="space-y-3 mt-4 pt-4 border-t border-slate-700/60">
            {/* Quick Period Buttons per User Req: Tahunan, Bulanan, Harian, dan Harian Rentang */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-bold mr-1">Filter Periode:</span>
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setFilterStartDate(today);
                  setFilterEndDate(today);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-bold border border-slate-700"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const y = now.getFullYear();
                  const m = String(now.getMonth() + 1).padStart(2, '0');
                  setFilterStartDate(`${y}-${m}-01`);
                  setFilterEndDate(now.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-bold border border-slate-700"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const y = now.getFullYear();
                  setFilterStartDate(`${y}-01-01`);
                  setFilterEndDate(now.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-bold border border-slate-700"
              >
                Tahun Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterStartDate('');
                  setFilterEndDate('');
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold border border-slate-700"
              >
                Semua Periode
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Kategori Transaksi</label>
              {isLaporan ? (
                <div className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-400">
                  Kategori Internal Terproteksi
                </div>
              ) : (
                <select
                  value={filterKategori}
                  onChange={(e) => setFilterKategori(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="semua">Semua Kategori</option>
                  {activeKasTab === 'koperasi' ? (
                    <>
                      {state.categoriesKasKoperasi.pemasukan.map((c) => (
                        <option key={c} value={c}>[+] {c}</option>
                      ))}
                      {state.categoriesKasKoperasi.pengeluaran.map((c) => (
                        <option key={c} value={c}>[-] {c}</option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value="Tabungan Pokok">Tabungan Pokok</option>
                      <option value="Setoran Tabungan Umum">Setoran Tabungan Umum</option>
                      <option value="Penarikan Tabungan Umum">Penarikan Tabungan Umum</option>
                    </>
                  )}
                </select>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* ================= VIEW TABEL ATAU NERACA ================= */}
      {activeKasTab === 'neraca' ? (
        /* Neraca & Laba Rugi Report View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Laba Rugi Operasional */}
          <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4 pb-2 border-b border-slate-700">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Laporan Laba / Rugi Koperasi
            </h4>

            <div className="space-y-4 text-xs">
              <div>
                <div className="font-bold text-emerald-400 mb-1">PENDAPATAN & PENERIMAAN:</div>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Penerimaan Zakat & Qurban</span>
                    <span className="font-mono">{formatRupiah(saldoKasKoperasi > 0 ? saldoKasKoperasi : 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Pendapatan Jasa & Administrasi</span>
                    <span className="font-mono">{formatRupiah(0)}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="font-bold text-red-400 mb-1">BEBAN & PENGELUARAN OVERHEAD:</div>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Beban Operasional & ATK</span>
                    <span className="font-mono">{formatRupiah(0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Sewa Kantor & Utilitas</span>
                    <span className="font-mono">{formatRupiah(0)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-700 flex justify-between font-bold text-sm">
                <span className="text-white">SURPLUS / HASIL USAHA BERJALAN:</span>
                <span className="text-emerald-400 font-mono font-black">{formatRupiah(saldoKasKoperasi)}</span>
              </div>
            </div>
          </div>

          {/* Neraca Keuangan */}
          <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4 pb-2 border-b border-slate-700">
              <Scale className="w-4 h-4 text-amber-400" />
              Laporan Posisi Keuangan (Neraca)
            </h4>

            <div className="space-y-4 text-xs">
              <div>
                <div className="font-bold text-amber-400 mb-1">ASET LANCAR (KAS & BANK):</div>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Kas di Bank (Kas Anggota)</span>
                    <span className="font-mono">{formatRupiah(saldoKasAnggota)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Kas di Bank (Kas Koperasi)</span>
                    <span className="font-mono">{formatRupiah(saldoKasKoperasi)}</span>
                  </div>
                </div>
                <div className="pt-1 flex justify-between font-bold text-slate-200">
                  <span>Total Aset Lancar:</span>
                  <span className="font-mono text-amber-400">{formatRupiah(saldoKasAnggota + saldoKasKoperasi)}</span>
                </div>
              </div>

              <div>
                <div className="font-bold text-sky-400 mb-1">KEWAJIBAN & EKUITAS:</div>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Simpanan Pokok Anggota</span>
                    <span className="font-mono">
                      {formatRupiah(state.members.reduce((acc, m) => acc + m.saldoPokok, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Simpanan Umum Anggota</span>
                    <span className="font-mono">
                      {formatRupiah(state.members.reduce((acc, m) => acc + m.saldoUmum, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Titipan Zakat & Qurban</span>
                    <span className="font-mono">
                      {formatRupiah(
                        state.members.reduce((acc, m) => acc + m.saldoZakatFitrah + m.saldoQurban, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-700 flex justify-between font-bold text-sm">
                <span className="text-white">BALANCE NERACA:</span>
                <span className="text-emerald-400 font-mono font-black">
                  {formatRupiah(saldoKasAnggota + saldoKasKoperasi)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Table of Cashbook Transactions */
        <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/40 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Tanggal</th>
                  {!isLaporan && <th className="py-2.5 px-3">Kategori</th>}
                  <th className="py-2.5 px-3">Keterangan</th>
                  <th className="py-2.5 px-3 text-right">Mutasi Masuk (CR)</th>
                  <th className="py-2.5 px-3 text-right">Mutasi Keluar (DB)</th>
                  <th className="py-2.5 px-3">Petugas</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {currentList.map((entry) => {
                  const isMasuk = entry.tipe === 'masuk';
                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-300">{entry.tanggal}</td>
                      {!isLaporan && (
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                            {entry.kategori}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{entry.keterangan}</div>
                        {entry.status === 'pending_approval' && (
                          <span className="text-[10px] text-amber-400 font-semibold">
                            ⏳ Menunggu Persetujuan ({entry.pendingAction || 'create'})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        {isMasuk ? formatRupiah(entry.nominal) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-red-400">
                        {!isMasuk ? formatRupiah(entry.nominal) : '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{entry.inputBy}</td>
                      <td className="py-3 px-3 text-right">
                        {entry.status === 'pending_approval' && canDirectModify ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleApproveKasAction(entry, true)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                              title="Setujui"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleApproveKasAction(entry, false)}
                              className="p-1 text-red-400 hover:text-red-300"
                              title="Tolak"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : canDirectModify || isWriter ? (
                          <button
                            onClick={() => handleDeleteKas(entry)}
                            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                            title="Hapus Transaksi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {currentList.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">
                Belum ada transaksi pada buku kas ini.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL INPUT KAS KOPERASI ================= */}
      {isInputModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl">
            <h3 className="text-sm font-extrabold text-white mb-3 pb-2 border-b border-slate-700">
              Input Transaksi Buku Kas Koperasi
            </h3>

            <form onSubmit={handleInputKasSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Jenis Transaksi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormTipe('masuk')}
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      formTipe === 'masuk'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    + Pemasukan (CR)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTipe('keluar')}
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      formTipe === 'keluar'
                        ? 'bg-red-500/20 border-red-500 text-red-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    - Pengeluaran (DB)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-300">Kategori</label>
                  <button
                    type="button"
                    onClick={() => setIsAddCatModalOpen(true)}
                    className="text-[10px] text-amber-400 hover:underline"
                  >
                    + Tambah Kategori
                  </button>
                </div>
                <select
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">Pilih Kategori</option>
                  {(formTipe === 'masuk'
                    ? state.categoriesKasKoperasi.pemasukan
                    : state.categoriesKasKoperasi.pengeluaran
                  ).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nominal Bebas (Ketik Langsung per req 3)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={formNominal}
                  onChange={(e) => setFormNominal(e.target.value)}
                  placeholder="Ketik nominal rupiah"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Tanggal</label>
                <input
                  type="date"
                  required
                  value={formTanggal}
                  onChange={(e) => setFormTanggal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Keterangan Lengkap</label>
                <textarea
                  required
                  rows={2}
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder="Rincian peruntukan transaksi..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInputModalOpen(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Kategori Kas Koperasi (Tambah & Kurang Kategori) */}
      {isAddCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <div>
                <h4 className="text-sm font-extrabold text-white">Kelola Kategori Kas Koperasi</h4>
                <p className="text-[11px] text-slate-400">Tambah atau kurangi daftar kategori buku kas</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCatModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List Kategori Pemasukan */}
            <div className="space-y-2 mb-4">
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Kategori Pemasukan ({state.categoriesKasKoperasi.pemasukan.length})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto p-1">
                {state.categoriesKasKoperasi.pemasukan.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs"
                  >
                    <span className="text-slate-200">{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory('pemasukan', cat)}
                      className="p-1 rounded-lg text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* List Kategori Pengeluaran */}
            <div className="space-y-2 mb-5">
              <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                Kategori Pengeluaran ({state.categoriesKasKoperasi.pengeluaran.length})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto p-1">
                {state.categoriesKasKoperasi.pengeluaran.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs"
                  >
                    <span className="text-slate-200">{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory('pengeluaran', cat)}
                      className="p-1 rounded-lg text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Tambah Kategori Baru */}
            <form onSubmit={handleAddCategory} className="p-3 bg-slate-900/90 rounded-2xl border border-slate-700/80 space-y-3">
              <div className="text-xs font-black text-amber-400">+ Tambah Kategori Baru</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Tipe Transaksi</label>
                  <select
                    value={newCatTipe}
                    onChange={(e) => setNewCatTipe(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="pemasukan">Pemasukan (+)</option>
                    <option value="pengeluaran">Pengeluaran (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Nama Kategori</label>
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Contoh: Operasional IT"
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all"
              >
                + Simpan Kategori Baru
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
