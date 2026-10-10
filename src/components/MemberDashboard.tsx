import React, { useState } from 'react';
import {
  AppState,
  MemberUser,
  MemberTransaction,
  KasEntry,
} from '../types';
import { formatRupiah, createAuditLog } from '../lib/storage';
import { LogoHws } from '../lib/logo';
import { MemberVerificationView } from './MemberVerificationView';
import { MutasiRekeningView } from './MutasiRekeningView';
import { ZakatQurbanView } from './ZakatQurbanView';
import { SuratMenyuratView } from './SuratMenyuratView';
import { ChatOnlineView } from './ChatOnlineView';
import { SettingModal } from './SettingModal';
import { KtaDigitalModal } from './KtaDigitalModal';
import {
  CreditCard,
  ArrowUpRight,
  User,
  FileText,
  HeartHandshake,
  Mail,
  MessageSquare,
  Settings,
  Copy,
  ChevronLeft,
  Lock,
  CheckCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  X,
  AlertCircle,
  ShieldCheck,
  Building,
} from 'lucide-react';

interface MemberDashboardProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  member: MemberUser;
  onLogout: () => void;
}

export const MemberDashboard: React.FC<MemberDashboardProps> = ({
  state,
  updateState,
  member,
  onLogout,
}) => {
  // Sync member with latest state in case balance updated in real-time
  const currentMember = state.members.find((m) => m.id === member.id) || member;

  const [activeMenu, setActiveMenu] = useState<
    'dashboard' | 'setoran' | 'kta' | 'mutasi' | 'zakat' | 'surat' | 'chat'
  >('dashboard');

  const [showSettings, setShowSettings] = useState(false);
  const [showKtaModal, setShowKtaModal] = useState(false);
  const [copiedRekening, setCopiedRekening] = useState(false);

  // Transfer Sesama Anggota State (Req 3: Konfirmasi sebelum memasukkan PIN)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [tfStep, setTfStep] = useState<'input' | 'confirm' | 'pin'>('input');
  const [tfTargetRek, setTfTargetRek] = useState('');
  const [tfNominal, setTfNominal] = useState('');
  const [tfCatatan, setTfCatatan] = useState('');
  const [tfPin, setTfPin] = useState('');
  const [tfError, setTfError] = useState('');
  const [tfSuccess, setTfSuccess] = useState('');

  // Tarik Tabungan Umum State
  const [showTarikModal, setShowTarikModal] = useState(false);
  const [tarikNominal, setTarikNominal] = useState('');
  const [tarikCatatan, setTarikCatatan] = useState('');
  const [tarikError, setTarikError] = useState('');

  // Auto-lookup recipient for transfer
  const cleanTargetQuery = tfTargetRek.trim().toLowerCase();
  const targetMemberRecipient = cleanTargetQuery
    ? state.members.find(
        (m) =>
          m.id !== currentMember.id &&
          (m.nomorRekening === cleanTargetQuery ||
            m.nomorAnggota.toLowerCase() === cleanTargetQuery ||
            m.whatsapp.replace(/\D/g, '') === cleanTargetQuery.replace(/\D/g, ''))
      )
    : null;

  // Total Simpanan Keseluruhan
  const totalSimpanan =
    currentMember.saldoPokok +
    currentMember.saldoZakatFitrah +
    currentMember.saldoQurban +
    currentMember.saldoUmum;

  // Unread messages count for member
  const unreadChatCount = state.chatMessages.filter(
    (m) => m.memberId === currentMember.id && m.senderType === 'admin' && !m.isReadByMember
  ).length;

  const handleCopyRekening = () => {
    navigator.clipboard?.writeText(currentMember.nomorRekening);
    setCopiedRekening(true);
    setTimeout(() => setCopiedRekening(false), 2000);
  };

  // Step 1 -> Step 2: Konfirmasi Rincian Sebelum Masukkan PIN (Req 3)
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setTfError('');
    if (!targetMemberRecipient) {
      setTfError('Nomor Rekening / No. Anggota tujuan tidak ditemukan.');
      return;
    }

    const amount = Number(tfNominal);
    if (!amount || amount <= 0) {
      setTfError('Nominal transfer harus lebih dari Rp 0.');
      return;
    }

    if (amount > currentMember.saldoUmum) {
      setTfError(`Saldo Tabungan Umum tidak mencukupi (Tersedia: ${formatRupiah(currentMember.saldoUmum)}).`);
      return;
    }

    setTfStep('confirm');
  };

  // Handle Transfer Sesama Anggota (Step 3: Kirim setelah PIN diverifikasi)
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTfError('');
    setTfSuccess('');

    if (!targetMemberRecipient) {
      setTfError('Nomor Rekening / No. Anggota tujuan tidak ditemukan.');
      return;
    }

    const amount = Number(tfNominal);
    if (!amount || amount <= 0) {
      setTfError('Nominal transfer harus lebih dari Rp 0.');
      return;
    }

    if (amount > currentMember.saldoUmum) {
      setTfError(`Saldo Tabungan Umum tidak mencukupi (Tersedia: ${formatRupiah(currentMember.saldoUmum)}).`);
      return;
    }

    // Validate PIN Transaksi
    const validPin = currentMember.pinTransaksi || '123456';
    if (tfPin !== validPin) {
      setTfError('PIN Transaksi salah.');
      return;
    }

    const now = new Date();
    const tgl = now.toISOString().split('T')[0];
    const jam = now.toTimeString().split(' ')[0].slice(0, 5);
    const refId = `TF-${Date.now().toString().slice(-6)}`;

    // 1. Transaction for Sender (Keluar / DB)
    const txSender: MemberTransaction = {
      id: `tx-tf-send-${Date.now()}`,
      memberId: currentMember.id,
      tanggal: tgl,
      jam,
      keterangan: `Transfer ke Rek ${targetMemberRecipient.nomorRekening} a/n ${targetMemberRecipient.nama}${tfCatatan ? ' - ' + tfCatatan : ''}`,
      cbg: `KCP ${currentMember.wilayah.toUpperCase()}`,
      tipe: 'keluar',
      nominal: amount,
      saldoSetelah: currentMember.saldoUmum - amount,
      kategori: 'umum',
      referensiId: refId,
    };

    // 2. Transaction for Recipient (Masuk / CR)
    const txReceiver: MemberTransaction = {
      id: `tx-tf-rcv-${Date.now() + 1}`,
      memberId: targetMemberRecipient.id,
      tanggal: tgl,
      jam,
      keterangan: `Transfer dari Rek ${currentMember.nomorRekening} a/n ${currentMember.nama}${tfCatatan ? ' - ' + tfCatatan : ''}`,
      cbg: `KCP ${targetMemberRecipient.wilayah.toUpperCase()}`,
      tipe: 'masuk',
      nominal: amount,
      saldoSetelah: targetMemberRecipient.saldoUmum + amount,
      kategori: 'umum',
      referensiId: refId,
    };

    await updateState((prev) => {
      const updatedMembers = prev.members.map((m) => {
        if (m.id === currentMember.id) {
          return { ...m, saldoUmum: m.saldoUmum - amount };
        }
        if (m.id === targetMemberRecipient.id) {
          return { ...m, saldoUmum: m.saldoUmum + amount };
        }
        return m;
      });

      return {
        ...prev,
        members: updatedMembers,
        memberTransactions: [txSender, txReceiver, ...prev.memberTransactions],
      };
    });

    setTfSuccess(`Transfer ${formatRupiah(amount)} ke ${targetMemberRecipient.nama} berhasil! Ref: ${refId}`);
    setTimeout(() => {
      setShowTransferModal(false);
      setTfStep('input');
      setTfTargetRek('');
      setTfNominal('');
      setTfCatatan('');
      setTfPin('');
      setTfSuccess('');
    }, 1800);
  };

  // Handle Penarikan Tabungan Umum
  const handleTarikSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTarikError('');

    const amount = Number(tarikNominal);
    if (!amount || amount <= 0) {
      setTarikError('Nominal penarikan harus lebih dari Rp 0.');
      return;
    }

    if (amount > currentMember.saldoUmum) {
      setTarikError(`Saldo Tabungan Umum tidak mencukupi (Tersedia: ${formatRupiah(currentMember.saldoUmum)}).`);
      return;
    }

    const now = new Date();
    const tgl = now.toISOString().split('T')[0];
    const jam = now.toTimeString().split(' ')[0].slice(0, 5);
    const ket = `Tarikan Tunai ${currentMember.nama}${tarikCatatan ? ' - ' + tarikCatatan : ''}`;

    const newTx: MemberTransaction = {
      id: `tx-tarik-${Date.now()}`,
      memberId: currentMember.id,
      tanggal: tgl,
      jam,
      keterangan: ket,
      cbg: `KCP ${currentMember.wilayah.toUpperCase()}`,
      tipe: 'keluar',
      nominal: amount,
      saldoSetelah: currentMember.saldoUmum - amount,
      kategori: 'umum',
    };

    const newKas: KasEntry = {
      id: `kas-tarik-${Date.now()}`,
      bukuKas: 'anggota',
      tanggal: tgl,
      kategori: 'Penarikan Tabungan Umum',
      keterangan: ket,
      tipe: 'keluar',
      nominal: amount,
      saldoKasSetelah: 0,
      inputBy: currentMember.nama,
      status: 'approved',
      createdAt: now.toISOString(),
    };

    await updateState((prev) => {
      const updatedMembers = prev.members.map((m) =>
        m.id === currentMember.id ? { ...m, saldoUmum: m.saldoUmum - amount } : m
      );

      return {
        ...prev,
        members: updatedMembers,
        memberTransactions: [newTx, ...prev.memberTransactions],
        kasList: [newKas, ...prev.kasList],
      };
    });

    alert(`Penarikan ${formatRupiah(amount)} berhasil diproses ke rekening ${currentMember.bankPribadi.namaBank} (${currentMember.bankPribadi.nomorRekening})!`);
    setShowTarikModal(false);
    setTarikNominal('');
    setTarikCatatan('');
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* ================= HEADER (Matching Anggota PC Dashboard.png & Mobile) ================= */}
      <header className="sticky top-0 z-40 bg-[#0d1424]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Left: Logo & Member Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white p-0.5 shadow flex items-center justify-center shrink-0">
              <LogoHws className="w-full h-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-wide text-white">
                  KOPERASI HWS
                </span>
                <span className="bg-[#f59e0b] text-slate-950 font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md uppercase">
                  ANGGOTA
                </span>
              </div>
              <div className="text-[11px] sm:text-xs text-slate-400 font-medium truncate max-w-[200px] sm:max-w-none">
                {currentMember.nama} • {currentMember.wilayah}
              </div>
            </div>
          </div>

          {/* Right: Actions (Logout removed from dashboard header per user instruction) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveMenu('chat')}
              className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all"
              title="Chat Online Pengurus"
            >
              <MessageSquare className="w-4 h-4" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] flex items-center justify-center">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="py-1.5 px-3 rounded-xl bg-[#162035] hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Settings className="w-4 h-4 text-amber-500" />
              <span>Pengaturan</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= BACK BUTTON ON SUBMENUS ================= */}
      {activeMenu !== 'dashboard' && (
        <div className="bg-[#111c33] border-b border-slate-800 px-4 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveMenu('dashboard')}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali ke Dashboard Utama</span>
            </button>
            <span className="text-xs text-slate-400 font-semibold uppercase">
              {activeMenu === 'setoran' && 'Verifikasi Setoran'}
              {activeMenu === 'mutasi' && 'Mutasi Rekening'}
              {activeMenu === 'zakat' && 'Zakat & Qurban'}
              {activeMenu === 'surat' && 'Surat Menyurat'}
              {activeMenu === 'chat' && 'Chat Online'}
            </span>
          </div>
        </div>
      )}

      {/* ================= MAIN BODY CONTAINER ================= */}
      <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6 flex-1">
        {activeMenu === 'dashboard' ? (
          <>
            {/* Top Balance Card (Matching Anggota PC Dashboard.png & Mobile) */}
            <div className="w-full bg-[#0d1424] border border-slate-700/80 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
              {/* Subtle Logo Watermark on right corner */}
              <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none hidden sm:block">
                <LogoHws className="w-64 h-64" />
              </div>

              {/* Title & Copyable Account Number */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                <div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider uppercase">
                    TOTAL SIMPANAN KESELURUHAN
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-white mt-1 tracking-tight">
                    {formatRupiah(totalSimpanan)}
                  </div>
                </div>

                {/* Account Number Pill */}
                <button
                  type="button"
                  onClick={handleCopyRekening}
                  className="self-start sm:self-auto py-1.5 px-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-bold text-amber-300 rounded-xl flex items-center gap-2 transition-all shadow-sm"
                  title="Klik untuk menyalin nomor rekening koperasi"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>{currentMember.nomorRekening}</span>
                  {copiedRekening && <span className="text-[10px] text-emerald-400">✓ Tersalin</span>}
                </button>
              </div>

              {/* 4 Sub-Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-5 relative z-10">
                {/* 1. Tabungan Pokok */}
                <div className="bg-[#141d33] border border-slate-700/60 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block">
                    Tabungan Pokok (Rp1rb/hr)
                  </span>
                  <div className="text-base sm:text-lg font-black text-[#f59e0b] mt-1">
                    {formatRupiah(currentMember.saldoPokok)}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                    <Lock className="w-3 h-3 text-amber-500" />
                    <span>Terkunci Sistem</span>
                  </div>
                </div>

                {/* 2. Zakat Fitrah */}
                <div className="bg-[#141d33] border border-slate-700/60 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block">
                    Zakat Fitrah (Rp500/hr)
                  </span>
                  <div className="text-base sm:text-lg font-black text-emerald-400 mt-1">
                    {formatRupiah(currentMember.saldoZakatFitrah)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Dikelola Pengurus
                  </div>
                </div>

                {/* 3. Tabungan Qurban */}
                <div className="bg-[#141d33] border border-slate-700/60 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block">
                    Tabungan Qurban (Rp500/hr)
                  </span>
                  <div className="text-base sm:text-lg font-black text-emerald-400 mt-1">
                    {formatRupiah(currentMember.saldoQurban)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Dikelola Pengurus
                  </div>
                </div>

                {/* 4. Tabungan Umum Bebas */}
                <div className="bg-[#141d33] border border-slate-700/60 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-[10px] sm:text-xs text-slate-400 font-semibold block">
                    Tabungan Umum Bebas
                  </span>
                  <div className="text-base sm:text-lg font-black text-sky-400 mt-1">
                    {formatRupiah(currentMember.saldoUmum)}
                  </div>
                  <div className="text-[10px] text-sky-400 font-bold mt-1">
                    Bebas Setor & Tarik
                  </div>
                </div>
              </div>

              {/* ================= 3 TOMBOL UTAMA: SETOR, TARIK & TRANSFER SESAMA ANGGOTA ================= */}
              {/* User Req 1: Pada menu dashboard anggota tampilkan tombol setor atau tarik dan transfer sesama anggota yg menggunakan tabungan umum */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-5 pt-4 border-t border-slate-700/60 relative z-10">
                <button
                  type="button"
                  onClick={() => setActiveMenu('setoran')}
                  className="py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all text-xs sm:text-sm"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Setor Tabungan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTarikModal(true)}
                  className="py-3 px-4 bg-[#162035] hover:bg-slate-800 text-sky-400 border border-sky-500/30 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all text-xs sm:text-sm"
                >
                  <ArrowDownLeft className="w-4 h-4 text-sky-400" />
                  <span>Tarik Tabungan Umum</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTransferModal(true)}
                  className="py-3 px-4 bg-[#162035] hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all text-xs sm:text-sm"
                >
                  <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
                  <span>Transfer Sesama Anggota</span>
                </button>
              </div>
            </div>

            {/* Menu Pilihan Anggota Grid (Vertical stack on mobile, 2-col on PC) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 font-bold">📚</span>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    Menu Pilihan Anggota
                  </h3>
                </div>
                <span className="text-xs text-slate-400">Pilih menu di bawah</span>
              </div>

              {/* 7 Menu Buttons (Vertical on mobile, grid on MD/PC. Logout is removed per prompt!) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                {/* 1. Dashboard */}
                <button
                  type="button"
                  onClick={() => setActiveMenu('dashboard')}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#f59e0b] text-slate-950 font-extrabold flex items-center justify-between shadow-lg shadow-amber-500/20 text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-black">1. Dashboard</div>
                      <div className="text-[11px] sm:text-xs font-medium text-slate-900 mt-0.5">
                        Ringkasan 4 simpanan & saldo
                      </div>
                    </div>
                  </div>
                  <span className="text-lg font-bold">›</span>
                </button>

                {/* 2. Verifikasi Setoran */}
                <button
                  type="button"
                  onClick={() => setActiveMenu('setoran')}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#111c33] hover:bg-[#162544] border border-slate-700/80 text-white flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 text-sky-400 flex items-center justify-center shrink-0 border border-slate-700">
                      <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-extrabold">2. Verifikasi Setoran</div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                        Setor & upload bukti transfer
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-400 text-lg">›</span>
                </button>

                {/* 3. Data Anggota */}
                <button
                  type="button"
                  onClick={() => setShowKtaModal(true)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#111c33] hover:bg-[#162544] border border-slate-700/80 text-white flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center shrink-0 border border-slate-700">
                      <User className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-extrabold">3. Data Anggota</div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                        Profil & KTA digital resmi
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-400 text-lg">›</span>
                </button>

                {/* 4. Mutasi Rekening */}
                <button
                  type="button"
                  onClick={() => setActiveMenu('mutasi')}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#111c33] hover:bg-[#162544] border border-slate-700/80 text-white flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center shrink-0 border border-slate-700">
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-extrabold">4. Mutasi Rekening</div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                        Mutasi tabungan wajib & umum (Unduh PDF)
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-400 text-lg">›</span>
                </button>

                {/* 5. Zakat & Qurban */}
                <button
                  type="button"
                  onClick={() => setActiveMenu('zakat')}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#111c33] hover:bg-[#162544] border border-slate-700/80 text-white flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center shrink-0 border border-slate-700">
                      <HeartHandshake className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-extrabold">5. Zakat & Qurban</div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                        Rincian tabungan syariah
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-400 text-lg">›</span>
                </button>

                {/* 6. Surat Menyurat */}
                <button
                  type="button"
                  onClick={() => setActiveMenu('surat')}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#111c33] hover:bg-[#162544] border border-slate-700/80 text-white flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 text-sky-400 flex items-center justify-center shrink-0 border border-slate-700">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
                        <span>6. Surat Menyurat</span>
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                          {state.suratList.length || 1}
                        </span>
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                        Edaran resmi koperasi
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-400 text-lg">›</span>
                </button>

                {/* 7. Chat Online */}
                <button
                  type="button"
                  onClick={() => setActiveMenu('chat')}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#111c33] hover:bg-[#162544] border border-slate-700/80 text-white flex items-center justify-between text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center shrink-0 border border-slate-700">
                      <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
                        <span>7. Chat Online</span>
                        {unreadChatCount > 0 && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                        Obrolan langsung realtime dengan pengurus
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-400 text-lg">›</span>
                </button>
              </div>
            </div>
          </>
        ) : activeMenu === 'setoran' ? (
          <MemberVerificationView
            state={state}
            updateState={updateState}
            currentMember={currentMember}
          />
        ) : activeMenu === 'mutasi' ? (
          <MutasiRekeningView state={state} member={currentMember} />
        ) : activeMenu === 'zakat' ? (
          <ZakatQurbanView
            state={state}
            updateState={updateState}
            currentMember={currentMember}
          />
        ) : activeMenu === 'surat' ? (
          <SuratMenyuratView
            state={state}
            updateState={updateState}
            currentMember={currentMember}
          />
        ) : activeMenu === 'chat' ? (
          <ChatOnlineView
            state={state}
            updateState={updateState}
            currentMember={currentMember}
          />
        ) : null}
      </main>

      {/* ================= MODAL: TRANSFER SESAMA ANGGOTA ================= */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-[#0f172a] text-slate-100 border border-slate-700/80 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden my-4">
            <div className="p-4 border-b border-slate-700/80 flex items-center justify-between bg-[#162035]">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white">
                  Transfer Sesama Anggota Koperasi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTransferModal(false);
                  setTfError('');
                  setTfSuccess('');
                }}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              {/* Sender Saldo Info */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 flex justify-between items-center">
                <span className="text-slate-400">Saldo Tabungan Umum Anda:</span>
                <span className="font-mono font-black text-sky-400 text-sm">
                  {formatRupiah(currentMember.saldoUmum)}
                </span>
              </div>

              {tfError && (
                <div className="p-2.5 bg-red-950/80 border border-red-500/40 text-red-200 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{tfError}</span>
                </div>
              )}

              {tfSuccess && (
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{tfSuccess}</span>
                </div>
              )}

              {/* TAHAP 1: INPUT TUJUAN & NOMINAL */}
              {tfStep === 'input' && (
                <form onSubmit={handleProceedToConfirm} className="space-y-3.5">
                  {/* Target Member Input */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Nomor Rekening / No. Anggota / HP Penerima *
                    </label>
                    <input
                      type="text"
                      required
                      value={tfTargetRek}
                      onChange={(e) => setTfTargetRek(e.target.value)}
                      placeholder="Masukkan No. Rekening / No. Anggota"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-xs focus:ring-2 focus:ring-amber-500"
                    />

                    {/* Recipient Preview */}
                    {targetMemberRecipient ? (
                      <div className="mt-2 p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-extrabold text-white text-[11px]">
                            {targetMemberRecipient.nama}
                          </div>
                          <div className="text-[10px] text-emerald-300 font-mono">
                            {targetMemberRecipient.nomorRekening} • Wilayah {targetMemberRecipient.wilayah}
                          </div>
                        </div>
                      </div>
                    ) : cleanTargetQuery.length >= 4 ? (
                      <div className="mt-1 text-[11px] text-amber-400">
                        Mencari anggota penerima...
                      </div>
                    ) : null}
                  </div>

                  {/* Transfer Amount */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Nominal Transfer (Rp) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={currentMember.saldoUmum}
                      value={tfNominal}
                      onChange={(e) => setTfNominal(e.target.value)}
                      placeholder="Contoh: 50000"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-sm focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Catatan / Berita */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Catatan / Berita Transfer (Opsional)
                    </label>
                    <input
                      type="text"
                      value={tfCatatan}
                      onChange={(e) => setTfCatatan(e.target.value)}
                      placeholder="Keterangan pembayaran / kebutuhan"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTransferModal(false)}
                      className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={!targetMemberRecipient || !tfNominal}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      Lanjut ke Konfirmasi
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              )}

              {/* TAHAP 2: KONFIRMASI RINCIAN TRANSFER SEBELUM PIN (REQ 3) */}
              {tfStep === 'confirm' && targetMemberRecipient && (
                <div className="space-y-3.5">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1 text-center">
                    <div className="font-extrabold text-amber-300 text-xs flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      Konfirmasi Transfer Dana
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Periksa rincian transfer dengan teliti sebelum memasukkan PIN persetujuan.
                    </p>
                  </div>

                  <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-700/60">
                      <span className="text-slate-400">Pengirim:</span>
                      <span className="font-bold text-white text-right">
                        {currentMember.nama} ({currentMember.nomorRekening})
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-700/60">
                      <span className="text-slate-400">Penerima Tujuan:</span>
                      <span className="font-extrabold text-amber-400 text-right">
                        {targetMemberRecipient.nama}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-700/60">
                      <span className="text-slate-400">No. Rekening Tujuan:</span>
                      <span className="font-mono font-bold text-sky-300">
                        {targetMemberRecipient.nomorRekening} (KCP {targetMemberRecipient.wilayah})
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-700/60">
                      <span className="text-slate-400">Nominal Transfer:</span>
                      <span className="font-mono font-black text-white text-sm">
                        {formatRupiah(Number(tfNominal))}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-700/60">
                      <span className="text-slate-400">Biaya Administrasi:</span>
                      <span className="font-bold text-emerald-400">
                        Rp 0 (Gratis Sesama Anggota)
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-700/60">
                      <span className="text-slate-400">Catatan / Berita:</span>
                      <span className="text-slate-200 text-right">
                        {tfCatatan || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="font-bold text-slate-300">Total Pengurangan Saldo:</span>
                      <span className="font-mono font-black text-amber-400 text-sm">
                        {formatRupiah(Number(tfNominal))}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTfStep('input')}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                    >
                      Ubah Rincian
                    </button>
                    <button
                      type="button"
                      onClick={() => setTfStep('pin')}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      Setuju & Masukkan PIN
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAHAP 3: MASUKKAN PIN UNTUK PERSETUJUAN KIRIM (REQ 3) */}
              {tfStep === 'pin' && targetMemberRecipient && (
                <form onSubmit={handleTransferSubmit} className="space-y-3.5">
                  <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 text-center space-y-1">
                    <div className="text-[11px] text-slate-400">Mengirimkan sejumlah:</div>
                    <div className="text-lg font-black font-mono text-amber-400">
                      {formatRupiah(Number(tfNominal))}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Kepada: <b className="text-white">{targetMemberRecipient.nama}</b> ({targetMemberRecipient.nomorRekening})
                    </div>
                  </div>

                  {/* PIN Transaksi Input */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1 text-center">
                      Masukkan PIN Transaksi Anda (6 Digit) *
                    </label>
                    <input
                      type="password"
                      required
                      autoFocus
                      maxLength={6}
                      value={tfPin}
                      onChange={(e) => setTfPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full px-3 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-center tracking-[0.5em] text-lg focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-slate-400 text-center mt-1">
                      PIN default keamanan awal: 123456
                    </p>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTfStep('confirm')}
                      className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      disabled={tfPin.length !== 6}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl shadow-lg transition-all"
                    >
                      Kirim Transfer Sekarang
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: TARIK TABUNGAN UMUM ================= */}
      {showTarikModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-[#0f172a] text-slate-100 border border-slate-700/80 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden my-4">
            <div className="p-4 border-b border-slate-700/80 flex items-center justify-between bg-[#162035]">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-extrabold text-white">
                  Penarikan Saldo Tabungan Umum
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTarikModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTarikSubmit} className="p-4 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1">
                <div className="text-slate-400 text-[11px]">Rekening Bank Pribadi Tujuan:</div>
                <div className="font-extrabold text-white text-xs">
                  {currentMember.bankPribadi.namaBank} ({currentMember.bankPribadi.nomorRekening})
                </div>
                <div className="text-[10px] text-slate-400">a/n {currentMember.bankPribadi.atasNama}</div>
              </div>

              {tarikError && (
                <div className="p-2.5 bg-red-950/80 border border-red-500/40 text-red-200 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{tarikError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Nominal Penarikan (Rp) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={currentMember.saldoUmum}
                  value={tarikNominal}
                  onChange={(e) => setTarikNominal(e.target.value)}
                  placeholder="Ketik nominal rupiah"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-sm focus:ring-2 focus:ring-sky-500"
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  Maksimal: {formatRupiah(currentMember.saldoUmum)}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Keperluan / Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={tarikCatatan}
                  onChange={(e) => setTarikCatatan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowTarikModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!tarikNominal}
                  className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-black rounded-xl shadow-lg transition-all"
                >
                  Tarik Dana Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}
      {showSettings && (
        <SettingModal
          state={state}
          updateState={updateState}
          currentMember={currentMember}
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
          onOpenKta={() => setShowKtaModal(true)}
          onOpenMutasi={() => setActiveMenu('mutasi')}
          onOpenChat={() => setActiveMenu('chat')}
        />
      )}

      {showKtaModal && (
        <KtaDigitalModal
          member={currentMember}
          onClose={() => setShowKtaModal(false)}
        />
      )}
    </div>
  );
};
