import React, { useState, useRef, useEffect } from 'react';
import {
  AppState,
  MemberUser,
  MemberTransaction,
  KasEntry,
} from '../types';
import { formatRupiah, createAuditLog, fetchStateFromServer, triggerBrowserNotification, playNotificationSound } from '../lib/storage';
import { LogoHws } from '../lib/logo';
import { initFCM } from '../lib/fcm';
import { MemberVerificationView } from './MemberVerificationView';
import { MutasiRekeningView } from './MutasiRekeningView';
import { ZakatQurbanView } from './ZakatQurbanView';
import { SuratMenyuratView } from './SuratMenyuratView';
import { ChatOnlineView } from './ChatOnlineView';
import { SettingModal } from './SettingModal';
import { KtaDigitalModal } from './KtaDigitalModal';
import { InstallAppModal } from './InstallAppModal';
import { MenuBerbagiModal } from './MenuBerbagiModal';
import {
  CreditCard,
  ArrowUpRight,
  User,
  FileText,
  HeartHandshake,
  Heart,
  Mail,
  MessageSquare,
  Settings,
  Copy,
  ChevronLeft,
  Lock,
  Unlock,
  CheckCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  X,
  AlertCircle,
  ShieldCheck,
  Building,
  Smartphone,
  TrendingUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MemberDashboardProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  member: MemberUser;
  onLogout: (reason?: string) => void;
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
  const [showInstallModal, setShowInstallModal] = useState(false);
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

  // Requirement A.8: Ganti PIN 6-digit saat transfer
  const [showChangePinInTransfer, setShowChangePinInTransfer] = useState(false);
  const [pinChangePassword, setPinChangePassword] = useState('');
  const [pinChangeNewPin, setPinChangeNewPin] = useState('');
  const [pinChangeConfirmPin, setPinChangeConfirmPin] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState('');

  // Tarik Tabungan (Umum / Pokok) State
  const [showTarikModal, setShowTarikModal] = useState(false);
  const [tarikJenisTabungan, setTarikJenisTabungan] = useState<'umum' | 'pokok'>('umum');
  const [tarikNominal, setTarikNominal] = useState('');
  const [tarikCatatan, setTarikCatatan] = useState('');
  const [tarikError, setTarikError] = useState('');
  const [showBerbagiModal, setShowBerbagiModal] = useState(false);

  // Req 6: Grafik pada anggota dapat di hide atau di lihat
  const [showGrafik, setShowGrafik] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hws_member_show_grafik');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  // Req 3C: Saldo Sedekah Anggota (berkurang sesuai penyaluran, tidak tercatat di mutasi tabungan)
  const sedekahList = state.sedekahList || [];
  const totalSedekahPenerimaan = sedekahList
    .filter((e) => e.tipe === 'penerimaan' && e.status === 'approved')
    .reduce((s, e) => s + e.nominal, 0);
  const totalSedekahPenyaluran = sedekahList
    .filter((e) => e.tipe === 'penyaluran' && e.status === 'approved')
    .reduce((s, e) => s + e.nominal, 0);

  const memberApprovedSedekah = sedekahList
    .filter(
      (e) =>
        (e.donaturMemberId === currentMember.id ||
          (e.donaturNama && e.donaturNama.toLowerCase() === currentMember.nama.toLowerCase())) &&
        e.tipe === 'penerimaan' &&
        e.status === 'approved'
    )
    .reduce((s, e) => s + e.nominal, 0);

  const memberDisbursedAllocation = totalSedekahPenerimaan > 0
    ? Math.round(memberApprovedSedekah * Math.min(1, totalSedekahPenyaluran / totalSedekahPenerimaan))
    : 0;
  const memberSaldoSedekah = Math.max(0, memberApprovedSedekah - memberDisbursedAllocation);

  const [backToast, setBackToast] = useState<string | null>(null);
  const [memberToasts, setMemberToasts] = useState<Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    timestamp: string;
    action?: () => void;
  }>>([]);

  // Requirement 7: 1x klik kembali ke menu sebelumnya, 3x klik logout
  const backClicksRef = useRef<number>(0);
  const lastBackClickTimeRef = useRef<number>(0);

  const handleSubmenuBack = () => {
    const now = Date.now();
    if (now - lastBackClickTimeRef.current < 3000) {
      backClicksRef.current += 1;
    } else {
      backClicksRef.current = 1;
    }
    lastBackClickTimeRef.current = now;

    if (backClicksRef.current >= 3) {
      backClicksRef.current = 0;
      setBackToast(null);
      onLogout('Anda telah berhasil keluar dari akun (3x klik tombol kembali).');
    } else if (backClicksRef.current === 2) {
      setBackToast('Klik 1x lagi untuk keluar / logout dari akun Anda.');
      setTimeout(() => setBackToast(null), 3000);
    } else {
      // 1x click: Kembali ke menu sebelumnya (dashboard) tanpa menampilkan note (Req 2)
      setActiveMenu('dashboard');
    }
  };

  useEffect(() => {
    const onAppBack = (e: Event) => {
      if (e.defaultPrevented) return;
      if (showSettings) {
        setShowSettings(false);
      } else if (showBerbagiModal) {
        setShowBerbagiModal(false);
      } else if (showTransferModal) {
        setShowTransferModal(false);
      } else if (showTarikModal) {
        setShowTarikModal(false);
      } else if (showKtaModal) {
        setShowKtaModal(false);
      } else if (activeMenu !== 'dashboard') {
        setActiveMenu('dashboard');
      }
    };
    window.addEventListener('app:back_press', onAppBack);
    return () => window.removeEventListener('app:back_press', onAppBack);
  }, [showSettings, showBerbagiModal, showTransferModal, showTarikModal, showKtaModal, activeMenu]);

  // Auto-lookup recipient for transfer (Req 2: Transfer sesama anggota terkirim akurat)
  const cleanTargetQuery = tfTargetRek.trim().toLowerCase();
  const cleanDigits = cleanTargetQuery.replace(/\D/g, '');
  const targetMemberRecipient = cleanTargetQuery
    ? state.members.find(
        (m) =>
          m.id !== currentMember.id &&
          (m.nomorRekening.toLowerCase() === cleanTargetQuery ||
            (cleanDigits.length >= 4 && m.nomorRekening.replace(/\D/g, '') === cleanDigits) ||
            m.nomorAnggota.toLowerCase() === cleanTargetQuery ||
            m.nama.toLowerCase() === cleanTargetQuery ||
            m.nama.toLowerCase().includes(cleanTargetQuery) ||
            (cleanDigits.length >= 4 && m.nomorRekening.replace(/\D/g, '').includes(cleanDigits)) ||
            (cleanDigits.length >= 4 && m.whatsapp.replace(/\D/g, '').includes(cleanDigits)))
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

  // Unread surat count for member (Req 5: ada notifikasi angka jika belum dibaca, hilangkan jika sudah terbaca)
  const unreadSuratCount = state.suratList.filter((s) => {
    const isTarget = s.tujuanTipe === 'semua' || s.targetMemberId === currentMember.id;
    if (!isTarget) return false;
    const readList = s.readByMemberIds || [];
    return !readList.includes(currentMember.id);
  }).length;

  // Initialize FCM and listen for real-time notifications (Req 1 & 5)
  useEffect(() => {
    initFCM(currentMember.id, 'member').catch(() => {});

    const handleNotifEvent = (e: any) => {
      const notif = e.detail;
      if (!notif) return;
      if (notif.recipientId === currentMember.id || notif.recipientId === 'all') {
        setMemberToasts((prev) => [
          {
            id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            title: notif.title || 'Pemberitahuan Koperasi HWS',
            message: notif.body || '',
            type: notif.type || 'info',
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            action: notif.type === 'surat_baru' ? () => setActiveMenu('surat') : undefined,
          },
          ...prev.slice(0, 3),
        ]);
      }
    };

    window.addEventListener('hws:realtime_notification', handleNotifEvent);
    return () => window.removeEventListener('hws:realtime_notification', handleNotifEvent);
  }, [currentMember.id]);

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

    // 1. Perbarui saldo pengirim, saldo penerima, dan mutasi secara langsung di state (Req 2: Transfer sesama anggota terkirim akurat)
    await updateState((prev) => {
      const updatedMembers = prev.members.map((m) => {
        if (m.id === currentMember.id) {
          return { ...m, saldoUmum: (Number(m.saldoUmum) || 0) - amount };
        }
        if (m.id === targetMemberRecipient.id) {
          return { ...m, saldoUmum: (Number(m.saldoUmum) || 0) + amount };
        }
        return m;
      });

      return {
        ...prev,
        members: updatedMembers,
        memberTransactions: [txSender, txReceiver, ...(prev.memberTransactions || [])],
      };
    });

    // 2. Kirim transfer via online API endpoint ke server (Req 2)
    let processedRef = refId;
    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentMember.id,
          targetRek: targetMemberRecipient.nomorRekening,
          nominal: amount,
          catatan: tfCatatan,
          pin: tfPin,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.refId) processedRef = data.refId;
      }
    } catch (apiErr: any) {
      console.warn('Backend transfer notice:', apiErr);
    }

    setTfSuccess(`✓ Transfer ${formatRupiah(amount)} ke ${targetMemberRecipient.nama} (${targetMemberRecipient.nomorRekening}) berhasil terkirim! Ref: ${processedRef}`);
    setTimeout(() => {
      setShowTransferModal(false);
      setTfStep('input');
      setTfTargetRek('');
      setTfNominal('');
      setTfCatatan('');
      setTfPin('');
      setTfSuccess('');
    }, 2000);
  };

  // Requirement A.8: Proses pergantian PIN 6 digit saat transfer
  const handleChangePinInTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg('');

    if (pinChangePassword !== currentMember.password) {
      setPinChangeMsg('Password login Anda tidak cocok.');
      return;
    }

    if (!pinChangeNewPin || pinChangeNewPin.length !== 6 || !/^\d{6}$/.test(pinChangeNewPin)) {
      setPinChangeMsg('PIN baru harus 6 digit angka.');
      return;
    }

    if (pinChangeNewPin !== pinChangeConfirmPin) {
      setPinChangeMsg('Konfirmasi PIN baru tidak sesuai.');
      return;
    }

    await updateState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === currentMember.id ? { ...m, pinTransaksi: pinChangeNewPin } : m
      ),
      auditLogs: [
        createAuditLog(
          { id: currentMember.id, nama: currentMember.nama, role: 'admin_read' } as any,
          'Ganti PIN Transaksi',
          `Anggota ${currentMember.nama} berhasil mengganti PIN transaksi 6 digit saat proses transfer`
        ),
        ...prev.auditLogs,
      ],
    }));

    setTfPin(pinChangeNewPin);
    setPinChangeMsg('✓ PIN transaksi 6-digit berhasil diganti!');
    setTimeout(() => {
      setShowChangePinInTransfer(false);
      setPinChangePassword('');
      setPinChangeNewPin('');
      setPinChangeConfirmPin('');
      setPinChangeMsg('');
    }, 1200);
  };

  // Handle Penarikan Tabungan (Umum / Pokok)
  const handleTarikSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTarikError('');

    const amount = Number(tarikNominal);
    if (!amount || amount <= 0) {
      setTarikError('Nominal penarikan harus lebih dari Rp 0.');
      return;
    }

    const availableBalance = tarikJenisTabungan === 'pokok' ? currentMember.saldoPokok : currentMember.saldoUmum;
    const labelTabungan = tarikJenisTabungan === 'pokok' ? 'Tabungan Pokok' : 'Tabungan Umum';

    if (tarikJenisTabungan === 'pokok' && currentMember.isPokokLocked) {
      setTarikError('Penarikan Tabungan Pokok sedang dikunci oleh Koperasi. Pembukaan kunci harus diajukan oleh Admin Write dan disahkan oleh Admin Approval.');
      return;
    }

    if (amount > availableBalance) {
      setTarikError(`Saldo ${labelTabungan} tidak mencukupi (Tersedia: ${formatRupiah(availableBalance)}).`);
      return;
    }

    const now = new Date();
    const tgl = now.toISOString().split('T')[0];
    const jam = now.toTimeString().split(' ')[0].slice(0, 5);
    const ket = `Tarikan ${labelTabungan} ${currentMember.nama}${tarikCatatan ? ' - ' + tarikCatatan : ''}`;

    const newTx: MemberTransaction = {
      id: `tx-tarik-${Date.now()}`,
      memberId: currentMember.id,
      tanggal: tgl,
      jam,
      keterangan: ket,
      cbg: `KCP ${currentMember.wilayah.toUpperCase()}`,
      tipe: 'keluar',
      nominal: amount,
      saldoSetelah: availableBalance - amount,
      kategori: tarikJenisTabungan === 'pokok' ? 'pokok' : 'umum',
    };

    const newKas: KasEntry = {
      id: `kas-tarik-${Date.now()}`,
      bukuKas: 'anggota',
      tanggal: tgl,
      kategori: `Penarikan ${labelTabungan}`,
      keterangan: ket,
      tipe: 'keluar',
      nominal: amount,
      saldoKasSetelah: 0,
      inputBy: currentMember.nama,
      status: 'approved',
      createdAt: now.toISOString(),
    };

    await updateState((prev) => {
      const updatedMembers = prev.members.map((m) => {
        if (m.id !== currentMember.id) return m;
        if (tarikJenisTabungan === 'pokok') {
          const newPokok = Math.max(0, m.saldoPokok - amount);
          return {
            ...m,
            saldoPokok: newPokok,
            totalSimpanan: newPokok + m.saldoZakatFitrah + m.saldoQurban + m.saldoUmum,
          };
        } else {
          const newUmum = Math.max(0, m.saldoUmum - amount);
          return {
            ...m,
            saldoUmum: newUmum,
            totalSimpanan: m.saldoPokok + m.saldoZakatFitrah + m.saldoQurban + newUmum,
          };
        }
      });

      return {
        ...prev,
        members: updatedMembers,
        memberTransactions: [newTx, ...prev.memberTransactions],
        kasList: [newKas, ...prev.kasList],
      };
    });

    alert(`✓ Penarikan ${labelTabungan} senilai ${formatRupiah(amount)} berhasil diproses ke rekening ${currentMember.bankPribadi.namaBank} (${currentMember.bankPribadi.nomorRekening})!`);
    setShowTarikModal(false);
    setTarikNominal('');
    setTarikCatatan('');
  };

  // Generate data for Recharts: Ringkasan Mutasi Saldo & Transaksi 30 Hari Terakhir
  const chartData30Days = React.useMemo(() => {
    const points: Array<{
      date: string;
      label: string;
      total: number;
      pokok: number;
      umum: number;
      mutasi: number;
    }> = [];

    const now = new Date();
    const memberTxs = (state.memberTransactions || []).filter((tx) => tx.memberId === currentMember.id);
    const currentTotal = (currentMember.saldoPokok || 0) + (currentMember.saldoZakatFitrah || 0) + (currentMember.saldoQurban || 0) + (currentMember.saldoUmum || 0);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = `${d.getDate()} ${d.toLocaleDateString('id-ID', { month: 'short' })}`;

      const dayTxs = memberTxs.filter((tx) => tx.tanggal === dateStr);
      const mutasiHariIni = dayTxs.reduce((acc, tx) => acc + (tx.tipe === 'masuk' ? tx.nominal : -tx.nominal), 0);

      points.push({
        date: dateStr,
        label: dayLabel,
        total: Math.max(0, currentTotal),
        pokok: Math.max(0, currentMember.saldoPokok || 0),
        umum: Math.max(0, currentMember.saldoUmum || 0),
        mutasi: mutasiHariIni,
      });
    }

    return points;
  }, [state.memberTransactions, currentMember]);

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* ================= HEADER (Matching Anggota PC Dashboard.png & Mobile) ================= */}
      <header className="sticky top-0 z-40 bg-[#0d1424]/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="max-w-md md:max-w-4xl lg:max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          {/* Top Row: Logo & Member Info */}
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-10 h-10 rounded-full bg-white p-0.5 shadow flex items-center justify-center shrink-0">
                <LogoHws className="w-full h-full" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-black text-sm sm:text-base tracking-wide text-white">
                    KOPERASI HWS
                  </span>
                  <span className="bg-[#f59e0b] text-slate-950 font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md uppercase">
                    ANGGOTA
                  </span>
                </div>
                <div className="text-[11px] sm:text-xs text-slate-400 font-medium truncate max-w-[210px] sm:max-w-none">
                  {currentMember.nama} • KCP {currentMember.wilayah}
                </div>
              </div>
            </div>

            {/* Desktop Only Right Action Buttons */}
            <div className="hidden sm:flex items-center gap-2">
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

          {/* Requirement A.1 & A.2: Tampilan tombol setting dan chat di mobile pindahkan ke bawah logo koperasi dan nama anggota */}
          {/* Tombol setting pada dashboard anggota JANGAN dibuat melebar kesamping pada mobile, tempatkan di bawah chat atau hanya logo icon */}
          <div className="flex sm:hidden items-center gap-2 pt-1 border-t border-slate-800/60">
            <button
              type="button"
              onClick={() => setActiveMenu('chat')}
              className="py-1.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Chat Pengurus</span>
              {unreadChatCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] flex items-center justify-center ml-0.5">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-xl bg-[#162035] hover:bg-slate-800 text-amber-400 border border-amber-500/40 flex items-center justify-center transition-all shadow-sm shrink-0"
              title="Pengaturan Koperasi"
            >
              <Settings className="w-4 h-4 text-amber-500" />
            </button>
          </div>
        </div>
      </header>

      {/* ================= BACK BUTTON ON SUBMENUS ================= */}
      {activeMenu !== 'dashboard' && (
        <div className="bg-[#111c33] border-b border-slate-800 px-3 sm:px-4 py-2.5">
          <div className="max-w-md md:max-w-4xl lg:max-w-5xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={handleSubmenuBack}
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

      {/* ================= MAIN BODY CONTAINER (Anti Melebar Kesamping di Mobile) ================= */}
      <main className="w-full max-w-md md:max-w-4xl lg:max-w-5xl mx-auto p-3 sm:p-6 space-y-5 sm:space-y-6 flex-1 overflow-x-hidden">
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

              {/* 5 Sub-Cards Grid: Pokok, Fitrah, Qurban, Umum, Saldo Sedekah (Req 3C) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mt-5 relative z-10">
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

                {/* 5. Saldo Sedekah Anggota (Req 3C) */}
                <div
                  onClick={() => setShowBerbagiModal(true)}
                  className="bg-gradient-to-br from-[#141d33] via-[#1a1c38] to-[#25152b] border border-rose-500/50 hover:border-rose-400 rounded-2xl p-3.5 sm:p-4 cursor-pointer transition-all hover:scale-[1.02] shadow-md group col-span-2 sm:col-span-1"
                  title="Klik untuk membuka Menu Sedekah (Setor QRIS & Transfer Bank)"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs text-rose-300 font-semibold block">
                      Saldo Sedekah
                    </span>
                    <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/30 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-rose-300 mt-1">
                    {formatRupiah(memberSaldoSedekah)}
                  </div>
                  <div className="text-[10px] text-rose-400/90 mt-1 flex items-center justify-between">
                    <span>Siap Disalurkan</span>
                    <span className="font-bold underline text-[9px] group-hover:text-rose-200">Setor ›</span>
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
                  className="py-3 px-4 bg-[#162035] hover:bg-slate-800 text-sky-400 border border-sky-500/30 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all text-xs sm:text-sm cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4 text-sky-400" />
                  <span>Tarik Tabungan (Umum / Pokok)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTransferModal(true)}
                  className="py-3 px-4 bg-[#162035] hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all text-xs sm:text-sm cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
                  <span>Transfer Sesama Anggota</span>
                </button>
              </div>

              {/* User Req 2: Tombol Menu Berbagi (Sedekah Subuh, Sedekah Jumat, Sedekah Umum) */}
              <button
                type="button"
                onClick={() => setShowBerbagiModal(true)}
                className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-rose-500/20 hover:from-rose-500/30 hover:to-amber-500/30 border border-rose-500/40 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-black text-rose-300 shadow-md active:scale-[0.99] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-xl bg-rose-500 text-slate-950 group-hover:scale-110 transition-transform">
                    <Heart className="w-4 h-4 fill-slate-950" />
                  </span>
                  <div className="text-left">
                    <div className="text-white font-extrabold text-xs sm:text-sm flex items-center gap-2">
                      <span>Menu Berbagi (Sedekah Subuh, Jumat & Umum)</span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                        Buku Kas Koperasi
                      </span>
                    </div>
                    <div className="text-[10px] text-rose-300/80 font-normal mt-0.5">
                      Pilihan sedekah berkah tercatat di kas koperasi • Tidak dapat ditarik kembali
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl group-hover:bg-amber-500/20 transition-colors">
                  Salurkan Berkah →
                </span>
              </button>
            </div>

            {/* ================= RECHARTS: GRAFIK RINGKASAN MUTASI SALDO & TRANSAKSI 30 HARI TERAKHIR ================= */}
            <div className="bg-[#0f172a] border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-white">
                      Grafik Ringkasan Mutasi Saldo Tabungan (30 Hari Terakhir)
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-400">
                      Visualisasi perkembangan saldo Tabungan Pokok, Tabungan Umum, & Total Simpanan
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="text-amber-300">Total Simpanan</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                      <span className="text-sky-300">Tabungan Umum</span>
                    </div>
                  </div>

                  {/* Req 6: Tombol Sembunyikan / Lihat Grafik */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowGrafik((prev) => {
                        const next = !prev;
                        try {
                          localStorage.setItem('hws_member_show_grafik', String(next));
                        } catch {}
                        return next;
                      });
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
                    title={showGrafik ? 'Sembunyikan grafik mutasi' : 'Tampilkan grafik mutasi'}
                  >
                    {showGrafik ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{showGrafik ? 'Sembunyikan Grafik' : 'Lihat Grafik'}</span>
                  </button>
                </div>
              </div>

              {showGrafik ? (
                <div className="w-full h-56 sm:h-64 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData30Days} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorUmum" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35}/>
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis
                        dataKey="label"
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                        interval={4}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                        tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}jt` : val >= 1000 ? `${(val/1000).toFixed(0)}rb` : String(val)}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                                <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label}</p>
                                <p className="text-amber-400 font-bold">
                                  Total: {formatRupiah(Number(payload[0]?.value || 0))}
                                </p>
                                {payload[1] && (
                                  <p className="text-sky-400 font-semibold text-[11px]">
                                    Tabungan Umum: {formatRupiah(Number(payload[1]?.value || 0))}
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorTotal)"
                        name="Total Simpanan"
                      />
                      <Area
                        type="monotone"
                        dataKey="umum"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorUmum)"
                        name="Tabungan Umum"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-7 text-center text-slate-400 text-xs italic bg-slate-900/60 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-1.5">
                  <span className="text-xl">📊</span>
                  <span>Grafik mutasi tabungan sedang disembunyikan. Klik tombol "Lihat Grafik" untuk menampilkan.</span>
                </div>
              )}
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
                        {unreadSuratCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow-md">
                            {unreadSuratCount}
                          </span>
                        )}
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

                {/* 8. Menu Berbagi (Sedekah Subuh, Sedekah Jumat, Sedekah Umum) */}
                <button
                  type="button"
                  onClick={() => setShowBerbagiModal(true)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 to-slate-900 border border-rose-500/40 text-white flex items-center justify-between text-left transition-all hover:border-rose-400 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                      <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 fill-rose-400/20" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5 text-rose-300">
                        <span>8. Menu Berbagi (Sedekah)</span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                          Sosial Syariah
                        </span>
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                        Sedekah Subuh, Sedekah Jumat & Sedekah Umum
                      </div>
                    </div>
                  </div>
                  <span className="text-rose-400 text-lg">›</span>
                </button>

                {/* 9. Pengaturan Keamanan (Security Settings - Biometrik) */}
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#111c33] hover:bg-[#162544] border border-amber-500/40 text-white flex items-center justify-between text-left transition-all group col-span-1 md:col-span-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40 group-hover:scale-105 transition-transform">
                      <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-extrabold flex items-center gap-1.5 text-amber-300">
                        <span>9. Pengaturan Keamanan (Biometrik Device)</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          Fingerprint / Face ID
                        </span>
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                        Aktifkan / nonaktifkan masuk via sensor sidik jari & wajah pada perangkat ini
                      </div>
                    </div>
                  </div>
                  <span className="text-amber-400 text-lg">›</span>
                </button>
              </div>
            </div>
          </>
        ) : activeMenu === 'setoran' ? (
          <MemberVerificationView
            state={state}
            updateState={updateState}
            currentMember={currentMember}
            onBackToDashboard={() => setActiveMenu('dashboard')}
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

                    {/* Recipient Preview: Hanya muncul setelah nomor rekening benar per Req A.6 */}
                    {targetMemberRecipient ? (
                      <div className="mt-2.5 p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl flex items-center gap-3 shadow-md">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base shrink-0 border border-emerald-500/30">
                          ✓
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider">
                            Penerima Ditemukan:
                          </div>
                          <div className="font-extrabold text-white text-xs sm:text-sm truncate">
                            {targetMemberRecipient.nama}
                          </div>
                          <div className="text-[11px] text-slate-300 font-mono">
                            Rek: {targetMemberRecipient.nomorRekening} • KCP {targetMemberRecipient.wilayah}
                          </div>
                        </div>
                      </div>
                    ) : tfTargetRek.trim().length >= 4 ? (
                      <div className="mt-2 text-[11px] text-amber-400/90 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span>Memeriksa kecocokan nomor rekening penerima...</span>
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
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 px-1">
                      <span>PIN default awal: 123456</span>
                      <button
                        type="button"
                        onClick={() => setShowChangePinInTransfer(!showChangePinInTransfer)}
                        className="text-amber-400 hover:text-amber-300 font-bold underline"
                      >
                        {showChangePinInTransfer ? 'Tutup Ganti PIN' : 'Ganti PIN 6-Digit?'}
                      </button>
                    </div>

                    {/* Inline Form Ganti PIN 6-Digit saat Transfer (Req A.8) */}
                    {showChangePinInTransfer && (
                      <div className="mt-3 p-3 bg-slate-900 rounded-2xl border border-amber-500/40 space-y-2 text-left">
                        <div className="text-xs font-extrabold text-amber-400">
                          Ganti PIN Transaksi (6-Digit)
                        </div>
                        {pinChangeMsg && (
                          <div className={`p-1.5 rounded-lg text-[10px] font-bold ${pinChangeMsg.startsWith('✓') ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                            {pinChangeMsg}
                          </div>
                        )}
                        <div>
                          <label className="block text-[10px] text-slate-400">Password Login Anda</label>
                          <input
                            type="password"
                            value={pinChangePassword}
                            onChange={(e) => setPinChangePassword(e.target.value)}
                            placeholder="Konfirmasi password akun"
                            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400">PIN 6-Digit Baru</label>
                            <input
                              type="password"
                              maxLength={6}
                              value={pinChangeNewPin}
                              onChange={(e) => setPinChangeNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="6 digit baru"
                              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-center text-xs tracking-widest"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">Ulangi PIN Baru</label>
                            <input
                              type="password"
                              maxLength={6}
                              value={pinChangeConfirmPin}
                              onChange={(e) => setPinChangeConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="Ulangi 6 digit"
                              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-center text-xs tracking-widest"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleChangePinInTransfer}
                          className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all"
                        >
                          Simpan PIN Baru & Lanjutkan
                        </button>
                      </div>
                    )}
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
                  Penarikan Saldo Tabungan (Umum / Pokok)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTarikModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTarikSubmit} className="p-4 space-y-3.5 text-xs">
              {/* Pilihan Sumber Tabungan: Tabungan Umum vs Tabungan Pokok */}
              <div>
                <label className="block font-bold text-slate-300 mb-1.5">
                  Pilih Sumber Tabungan yang Ditarik:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTarikJenisTabungan('umum');
                      setTarikNominal('');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      tarikJenisTabungan === 'umum'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-md shadow-sky-500/20'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-extrabold text-xs">Tabungan Umum</div>
                    <div className="text-[11px] font-mono font-bold text-sky-300 mt-0.5">
                      {formatRupiah(currentMember.saldoUmum)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTarikJenisTabungan('pokok');
                      setTarikNominal('');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                      tarikJenisTabungan === 'pokok'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-extrabold text-xs">Tabungan Pokok</div>
                      {currentMember.isPokokLocked ? (
                        <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Terkunci
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <Unlock className="w-2.5 h-2.5" /> Terbuka
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono font-bold text-amber-300 mt-0.5">
                      {formatRupiah(currentMember.saldoPokok)}
                    </div>
                  </button>
                </div>
              </div>

              {/* Status Tabungan Pokok Banner */}
              {tarikJenisTabungan === 'pokok' && (
                <div
                  className={`p-3 rounded-2xl border text-xs space-y-1 ${
                    currentMember.isPokokLocked
                      ? 'bg-red-950/40 border-red-500/40 text-red-200'
                      : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  }`}
                >
                  <div className="font-extrabold flex items-center gap-1.5">
                    {currentMember.isPokokLocked ? (
                      <>
                        <Lock className="w-4 h-4 text-red-400" />
                        <span>Tabungan Pokok Sedang Dikunci (Locked)</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4 text-emerald-400" />
                        <span>Tabungan Pokok Terbuka (Unlocked)</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    {currentMember.isPokokLocked
                      ? 'Penarikan simpanan pokok saat ini dikunci. Pembukaan kunci harus diajukan oleh Admin Write dengan mengetik alasan resmi dan disahkan oleh Admin Approval.'
                      : 'Pembukaan kunci penarikan simpanan pokok telah disetujui oleh pengurus koperasi. Anda dapat mencairkan dana ini ke rekening bank pribadi Anda.'}
                  </p>
                </div>
              )}

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
                  disabled={tarikJenisTabungan === 'pokok' && currentMember.isPokokLocked}
                  min={1}
                  max={tarikJenisTabungan === 'pokok' ? currentMember.saldoPokok : currentMember.saldoUmum}
                  value={tarikNominal}
                  onChange={(e) => setTarikNominal(e.target.value)}
                  placeholder={tarikJenisTabungan === 'pokok' && currentMember.isPokokLocked ? 'Penarikan dikunci oleh admin' : 'Ketik nominal rupiah'}
                  className="w-full px-3 py-2 bg-slate-800 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed border border-slate-700 rounded-xl text-white font-mono text-sm focus:ring-2 focus:ring-sky-500"
                />
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>Maksimal Saldo: {formatRupiah(tarikJenisTabungan === 'pokok' ? currentMember.saldoPokok : currentMember.saldoUmum)}</span>
                  {!(tarikJenisTabungan === 'pokok' && currentMember.isPokokLocked) && (
                    <button
                      type="button"
                      onClick={() => setTarikNominal(String(tarikJenisTabungan === 'pokok' ? currentMember.saldoPokok : currentMember.saldoUmum))}
                      className="text-amber-400 hover:underline font-bold cursor-pointer"
                    >
                      Tarik Semua
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Keperluan / Catatan (Opsional)
                </label>
                <input
                  type="text"
                  disabled={tarikJenisTabungan === 'pokok' && currentMember.isPokokLocked}
                  value={tarikCatatan}
                  onChange={(e) => setTarikCatatan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 disabled:bg-slate-900 disabled:text-slate-500 disabled:cursor-not-allowed border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowTarikModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!tarikNominal || (tarikJenisTabungan === 'pokok' && currentMember.isPokokLocked)}
                  className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  {tarikJenisTabungan === 'pokok' && currentMember.isPokokLocked ? '🔒 Tabungan Pokok Terkunci' : 'Tarik Dana Sekarang'}
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

      {/* ================= REAL-TIME NOTIFICATIONS TOAST (REQ 1 & 5) ================= */}
      {memberToasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[110] max-w-sm w-full space-y-2 pointer-events-none">
          {memberToasts.map((toast) => (
            <div
              key={toast.id}
              onClick={() => {
                toast.action?.();
                setMemberToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }}
              className="pointer-events-auto p-3.5 bg-slate-900/95 border border-amber-500/80 rounded-2xl shadow-2xl backdrop-blur text-white flex items-start gap-3 cursor-pointer hover:border-amber-400 transition-all animate-bounce"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 text-sm font-bold border border-amber-500/30">
                {toast.type === 'surat_baru' ? '📬' : toast.type === 'setoran_verified' ? '✅' : '💳'}
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-300">{toast.title}</span>
                  <span className="text-[10px] text-slate-400">{toast.timestamp}</span>
                </div>
                <p className="text-slate-200 mt-0.5 line-clamp-2">{toast.message}</p>
                <span className="text-[10px] text-amber-400 font-bold block mt-1">Ketuk untuk membuka ›</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMemberToasts((prev) => prev.filter((t) => t.id !== toast.id));
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ================= FLOATING BACK / LOGOUT TOAST (REQ 7) ================= */}
      {backToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-slate-900/95 border border-amber-500/60 text-amber-300 text-xs sm:text-sm font-bold rounded-2xl shadow-2xl backdrop-blur-md animate-bounce flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>{backToast}</span>
        </div>
      )}

      {/* ================= MODAL MENU BERBAGI (REQ 2: SEDEKAH SUBUH, JUMAT, UMUM & LAPORAN) ================= */}
      <MenuBerbagiModal
        isOpen={showBerbagiModal}
        onClose={() => setShowBerbagiModal(false)}
        state={state}
        updateState={updateState}
        currentMember={currentMember}
      />
    </div>
  );
};
