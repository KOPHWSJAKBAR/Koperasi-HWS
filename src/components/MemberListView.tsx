import React, { useState } from 'react';
import {
  AppState,
  MemberUser,
  AdminUser,
  WilayahKoperasi,
} from '../types';
import { formatRupiah, generateNomorRekening, generateNomorAnggota, createAuditLog } from '../lib/storage';
import { downloadExcelCsv, printDocumentHtml, exportAnggotaExcel, exportAnggotaPdf } from '../lib/exportPdf';
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
  Snowflake,
  ShieldCheck,
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
  const [viewingMemberProfile, setViewingMemberProfile] = useState<MemberUser | null>(null);
  const [memberToFreeze, setMemberToFreeze] = useState<MemberUser | null>(null);
  const [freezeReasonInput, setFreezeReasonInput] = useState('');
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

  // Members pending freeze approval (Req 4)
  const pendingFreezeMembers = state.members.filter(
    (m) => m.status === 'pending_freeze'
  );

  // Propose account freeze (Req 4: diajukan oleh admin write)
  const handleProposeFreeze = async (member: MemberUser, reason: string) => {
    if (!reason.trim()) {
      alert('Harap masukkan alasan pembekuan akun.');
      return;
    }

    const freezeReq = {
      requestedByRole: currentAdmin.role,
      requestedByName: currentAdmin.nama,
      reason: reason.trim(),
      requestedAt: new Date().toISOString(),
      approvedByKelola: isKelola,
      approvedByKelolaName: isKelola ? currentAdmin.nama : undefined,
      approvedBySuperAdmin: isSuperAdmin,
      approvedBySuperAdminName: isSuperAdmin ? currentAdmin.nama : undefined,
    };

    const isDirectlyFrozen = isSuperAdmin;

    await updateState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === member.id
          ? {
              ...m,
              status: isDirectlyFrozen ? 'dibekukan' : 'pending_freeze',
              freezeRequest: freezeReq,
            }
          : m
      ),
      auditLogs: [
        createAuditLog(
          currentAdmin,
          isDirectlyFrozen ? 'Bekukan Akun Anggota' : 'Pengajuan Pembekuan Akun',
          `${currentAdmin.nama} (${currentAdmin.role}) mengajukan pembekuan akun ${member.nama} (${member.nomorAnggota}). Alasan: ${reason}`,
          member.id
        ),
        ...prev.auditLogs,
      ],
    }));

    setMemberToFreeze(null);
    setFreezeReasonInput('');
    alert(
      isDirectlyFrozen
        ? `Akun ${member.nama} berhasil DIBEKUKAN.`
        : `Pengajuan pembekuan akun ${member.nama} berhasil dikirim! Menunggu persetujuan Admin Kelola dan Super Admin.`
    );
  };

  // Approve account freeze by Kelola or Super Admin
  const handleApproveFreeze = async (member: MemberUser) => {
    const existingReq = member.freezeRequest || {
      requestedByRole: 'admin_write',
      requestedByName: 'Admin',
      reason: 'Pelanggaran ketentuan koperasi',
      requestedAt: new Date().toISOString(),
    };

    const updatedKelola = isKelola ? true : !!existingReq.approvedByKelola;
    const updatedSuperAdmin = isSuperAdmin ? true : !!existingReq.approvedBySuperAdmin;

    // Fully frozen if Super Admin approves or both approve
    const isFinalized = isSuperAdmin || (updatedKelola && updatedSuperAdmin);

    await updateState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === member.id
          ? {
              ...m,
              status: isFinalized ? 'dibekukan' : 'pending_freeze',
              freezeRequest: {
                ...existingReq,
                approvedByKelola: updatedKelola,
                approvedByKelolaName: isKelola ? currentAdmin.nama : existingReq.approvedByKelolaName,
                approvedBySuperAdmin: updatedSuperAdmin,
                approvedBySuperAdminName: isSuperAdmin ? currentAdmin.nama : existingReq.approvedBySuperAdminName,
              },
            }
          : m
      ),
      auditLogs: [
        createAuditLog(
          currentAdmin,
          isFinalized ? 'Persetujuan Pembekuan Akun (Final)' : 'Persetujuan Pembekuan Akun (Bertahap)',
          `${currentAdmin.nama} (${currentAdmin.role}) menyetujui pembekuan akun ${member.nama}`,
          member.id
        ),
        ...prev.auditLogs,
      ],
    }));

    alert(
      isFinalized
        ? `Akun anggota ${member.nama} telah resmi DIBEKUKAN.`
        : `Persetujuan Admin Kelola berhasil dicatat. Menunggu persetujuan Super Admin untuk memfinalisasi pembekuan.`
    );
  };

  // Reject account freeze
  const handleRejectFreeze = async (member: MemberUser) => {
    await updateState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === member.id
          ? {
              ...m,
              status: 'aktif',
              freezeRequest: undefined,
            }
          : m
      ),
      auditLogs: [
        createAuditLog(
          currentAdmin,
          'Tolak Pembekuan Akun',
          `Menolak permohonan pembekuan akun ${member.nama}`,
          member.id
        ),
        ...prev.auditLogs,
      ],
    }));
    alert(`Pengajuan pembekuan akun ${member.nama} telah dibatalkan.`);
  };

  // Unfreeze account
  const handleUnfreeze = async (member: MemberUser) => {
    if (!isSuperAdmin && !isKelola) {
      alert('Hanya Super Admin atau Admin Kelola yang dapat membuka status pembekuan akun.');
      return;
    }

    const confirmUnfreeze = confirm(`Buka pembekuan akun anggota ${member.nama} (${member.nomorAnggota})?`);
    if (!confirmUnfreeze) return;

    await updateState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === member.id
          ? {
              ...m,
              status: 'aktif',
              freezeRequest: undefined,
            }
          : m
      ),
      auditLogs: [
        createAuditLog(
          currentAdmin,
          'Buka Pembekuan Akun (Unfreeze)',
          `Membuka status pembekuan akun ${member.nama} (${member.nomorAnggota}) kembali aktif`,
          member.id
        ),
        ...prev.auditLogs,
      ],
    }));
    alert(`Status akun ${member.nama} telah aktif kembali.`);
  };

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

  // Export Rekap Anggota (User Req 12 & 13)
  const handleExportMembers = (format: 'pdf' | 'excel') => {
    const periodeStr =
      periodeTipe === 'semua'
        ? 'Semua Periode'
        : periodeTipe === 'harian'
        ? `${filterStartDate || 'Awal'} s/d ${filterEndDate || 'Akhir'}`
        : periodeTipe === 'bulanan'
        ? `Bulan ${filterMonth}`
        : `Tahun ${filterYear}`;

    if (format === 'excel') {
      // User Req 13: Kolom Nama, Wilayah, Tabungan Pokok, Tabungan Qurban, Tabungan Zakat, dan Jumlah, Judul & Periode di atas, Total keseluruhan kebawah (Req 12)
      exportAnggotaExcel(
        filteredMembers,
        periodeStr,
        `LAPORAN DATA & TABUNGAN ANGGOTA (${selectedWilayah.toUpperCase()})`
      );
    } else {
      // User Req 12: PDF dengan total keseluruhan anggota kebawah & watermark anti-pemalsuan (Req 10)
      exportAnggotaPdf(filteredMembers, periodeStr, selectedWilayah);
    }
  };

  return (
    <div className="space-y-6">
      {/* PENDING FREEZE APPROVAL ALERT BOX FOR SUPER ADMIN & ADMIN KELOLA (Req 4) */}
      {(isSuperAdmin || isKelola) && pendingFreezeMembers.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-3xl p-5 shadow-2xl space-y-3">
          <div className="flex items-center gap-2.5">
            <Snowflake className="w-5 h-5 text-amber-400" />
            <h4 className="font-black text-sm text-amber-200">
              Permintaan Pembekuan Akun Anggota Menunggu Persetujuan ({pendingFreezeMembers.length} Akun)
            </h4>
          </div>
          <p className="text-xs text-amber-300/80">
            Diajukan oleh Admin Write. Memerlukan persetujuan dari Admin Kelola dan Super Admin sebelum akun anggota resmi dibekukan.
          </p>
          <div className="space-y-2 pt-1">
            {pendingFreezeMembers.map((m) => {
              const req = m.freezeRequest;
              return (
                <div
                  key={m.id}
                  className="p-3 bg-slate-900/90 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-extrabold text-white">
                      {m.nama} ({m.nomorAnggota})
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Rekening: <span className="font-mono text-amber-400">{m.nomorRekening}</span> • Wilayah: {m.wilayah}
                    </div>
                    <div className="text-[11px] text-amber-300 mt-1">
                      Alasan: <span className="italic font-medium">"{req?.reason || 'Pelanggaran ketentuan'}"</span> • Diajukan oleh: <b>{req?.requestedByName || 'Admin Write'}</b>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] mt-1 font-bold">
                      <span className={req?.approvedByKelola ? 'text-emerald-400' : 'text-slate-400'}>
                        {req?.approvedByKelola ? '✓ Disetujui Admin Kelola' : '⏳ Menunggu Admin Kelola'}
                      </span>
                      <span>•</span>
                      <span className={req?.approvedBySuperAdmin ? 'text-emerald-400' : 'text-slate-400'}>
                        {req?.approvedBySuperAdmin ? '✓ Disetujui Super Admin' : '⏳ Menunggu Super Admin'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRejectFreeze(m)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveFreeze(m)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow"
                    >
                      Setujui Pembekuan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white uppercase">{member.nama}</span>
                      {member.status === 'dibekukan' && (
                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-black uppercase">
                          <Snowflake className="w-2.5 h-2.5" /> DIBEKUKAN
                        </span>
                      )}
                      {member.status === 'pending_freeze' && (
                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black uppercase">
                          ⏳ PENDING BEKU
                        </span>
                      )}
                      {member.status === 'pending_deletion' && (
                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-black uppercase">
                          ⚠️ PENDING HAPUS
                        </span>
                      )}
                    </div>
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
                      {/* Req 14: Admin Super, Admin Write, dan Admin Approval dapat melihat profile anggota */}
                      <button
                        onClick={() => setViewingMemberProfile(member)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg"
                        title="Lihat Profil Lengkap Anggota"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setSelectedMemberForKta(member)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg"
                        title="Lihat KTA Digital"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>

                      {/* Req 14: Admin Super, Admin Write, dan Admin Approval dapat mengganti profile anggota */}
                      <button
                        onClick={() => setEditingMember({ ...member })}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg"
                        title="Edit Profil & Data Anggota"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Req 4: Akun anggota dapat dibekukan dengan pengajuan admin write dan disetujui admin kelola & super admin */}
                      {member.status === 'dibekukan' ? (
                        (isSuperAdmin || isKelola) && (
                          <button
                            onClick={() => handleUnfreeze(member)}
                            className="p-1.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-400 rounded-lg"
                            title="Buka Pembekuan Akun (Aktifkan)"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => {
                            setMemberToFreeze(member);
                            setFreezeReasonInput('');
                          }}
                          className="p-1.5 bg-amber-950/60 hover:bg-amber-900 text-amber-400 rounded-lg"
                          title="Ajukan Pembekuan Akun (Freeze)"
                        >
                          <Snowflake className="w-3.5 h-3.5" />
                        </button>
                      )}

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

      {/* ================= MODAL LIHAT DETAIL PROFIL ANGGOTA (Req 14) ================= */}
      {viewingMemberProfile && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-lg rounded-3xl p-6 shadow-2xl max-h-[88vh] overflow-y-auto text-slate-100">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Detail Profil Anggota: {viewingMemberProfile.nama}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {viewingMemberProfile.nomorAnggota} • Rek: {viewingMemberProfile.nomorRekening}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingMemberProfile(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Status Badge */}
              <div className="flex items-center justify-between p-3 bg-slate-800/80 rounded-2xl border border-slate-700">
                <span className="text-slate-400 font-bold">Status Akun:</span>
                <span className={`px-2.5 py-1 rounded-full font-black uppercase text-[10px] ${
                  viewingMemberProfile.status === 'dibekukan'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : viewingMemberProfile.status === 'pending_freeze'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {viewingMemberProfile.status}
                </span>
              </div>

              {/* Data Pribadi */}
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="font-black text-amber-400 text-xs uppercase tracking-wide">
                  Identitas & Kontak Anggota
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-400 block">NIK KTP</span>
                    <span className="font-mono font-bold text-white">{viewingMemberProfile.nik}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">WhatsApp / HP</span>
                    <span className="font-mono font-bold text-white">{viewingMemberProfile.whatsapp}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Email</span>
                    <span className="font-bold text-white truncate block">{viewingMemberProfile.email || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Wilayah</span>
                    <span className="font-bold text-amber-300">{viewingMemberProfile.wilayah}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block">Alamat Lengkap</span>
                  <div className="text-slate-200 mt-0.5">
                    {viewingMemberProfile.alamatLengkap || '-'}, RT {viewingMemberProfile.rt || '001'} / RW {viewingMemberProfile.rw || '001'}, Kel. {viewingMemberProfile.kelurahan || '-'}, Kec. {viewingMemberProfile.kecamatan || '-'}, {viewingMemberProfile.kota || 'Jakarta Barat'} {viewingMemberProfile.kodePos || '11740'}
                  </div>
                </div>
              </div>

              {/* Rekening Pribadi & Tabungan */}
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="font-black text-sky-400 text-xs uppercase tracking-wide">
                  Rekening Bank & Saldo Tabungan
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Bank Pencairan Pribadi</span>
                    <span className="font-bold text-white">{viewingMemberProfile.bankPribadi?.namaBank}</span>
                    <span className="font-mono text-[11px] text-slate-400 block">
                      {viewingMemberProfile.bankPribadi?.nomorRekening} (a.n {viewingMemberProfile.bankPribadi?.atasNama})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total Semua Tabungan</span>
                    <span className="font-mono font-black text-amber-400 text-sm block">
                      {formatRupiah(
                        viewingMemberProfile.saldoPokok +
                        viewingMemberProfile.saldoUmum +
                        viewingMemberProfile.saldoZakatFitrah +
                        viewingMemberProfile.saldoQurban
                      )}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/60 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Tabungan Pokok</span>
                    <span className="font-mono font-bold text-amber-300">{formatRupiah(viewingMemberProfile.saldoPokok)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Tabungan Qurban</span>
                    <span className="font-mono font-bold text-emerald-300">{formatRupiah(viewingMemberProfile.saldoQurban)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Zakat Fitrah</span>
                    <span className="font-mono font-bold text-emerald-300">{formatRupiah(viewingMemberProfile.saldoZakatFitrah)}</span>
                  </div>
                </div>
              </div>

              {/* Actions from within View Profile Modal */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingMember({ ...viewingMemberProfile });
                    setViewingMemberProfile(null);
                  }}
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Data Anggota Ini
                </button>
                <button
                  type="button"
                  onClick={() => setViewingMemberProfile(null)}
                  className="px-5 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PENGAJUAN PEMBEKUAN AKUN (Req 4) ================= */}
      {memberToFreeze && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-amber-500/50 w-full max-w-md rounded-3xl p-5 shadow-2xl text-slate-100">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
              <div className="flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white">
                  Ajukan Pembekuan Akun
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMemberToFreeze(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700">
                <div className="font-bold text-white">{memberToFreeze.nama}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {memberToFreeze.nomorAnggota} • Rek: {memberToFreeze.nomorRekening}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Alasan Pembekuan Akun *
                </label>
                <textarea
                  required
                  rows={3}
                  value={freezeReasonInput}
                  onChange={(e) => setFreezeReasonInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[10px] text-amber-300">
                ℹ️ Alur Pembekuan: Diajukan oleh Admin Write / Pengurus, lalu disetujui oleh Admin Kelola dan Super Admin sebelum akun dibekukan secara penuh.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMemberToFreeze(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleProposeFreeze(memberToFreeze, freezeReasonInput)}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow"
                >
                  Kirim Pengajuan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
