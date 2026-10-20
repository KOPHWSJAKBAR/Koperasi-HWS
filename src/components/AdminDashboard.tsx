import React, { useState, useEffect, useRef } from 'react';
import {
  AppState,
  AdminUser,
} from '../types';
import {
  formatRupiah,
  playNotificationSound,
  requestNotificationPermission,
  triggerBrowserNotification,
} from '../lib/storage';
import { LogoHws } from '../lib/logo';
import { MemberVerificationView } from './MemberVerificationView';
import { MemberListView } from './MemberListView';
import { BukuKasView } from './BukuKasView';
import { PenyesuaianSaldoView } from './PenyesuaianSaldoView';
import { ZakatQurbanView } from './ZakatQurbanView';
import { SuratMenyuratView } from './SuratMenyuratView';
import { ChatOnlineView } from './ChatOnlineView';
import { SettingModal } from './SettingModal';
import { InstallAppModal } from './InstallAppModal';
import { MenuBerbagiModal } from './MenuBerbagiModal';
import { downloadExcelCsv, printDocumentHtml } from '../lib/exportPdf';
import {
  BookOpen,
  Users,
  CheckCircle2,
  HeartHandshake,
  Heart,
  FileSpreadsheet,
  Send,
  Mail,
  MessageSquare,
  Settings,
  LogOut,
  DollarSign,
  ChevronLeft,
  FileDown,
  Printer,
  PlusCircle,
  TrendingUp,
  Building,
  Shield,
  Layers,
  Bell,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Activity,
  SlidersHorizontal,
  Smartphone,
  Lock,
  Fingerprint,
} from 'lucide-react';

interface AdminToast {
  id: string;
  type: 'deposit' | 'chat' | 'test';
  title: string;
  message: string;
  timestamp: string;
  targetId?: string;
}

