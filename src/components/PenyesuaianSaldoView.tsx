import React, { useState } from 'react';
import {
  AppState,
  AdminUser,
  MemberUser,
  WilayahKoperasi,
  MemberTransaction,
  KasEntry,
} from '../types';
import { formatRupiah, createAuditLog } from '../lib/storage';
import { sendRealtimeNotification } from '../lib/fcm';
import {
  SlidersHorizontal,
  Scale,
  Percent,
  Users,
  Building,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowRight,
  TrendingUp,
  History,
  Info,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  User,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';

interface PenyesuaianSaldoViewProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin: AdminUser;
}

const WILAYAH_LIST: WilayahKoperasi[] = [
  'Cengkareng',
  'Kalideres',
  'Kembangan',
  'Kebon Jeruk',
];

export const PenyesuaianSaldoView: React.FC<PenyesuaianSaldoViewProps> = ({
  state,
  updateState,
  currentAdmin,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'koreksi' | 'pembagian_hasil' | 'riwayat'>('koreksi');

  // ================= STATE 1: KOREKSI SALDO =================
  const [koreksiTargetTipe, setKoreksiTargetTipe] = useState<'wilayah' | 'perorangan' | 'semua'>('wilayah');
  const [koreksiWilayah, setKoreksiWilayah] = useState<WilayahKoperasi>('Cengkareng');
  const [koreksiMemberId, setKoreksiMemberId] = useState<string>('');
  const [koreksiMemberSearch, setKoreksiMemberSearch] = useState<string>('');
  const [koreksiTipe, setKoreksiTipe] = useState<'masuk' | 'keluar'>('masuk');
  const [koreksiJenisTabungan, setKoreksiJenisTabungan] = useState<'pokok' | 'umum'>('umum');
  const [koreksiNominal, setKoreksiNominal] = useState<string>('');
  const [koreksiKeterangan, setKoreksiKeterangan] = useState<string>('');
  const [isSubmittingKoreksi, setIsSubmittingKoreksi] = useState(false);

  // Security password state for Super Admin (Req User)
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // ================= STATE 2: PEMBAGIAN HASIL (SHU / PERSENTASE POKOK) =================
  const [bagiHasilTargetTipe, setBagiHasilTargetTipe] = useState<'wilayah' | 'perorangan' | 'semua'>('wilayah');
  const [bagiHasilWilayah, setBagiHasilWilayah] = useState<WilayahKoperasi>('Cengkareng');
  const [bagiHasilMemberId, setBagiHasilMemberId] = useState<string>('');
  const [bagiHasilMemberSearch, setBagiHasilMemberSearch] = useState<string>('');
  const [bagiHasilPersen, setBagiHasilPersen] = useState<string>('5');
  const [bagiHasilBukuKas, setBagiHasilBukuKas] = useState<'koperasi' | 'anggota'>('koperasi');
  const [bagiHasilTujuanKredit, setBagiHasilTujuanKredit] = useState<'umum' | 'pokok'>('umum');
  const [bagiHasilKeterangan, setBagiHasilKeterangan] = useState<string>(
    `Pembagian Hasil Usaha Koperasi Tahun ${new Date().getFullYear()}`
  );
  const [isSubmittingBagiHasil, setIsSubmittingBagiHasil] = useState(false);

  // Filter Target Members for Koreksi
  const targetMembersKoreksi = state.members.filter((m) => {
    if (m.status === 'dibekukan' || m.status === 'nonaktif') return false;
    if (koreksiTargetTipe === 'semua') return true;
    if (koreksiTargetTipe === 'wilayah') return m.wilayah === koreksiWilayah;
    if (koreksiTargetTipe === 'perorangan') return m.id === koreksiMemberId;
    return true;
  });

  // Filter Target Members for Bagi Hasil
  const targetMembersBagiHasil = state.members.filter((m) => {
    if (m.status === 'dibekukan' || m.status === 'nonaktif') return false;
    if (m.saldoPokok <= 0) return false; // Hanya anggota dengan simpanan pokok aktif
    if (bagiHasilTargetTipe === 'semua') return true;
    if (bagiHasilTargetTipe === 'wilayah') return m.wilayah === bagiHasilWilayah;
    if (bagiHasilTargetTipe === 'perorangan') return m.id === bagiHasilMemberId;
    return true;
  });

  // Kalkulasi Bagi Hasil
  const persenNum = Math.max(0, parseFloat(bagiHasilPersen) || 0);
  const totalPokokTarget = targetMembersBagiHasil.reduce((sum, m) => sum + (m.saldoPokok || 0), 0);
  const totalBagiHasilEstimasi = Math.round(totalPokokTarget * (persenNum / 100));

  // Role check: Hanya Super Admin yang berwenang masuk transaksi anggota (Req User)
  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const isLaporan = currentAdmin.role === 'admin_laporan';
  const canPerformAdjustment = isSuperAdmin;

  // ================= SUBMIT KOREKSI SALDO =================
  const handleKirimKoreksi = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!canPerformAdjustment) {
      alert('Akses Ditolak: Hanya Super Admin yang berwenang masuk transaksi anggota.');
      return;
    }

    // Validasi Password Super Admin (Req User)
    const expectedPassword = currentAdmin.password || 'admin123';
    if (!adminPasswordInput.trim()) {
      setPasswordError('Password Super Admin wajib diisi untuk persetujuan transaksi.');
      return;
    }

    if (adminPasswordInput.trim() !== expectedPassword) {
      setPasswordError('Password Super Admin salah! Verifikasi persetujuan transaksi ditolak.');
      alert('Verifikasi Gagal: Password Super Admin yang Anda masukkan salah.');
      return;
    }

    const nominalNum = parseInt(koreksiNominal.replace(/\D/g, ''), 10);
    if (!nominalNum || nominalNum <= 0) {
      alert('Masukkan nominal koreksi saldo yang valid.');
      return;
    }

    if (!koreksiKeterangan.trim()) {
      alert('Keterangan koreksi saldo wajib diisi.');
      return;
    }

    if (targetMembersKoreksi.length === 0) {
      alert('Tidak ada anggota aktif yang memenuhi kriteria target koreksi.');
      return;
    }

    const totalDana = nominalNum * targetMembersKoreksi.length;
    const confirmMsg =
      `Konfirmasi Koreksi Saldo:\n` +
      `- Tipe: ${koreksiTipe === 'masuk' ? 'Pemasukan (+)' : 'Pengeluaran (-)'}\n` +
      `- Tabungan: ${koreksiJenisTabungan === 'pokok' ? 'Tabungan Pokok' : 'Tabungan Umum'}\n` +
      `- Nominal per Anggota: ${formatRupiah(nominalNum)}\n` +
      `- Target: ${targetMembersKoreksi.length} Anggota\n` +
      `- Total Dana: ${formatRupiah(totalDana)}\n` +
      `- Keterangan: ${koreksiKeterangan}\n\n` +
      `Apakah Anda yakin ingin memproses koreksi saldo ini?`;

    if (!confirm(confirmMsg)) return;

    setIsSubmittingKoreksi(true);
    const now = new Date();
    const tgl = now.toISOString().split('T')[0];
    const jam = now.toTimeString().split(' ')[0].slice(0, 5);

    try {
      const targetIds = new Set(targetMembersKoreksi.map((m) => m.id));
      const newTransactions: MemberTransaction[] = [];
      const newKasEntries: KasEntry[] = [];

      await updateState((prev) => {
        const updatedMembers = prev.members.map((m) => {
          if (!targetIds.has(m.id)) return m;

          let updatedPokok = m.saldoPokok;
          let updatedUmum = m.saldoUmum;

          if (koreksiJenisTabungan === 'pokok') {
            if (koreksiTipe === 'masuk') updatedPokok += nominalNum;
            else updatedPokok = Math.max(0, updatedPokok - nominalNum);
          } else {
            if (koreksiTipe === 'masuk') updatedUmum += nominalNum;
            else updatedUmum = Math.max(0, updatedUmum - nominalNum);
          }

          const txId = `tx-adj-${Date.now()}-${m.id.slice(-4)}`;
          newTransactions.push({
            id: txId,
            memberId: m.id,
            tanggal: tgl,
            jam,
            keterangan: `KOREKSI SALDO: ${koreksiKeterangan}`,
            cbg: `KCP ${(m.wilayah || 'CENGKARENG').toUpperCase()}`,
            tipe: koreksiTipe === 'masuk' ? 'masuk' : 'keluar',
            nominal: nominalNum,
            saldoSetelah: updatedPokok + updatedUmum,
            kategori: koreksiJenisTabungan === 'pokok' ? 'pokok' : 'umum',
            referensiId: `ADJ-${Date.now().toString().slice(-6)}`,
          });

          return {
            ...m,
            saldoPokok: updatedPokok,
            saldoUmum: updatedUmum,
          };
        });

        // Entri penyeimbang di Buku Kas Anggota
        const kasEntryId = `kas-adj-${Date.now()}`;
        newKasEntries.push({
          id: kasEntryId,
          bukuKas: 'anggota',
          tanggal: tgl,
          kategori: koreksiJenisTabungan === 'pokok' ? 'Tabungan Pokok' : 'Tabungan Bebas',
          keterangan: `Koreksi Saldo ${koreksiTipe === 'masuk' ? 'Masuk' : 'Keluar'} (${targetMembersKoreksi.length} Anggota): ${koreksiKeterangan}`,
          namaPenerima: targetMembersKoreksi.length === 1 ? targetMembersKoreksi[0].nama : `Koreksi Saldo Massal (${targetMembersKoreksi.length} Anggota)`,
          tipe: koreksiTipe === 'masuk' ? 'masuk' : 'keluar',
          nominal: totalDana,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        });

        const audit = createAuditLog(
          currentAdmin,
          'Persetujuan Transaksi Anggota',
          `Super Admin ${currentAdmin.nama} menyetujui transaksi anggota (${koreksiTipe.toUpperCase()} [${koreksiJenisTabungan.toUpperCase()}]) sebesar ${formatRupiah(nominalNum)} ke ${targetMembersKoreksi.length} anggota (${koreksiTargetTipe === 'wilayah' ? `Wilayah ${koreksiWilayah}` : koreksiTargetTipe === 'perorangan' ? targetMembersKoreksi[0]?.nama : 'Semua Anggota'}). Otorisasi password terverifikasi. Ket: ${koreksiKeterangan}`,
          kasEntryId
        );

        return {
          ...prev,
          members: updatedMembers,
          memberTransactions: [...newTransactions, ...(prev.memberTransactions || [])],
          kasList: [...newKasEntries, ...(prev.kasList || [])],
          auditLogs: [audit, ...(prev.auditLogs || [])],
        };
      });

      // Kirim Real-time FCM Notification ke masing-masing anggota target
      targetMembersKoreksi.forEach((m) => {
        sendRealtimeNotification({
          recipientId: m.id,
          recipientNama: m.nama,
          title: `💳 Transaksi Anggota: ${koreksiTipe === 'masuk' ? 'Kredit (+)' : 'Debit (-)'}`,
          body: `Transaksi ${koreksiJenisTabungan === 'pokok' ? 'Tabungan Pokok' : 'Tabungan Umum'} sebesar ${formatRupiah(nominalNum)} telah disetujui oleh Super Admin. Keterangan: ${koreksiKeterangan}.`,
          type: 'mutasi_baru',
          data: { nominal: nominalNum, tipe: koreksiTipe },
        }).catch(() => {});
      });

      alert(`✓ Persetujuan Berhasil! Transaksi ${koreksiTipe === 'masuk' ? 'pemasukan' : 'pengeluaran'} sebesar ${formatRupiah(nominalNum)} untuk ${targetMembersKoreksi.length} anggota berhasil disahkan.`);
      setKoreksiNominal('');
      setKoreksiKeterangan('');
      setAdminPasswordInput('');
      setPasswordError('');
    } catch (err: any) {
      alert('Gagal memproses transaksi: ' + err.message);
    } finally {
      setIsSubmittingKoreksi(false);
    }
  };

  // ================= SUBMIT PEMBAGIAN HASIL =================
  const handleKirimBagiHasil = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!canPerformAdjustment) {
      alert('Akses Ditolak: Hanya Super Admin yang berwenang menyetujui transaksi pembagian hasil.');
      return;
    }

    // Validasi Password Super Admin (Req User)
    const expectedPassword = currentAdmin.password || 'admin123';
    if (!adminPasswordInput.trim()) {
      setPasswordError('Password Super Admin wajib diisi untuk persetujuan transaksi.');
      return;
    }

    if (adminPasswordInput.trim() !== expectedPassword) {
      setPasswordError('Password Super Admin salah! Verifikasi persetujuan transaksi ditolak.');
      alert('Verifikasi Gagal: Password Super Admin yang Anda masukkan salah.');
      return;
    }

    if (persenNum <= 0) {
      alert('Masukkan persentase bagi hasil yang valid (> 0%).');
      return;
    }

    if (targetMembersBagiHasil.length === 0) {
      alert('Tidak ada anggota dengan saldo tabungan pokok aktif untuk dibagikan hasil.');
      return;
    }

    if (!bagiHasilKeterangan.trim()) {
      alert('Keterangan pembagian hasil wajib diisi.');
      return;
    }

    const confirmMsg =
      `Konfirmasi Pembagian Hasil (Bagi Hasil / SHU):\n` +
      `- Persentase: ${persenNum}% dari Tabungan Pokok\n` +
      `- Jumlah Anggota Penerima: ${targetMembersBagiHasil.length} Anggota\n` +
      `- Total Tabungan Pokok Dasar: ${formatRupiah(totalPokokTarget)}\n` +
      `- Total Estimasi Bagi Hasil: ${formatRupiah(totalBagiHasilEstimasi)}\n` +
      `- Buku Kas Sumber Beban: Buku Kas ${bagiHasilBukuKas.toUpperCase()}\n` +
      `- Tujuan Kredit Saldo: ${bagiHasilTujuanKredit === 'umum' ? 'Tabungan Umum (Bebas Ditarik)' : 'Tabungan Pokok'}\n` +
      `- Keterangan: ${bagiHasilKeterangan}\n\n` +
      `Apakah Anda yakin ingin memproses pembagian hasil ini ke seluruh anggota target?`;

    if (!confirm(confirmMsg)) return;

    setIsSubmittingBagiHasil(true);
    const now = new Date();
    const tgl = now.toISOString().split('T')[0];
    const jam = now.toTimeString().split(' ')[0].slice(0, 5);

    try {
      const newTransactions: MemberTransaction[] = [];
      let totalBagiHasilTerkredit = 0;

      await updateState((prev) => {
        const updatedMembers = prev.members.map((m) => {
          const isTarget = targetMembersBagiHasil.some((t) => t.id === m.id);
          if (!isTarget || m.saldoPokok <= 0) return m;

          const bagianAnggota = Math.round(m.saldoPokok * (persenNum / 100));
          if (bagianAnggota <= 0) return m;

          totalBagiHasilTerkredit += bagianAnggota;

          let updatedPokok = m.saldoPokok;
          let updatedUmum = m.saldoUmum;

          if (bagiHasilTujuanKredit === 'umum') {
            updatedUmum += bagianAnggota;
          } else {
            updatedPokok += bagianAnggota;
          }

          const txId = `tx-shu-${Date.now()}-${m.id.slice(-4)}`;
          newTransactions.push({
            id: txId,
            memberId: m.id,
            tanggal: tgl,
            jam,
            keterangan: `BAGI HASIL ${persenNum}% DARI POKOK (${formatRupiah(m.saldoPokok)}): ${bagiHasilKeterangan}`,
            cbg: `KCP ${(m.wilayah || 'CENGKARENG').toUpperCase()}`,
            tipe: 'masuk',
            nominal: bagianAnggota,
            saldoSetelah: updatedPokok + updatedUmum,
            kategori: bagiHasilTujuanKredit === 'umum' ? 'umum' : 'pokok',
            referensiId: `SHU-${Date.now().toString().slice(-6)}`,
          });

          return {
            ...m,
            saldoPokok: updatedPokok,
            saldoUmum: updatedUmum,
          };
        });

        // Entri Pengeluaran di Buku Kas yang dipilih
        const kasEntryId = `kas-shu-${Date.now()}`;
        const newKasEntry: KasEntry = {
          id: kasEntryId,
          bukuKas: bagiHasilBukuKas,
          tanggal: tgl,
          kategori: 'Penyaluran Bagi Hasil / SHU',
          keterangan: `Pembagian Hasil ${persenNum}% Tabungan Pokok ke ${targetMembersBagiHasil.length} Anggota: ${bagiHasilKeterangan}`,
          namaPenerima: `Bagi Hasil ${targetMembersBagiHasil.length} Anggota Koperasi`,
          tipe: 'keluar',
          nominal: totalBagiHasilTerkredit,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        };

        const audit = createAuditLog(
          currentAdmin,
          'Pembagian Hasil Anggota',
          `Memproses pembagian hasil ${persenNum}% tabungan pokok ke ${targetMembersBagiHasil.length} anggota senilai ${formatRupiah(totalBagiHasilTerkredit)} dibebankan pada Buku Kas ${bagiHasilBukuKas.toUpperCase()}. Tujuan kredit: Tabungan ${bagiHasilTujuanKredit.toUpperCase()}`,
          kasEntryId
        );

        return {
          ...prev,
          members: updatedMembers,
          memberTransactions: [...newTransactions, ...(prev.memberTransactions || [])],
          kasList: [newKasEntry, ...(prev.kasList || [])],
          auditLogs: [audit, ...(prev.auditLogs || [])],
        };
      });

      // Kirim Real-time FCM Notification ke masing-masing anggota target
      targetMembersBagiHasil.forEach((m) => {
        const bagian = Math.round(m.saldoPokok * (persenNum / 100));
        if (bagian > 0) {
          sendRealtimeNotification({
            recipientId: m.id,
            recipientNama: m.nama,
            title: `🎉 Pembagian Hasil Koperasi Masuk!`,
            body: `Selamat! Anda menerima Bagi Hasil ${persenNum}% senilai ${formatRupiah(bagian)} yang dikreditkan ke ${bagiHasilTujuanKredit === 'umum' ? 'Tabungan Umum' : 'Tabungan Pokok'} Anda.`,
            type: 'mutasi_baru',
            data: { nominal: bagian, persen: persenNum },
          }).catch(() => {});
        }
      });

      alert(`✓ Pembagian hasil usaha berhasil diproses! Sebanyak ${formatRupiah(totalBagiHasilTerkredit)} telah dikreditkan ke ${targetMembersBagiHasil.length} anggota.`);
    } catch (err: any) {
      alert('Gagal memproses pembagian hasil: ' + err.message);
    } finally {
      setIsSubmittingBagiHasil(false);
    }
  };

  // Search filtered member list for perorangan selection
  const filteredSearchMembers = state.members.filter((m) => {
    const q = (activeSubTab === 'koreksi' ? koreksiMemberSearch : bagiHasilMemberSearch).toLowerCase();
    if (!q) return true;
    return (
      m.nama.toLowerCase().includes(q) ||
      m.nomorAnggota.toLowerCase().includes(q) ||
      m.nomorRekening.includes(q) ||
      m.whatsapp.includes(q)
    );
  });

  // Recent adjustments from audit logs
  const riwayatPenyesuaian = state.auditLogs.filter(
    (log) =>
      log.action.includes('Koreksi Saldo') ||
      log.action.includes('Pembagian Hasil') ||
      log.detail.includes('koreksi saldo') ||
      log.detail.includes('pembagian hasil')
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-[#111c33] to-slate-900 border border-slate-700/80 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
            <SlidersHorizontal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Menu Penyesuaian Saldo Anggota
              </h2>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold px-2 py-0.5 rounded-full">
                Admin Menu Resmi
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Koreksi saldo anggota (masuk/keluar) & Pembagian hasil usaha (% kalkulasi tabungan pokok)
            </p>
          </div>
        </div>

        {/* Status Peran */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-2xl border border-slate-700 text-xs">
          <span className="text-slate-400 font-semibold">Login sebagai:</span>
          <span className="font-bold text-amber-400">{currentAdmin.nama}</span>
          <span className="text-[10px] bg-sky-500/20 text-sky-300 font-mono px-2 py-0.5 rounded-full uppercase">
            {currentAdmin.role}
          </span>
        </div>
      </div>

      {/* Warning for Admin Laporan */}
      {isLaporan && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-300 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>
            Mode Pratinjau: Peran Admin Laporan hanya memiliki izin melihat data dan mengunduh laporan. Tombol eksekusi koreksi saldo dan pembagian hasil dinonaktifkan.
          </span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-[#111c33] p-1.5 rounded-2xl border border-slate-700/80 max-w-xl">
        <button
          type="button"
          onClick={() => setActiveSubTab('koreksi')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'koreksi'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>1. Koreksi Saldo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('pembagian_hasil')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'pembagian_hasil'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>2. Pembagian Hasil</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('riwayat')}
          className={`py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
            activeSubTab === 'riwayat'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Riwayat ({riwayatPenyesuaian.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. SUBMENU: KOREKSI SALDO                                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'koreksi' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulir Koreksi */}
          <div className="lg:col-span-7 bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Formulir Koreksi Saldo Anggota</h3>
                  <p className="text-[11px] text-slate-400">Pemasukan / Pengeluaran saldo untuk seluruh, perwilayah, atau perorangan</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                Langkah 1 dari 1
              </span>
            </div>

            <form onSubmit={handleKirimKoreksi} className="space-y-4 text-xs">
              {/* Target Pilihan */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  1. Pilihan Sasaran Anggota *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setKoreksiTargetTipe('semua')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      koreksiTargetTipe === 'semua'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Seluruh Anggota
                  </button>
                  <button
                    type="button"
                    onClick={() => setKoreksiTargetTipe('wilayah')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      koreksiTargetTipe === 'wilayah'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Per Wilayah
                  </button>
                  <button
                    type="button"
                    onClick={() => setKoreksiTargetTipe('perorangan')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      koreksiTargetTipe === 'perorangan'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Perorangan
                  </button>
                </div>
              </div>

              {/* Detail Target Wilayah */}
              {koreksiTargetTipe === 'wilayah' && (
                <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1.5 animate-fade-in">
                  <label className="block font-bold text-amber-400 text-xs">Pilih Wilayah KCP:</label>
                  <select
                    value={koreksiWilayah}
                    onChange={(e) => setKoreksiWilayah(e.target.value as WilayahKoperasi)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    {WILAYAH_LIST.map((w) => (
                      <option key={w} value={w}>
                        Wilayah KCP {w}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Detail Target Perorangan */}
              {koreksiTargetTipe === 'perorangan' && (
                <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 animate-fade-in">
                  <label className="block font-bold text-sky-400 text-xs">Pilih Anggota Spesifik:</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cari nama, no. rekening, atau WhatsApp..."
                      value={koreksiMemberSearch}
                      onChange={(e) => setKoreksiMemberSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>
                  <select
                    required
                    value={koreksiMemberId}
                    onChange={(e) => setKoreksiMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-semibold"
                  >
                    <option value="">-- Pilih Anggota Target --</option>
                    {filteredSearchMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama} ({m.nomorAnggota} - Rek: {m.nomorRekening}) - Saldo: {formatRupiah(m.saldoPokok + m.saldoUmum)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Jenis Koreksi & Pilihan Tabungan */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-300">2. Arah Koreksi *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setKoreksiTipe('masuk')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        koreksiTipe === 'masuk'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      + Pemasukan (Kredit)
                    </button>
                    <button
                      type="button"
                      onClick={() => setKoreksiTipe('keluar')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        koreksiTipe === 'keluar'
                          ? 'bg-red-500 text-white border-red-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      - Pengeluaran (Debit)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-300">3. Jenis Tabungan *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setKoreksiJenisTabungan('umum')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        koreksiJenisTabungan === 'umum'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Tabungan Umum
                    </button>
                    <button
                      type="button"
                      onClick={() => setKoreksiJenisTabungan('pokok')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        koreksiJenisTabungan === 'pokok'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Tabungan Pokok
                    </button>
                  </div>
                </div>
              </div>

              {/* Input Nominal */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  4. Input Jumlah Nominal per Anggota (Rp) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">
                    Rp
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 50.000"
                    value={koreksiNominal}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setKoreksiNominal(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                    }}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-mono text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Input Keterangan */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  5. Keterangan Resmi Koreksi Saldo *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Contoh: Penyesuaian kelebihan setoran tunai atau koreksi administrasi..."
                  value={koreksiKeterangan}
                  onChange={(e) => setKoreksiKeterangan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingKoreksi || !canPerformAdjustment}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSubmittingKoreksi ? 'Memproses Koreksi...' : 'Klik Kirim Koreksi Saldo'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Panel Informasi & Preview Target */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-3.5">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>Simulasi Dampak Koreksi Saldo</span>
              </h4>

              <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Jumlah Anggota Terdampak:</span>
                  <span className="font-extrabold text-white bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                    {targetMembersKoreksi.length} Anggota
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Nominal per Anggota:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {koreksiNominal ? `Rp ${koreksiNominal}` : 'Rp 0'}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-white">Total Mutasi Dana:</span>
                  <span className={`font-mono font-black text-sm ${koreksiTipe === 'masuk' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {koreksiNominal
                      ? formatRupiah(parseInt(koreksiNominal.replace(/\D/g, ''), 10) * targetMembersKoreksi.length)
                      : 'Rp 0'}
                  </span>
                </div>
              </div>

              {/* Daftar Cuplikan Anggota */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400">
                  Daftar Anggota Sasaran ({targetMembersKoreksi.length}):
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {targetMembersKoreksi.map((m) => (
                    <div
                      key={m.id}
                      className="p-2 bg-slate-900/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-extrabold text-white text-[11px]">{m.nama}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {m.nomorAnggota} • KCP {m.wilayah}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Saldo Pokok:</div>
                        <div className="font-mono text-[11px] text-amber-300 font-bold">
                          {formatRupiah(m.saldoPokok)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {targetMembersKoreksi.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      Tidak ada anggota yang cocok dengan filter sasaran.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUBMENU: PEMBAGIAN HASIL (SHU / PERSENTASE POKOK)                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'pembagian_hasil' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulir Pembagian Hasil */}
          <div className="lg:col-span-7 bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Formulir Pembagian Hasil (Bagi Hasil / SHU)</h3>
                  <p className="text-[11px] text-slate-400">
                    Jumlah saldo tabungan pokok dikalikan persentase yang di-input secara otomatis
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                Otomatis Realtime
              </span>
            </div>

            <form onSubmit={handleKirimBagiHasil} className="space-y-4 text-xs">
              {/* Target Sasaran Bagi Hasil */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  1. Pilihan Sasaran Penerima Bagi Hasil *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBagiHasilTargetTipe('semua')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      bagiHasilTargetTipe === 'semua'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Seluruh Anggota
                  </button>
                  <button
                    type="button"
                    onClick={() => setBagiHasilTargetTipe('wilayah')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      bagiHasilTargetTipe === 'wilayah'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Per Wilayah
                  </button>
                  <button
                    type="button"
                    onClick={() => setBagiHasilTargetTipe('perorangan')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      bagiHasilTargetTipe === 'perorangan'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Perorangan
                  </button>
                </div>
              </div>

              {/* Target Wilayah */}
              {bagiHasilTargetTipe === 'wilayah' && (
                <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1.5 animate-fade-in">
                  <label className="block font-bold text-amber-400 text-xs">Pilih Wilayah KCP:</label>
                  <select
                    value={bagiHasilWilayah}
                    onChange={(e) => setBagiHasilWilayah(e.target.value as WilayahKoperasi)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    {WILAYAH_LIST.map((w) => (
                      <option key={w} value={w}>
                        Wilayah KCP {w}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Perorangan */}
              {bagiHasilTargetTipe === 'perorangan' && (
                <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 animate-fade-in">
                  <label className="block font-bold text-sky-400 text-xs">Pilih Anggota Spesifik:</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cari nama atau nomor anggota..."
                      value={bagiHasilMemberSearch}
                      onChange={(e) => setBagiHasilMemberSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>
                  <select
                    required
                    value={bagiHasilMemberId}
                    onChange={(e) => setBagiHasilMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-semibold"
                  >
                    <option value="">-- Pilih Anggota Penerima --</option>
                    {filteredSearchMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama} (Pokok: {formatRupiah(m.saldoPokok)}) - Rek: {m.nomorRekening}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Input Persentase Bagi Hasil */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  2. Input Persentase Bagi Hasil (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    required
                    placeholder="Contoh: 5 atau 7.5"
                    value={bagiHasilPersen}
                    onChange={(e) => setBagiHasilPersen(e.target.value)}
                    className="w-full pl-3 pr-9 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-mono text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-amber-400 font-extrabold text-sm">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  Rumus: Bagian per Anggota = Saldo Tabungan Pokok Anggota × ({persenNum || 0} ÷ 100)
                </p>
              </div>

              {/* Input Pilihan Buku Kas & Tujuan Kredit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-300">3. Pilihan Buku Kas Sumber *</label>
                  <select
                    value={bagiHasilBukuKas}
                    onChange={(e) => setBagiHasilBukuKas(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs"
                  >
                    <option value="koperasi">Buku Kas Koperasi (Kas 2)</option>
                    <option value="anggota">Buku Kas Anggota (Kas 1)</option>
                  </select>
                  <p className="text-[10px] text-slate-400">
                    Beban pengeluaran dicatat resmi pada buku kas ini.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-300">4. Tujuan Kredit Saldo Anggota *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBagiHasilTujuanKredit('umum')}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-bold border transition-all text-center ${
                        bagiHasilTujuanKredit === 'umum'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Tabungan Umum
                    </button>
                    <button
                      type="button"
                      onClick={() => setBagiHasilTujuanKredit('pokok')}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-bold border transition-all text-center ${
                        bagiHasilTujuanKredit === 'pokok'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Tabungan Pokok
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {bagiHasilTujuanKredit === 'umum' ? '✓ Masuk tabungan umum (bebas ditarik anggota)' : '✓ Menambah simpanan pokok'}
                  </p>
                </div>
              </div>

              {/* Input Keterangan Bagi Hasil */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  5. Keterangan Resmi Pembagian Hasil *
                </label>
                <input
                  type="text"
                  required
                  value={bagiHasilKeterangan}
                  onChange={(e) => setBagiHasilKeterangan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingBagiHasil || !canPerformAdjustment}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>
                    {isSubmittingBagiHasil ? 'Memproses Bagi Hasil...' : 'Klik Kirim & Proses Pembagian Hasil'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Panel Rekapitulasi & Tabel Preview Bagi Hasil */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-3.5">
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Rekapitulasi Kalkulasi Bagi Hasil</span>
              </h4>

              <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Persentase Diterapkan:</span>
                  <span className="font-mono font-extrabold text-amber-400 text-sm">
                    {persenNum}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Jumlah Anggota Penerima:</span>
                  <span className="font-extrabold text-white bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                    {targetMembersBagiHasil.length} Anggota
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Total Tabungan Pokok Dasar:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {formatRupiah(totalPokokTarget)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-white">Total Estimasi Bagi Hasil:</span>
                  <span className="font-mono font-black text-sm text-emerald-400">
                    {formatRupiah(totalBagiHasilEstimasi)}
                  </span>
                </div>
              </div>

              {/* Rincian Pembagian per Anggota */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                  <span>Rincian Pembagian per Anggota:</span>
                  <span>{targetMembersBagiHasil.length} Penerima</span>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {targetMembersBagiHasil.map((m) => {
                    const bagian = Math.round(m.saldoPokok * (persenNum / 100));
                    return (
                      <div
                        key={m.id}
                        className="p-2 bg-slate-900/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-extrabold text-white text-[11px]">{m.nama}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Pokok: {formatRupiah(m.saldoPokok)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-emerald-400 font-semibold">Bagi Hasil:</div>
                          <div className="font-mono text-[11px] text-emerald-300 font-black">
                            +{formatRupiah(bagian)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {targetMembersBagiHasil.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      Tidak ada anggota dengan saldo pokok aktif untuk pembagian hasil.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUBMENU: RIWAYAT PENYESUAIAN SALDO                                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'riwayat' && (
        <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Riwayat Koreksi & Pembagian Hasil</h3>
                <p className="text-[11px] text-slate-400">Catatan audit resmi setiap pemrosesan penyesuaian saldo anggota</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {riwayatPenyesuaian.map((log) => (
              <div
                key={log.id}
                className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400 text-xs">{log.action}</span>
                    <span className="text-[10px] text-slate-500">•</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="text-slate-300">{log.detail}</p>
                </div>
                <div className="shrink-0 text-[10px] text-slate-400 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700 self-start sm:self-auto">
                  Diproses oleh: <span className="font-bold text-white">{log.adminNama}</span>
                </div>
              </div>
            ))}

            {riwayatPenyesuaian.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-xs">
                Belum ada riwayat koreksi saldo atau pembagian hasil yang diproses.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
