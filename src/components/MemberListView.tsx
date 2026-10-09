import React, { useState } from 'react';
import {
  AppState,
  MemberUser,
  AdminUser,
  WilayahKoperasi,
} from '../types';
import { formatRupiah, generateNomorRekening, generateNomorAnggota, createAuditLog } from '../lib/storage';
import { downloadExcelCsv, printDocumentHtml } from '../lib/exportPdf';
import { KtaDigitalModal } from './KtaDigitalModal';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  FileDown,
  Printer,
  ShieldAlert,
  Trash2,
  Edit,
  Eye,
  Lock,
  Unlock,
  CheckCircle,
  X,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';

interface MemberListViewProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin: AdminUser;
}

export const MemberListView: React.FC<MemberListViewProps> = ({
  state,
  updateState,
  currentAdmin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWilayah, setSelectedWilayah] = useState<string>('semua');
  const [selectedMemberForKta, setSelectedMemberForKta] = useState<MemberUser | null>(null);
  const [editingMember, setEditingMember] = useState<MemberUser | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Period filter states for reports
  const [periodeTipe, setPeriodeTipe] = useState<'semua' | 'harian' | 'bulanan' | 'tahunan'>('semua');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

  // New Member Form State
  const [formNama, setFormNama] = useState('');
  const [formNik, setFormNik] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formWilayah, setFormWilayah] = useState<WilayahKoperasi>('Cengkareng');
  const [formAlamat, setFormAlamat] = useState('');
  const [formProvinsi, setFormProvinsi] = useState('DKI Jakarta');
  const [formKota, setFormKota] = useState('Jakarta Barat');
  const [formKecamatan, setFormKecamatan] = useState('Cengkareng');
  const [formKelurahan, setFormKelurahan] = useState('');
  const [formRt, setFormRt] = useState('001');
  const [formRw, setFormRw] = useState('001');
  const [formKodePos, setFormKodePos] = useState('11740');
  const [formBank, setFormBank] = useState('Bank Central Asia (BCA)');
  const [formRekPribadi, setFormRekPribadi] = useState('');
  const [formAtasNama, setFormAtasNama] = useState('');
  const [formPassword, setFormPassword] = useState('user123');

  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const isWriter = currentAdmin.role === 'admin_write';
  const isKelola = currentAdmin.role === 'admin_kelola' || currentAdmin.role === 'admin_pembukuan';

  // Members pending deletion approval
  const pendingDeleteMembers = state.members.filter(
    (m) => m.status === 'pending_deletion' || m.status === 'pending'
  );

  // Filter members
  const filteredMembers = state.members.filter((m) => {
    if (selectedWilayah !== 'semua' && m.wilayah !== selectedWilayah) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        m.nama.toLowerCase().includes(q) ||
        m.nomorAnggota.toLowerCase().includes(q) ||
        m.nomorRekening.includes(q) ||
        m.whatsapp.includes(q) ||
        m.nik.includes(q);
      if (!match) return false;
    }
    // Period filter
    const joinDate = m.terdaftarSejak || '2026-01-01';
    if (periodeTipe === 'harian') {
      if (filterStartDate && joinDate < filterStartDate) return false;
      if (filterEndDate && joinDate > filterEndDate) return false;
    } else if (periodeTipe === 'bulanan' && filterMonth) {
      if (!joinDate.startsWith(filterMonth)) return false;
    } else if (periodeTipe === 'tahunan' && filterYear) {
      if (!joinDate.startsWith(filterYear)) return false;
    }
    return true;
  });

  // Toggle lock on Tabungan Pokok
  const handleToggleLockPokok = async (member: MemberUser) => {
    const newStatus = !member.isPokokLocked;
    await updateState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === member.id ? { ...m, isPokokLocked: newStatus } : m
      ),
      auditLogs: [
        createAuditLog(
          currentAdmin,
          newStatus ? 'Kunci Tabungan Pokok' : 'Buka Kunci Tabungan Pokok',
          `Mengubah status lock tabungan pokok untuk ${member.nama} (${member.nomorAnggota})`,
          member.id
        ),
        ...prev.auditLogs,
      ],
    }));
  };

  // Delete Member (Admin write requires approval from super admin or admin kelola)
  const handleDeleteMember = async (member: MemberUser) => {
    if (!isSuperAdmin && !isKelola && !isWriter) {
      alert('Anda tidak memiliki hak untuk menghapus anggota.');
      return;
    }

    if (isWriter) {
      const confirmReq = confirm(
        `Ajukan penghapusan anggota ${member.nama} (${member.nomorAnggota}) ke Super Admin / Admin Kelola?`
      );
      if (!confirmReq) return;

      await updateState((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.id === member.id ? { ...m, status: 'pending_deletion' } : m
        ),
        auditLogs: [
          createAuditLog(
            currentAdmin,
            'Pengajuan Hapus Anggota',
            `Admin write mengajukan penghapusan anggota ${member.nama} (${member.nomorAnggota})`,
            member.id
          ),
          ...prev.auditLogs,
        ],
      }));
      alert('Pengajuan hapus anggota berhasil dikirim. Menunggu persetujuan Super Admin atau Admin Kelola.');
      return;
    }

    // Super Admin or Admin Kelola directly executes delete
    await executeApprovedDelete(member);
  };

  // Execute deletion and record to Cash Books per User Req 1
  const executeApprovedDelete = async (member: MemberUser) => {
    const totalSaldo = member.saldoPokok + member.saldoUmum + member.saldoZakatFitrah + member.saldoQurban;
    const confirmDelete = confirm(
      `Setujui & hapus data anggota ${member.nama} (${member.nomorAnggota})?\n` +
      `Sisa Saldo: ${formatRupiah(totalSaldo)}.\n` +
      `Saldo akan otomatis dicatat keluar dari Buku Kas Anggota dan masuk ke Buku Kas Koperasi sebagai Tutup Account.`
    );

    if (!confirmDelete) return;

    const now = new Date();
    const tgl = now.toISOString().split('T')[0];

    await updateState((prev) => {
      let updatedKasList = [...prev.kasList];

      if (totalSaldo > 0) {
        // Keluar dari Buku Kas Anggota
        updatedKasList.unshift({
          id: `kas-del-ang-${Date.now()}`,
          bukuKas: 'anggota',
          tanggal: tgl,
          kategori: 'Pindah Kas Hapus Akun',
          keterangan: `pindah kas hapus account ${member.nama}`,
          tipe: 'keluar',
          nominal: totalSaldo,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        });

        // Masuk ke Buku Kas Koperasi
        updatedKasList.unshift({
          id: `kas-del-kop-${Date.now() + 1}`,
          bukuKas: 'koperasi',
          tanggal: tgl,
          kategori: 'Pindah Kas Tutup Akun',
          keterangan: `Tutup acoount ${member.nama} dan sisa saldo ${formatRupiah(totalSaldo)}`,
          tipe: 'masuk',
          nominal: totalSaldo,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        });
      }

      const audit = createAuditLog(
        currentAdmin,
        'Hapus Anggota Koperasi',
        `Menyetujui penghapusan anggota ${member.nama} (${member.nomorAnggota}). Saldo dialihkan ke Kas Koperasi: ${formatRupiah(totalSaldo)}`,
        member.id
      );

      return {
        ...prev,
        members: prev.members.filter((m) => m.id !== member.id),
        kasList: updatedKasList,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    alert(`Anggota ${member.nama} berhasil dihapus dan saldo dicatat di buku kas!`);
  };

  // Reject Deletion Request
  const handleRejectDelete = async (member: MemberUser) => {
    await updateState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === member.id ? { ...m, status: 'aktif' } : m
      ),
      auditLogs: [
        createAuditLog(
          currentAdmin,
          'Tolak Hapus Anggota',
          `Menolak permohonan hapus anggota ${member.nama} (${member.nomorAnggota})`,
          member.id
        ),
        ...prev.auditLogs,
      ],
    }));
    alert(`Pengajuan hapus anggota ${member.nama} ditolak.`);
  };

  // Add Member by Admin
  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate unique NIK & HP
    const existNik = state.members.find((m) => m.nik === formNik.trim());
    if (existNik) {
      alert('NIK ini sudah terdaftar sebagai anggota koperasi.');
      return;
    }
    const cleanHp = formWhatsapp.replace(/\D/g, '');
    const existHp = state.members.find((m) => m.whatsapp.replace(/\D/g, '') === cleanHp);
    if (existHp) {
      alert('Nomor WhatsApp ini sudah digunakan oleh anggota lain.');
      return;
    }

    const { nomorRekening, nextRunningNumber } = generateNomorRekening(
      formWilayah,
      formWhatsapp,
      state.lastRunningNumber
    );
    const nomorAnggota = generateNomorAnggota(formWilayah, state.members.length);

    const newMember: MemberUser = {
      id: `mem-${Date.now()}`,
      nomorAnggota,
      nomorRekening,
      nama: formNama.trim(),
      nik: formNik.trim(),
      whatsapp: formWhatsapp.trim(),
      email: formEmail.trim(),
      wilayah: formWilayah,
      alamatLengkap: formAlamat.trim(),
      provinsi: formProvinsi,
      kota: formKota,
      kecamatan: formKecamatan,
      kelurahan: formKelurahan,
      rt: formRt,
      rw: formRw,
      kodePos: formKodePos,
      bankPribadi: {
        namaBank: formBank,
        nomorRekening: formRekPribadi,
        atasNama: formAtasNama || formNama,
      },
      password: formPassword,
      saldoPokok: 0,
      isPokokLocked: true,
      saldoZakatFitrah: 0,
      saldoQurban: 0,
      saldoUmum: 0,
      status: 'aktif',
      terdaftarSejak: new Date().toISOString().split('T')[0],
    };

    await updateState((prev) => ({
      ...prev,
      members: [...prev.members, newMember],
      lastRunningNumber: nextRunningNumber,
      auditLogs: [
        createAuditLog(
          currentAdmin,
          'Tambah Anggota',
          `Admin menambahkan anggota baru ${newMember.nama} (${newMember.nomorAnggota})`,
          newMember.id
        ),
        ...prev.auditLogs,
      ],
    }));

    setShowAddModal(false);
    alert(`Anggota berhasil ditambahkan! Rekening: ${nomorRekening}`);
  };

  // Edit Member Profile Save
  const handleSaveEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    await updateState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === editingMember.id ? editingMember : m
      ),
      auditLogs: [
        createAuditLog(
          currentAdmin,
          'Edit Profil Anggota',
          `Memperbarui profil anggota ${editingMember.nama} (${editingMember.nomorAnggota})`,
          editingMember.id
        ),
        ...prev.auditLogs,
      ],
    }));

    setEditingMember(null);
    alert('Data anggota berhasil diperbarui!');
  };

  // Export Rekap Anggota
  const handleExportMembers = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      // Sesuai permintaan 3: kolom pada excel hanya menampilkan nomor anggota, nama lengkap, nomor rekening, wilayah, tabungan pokok, tabungan umum, tabungan simpanan, dan total keseluruhan.
      const rows = filteredMembers.map((m) => ({
        'Nomor Anggota': m.nomorAnggota,
        'Nama Lengkap': m.nama,
        'Nomor Rekening': m.nomorRekening,
        'Wilayah': m.wilayah,
        'Tabungan Pokok': m.saldoPokok,
        'Tabungan Umum': m.saldoUmum,
        'Tabungan Simpanan': m.saldoZakatFitrah + m.saldoQurban,
        'Total Keseluruhan': m.saldoPokok + m.saldoUmum + m.saldoZakatFitrah + m.saldoQurban,
      }));
      downloadExcelCsv(rows, `Rekap_Anggota_HWS_${selectedWilayah}_${Date.now()}`);
    } else {
      const tableRows = filteredMembers
        .map(
          (m) => `
        <tr style="border-bottom: 1px solid #ddd; font-size: 11px;">
          <td style="padding: 6px; font-family: monospace;">${m.nomorAnggota}</td>
          <td style="padding: 6px; font-weight: 700;">${m.nama}</td>
          <td style="padding: 6px; font-family: monospace;">${m.nomorRekening}</td>
          <td style="padding: 6px;">${m.wilayah}</td>
          <td style="padding: 6px; text-align: right;">${formatRupiah(m.saldoPokok)}</td>
          <td style="padding: 6px; text-align: right;">${formatRupiah(m.saldoUmum)}</td>
          <td style="padding: 6px; text-align: right;">${formatRupiah(m.saldoZakatFitrah + m.saldoQurban)}</td>
          <td style="padding: 6px; text-align: right; font-weight: 700;">
            ${formatRupiah(m.saldoPokok + m.saldoUmum + m.saldoZakatFitrah + m.saldoQurban)}
          </td>
        </tr>
      `
        )
        .join('');

      const html = `
        <div style="padding: 10px;">
          <div style="border-bottom: 2px solid #000; padding-bottom: 8px;">
            <h2 style="font-size: 16px; font-weight: 900;">KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA</h2>
            <div style="font-size: 12px; font-weight: 700;">Laporan Rekapitulasi Data Anggota (${selectedWilayah.toUpperCase()})</div>
            <div style="font-size: 10px; color: #555;">Periode: ${periodeTipe.toUpperCase()} • Total: ${filteredMembers.length} Anggota</div>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 14px;">
            <thead>
              <tr style="background: #f3f4f6; font-size: 11px; text-align: left;">
                <th style="padding: 6px;">No. Anggota</th>
                <th style="padding: 6px;">Nama Lengkap</th>
                <th style="padding: 6px;">No. Rekening</th>
                <th style="padding: 6px;">Wilayah</th>
                <th style="padding: 6px; text-align: right;">Tab. Pokok</th>
                <th style="padding: 6px; text-align: right;">Tab. Umum</th>
                <th style="padding: 6px; text-align: right;">Tab. Simpanan</th>
                <th style="padding: 6px; text-align: right;">Total Keseluruhan</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      `;
      printDocumentHtml(html, `Rekap_Anggota_${selectedWilayah}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* PENDING DELETION APPROVAL ALERT BOX FOR SUPER ADMIN & ADMIN KELOLA */}
      {(isSuperAdmin || isKelola) && pendingDeleteMembers.length > 0 && (
        <div className="bg-red-950/40 border border-red-500/50 rounded-3xl p-5 shadow-2xl space-y-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h4 className="font-black text-sm text-red-200">
              Permintaan Hapus Anggota Menunggu Persetujuan ({pendingDeleteMembers.length} Anggota)
            </h4>
          </div>
          <p className="text-xs text-red-300/80">
            Diajukan oleh Admin Write. Jika disetujui, saldo terakhir anggota akan dicatat keluar dari Buku Kas Anggota dan masuk ke Kas Koperasi sebagai Tutup Account.
          </p>
          <div className="space-y-2 pt-1">
            {pendingDeleteMembers.map((m) => {
              const total = m.saldoPokok + m.saldoUmum + m.saldoZakatFitrah + m.saldoQurban;
              return (
                <div
                  key={m.id}
                  className="p-3 bg-slate-900/90 rounded-2xl border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-extrabold text-white">
                      {m.nama} ({m.nomorAnggota})
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Rekening: <span className="font-mono text-amber-400">{m.nomorRekening}</span> • Wilayah: {m.wilayah}
                    </div>
                    <div className="text-[11px] text-amber-300 font-bold mt-0.5">
                      Sisa Saldo Terakhir: {formatRupiah(total)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRejectDelete(m)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => executeApprovedDelete(m)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl shadow"
                    >
                      Setujui Hapus & Catat ke Buku Kas
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              Kelola & Rekapitulasi Data Anggota Koperasi
            </h3>
            <p className="text-xs text-slate-400">
              Total {state.members.length} anggota aktif terdaftar di seluruh wilayah
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(isSuperAdmin || isWriter) && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                + Tambah Anggota Baru
              </button>
            )}

            <button
              onClick={() => handleExportMembers('pdf')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 border border-amber-500/30 rounded-xl font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Cetak PDF
            </button>
            <button
              onClick={() => handleExportMembers('excel')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-emerald-400 border border-emerald-500/30 rounded-xl font-bold flex items-center gap-1.5"
            >
              <FileDown className="w-4 h-4" />
              Unduh Excel
            </button>
          </div>
        </div>

        {/* Search & Region Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, NIK, No. Rekening (10 digit), No. Anggota, No. HP..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <select
              value={selectedWilayah}
              onChange={(e) => setSelectedWilayah(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
            >
              <option value="semua">Semua Wilayah</option>
              <option value="Cengkareng">Wilayah Cengkareng</option>
              <option value="Kalideres">Wilayah Kalideres</option>
              <option value="Kembangan">Wilayah Kembangan</option>
              <option value="Kebon Jeruk">Wilayah Kebon Jeruk</option>
            </select>
          </div>
        </div>

        {/* Filter Periode Laporan per req 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-700/60 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Periode Rekap</label>
            <select
              value={periodeTipe}
              onChange={(e) => setPeriodeTipe(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="semua">Semua Periode</option>
              <option value="harian">Harian (Rentang Tanggal)</option>
              <option value="bulanan">Bulanan</option>
              <option value="tahunan">Tahunan</option>
            </select>
          </div>

          {periodeTipe === 'harian' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </>
          )}

          {periodeTipe === 'bulanan' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1">Pilih Bulan</label>
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            </div>
          )}

          {periodeTipe === 'tahunan' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1">Pilih Tahun</label>
              <input
                type="number"
                min="2020"
                max="2035"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/40 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">No. Anggota & Rek</th>
                <th className="py-2.5 px-3">Nama & Kontak</th>
                <th className="py-2.5 px-3">Wilayah</th>
                <th className="py-2.5 px-3 text-right">Tab. Pokok</th>
                <th className="py-2.5 px-3 text-right">Tab. Umum</th>
                <th className="py-2.5 px-3 text-right">Zakat & Qurban</th>
                <th className="py-2.5 px-3 text-center">Lock Pokok</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredMembers.map((member) => (
                <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-mono font-bold text-amber-400">{member.nomorAnggota}</div>
                    <div className="text-[11px] font-mono text-slate-300 font-semibold">
                      Rek: {member.nomorRekening}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-white uppercase">{member.nama}</div>
                    <div className="text-[10px] text-slate-400">
                      WA: {member.whatsapp} • NIK: {member.nik}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="py-0.5 px-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-[10px] font-bold">
                      {member.wilayah}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                    {formatRupiah(member.saldoPokok)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-sky-400">
                    {formatRupiah(member.saldoUmum)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                    {formatRupiah(member.saldoZakatFitrah + member.saldoQurban)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleToggleLockPokok(member)}
                      title={member.isPokokLocked ? 'Terkunci (Klik untuk buka)' : 'Terbuka (Klik untuk kunci)'}
                      className={`p-1.5 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 ${
                        member.isPokokLocked
                          ? 'bg-red-500/10 border-red-500/30 text-red-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      }`}
                    >
                      {member.isPokokLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      {member.isPokokLocked ? 'Locked' : 'Open'}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedMemberForKta(member)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg"
                        title="Lihat KTA Digital"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingMember({ ...member })}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg"
                        title="Edit Profil & Password"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      {(isSuperAdmin || isWriter) && (
                        <button
                          onClick={() => handleDeleteMember(member)}
                          className="p-1.5 bg-red-950/60 hover:bg-red-900 text-red-400 rounded-lg"
                          title="Hapus Anggota (Pindah Saldo ke Koperasi)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredMembers.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs">
              Tidak ada data anggota ditemukan.
            </div>
          )}
        </div>
      </div>

      {/* Modal KTA Digital */}
      {selectedMemberForKta && (
        <KtaDigitalModal
          member={selectedMemberForKta}
          onClose={() => setSelectedMemberForKta(null)}
        />
      )}

      {/* Modal Edit Member */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-lg rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-sm font-extrabold text-white">
                Edit Profil Anggota: {editingMember.nama}
              </h3>
              <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditMember} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editingMember.nama}
                  onChange={(e) => setEditingMember({ ...editingMember, nama: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Nomor WhatsApp</label>
                  <input
                    type="tel"
                    required
                    value={editingMember.whatsapp}
                    onChange={(e) => setEditingMember({ ...editingMember, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editingMember.email}
                    onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Password Anggota Baru</label>
                <input
                  type="text"
                  placeholder="Ketik password baru jika ingin mengubah"
                  value={editingMember.password || ''}
                  onChange={(e) => setEditingMember({ ...editingMember, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  value={editingMember.alamatLengkap}
                  onChange={(e) => setEditingMember({ ...editingMember, alamatLengkap: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 text-slate-950 font-black rounded-xl shadow"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Member */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-lg rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-sm font-extrabold text-white">Tambah Anggota Koperasi Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">NIK (16 Digit) *</label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">No. WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Wilayah *</label>
                  <select
                    value={formWilayah}
                    onChange={(e) => setFormWilayah(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="Cengkareng">Cengkareng</option>
                    <option value="Kalideres">Kalideres</option>
                    <option value="Kembangan">Kembangan</option>
                    <option value="Kebon Jeruk">Kebon Jeruk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Alamat Lengkap</label>
                <input
                  type="text"
                  required
                  value={formAlamat}
                  onChange={(e) => setFormAlamat(e.target.value)}
                  placeholder="Jl. Raya No..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 text-slate-950 font-black rounded-xl"
                >
                  Daftarkan Anggota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