interface AdminDashboardProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  admin: AdminUser;
  onLogout: (reason?: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  state,
  updateState,
  admin,
  onLogout,
}) => {
  // Sync admin with latest state
  const currentAdmin = state.admins.find((a) => a.id === admin.id) || admin;

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'verifikasi' | 'anggota' | 'kas' | 'penyesuaian_saldo' | 'zakat' | 'surat' | 'chat'
  >('dashboard');

  const [showSettings, setShowSettings] = useState(false);
  const [settingSubModal, setSettingSubModal] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showBerbagiModal, setShowBerbagiModal] = useState(false);
  const [berbagiInitialTab, setBerbagiInitialTab] = useState<'laporan' | 'salurkan' | 'konfirmasi'>('laporan');

  // Orcas Policy Engine confirmation modal state for Mobile & PC
  const [orcasConfirmation, setOrcasConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    actionName: string;
    details: string;
    onApprove?: () => void;
    onReject?: () => void;
  } | null>(null);

  // Notification state
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('koperasi_admin_sound') !== 'false';
    } catch {
      return true;
    }
  });

  const prevPendingIdsRef = useRef<Set<string>>(
    new Set(state.setoranList.filter((s) => s.status === 'pending').map((s) => s.id))
  );
  const prevChatIdsRef = useRef<Set<string>>(
    new Set(state.chatMessages.map((m) => m.id))
  );
  const isInitialMountRef = useRef<boolean>(true);

  const unreadSuratAdminCount = state.suratList.filter((s) => {
    const readList = s.readByAdminIds || [];
    return !readList.includes(currentAdmin.id);
  }).length;

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
      onLogout('Anda telah berhasil keluar dari akun admin (3x klik tombol kembali).');
    } else if (backClicksRef.current === 2) {
      setToasts((prev) => [
        {
          id: `toast-${Date.now()}`,
          type: 'test',
          title: 'Konfirmasi Logout',
          message: 'Klik 1x lagi untuk keluar / logout dari akun admin.',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev,
      ]);
    } else {
      // 1x click: Kembali ke menu sebelumnya (dashboard) tanpa menampilkan note (Req 2)
      setActiveTab('dashboard');
    }
  };

  useEffect(() => {
    const onAppBack = (e: Event) => {
      if (e.defaultPrevented) return;
      if (showSettings) {
        setShowSettings(false);
      } else if (showBerbagiModal) {
        setShowBerbagiModal(false);
      } else if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
      }
    };
    window.addEventListener('app:back_press', onAppBack);
    return () => window.removeEventListener('app:back_press', onAppBack);
  }, [showSettings, showBerbagiModal, activeTab]);

  // Request browser notification permission once on admin dashboard mount
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  // Save sound setting
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('koperasi_admin_sound', String(next));
    } catch {}
  };

  // Test notification helper
  const handleTestNotification = () => {
    playNotificationSound('deposit');
    setTimeout(() => playNotificationSound('chat'), 500);
    triggerBrowserNotification(
      '🔔 Tes Notifikasi Koperasi HWS',
      'Sistem notifikasi suara dan push notifikasi admin aktif dengan normal!'
    );
    setToasts((prev) => [
      {
        id: `toast-test-${Date.now()}`,
        type: 'test',
        title: 'Tes Notifikasi Berhasil!',
        message: 'Perangkat admin kini siap menerima notifikasi setoran masuk dan chat secara realtime.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev,
    ]);
  };

  // Detection effect for incoming deposits and chats
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // 1. Check newly added pending deposits
    const currentPending = state.setoranList.filter((s) => s.status === 'pending');
    const newPendingDeposits = currentPending.filter(
      (s) => !prevPendingIdsRef.current.has(s.id)
    );

    if (newPendingDeposits.length > 0) {
      if (soundEnabled) {
        playNotificationSound('deposit');
      }

      newPendingDeposits.forEach((dep) => {
        triggerBrowserNotification(
          '🔔 Setoran Masuk Baru - Koperasi HWS',
          `${dep.memberNama} mengajukan setoran ${dep.jenis} sebesar Rp ${dep.nominal.toLocaleString('id-ID')} (${dep.metode})`,
          () => setActiveTab('verifikasi')
        );

        setToasts((prev) => [
          {
            id: `toast-dep-${dep.id}-${Date.now()}`,
            type: 'deposit',
            title: 'Setoran Masuk Baru!',
            message: `${dep.memberNama} • Rp ${dep.nominal.toLocaleString('id-ID')} (${dep.jenis})`,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            targetId: dep.id,
          },
          ...prev.slice(0, 4),
        ]);
      });
    }
    prevPendingIdsRef.current = new Set(currentPending.map((s) => s.id));

    // 2. Check new incoming chat messages from members
    const newChatMessages = state.chatMessages.filter(
      (m) =>
        !prevChatIdsRef.current.has(m.id) &&
        m.senderType === 'member' &&
        !m.isReadByAdmin
    );

    if (newChatMessages.length > 0) {
      if (soundEnabled) {
        playNotificationSound('chat');
      }

      newChatMessages.forEach((msg) => {
        triggerBrowserNotification(
          `💬 Pesan Chat dari ${msg.senderNama}`,
          msg.pesan,
          () => setActiveTab('chat')
        );

        setToasts((prev) => [
          {
            id: `toast-chat-${msg.id}-${Date.now()}`,
            type: 'chat',
            title: `Pesan Chat: ${msg.senderNama}`,
            message: msg.pesan,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            targetId: msg.memberId,
          },
          ...prev.slice(0, 4),
        ]);
      });
    }
    prevChatIdsRef.current = new Set(state.chatMessages.map((m) => m.id));
  }, [state.setoranList, state.chatMessages, soundEnabled]);

  // Auto-dismiss toasts after 9s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(0, -1));
    }, 9000);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Role permissions (Req I)
  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const isApproval = currentAdmin.role === 'admin_approval' || currentAdmin.role === 'admin_kelola' || currentAdmin.role === 'admin_pembukuan';
  const isKelola = isApproval;
  const isWriter = currentAdmin.role === 'admin_write';
  const isLaporan = currentAdmin.role === 'admin_laporan';

  // Calculate totals
  const totalPokok = state.members.reduce((acc, m) => acc + m.saldoPokok, 0);
  const totalUmum = state.members.reduce((acc, m) => acc + m.saldoUmum, 0);
  const totalZakat = state.members.reduce((acc, m) => acc + m.saldoZakatFitrah, 0);
  const totalQurban = state.members.reduce((acc, m) => acc + m.saldoQurban, 0);

  // Calculate running balances for the two cash books
  let saldoKasAnggota = 0;
  state.kasList
    .filter((k) => k.bukuKas === 'anggota' && k.status === 'approved')
    .forEach((k) => {
      if (k.tipe === 'masuk') saldoKasAnggota += k.nominal;
      else saldoKasAnggota -= k.nominal;
    });

  let saldoKasKoperasi = 0;
  state.kasList
    .filter((k) => k.bukuKas === 'koperasi' && k.status === 'approved')
    .forEach((k) => {
      if (k.tipe === 'masuk') saldoKasKoperasi += k.nominal;
      else saldoKasKoperasi -= k.nominal;
    });

  // Perhitungan Saldo Kas Berbagi & Sedekah Koperasi (Req 1D)
  const namaSubuh = state.pengaturanBerbagi?.namaSubuh || 'Sedekah Subuh';
  const namaJumat = state.pengaturanBerbagi?.namaJumat || 'Sedekah Jumat';
  const namaUmum = state.pengaturanBerbagi?.namaUmum || 'Sedekah Umum';
  const allSedekah = state.sedekahList || [];
  const totalSedekahMasuk = allSedekah.filter((e) => e.tipe === 'penerimaan' && e.status === 'approved').reduce((acc, e) => acc + e.nominal, 0);
  const totalSedekahSalur = allSedekah.filter((e) => e.tipe === 'penyaluran' && e.status === 'approved').reduce((acc, e) => acc + e.nominal, 0);
  const saldoSedekahTersedia = Math.max(0, totalSedekahMasuk - totalSedekahSalur);
  const subuhSaldo = Math.max(0, allSedekah.filter((e) => e.jenis === 'sedekah_subuh' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0)
    - allSedekah.filter((e) => e.jenis === 'sedekah_subuh' && e.tipe === 'penyaluran' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0));
  const jumatSaldo = Math.max(0, allSedekah.filter((e) => e.jenis === 'sedekah_jumat' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0)
    - allSedekah.filter((e) => e.jenis === 'sedekah_jumat' && e.tipe === 'penyaluran' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0));
  const umumSaldo = Math.max(0, allSedekah.filter((e) => e.jenis === 'sedekah_umum' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0)
    - allSedekah.filter((e) => e.jenis === 'sedekah_umum' && e.tipe === 'penyaluran' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0));

  // Pending deposits count
  const pendingDepositsCount = state.setoranList.filter((s) => s.status === 'pending').length;

  // Pending Tabungan Pokok Lock / Unlock requests (Req 7)
  const pendingLockPokokCount = state.members.filter((m) => !!m.lockPokokRequest).length;

  // Pending Buku Kas Koperasi Approval (Input, Edit, Hapus)
  const pendingKasCount = state.kasList.filter((k) => k.status === 'pending_approval').length;

  // Unread chat messages from members
  const unreadChatCount = state.chatMessages.filter(
    (m) => m.senderType === 'member' && !m.isReadByAdmin
  ).length;

  // Pending Penyaluran Sedekah Approval (Input Admin Write butuh persetujuan Approval / Super Admin per Req E)
  const pendingSalurCount = (state.sedekahList || []).filter(
    (e) => e.tipe === 'penyaluran' && e.status === 'pending'
  ).length;

  const totalNotifCount =
    pendingDepositsCount +
    unreadChatCount +
    ((isSuperAdmin || isApproval) ? pendingLockPokokCount + pendingKasCount + pendingSalurCount : 0);

  // Print summary report
  const handlePrintSummary = () => {
    const html = `
      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px;">
          <div>
            <h2 style="font-size: 16px; font-weight: 900; margin: 0;">KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA</h2>
            <div style="font-size: 12px; font-weight: 700; color: #b45309;">Laporan Ringkasan Posisi Kas & Saldo Anggota</div>
          </div>
          <div style="font-size: 10px; text-align: right;">Dicetak: ${new Date().toLocaleDateString('id-ID')}</div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px;">
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Total Simpanan Pokok:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(totalPokok)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Total Tabungan Umum:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(totalUmum)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Total Titipan Zakat Fitrah:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(totalZakat)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Total Titipan Tabungan Qurban:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(totalQurban)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Saldo Berjalan Buku Kas Anggota:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(saldoKasAnggota)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Saldo Berjalan Buku Kas Koperasi:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(saldoKasKoperasi)}</td></tr>
          <tr style="background: #f3f4f6; font-weight: 800; font-size: 13px;"><td style="padding: 8px;">TOTAL KONSOLIDASI KEUANGAN:</td><td style="text-align: right;">${formatRupiah(saldoKasAnggota + saldoKasKoperasi)}</td></tr>
        </table>
      </div>
    `;
    printDocumentHtml(html, 'Ringkasan_Kas_HWS');
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* ================= HEADER (Matching Tampilan Pada Dashboard PC Aplikasi admin.png) ================= */}
      <header className="sticky top-0 z-40 bg-[#0d1424]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left Brand & Admin Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white p-0.5 shadow flex items-center justify-center shrink-0">
              <LogoHws className="w-full h-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-wide text-white">
                  KOPERASI HWS
                </span>
                <span className="bg-[#00bcd4] text-slate-950 font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md uppercase">
                  ADMIN
                </span>
                <span className="bg-[#f59e0b] text-slate-950 font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md uppercase">
                  {currentAdmin.role.replace('_', ' ')}
                </span>
              </div>
              <div className="text-[11px] sm:text-xs text-slate-400 font-medium">
                {currentAdmin.nama} • Wilayah {currentAdmin.wilayahKantor}
              </div>
            </div>
          </div>

          {/* Right Action Buttons: Only Setting per User Req 9 ("Menu setting pada dashboard hilangkan hanya ada setting") */}
          <div className="flex items-center gap-2">
            {/* Realtime Notification Center Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifCenter(!showNotifCenter)}
                className="relative py-1.5 px-2.5 rounded-xl bg-[#162035] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-all shadow-sm flex items-center justify-center gap-1.5"
                title="Pusat Notifikasi Realtime"
              >
                <Bell className="w-4 h-4 text-amber-400" />
                {totalNotifCount > 0 ? (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-bounce shadow">
                    {totalNotifCount}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">Notif</span>
                )}
              </button>

              {/* Notification Center Popover (Req B.1: tidak dibuat melebar pada mobile) */}
              {showNotifCenter && (
                <div className="fixed top-14 inset-x-2 sm:inset-x-auto sm:right-4 sm:top-auto sm:absolute sm:mt-2 w-auto sm:w-96 max-w-[calc(100vw-16px)] bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden text-xs">
                  <div className="p-3 bg-[#162035] border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <span className="font-extrabold text-white text-xs">Pusat Notifikasi Realtime</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={toggleSound}
                        className={`p-1 rounded-lg text-xs font-bold flex items-center gap-1 px-2 border transition-all ${
                          soundEnabled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                        title={soundEnabled ? 'Matikan Suara Notifikasi' : 'Aktifkan Suara Notifikasi'}
                      >
                        {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                        <span className="text-[10px]">{soundEnabled ? 'Suara ON' : 'MUTE'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNotifCenter(false)}
                        className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Actions & Test bar */}
                  <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleTestNotification}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-[10px] flex items-center gap-1 transition-all"
                    >
                      <Sparkles className="w-3 h-3" />
                      Tes Suara & Notif
                    </button>
                    <button
                      type="button"
                      onClick={() => requestNotificationPermission()}
                      className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-bold text-[10px] flex items-center gap-1 transition-all"
                    >
                      Izin Push HP/Browser
                    </button>
                  </div>

                  {/* Notification List */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/80 p-2 space-y-1">
                    {/* Pending Setoran Section */}
                    {pendingDepositsCount > 0 && (
                      <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/30 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                          <span>🔔 {pendingDepositsCount} Setoran Menunggu Verifikasi</span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('verifikasi');
                              setShowNotifCenter(false);
                            }}
                            className="text-[10px] text-amber-400 underline font-extrabold"
                          >
                            Buka Semua
                          </button>
                        </div>
                        {state.setoranList
                          .filter((s) => s.status === 'pending')
                          .slice(0, 3)
                          .map((dep) => (
                            <div
                              key={dep.id}
                              onClick={() => {
                                setActiveTab('verifikasi');
                                setShowNotifCenter(false);
                              }}
                              className="p-1.5 bg-slate-900/80 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors text-[10px]"
                            >
                              <div className="font-bold text-white flex justify-between">
                                <span>{dep.memberNama}</span>
                                <span className="text-emerald-400 font-black">
                                  Rp {Number(dep.nominal).toLocaleString('id-ID')}
                                </span>
                              </div>
                              <div className="text-slate-400 text-[9px]">
                                {dep.jenis.toUpperCase()} • {dep.metode}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Unread Chat Section */}
                    {unreadChatCount > 0 && (
                      <div className="p-2 bg-sky-500/10 rounded-xl border border-sky-500/30 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-sky-300">
                          <span>💬 {unreadChatCount} Pesan Chat Baru</span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('chat');
                              setShowNotifCenter(false);
                            }}
                            className="text-[10px] text-sky-400 underline font-extrabold"
                          >
                            Buka Chat
                          </button>
                        </div>
                        {state.chatMessages
                          .filter((m) => m.senderType === 'member' && !m.isReadByAdmin)
                          .slice(0, 3)
                          .map((msg) => (
                            <div
                              key={msg.id}
                              onClick={() => {
                                setActiveTab('chat');
                                setShowNotifCenter(false);
                              }}
                              className="p-1.5 bg-slate-900/80 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors text-[10px]"
                            >
                              <div className="font-bold text-white flex justify-between">
                                <span>{msg.senderNama}</span>
                                <span className="text-slate-400 text-[9px]">
                                  {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="text-slate-300 text-[10px] truncate">{msg.pesan}</div>
                            </div>
                          ))}
                      </div>
                    )}

                    {totalNotifCount === 0 && (
                      <div className="py-6 text-center text-slate-400 text-[11px]">
                        ✓ Semua notifikasi telah ditinjau! Tidak ada setoran atau chat baru saat ini.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Realtime Online Status Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-extrabold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Online Realtime (Firebase)</span>
            </div>

            {/* Write Permission Status: Write hanya pada Super Admin */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-[10px] font-bold">
              <span className="text-slate-400">Akses Tulis:</span>
              <span className={isSuperAdmin ? 'text-amber-400 font-black' : 'text-slate-400'}>
                {isSuperAdmin ? 'Super Admin' : 'Terbatas'}
              </span>
            </div>

            {/* Menu Setting: Memuat Keamanan Biometrik, Kelola Admin, dan Profil */}
            <button
              type="button"
              onClick={() => {
                setSettingSubModal(null);
                setShowSettings(true);
              }}
              className="py-1.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-black flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              title="Menu Pengaturan (Kelola Admin, Keamanan Biometrik, Pasang Aplikasi, Profil Koperasi)"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span>Menu Setting</span>
            </button>
          </div>
        </div>

        {/* Navigation Bar for Desktop (Matching Tampilan Pada Dashboard PC Aplikasi admin.png) */}
        <div className="hidden lg:flex items-center gap-1 max-w-7xl mx-auto mt-3 pt-2 border-t border-slate-800/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              activeTab === 'dashboard'
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Dashboard
          </button>

          {!isLaporan && (
            <button
              onClick={() => setActiveTab('verifikasi')}
              className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                activeTab === 'verifikasi'
                  ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verifikasi Setoran
              {pendingDepositsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center ml-1">
                  {pendingDepositsCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('anggota')}
            className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              activeTab === 'anggota'
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Data Anggota ({state.members.length})</span>
            {pendingLockPokokCount > 0 && (isSuperAdmin || isApproval) && (
              <span className="px-1.5 py-0.5 bg-sky-500 text-slate-950 rounded-full font-black text-[10px] animate-pulse">
                {pendingLockPokokCount} Lock
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('kas')}
            className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              activeTab === 'kas'
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Buku Kas & Neraca</span>
            {pendingKasCount > 0 && (isSuperAdmin || isApproval) && (
              <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded-full font-black text-[10px] animate-pulse">
                {pendingKasCount} Approval
              </span>
            )}
          </button>

          {!isLaporan && (
            <button
              onClick={() => setActiveTab('penyesuaian_saldo')}
              className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                activeTab === 'penyesuaian_saldo'
                  ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Penyesuaian Saldo
            </button>
          )}

          <button
            onClick={() => setActiveTab('zakat')}
            className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              activeTab === 'zakat'
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            Zakat & Qurban
          </button>

          {/* User Req 3: Menu Laporan Sedekah & Penyaluran Sedekah pada Dashboard Admin */}
          <button
            type="button"
            onClick={() => {
              setBerbagiInitialTab('laporan');
              setShowBerbagiModal(true);
            }}
            className="py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 cursor-pointer"
            title="Laporan Sedekah (Filter Wilayah, Per Anggota & Periode Excel/PDF)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
            <span>Laporan Sedekah</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBerbagiInitialTab('salurkan');
              setShowBerbagiModal(true);
            }}
            className="py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 cursor-pointer relative"
            title="Penyaluran Sedekah (Input Admin Write & Disetujui Approval/Super Admin)"
          >
            <Send className="w-3.5 h-3.5 text-amber-400" />
            <span>Penyaluran Sedekah</span>
            {pendingSalurCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse" title={`${pendingSalurCount} Penyaluran Butuh Approval`}>
                {pendingSalurCount}
              </span>
            )}
          </button>

          {!isLaporan && (
            <button
              onClick={() => setActiveTab('surat')}
              className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                activeTab === 'surat'
                  ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Surat Menyurat</span>
              {unreadSuratAdminCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[9px] font-black">
                  {unreadSuratAdminCount}
                </span>
              )}
            </button>
          )}

          {!isLaporan && (
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                activeTab === 'chat'
                  ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat Anggota
              {unreadChatCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-sky-500 text-slate-950 text-[10px] font-black flex items-center justify-center ml-1 animate-pulse">
                  {unreadChatCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* ================= BACK BUTTON ON SUBMENUS (Mobile Navigation Requirement) ================= */}
      {activeTab !== 'dashboard' && (
        <div className="bg-[#111c33] border-b border-slate-800 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={handleSubmenuBack}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali ke Dashboard Admin</span>
            </button>
            <span className="text-xs text-slate-400 font-semibold uppercase">
              {activeTab === 'verifikasi' && 'Verifikasi Setoran'}
              {activeTab === 'anggota' && 'Data Anggota'}
              {activeTab === 'kas' && 'Buku Kas & Neraca'}
              {activeTab === 'penyesuaian_saldo' && 'Penyesuaian Saldo Anggota'}
              {activeTab === 'zakat' && 'Zakat & Qurban'}
              {activeTab === 'surat' && 'Surat Menyurat'}
              {activeTab === 'chat' && 'Chat Online'}
            </span>
          </div>
        </div>
      )}

      {/* ================= MAIN CONTENT BODY ================= */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 flex-1 overflow-x-hidden">
        {activeTab === 'dashboard' ? (
          <>
            {/* PENDING LOCK POKOK APPROVAL ALERT BANNER (Req 7) */}
            {(isSuperAdmin || isApproval) && pendingLockPokokCount > 0 && (
              <div
                onClick={() => setActiveTab('anggota')}
                className="bg-gradient-to-r from-sky-950/80 via-indigo-950/70 to-slate-900 border border-sky-500/50 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-sky-400 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-white">
                        Ada {pendingLockPokokCount} Pengajuan Kunci / Buka Tabungan Pokok Menunggu Persetujuan
                      </h4>
                      <span className="text-[10px] font-black bg-sky-500 text-slate-950 px-2 py-0.5 rounded-full animate-pulse">
                        Perlu Disahkan
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-300/80 mt-0.5">
                      Diajukan oleh Admin Write beserta alasan permohonan. Klik untuk membuka menu Data Anggota dan memberikan persetujuan.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl text-xs shrink-0 shadow-lg shadow-sky-500/20 transition-all cursor-pointer self-end sm:self-center"
                >
                  Buka Pengesahan
                </button>
              </div>
            )}

            {/* PENDING BUKU KAS APPROVAL ALERT BANNER (Input, Edit, Hapus) */}
            {(isSuperAdmin || isApproval) && pendingKasCount > 0 && (
              <div
                onClick={() => setActiveTab('kas')}
                className="bg-gradient-to-r from-amber-950/80 via-yellow-950/70 to-slate-900 border border-amber-500/50 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-amber-400 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-white">
                        Ada {pendingKasCount} Transaksi Buku Kas Koperasi Menunggu Persetujuan
                      </h4>
                      <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full animate-pulse">
                        Approval Kas
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      Diajukan oleh Admin Write (input, edit, atau permohonan hapus). Klik untuk membuka Buku Kas dan menyetujui atau menolak.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shrink-0 shadow-lg shadow-amber-500/20 transition-all cursor-pointer self-end sm:self-center"
                >
                  Buka Kas →
                </button>
              </div>
            )}

            {/* Top 4 Stat Cards Grid (Matching Tampilan Pada Dashboard PC Aplikasi admin.png) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Total Simpanan Pokok */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-5 shadow-xl">
                <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider block">
                  TOTAL SIMPANAN POKOK
                </span>
                <div className="text-2xl sm:text-3xl font-black text-[#f59e0b] mt-1.5">
                  {formatRupiah(totalPokok)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Rp1.000 / hari • Terkunci oleh Admin
                </div>
              </div>

              {/* 2. Total Tabungan Umum */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-5 shadow-xl">
                <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider block">
                  TOTAL TABUNGAN UMUM
                </span>
                <div className="text-2xl sm:text-3xl font-black text-sky-400 mt-1.5">
                  {formatRupiah(totalUmum)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Bisa setor & tarik kapan saja
                </div>
              </div>

              {/* 3. Dana Zakat & Qurban */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-5 shadow-xl">
                <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider block">
                  DANA ZAKAT & QURBAN
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1.5">
                  {formatRupiah(totalZakat + totalQurban)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Fitrah: {formatRupiah(totalZakat)} • Qurban: {formatRupiah(totalQurban)}
                </div>
              </div>

              {/* 4. Saldo Kas Berjalan */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-5 shadow-xl">
                <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider block">
                  SALDO KAS BERJALAN
                </span>
                <div className="text-2xl sm:text-3xl font-black text-white mt-1.5">
                  {formatRupiah(saldoKasAnggota + saldoKasKoperasi)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Kas Anggota: {formatRupiah(saldoKasAnggota)} | Kas: {formatRupiah(saldoKasKoperasi)}
                </div>
              </div>
            </div>

            {/* 2 Main Cards: Buku Kas Anggota & Buku Kas Koperasi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Buku Kas Anggota */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-5 h-5 text-amber-500" />
                      <div>
                        <h4 className="text-base font-extrabold text-white">Buku Kas Anggota</h4>
                        <div className="text-[11px] text-slate-400">
                          Tabungan Pokok & Tabungan Umum Seluruh Anggota
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400">Saldo Berjalan</span>
                      <div className="text-sm font-black text-emerald-400 font-mono">
                        {formatRupiah(saldoKasAnggota)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mt-4 text-xs">
                    <div className="p-3 bg-[#162035] rounded-xl flex justify-between items-center">
                      <span className="text-slate-300">Total Simpanan Pokok:</span>
                      <span className="font-bold text-amber-400 font-mono">{formatRupiah(totalPokok)}</span>
                    </div>
                    <div className="p-3 bg-[#162035] rounded-xl flex justify-between items-center">
                      <span className="text-slate-300">Total Tabungan Umum Anggota:</span>
                      <span className="font-bold text-sky-400 font-mono">{formatRupiah(totalUmum)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setSettingSubModal('sesuaikan_saldo');
                        setShowSettings(true);
                      }}
                      className="w-full py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                    >
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      <span>Sesuaikan Saldo Anggota</span>
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('kas')}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Cetak Laporan PDF
                    </button>
                    <button
                      onClick={() => setActiveTab('kas')}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Unduh Excel
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Buku Kas Koperasi */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <Building className="w-5 h-5 text-sky-400" />
                      <div>
                        <h4 className="text-base font-extrabold text-white">Buku Kas Koperasi</h4>
                        <div className="text-[11px] text-slate-400">
                          Overhead Operasional, Penyaluran Zakat & Qurban
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400">Saldo Berjalan</span>
                      <div className="text-sm font-black text-sky-400 font-mono">
                        {formatRupiah(saldoKasKoperasi)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mt-4 text-xs">
                    <div className="p-3 bg-[#162035] rounded-xl flex justify-between items-center">
                      <span className="text-slate-300">Total Zakat Fitrah Tersedia:</span>
                      <span className="font-bold text-emerald-400 font-mono">{formatRupiah(totalZakat)}</span>
                    </div>
                    <div className="p-3 bg-[#162035] rounded-xl flex justify-between items-center">
                      <span className="text-slate-300">Total Tabungan Qurban Tersedia:</span>
                      <span className="font-bold text-emerald-400 font-mono">{formatRupiah(totalQurban)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setActiveTab('kas')}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                    + Input Kas Koperasi
                  </button>
                  <button
                    onClick={() => setActiveTab('zakat')}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    <HeartHandshake className="w-3.5 h-3.5" />
                    Salurkan Zakat & Qurban
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Vertical Menu Stack (Matching Tampilan Pada Dasbord mobile Admin.png) */}
            <div className="lg:hidden space-y-3 pt-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Pilihan Menu Utama Admin
                </span>
                <span className="text-[11px] text-slate-500">Pilih menu di bawah</span>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="w-full p-4 rounded-2xl bg-[#f59e0b] text-slate-950 font-extrabold flex items-center justify-between shadow-lg text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-950 text-white flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black">1. Dashboard</div>
                      <div className="text-[10px] font-medium text-slate-900">
                        Ringkasan Kas, Saldo & Statistik
                      </div>
                    </div>
                  </div>
                  <span>›</span>
                </button>

                {!isLaporan && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('verifikasi')}
                    className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-sky-400 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold">2. Verifikasi Setoran</div>
                        <div className="text-[10px] text-slate-400">
                          Verifikasi bukti setor transfer anggota
                        </div>
                      </div>
                    </div>
                    <span>›</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('anggota')}
                  className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold flex items-center gap-1.5">
                        <span>3. Data Anggota</span>
                        <span className="text-[9px] bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-300">
                          {state.members.length} Anggota
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        KTA Digital, Rekening, Mutasi & Anggota Baru
                      </div>
                    </div>
                  </div>
                  <span>›</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('kas')}
                  className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold">4. Buku Kas & Neraca</div>
                      <div className="text-[10px] text-slate-400">
                        Buku Kas Anggota, Kas Koperasi & Laporan Neraca
                      </div>
                    </div>
                  </div>
                  <span>›</span>
                </button>

                {!isLaporan && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('penyesuaian_saldo')}
                    className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 hover:border-amber-500/60 text-white flex items-center justify-between text-left transition-all group shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <SlidersHorizontal className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold flex items-center gap-1.5">
                          <span>5. Penyesuaian Saldo Anggota</span>
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 font-black px-1.5 py-0.2 rounded">Baru</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Koreksi Saldo Manual & Pembagian Hasil (% Pokok / SHU)
                        </div>
                      </div>
                    </div>
                    <span>›</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('zakat')}
                  className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center">
                      <HeartHandshake className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold">6. Zakat & Qurban</div>
                      <div className="text-[10px] text-slate-400">
                        Penyaluran Zakat Fitrah & Tabungan Qurban
                      </div>
                    </div>
                  </div>
                  <span>›</span>
                </button>

                {/* User Req 3: Menu Laporan Sedekah & Penyaluran Sedekah pada Mobile Admin */}
                <button
                  type="button"
                  onClick={() => {
                    setBerbagiInitialTab('laporan');
                    setShowBerbagiModal(true);
                  }}
                  className="w-full p-4 rounded-2xl bg-[#111c33] border border-sky-500/40 text-white flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold flex items-center gap-1.5">
                        <span>7. Laporan Sedekah</span>
                        <span className="text-[9px] bg-sky-500/20 text-sky-300 font-bold px-1.5 py-0.2 rounded">PDF / Excel</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Filter per wilayah, per anggota & periode harian/bulanan/tahunan
                      </div>
                    </div>
                  </div>
                  <span>›</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBerbagiInitialTab('salurkan');
                    setShowBerbagiModal(true);
                  }}
                  className="w-full p-4 rounded-2xl bg-[#111c33] border border-amber-500/40 text-white flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center relative">
                      <Send className="w-4 h-4" />
                      {pendingSalurCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center animate-pulse">
                          {pendingSalurCount}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold flex items-center gap-1.5">
                        <span>8. Penyaluran Sedekah</span>
                        {pendingSalurCount > 0 && (
                          <span className="text-[9px] bg-rose-500 text-white font-black px-1.5 py-0.2 rounded animate-pulse">
                            {pendingSalurCount} Butuh Approval
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Input Admin Write & Disetujui Approval/Super Admin
                      </div>
                    </div>
                  </div>
                  <span>›</span>
                </button>

                {!isLaporan && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('surat')}
                    className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-sky-400 flex items-center justify-center">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold flex items-center gap-1.5">
                          <span>7. Surat Menyurat</span>
                          {unreadSuratAdminCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black animate-pulse">
                              {unreadSuratAdminCount}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Terbitkan surat resmi ke WhatsApp & Email
                        </div>
                      </div>
                    </div>
                    <span>›</span>
                  </button>
                )}

                {!isLaporan && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold">8. Chat Online</div>
                        <div className="text-[10px] text-slate-400">
                          Obrolan langsung realtime dengan anggota
                        </div>
                      </div>
                    </div>
                    <span>›</span>
                  </button>
                )}

                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setSettingSubModal('daftar_admin');
                      setShowSettings(true);
                    }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-[#111c33] border border-amber-500/40 text-white flex items-center justify-between text-left hover:border-amber-400 transition-all shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold flex items-center gap-2">
                          <span>8. Kelola Administrator</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-amber-500 text-slate-950 font-black">
                            {state.admins.length} Admin
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Super Admin: Edit data akun, tambah pengurus baru, atau hapus admin
                        </div>
                      </div>
                    </div>
                    <span className="text-amber-400 font-bold">›</span>
                  </button>
                )}

                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setSettingSubModal('log_audit');
                      setShowSettings(true);
                    }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 to-[#111c33] border border-purple-500/40 text-white flex items-center justify-between text-left hover:border-purple-400 transition-all shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-black">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold flex items-center gap-2">
                          <span>9. Log Audit History Multi-Platform</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-purple-500 text-white font-black">
                            {state.auditLogs.length} Log
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Rekam aktivitas admin dari Web, Android Mobile (.APK), iOS & PC Desktop
                        </div>
                      </div>
                    </div>
                    <span className="text-purple-400 font-bold">›</span>
                  </button>
                )}
              </div>
            </div>
          </>
        ) : activeTab === 'verifikasi' ? (
          <MemberVerificationView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'anggota' ? (
          <MemberListView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'kas' ? (
          <BukuKasView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'penyesuaian_saldo' ? (
          <PenyesuaianSaldoView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'zakat' ? (
          <ZakatQurbanView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'surat' ? (
          <SuratMenyuratView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'chat' ? (
          <ChatOnlineView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : null}
      </main>

      {/* ================= FLOATING NOTIFICATION TOASTS ================= */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`p-3.5 rounded-2xl shadow-2xl border pointer-events-auto transition-all transform animate-in slide-in-from-bottom-3 duration-300 ${
                toast.type === 'deposit'
                  ? 'bg-[#0f172a] border-emerald-500/60 shadow-emerald-500/20'
                  : toast.type === 'chat'
                  ? 'bg-[#0f172a] border-sky-500/60 shadow-sky-500/20'
                  : 'bg-[#0f172a] border-amber-500/60 shadow-amber-500/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                      toast.type === 'deposit'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : toast.type === 'chat'
                        ? 'bg-sky-500/20 text-sky-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {toast.type === 'deposit' ? '💵' : toast.type === 'chat' ? '💬' : '🔔'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-xs">{toast.title}</span>
                      <span className="text-[10px] text-slate-400">{toast.timestamp}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] mt-0.5 line-clamp-2">
                      {toast.message}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                {toast.type === 'deposit' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('verifikasi');
                      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                    }}
                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] rounded-lg transition-colors"
                  >
                    Buka Verifikasi →
                  </button>
                )}
                {toast.type === 'chat' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('chat');
                      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                    }}
                    className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-[10px] rounded-lg transition-colors"
                  >
                    Buka Chat →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= SETTING MODAL ================= */}
      {showSettings && (
        <SettingModal
          state={state}
          updateState={updateState}
          currentAdmin={currentAdmin}
          initialSubModal={settingSubModal}
          onClose={() => {
            setShowSettings(false);
            setSettingSubModal(null);
          }}
          onLogout={onLogout}
        />
      )}

      {/* ================= MODAL INSTALASI APLIKASI ================= */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* ================= ORCAS POLICY ENGINE CONFIRMATION MODAL (MOBILE & PC) ================= */}
      {orcasConfirmation?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-amber-500/50 w-full max-w-md rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-700/80 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  Orcas Policy Engine SDK
                </h4>
                <div className="text-[11px] text-white font-bold">
                  Konfirmasi Kebijakan Keamanan Sistem
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 mb-4">
              <div className="text-[11px] font-bold text-slate-200">
                Orcas policy engine requires confirmation for this tool call, please approve or reject
              </div>
              <div className="text-[10px] text-slate-400">
                Aksi: <span className="text-amber-300 font-semibold">{orcasConfirmation.actionName}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Keterangan: <span className="text-slate-300">{orcasConfirmation.details}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  orcasConfirmation.onReject?.();
                  setOrcasConfirmation(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
              >
                Reject (Tolak)
              </button>
              <button
                type="button"
                onClick={() => {
                  orcasConfirmation.onApprove?.();
                  setOrcasConfirmation(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg transition-all"
              >
                Approve (Setujui)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL MENU BERBAGI (REQ 2: SEDEKAH SUBUH, JUMAT, UMUM & LAPORAN) ================= */}
      <MenuBerbagiModal
        isOpen={showBerbagiModal}
        onClose={() => setShowBerbagiModal(false)}
        state={state}
        updateState={updateState}
        currentAdmin={currentAdmin}
        initialTab={berbagiInitialTab}
      />
    </div>
  );
};
