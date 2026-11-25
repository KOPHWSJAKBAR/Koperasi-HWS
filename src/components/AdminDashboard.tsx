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
  dismissBrowserNotification,
  getHasHydratedRemoteState,
  fetchStateFromServer,
  getUnifiedSedekahList,
  canApproveByRole,
  getRequiredApproverLabel,
  deduplicateSetoranListPostCutoffClient,
} from '../lib/storage';
import { LogoHws } from '../lib/logo';
import { MemberVerificationView } from './MemberVerificationView';
import { MemberListView } from './MemberListView';
import { BukuKasView } from './BukuKasView';
import { PenyesuaianSaldoView } from './PenyesuaianSaldoView';
import { ErrorBoundary } from './ErrorBoundary';
import { ZakatQurbanView } from './ZakatQurbanView';
import { SuratMenyuratView } from './SuratMenyuratView';
import { ChatOnlineView } from './ChatOnlineView';
import { SettingModal } from './SettingModal';
import { InstallAppModal } from './InstallAppModal';
import { MenuBerbagiModal } from './MenuBerbagiModal';
import { HapusTransaksiAnggotaModal } from './HapusTransaksiAnggotaModal';
import { TabunganUmumView } from './TabunganUmumView';
import { downloadExcelCsv, printDocumentHtml } from '../lib/exportPdf';
import { initFCM, cleanupFCM } from '../lib/fcm';
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
  Lock,
  Fingerprint,
  Trash2,
  CheckCheck,
  Wallet,
  ChevronRight,
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
    'dashboard' | 'verifikasi' | 'anggota' | 'kas' | 'penyesuaian_saldo' | 'zakat' | 'surat' | 'chat' | 'tabungan_umum'
  >('dashboard');

  const [showSettings, setShowSettings] = useState(false);
  const [settingSubModal, setSettingSubModal] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showBerbagiModal, setShowBerbagiModal] = useState(false);
  const [berbagiInitialTab, setBerbagiInitialTab] = useState<'laporan' | 'salurkan' | 'konfirmasi'>('laporan');
  const [showHapusTxModal, setShowHapusTxModal] = useState(false);

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

  const [wibTime, setWibTime] = useState<string>(() => {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setWibTime(
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date())
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Hitung daftar setoran yang benar-benar masih menunggu verifikasi (belum diproses admin manapun & bebas duplikat >= 24/11/2026)
  const pendingDeposits = React.useMemo(() => {
    const deletedSet = new Set(state.deletedSetoranIds || []);
    const sedekahStatusById = new Map((state.sedekahList || []).map((sdk) => [sdk.id, sdk.status]));
    const dedupedList = deduplicateSetoranListPostCutoffClient(
      state.setoranList || [],
      state.members || [],
      new Set(state.deletedMemberIds || [])
    ).list;
    return dedupedList.filter((s) => {
      if (!s || !s.id || deletedSet.has(s.id)) return false;
      if (s.status !== 'pending' || s.verifiedBy || s.verifiedAt) return false;
      if (s.jenis === 'sedekah') {
        const sdkSt = sedekahStatusById.get(s.id);
        if (sdkSt === 'approved' || sdkSt === 'rejected') return false;
      }
      return true;
    });
  }, [state.setoranList, state.sedekahList, state.deletedSetoranIds, state.members, state.deletedMemberIds]);

  const prevPendingIdsRef = useRef<Set<string>>(
    new Set(pendingDeposits.map((s) => s.id))
  );
  const notifiedDepositIdsRef = useRef<Set<string>>(new Set());
  const processedDepositIdsRef = useRef<Set<string>>(
    new Set(
      (state.setoranList || [])
        .filter((s) => s.status === 'disetujui' || s.status === 'ditolak' || Boolean(s.verifiedBy || s.verifiedAt))
        .map((s) => s.id)
    )
  );
  const hasSyncedInitialRef = useRef<boolean>(false);
  const prevChatIdsRef = useRef<Set<string>>(
    new Set(state.chatMessages.map((m) => m.id))
  );
  const hasSyncedInitialChatRef = useRef<boolean>(false);

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

  // Request browser notification permission once on admin dashboard mount & register FCM
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
    if (currentAdmin?.id) {
      initFCM(currentAdmin.id, 'admin').catch(() => {});
    }
    if (!getHasHydratedRemoteState()) {
      fetchStateFromServer(true).catch(() => {});
    }
    return () => {
      cleanupFCM();
    };
  }, [currentAdmin?.id]);

  // Listen immediate SSE / local verification events to prune open deposit toasts & browser notifications
  useEffect(() => {
    const dismissByDepositId = (depositId?: string) => {
      if (!depositId) return;
      processedDepositIdsRef.current.add(depositId);
      dismissBrowserNotification(`hws-setoran-${depositId}`);
      setToasts((prev) => prev.filter((t) => !(t.type === 'deposit' && t.targetId === depositId)));
    };
    const onSetoranUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const dep = detail?.deposit;
      if (dep?.id && (dep.status === 'disetujui' || dep.status === 'ditolak')) {
        dismissByDepositId(dep.id);
      }
    };
    const onSetoranProcessed = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      dismissByDepositId(detail?.depositId);
    };
    window.addEventListener('hws:setoran_updated', onSetoranUpdated);
    window.addEventListener('hws:setoran_processed', onSetoranProcessed);
    return () => {
      window.removeEventListener('hws:setoran_updated', onSetoranUpdated);
      window.removeEventListener('hws:setoran_processed', onSetoranProcessed);
    };
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

  // Detection effect for incoming deposits and chats (with remote hydration guard & auto-dismissal)
  useEffect(() => {
    // Catat semua setoran yang sudah terminal agar tidak pernah memicu notifikasi ulang
    const currentPendingIds = new Set(pendingDeposits.map((s) => s.id));
    (state.setoranList || []).forEach((s) => {
      if (s && s.id && (s.status === 'disetujui' || s.status === 'ditolak' || s.verifiedBy || s.verifiedAt)) {
        processedDepositIdsRef.current.add(s.id);
        dismissBrowserNotification(`hws-setoran-${s.id}`);
      }
    });

    // Otomatis tutup toast setoran masuk jika setoran tsb sudah diverifikasi oleh admin lain
    setToasts((prev) => {
      const filtered = prev.filter((t) => !(t.type === 'deposit' && t.targetId && !currentPendingIds.has(t.targetId)));
      return filtered.length === prev.length ? prev : filtered;
    });

    const isHydrated = getHasHydratedRemoteState();

    // Tunggu hidrasi server/Firestore selesai sebelum membunyikan notifikasi agar cache lama tidak memicu alert palsu
    if (!isHydrated) {
      prevPendingIdsRef.current = currentPendingIds;
      prevChatIdsRef.current = new Set(state.chatMessages.map((m) => m.id));
      return;
    }

    // Seed awal setelah hidrasi remote pertama selesai: jangan bunyikan notif untuk data yang sudah ada di server
    if (!hasSyncedInitialRef.current) {
      hasSyncedInitialRef.current = true;
      prevPendingIdsRef.current = currentPendingIds;
      currentPendingIds.forEach((id) => notifiedDepositIdsRef.current.add(id));
    } else {
      // 1. Check truly new pending deposits arriving after initial sync
      const newPendingDeposits = pendingDeposits.filter(
        (s) =>
          !prevPendingIdsRef.current.has(s.id) &&
          !notifiedDepositIdsRef.current.has(s.id) &&
          !processedDepositIdsRef.current.has(s.id)
      );

      if (newPendingDeposits.length > 0) {
        if (soundEnabled) {
          playNotificationSound('deposit');
        }

        newPendingDeposits.forEach((dep) => {
          notifiedDepositIdsRef.current.add(dep.id);
          triggerBrowserNotification(
            '🔔 Setoran Masuk Baru - Koperasi HWS',
            `${dep.memberNama} mengajukan setoran ${dep.jenis} sebesar Rp ${dep.nominal.toLocaleString('id-ID')} (${dep.metode})`,
            () => setActiveTab('verifikasi'),
            `hws-setoran-${dep.id}`
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
      prevPendingIdsRef.current = currentPendingIds;
    }

    if (!hasSyncedInitialChatRef.current) {
      hasSyncedInitialChatRef.current = true;
      prevChatIdsRef.current = new Set(state.chatMessages.map((m) => m.id));
      return;
    }

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
  }, [pendingDeposits, state.setoranList, state.chatMessages, soundEnabled]);

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

  // Filter out deleted kas entries
  const deletedKasSet = new Set(state.deletedKasIds || []);
  const activeKasList = (state.kasList || []).filter(
    (k) => !deletedKasSet.has(k.id) && (k as any).status !== 'deleted'
  );

  // 1. User Req 2: Dasboard buku kas anggota = Total simpanan pokok anggota + total Tabungan umum + Tabungan zakat Fitrah + Tabungan qurban
  const totalDanaZakatQurban = totalZakat + totalQurban;
  const totalSaldoAnggota = totalPokok + totalUmum + totalZakat + totalQurban;
  const saldoKasAnggota = totalSaldoAnggota;

  // 2. Saldo Buku Kas Koperasi = total dari seluruh transaksi pada buku kas koperasi
  let saldoKasKoperasi = 0;
  activeKasList
    .filter((k) => k.bukuKas === 'koperasi' && k.status === 'approved')
    .forEach((k) => {
      if (k.tipe === 'masuk') saldoKasKoperasi += k.nominal;
      else saldoKasKoperasi -= k.nominal;
    });

  // Perhitungan Saldo Kas Berbagi & Sedekah Koperasi (Req 1D)
  const namaSubuh = state.pengaturanBerbagi?.namaSubuh || 'Sedekah Subuh';
  const namaJumat = state.pengaturanBerbagi?.namaJumat || 'Sedekah Jumat';
  const namaUmum = state.pengaturanBerbagi?.namaUmum || 'Sedekah Umum';
  const allSedekah = getUnifiedSedekahList(state);
  const totalSedekahMasuk = allSedekah.filter((e) => e.tipe === 'penerimaan' && e.status === 'approved').reduce((acc, e) => acc + e.nominal, 0);
  const totalSedekahSalur = allSedekah.filter((e) => e.tipe === 'penyaluran' && e.status === 'approved').reduce((acc, e) => acc + e.nominal, 0);
  const saldoSedekahTersedia = Math.max(0, totalSedekahMasuk - totalSedekahSalur);
  const subuhSaldo = Math.max(0, allSedekah.filter((e) => e.jenis === 'sedekah_subuh' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0)
    - allSedekah.filter((e) => e.jenis === 'sedekah_subuh' && e.tipe === 'penyaluran' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0));
  const jumatSaldo = Math.max(0, allSedekah.filter((e) => e.jenis === 'sedekah_jumat' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0)
    - allSedekah.filter((e) => e.jenis === 'sedekah_jumat' && e.tipe === 'penyaluran' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0));
  const umumSaldo = Math.max(0, allSedekah.filter((e) => e.jenis === 'sedekah_umum' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0)
    - allSedekah.filter((e) => e.jenis === 'sedekah_umum' && e.tipe === 'penyaluran' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0));

  // 3. User Req 1: Dashboard Saldo kas berjalan = total saldo anggota (pokok+Tabungan umum+Zakat+qurban) + saldo buku kas koperasi
  const saldoKasBerjalan = totalSaldoAnggota + saldoKasKoperasi;

  // Jumlah anggota yang memiliki saldo tabungan umum > 0
  const tabunganUmumMembersCount = state.members.filter((m) => (m.saldoUmum || 0) > 0).length;

  // Pending deposits count (hanya setoran yang benar-benar masih menunggu verifikasi)
  const pendingDepositsCount = pendingDeposits.length;

  // Pending Tabungan Pokok Lock / Unlock requests yang dapat disetujui oleh role saat ini
  const pendingLockPokokCount = state.members.filter(
    (m) => !!m.lockPokokRequest && canApproveByRole(m.lockPokokRequest.requestedByRole, currentAdmin.role)
  ).length;

  // Pending Buku Kas (Anggota & Koperasi) yang dapat disetujui oleh role saat ini
  const pendingKasCount = state.kasList.filter(
    (k) => k.status === 'pending_approval' && canApproveByRole(k.requestedByRole || 'admin_write', currentAdmin.role)
  ).length;

  // Pending Mutasi Anggota (Hapus Mutasi / Koreksi Saldo / Bagi Hasil) yang dapat disetujui oleh role saat ini
  const pendingMutasiCount = (state.pendingMutasiRequests || []).filter(
    (r) => r.status === 'pending' && canApproveByRole(r.requestedByRole, currentAdmin.role)
  ).length;

  // Unread chat messages from members (only count active existing members)
  const unreadChatCount = state.chatMessages.filter(
    (m) => m.senderType === 'member' && !m.isReadByAdmin && state.members.some((mem) => mem.id === m.memberId)
  ).length;

  // Pending Penyaluran Sedekah Approval yang dapat disetujui oleh role saat ini
  const pendingSalurCount = (state.sedekahList || []).filter(
    (e) => e.tipe === 'penyaluran' && e.status === 'pending' && canApproveByRole(e.requestedByRole || 'admin_write', currentAdmin.role)
  ).length;

  const totalNotifCount =
    pendingDepositsCount +
    unreadChatCount +
    unreadSuratAdminCount +
    ((isSuperAdmin || isApproval) ? pendingLockPokokCount + pendingKasCount + pendingMutasiCount + pendingSalurCount : 0);

  // Bersihkan notifikasi & tandai pesan/surat sudah terbaca permanen
  const handleClearAllNotifications = async () => {
    try {
      fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true, readBy: 'admin' }),
      }).catch(() => {});
      fetch('/api/surat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markAll: true,
          readerId: currentAdmin.id,
          readerType: 'admin',
        }),
      }).catch(() => {});
    } catch {}

    await updateState((prev) => ({
      ...prev,
      chatMessages: prev.chatMessages.map((m) => ({ ...m, isReadByAdmin: true })),
      suratList: prev.suratList.map((s) => ({
        ...s,
        readByAdminIds: Array.from(new Set([...(s.readByAdminIds || []), currentAdmin.id])),
      })),
    }));

    setToasts([]);
  };

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
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Dana Zakat dan Qurban:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(totalDanaZakatQurban)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Saldo Sedekah Koperasi:</td><td style="text-align: right; font-weight: 700; color: #e11d48;">${formatRupiah(saldoSedekahTersedia)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd; background: #fafafa;"><td style="padding: 8px;">Buku Kas Anggota:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(saldoKasAnggota)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd; background: #fafafa;"><td style="padding: 8px;">Buku Kas Koperasi:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(saldoKasKoperasi)}</td></tr>
          <tr style="background: #ecfdf5; font-weight: 900; font-size: 13px; color: #047857; border-top: 2px solid #059669;"><td style="padding: 10px 8px;">SALDO KAS BERJALAN (TOTAL SALDO ANGGOTA + KAS KOPERASI):</td><td style="text-align: right; font-family: monospace;">${formatRupiah(saldoKasBerjalan)}</td></tr>
        </table>
      </div>
    `;
    printDocumentHtml(html, 'Ringkasan_Kas_HWS');
  };

  useEffect(() => {
    import('../lib/firebase').then(({ logAnalyticsEvent }) => {
      logAnalyticsEvent('admin_view_tab', {
        tab: activeTab,
        admin_role: currentAdmin.role,
        admin_name: currentAdmin.nama,
      });
    }).catch(() => {});
  }, [activeTab, currentAdmin.role, currentAdmin.nama]);

  const activeTabTitle =
    activeTab === 'verifikasi'
      ? 'Verifikasi Setoran'
      : activeTab === 'anggota'
      ? 'Data Anggota'
      : activeTab === 'kas'
      ? 'Buku Kas Neraca'
      : activeTab === 'penyesuaian_saldo'
      ? 'Penyesuaian Saldo'
      : activeTab === 'zakat'
      ? 'Zakat & Qurban'
      : activeTab === 'surat'
      ? 'Surat Menyurat'
      : activeTab === 'chat'
      ? 'Chat Online'
      : activeTab === 'tabungan_umum'
      ? 'Tabungan Umum'
      : 'Dashboard Utama';

  const logoMenuItems = [
    !isLaporan && {
      id: 'verifikasi',
      label: 'Verifikasi Setoran',
      icon: CheckCircle2,
      iconClass: 'text-sky-400',
      badgeBgClass: 'bg-sky-500/15 border-sky-500/25',
      active: activeTab === 'verifikasi',
      badge: pendingDepositsCount > 0 ? pendingDepositsCount : null,
      badgeColor: 'bg-amber-500 text-slate-950',
      onClick: () => setActiveTab('verifikasi'),
    },
    {
      id: 'anggota',
      label: 'Data Anggota',
      icon: Users,
      iconClass: 'text-emerald-400',
      badgeBgClass: 'bg-emerald-500/15 border-emerald-500/25',
      active: activeTab === 'anggota',
      badge:
        pendingLockPokokCount + pendingMutasiCount > 0 && (isSuperAdmin || isApproval)
          ? pendingLockPokokCount + pendingMutasiCount
          : state.members.length,
      badgeColor:
        pendingLockPokokCount + pendingMutasiCount > 0 && (isSuperAdmin || isApproval)
          ? 'bg-sky-500 text-slate-950'
          : 'bg-slate-800 text-slate-300 border border-slate-700',
      onClick: () => setActiveTab('anggota'),
    },
    {
      id: 'kas',
      label: 'Buku Kas Neraca',
      icon: BookOpen,
      iconClass: 'text-amber-400',
      badgeBgClass: 'bg-amber-500/15 border-amber-500/25',
      active: activeTab === 'kas',
      badge: pendingKasCount > 0 && (isSuperAdmin || isApproval) ? pendingKasCount : null,
      badgeColor: 'bg-amber-500 text-slate-950',
      onClick: () => setActiveTab('kas'),
    },
    !isLaporan && {
      id: 'penyesuaian_saldo',
      label: 'Penyesuaian Saldo',
      icon: SlidersHorizontal,
      iconClass: 'text-amber-300',
      badgeBgClass: 'bg-amber-500/15 border-amber-500/25',
      active: activeTab === 'penyesuaian_saldo',
      badge: null,
      badgeColor: '',
      onClick: () => setActiveTab('penyesuaian_saldo'),
    },
    {
      id: 'zakat',
      label: 'Zakat & Qurban',
      icon: HeartHandshake,
      iconClass: 'text-emerald-400',
      badgeBgClass: 'bg-emerald-500/15 border-emerald-500/25',
      active: activeTab === 'zakat',
      badge: null,
      badgeColor: '',
      onClick: () => setActiveTab('zakat'),
    },
    {
      id: 'penyaluran',
      label: 'Penyaluran',
      icon: Send,
      iconClass: 'text-amber-400',
      badgeBgClass: 'bg-amber-500/15 border-amber-500/25',
      active: false,
      badge: pendingSalurCount > 0 ? pendingSalurCount : null,
      badgeColor: 'bg-rose-500 text-white',
      onClick: () => {
        setBerbagiInitialTab('salurkan');
        setShowBerbagiModal(true);
      },
    },
    {
      id: 'sedekah',
      label: 'Sedekah',
      icon: Heart,
      iconClass: 'text-rose-400',
      badgeBgClass: 'bg-rose-500/15 border-rose-500/25',
      active: false,
      badge: null,
      badgeColor: '',
      onClick: () => {
        setBerbagiInitialTab('laporan');
        setShowBerbagiModal(true);
      },
    },
    !isLaporan && {
      id: 'surat',
      label: 'Surat Menyurat',
      icon: Mail,
      iconClass: 'text-sky-400',
      badgeBgClass: 'bg-sky-500/15 border-sky-500/25',
      active: activeTab === 'surat',
      badge: unreadSuratAdminCount > 0 ? unreadSuratAdminCount : null,
      badgeColor: 'bg-rose-500 text-white',
      onClick: () => setActiveTab('surat'),
    },
    !isLaporan && {
      id: 'chat',
      label: 'Chat Online',
      icon: MessageSquare,
      iconClass: 'text-amber-400',
      badgeBgClass: 'bg-amber-500/15 border-amber-500/25',
      active: activeTab === 'chat',
      badge: unreadChatCount > 0 ? unreadChatCount : null,
      badgeColor: 'bg-sky-500 text-slate-950',
      onClick: () => setActiveTab('chat'),
    },
    isSuperAdmin && {
      id: 'log_audit',
      label: 'Log Audit',
      icon: Activity,
      iconClass: 'text-purple-400',
      badgeBgClass: 'bg-purple-500/15 border-purple-500/25',
      active: false,
      badge: null,
      badgeColor: '',
      onClick: () => {
        setSettingSubModal('log_audit');
        setShowSettings(true);
      },
    },
    (isSuperAdmin || isApproval || isWriter) && {
      id: 'hapus_mutasi',
      label: 'Hapus Mutasi',
      icon: Trash2,
      iconClass: 'text-rose-400',
      badgeBgClass: 'bg-rose-500/15 border-rose-500/25',
      active: false,
      badge: null,
      badgeColor: '',
      onClick: () => setShowHapusTxModal(true),
    },
    {
      id: 'tabungan_umum',
      label: 'Tabungan Umum',
      icon: Wallet,
      iconClass: 'text-sky-400',
      badgeBgClass: 'bg-sky-500/15 border-sky-500/25',
      active: activeTab === 'tabungan_umum',
      badge: tabunganUmumMembersCount > 0 ? tabunganUmumMembersCount : null,
      badgeColor: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
      onClick: () => setActiveTab('tabungan_umum'),
    },
  ].filter(Boolean) as Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    badgeBgClass: string;
    active: boolean;
    badge: number | null;
    badgeColor: string;
    onClick: () => void;
  }>;

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-40 bg-[#0d1424]/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2 sm:py-3">
        <div className={`${activeTab === 'dashboard' ? 'max-w-7xl' : 'max-w-[1440px]'} mx-auto flex items-center justify-between gap-2 sm:gap-3`}>
          {/* Left Brand & Admin Badge */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2 sm:gap-3 min-w-0 text-left cursor-pointer group"
            title="Kembali ke Dashboard Admin"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white p-0.5 shadow flex items-center justify-center shrink-0">
              <LogoHws className="w-full h-full" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs sm:text-base tracking-wide text-white truncate group-hover:text-amber-300 transition-colors">
                  KOPERASI HWS
                </span>
                <span className="hidden sm:inline-block bg-[#00bcd4] text-slate-950 font-black text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md uppercase shrink-0">
                  ADMIN
                </span>
                <span className="bg-[#f59e0b] text-slate-950 font-black text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md uppercase shrink-0">
                  {currentAdmin.role.replace('_', ' ')}
                </span>
              </div>
              <div className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">
                {currentAdmin.nama} • {currentAdmin.wilayahKantor}
              </div>
            </div>
          </button>

          {/* Right Action Buttons: Notif + Menu Setting */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

            {/* Realtime Notification Center Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifCenter(!showNotifCenter)}
                className="relative min-w-[40px] min-h-[40px] sm:min-h-[36px] py-1.5 px-2 sm:px-2.5 rounded-xl bg-[#162035] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                title="Pusat Notifikasi Realtime"
              >
                <Bell className="w-4 h-4 text-amber-400" />
                {totalNotifCount > 0 ? (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow tabular-nums">
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
                  <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleTestNotification}
                        className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-[10px] flex items-center gap-1 transition-all"
                      >
                        <Sparkles className="w-3 h-3" />
                        Tes Suara
                      </button>
                      <button
                        type="button"
                        onClick={() => requestNotificationPermission()}
                        className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-bold text-[10px] flex items-center gap-1 transition-all"
                      >
                        Izin Push
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearAllNotifications}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-extrabold text-[10px] flex items-center gap-1 transition-all ml-auto"
                      title="Tandai semua pesan dan surat resmi sebagai sudah dibaca"
                    >
                      <CheckCheck className="w-3 h-3 text-emerald-400" />
                      Tandai Semua Terbaca
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
                        {pendingDeposits
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
                              <div className="text-slate-400 text-[9px] flex items-center justify-between gap-2">
                                <span>{dep.jenis.toUpperCase()} • {dep.metode}</span>
                                <span className="font-mono text-amber-300/90">
                                  {dep.createdAt
                                    ? new Date(dep.createdAt).toLocaleTimeString('id-ID', {
                                        timeZone: 'Asia/Jakarta',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false,
                                      }) + ' WIB'
                                    : '-'}
                                </span>
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

                    {/* Unread Surat Resmi Section */}
                    {unreadSuratAdminCount > 0 && (
                      <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/30 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-purple-300">
                          <span>📬 {unreadSuratAdminCount} Surat Edaran Baru</span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('surat');
                              setShowNotifCenter(false);
                            }}
                            className="text-[10px] text-purple-400 underline font-extrabold"
                          >
                            Buka Surat
                          </button>
                        </div>
                        {state.suratList
                          .filter((s) => !(s.readByAdminIds || []).includes(currentAdmin.id))
                          .slice(0, 3)
                          .map((surat) => (
                            <div
                              key={surat.id}
                              onClick={() => {
                                setActiveTab('surat');
                                setShowNotifCenter(false);
                              }}
                              className="p-1.5 bg-slate-900/80 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors text-[10px]"
                            >
                              <div className="font-bold text-white flex justify-between">
                                <span className="truncate max-w-[200px]">{surat.perihal}</span>
                                <span className="text-purple-400 font-mono text-[9px]">
                                  {surat.nomorSurat}
                                </span>
                              </div>
                              <div className="text-slate-400 text-[9px]">
                                Tujuan: {surat.targetMemberNama || 'Seluruh Anggota'}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {totalNotifCount === 0 && (
                      <div className="py-6 text-center text-slate-400 text-[11px]">
                        ✓ Semua notifikasi telah ditinjau! Tidak ada setoran, chat, atau surat baru saat ini.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Live WIB Time Badge (Waktu Indonesia Bagian Barat UTC+7) */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-amber-500/30 text-[10px] font-bold text-amber-300">
              <span className="text-slate-400">WIB:</span>
              <span className="font-mono tabular-nums">{wibTime}</span>
            </div>

            {/* Realtime Online Status Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-extrabold text-emerald-400">
              <span>Online Realtime</span>
            </div>

            {/* Write Permission Status: Write hanya pada Super Admin */}
            <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-[10px] font-bold">
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
              className="min-h-[40px] sm:min-h-[36px] py-1.5 px-2.5 sm:px-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 border border-amber-500/40 text-[11px] sm:text-xs font-black flex items-center gap-1.5 sm:gap-2 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              title="Menu Pengaturan (Kelola Admin, Keamanan Biometrik, Pasang Aplikasi, Profil Koperasi)"
            >
              <Settings className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Menu Setting</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= DESKTOP OVERVIEW MENU BAR (SAAT DI DASHBOARD UTAMA) ================= */}
      {activeTab === 'dashboard' && (
        <nav
          aria-label="Menu Utama Admin Desktop"
          className="hidden lg:block bg-[#0d1424]/95 border-b border-slate-800/80 px-6 py-2.5"
        >
          <div className="max-w-7xl mx-auto flex items-stretch [&>button]:flex-1 [&>button]:min-w-0 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              title="Dashboard"
              className="group relative flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border transition-all cursor-pointer min-h-[60px] bg-amber-500/15 border-amber-500/60 text-amber-300"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-500 text-slate-950">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold leading-tight text-center line-clamp-2">
                Dashboard
              </span>
            </button>

            {logoMenuItems.map((item) => {
              const IconComp = item.icon;
              const isTabunganActive = item.id === 'tabungan_umum' && item.active;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  title={item.label}
                  className={`group relative flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border transition-all cursor-pointer min-h-[60px] ${
                    isTabunganActive
                      ? 'bg-sky-500/15 border-sky-500/60 text-sky-300'
                      : item.active
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {item.badge !== null && (
                    <span
                      className={`absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center font-mono tabular-nums ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isTabunganActive
                        ? 'bg-sky-500 text-slate-950'
                        : item.active
                        ? 'bg-amber-500 text-slate-950'
                        : `bg-slate-800 ${item.iconClass}`
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold leading-tight text-center line-clamp-2">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* ================= MOBILE DASHBOARD: 12 LOGO + LABEL MENU LAUNCHER DI BAWAH MENU SETTING ================= */}
      {activeTab === 'dashboard' && (
        <section
          aria-label="Menu Dashboard Mobile Admin"
          className="lg:hidden bg-[#0b1120] px-3 pt-3 pb-1"
        >
          <div className="bg-[#0d1424] border border-slate-800/90 rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                  Menu Layanan Admin
                </span>
              </div>
              <span className="text-[10px] font-mono tabular-nums text-emerald-400 font-bold">
                {wibTime} WIB
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {logoMenuItems.map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    title={item.label}
                    className="relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-2xl border bg-[#111c33]/85 border-slate-800/90 hover:border-amber-500/40 active:scale-[0.97] transition-all cursor-pointer min-h-[84px]"
                  >
                    {item.badge !== null && (
                      <span
                        className={`absolute top-1.5 right-1.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-black flex items-center justify-center font-mono tabular-nums ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.badgeBgClass} ${item.iconClass}`}
                    >
                      <IconComp className="w-5 h-5" />
                    </div>
                    <span className="text-[10.5px] font-bold leading-tight text-center text-slate-200 line-clamp-2">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================= MOBILE SUBMENU BACK BAR + QUICK LOGO STRIP (< LG ONLY) ================= */}
      {activeTab !== 'dashboard' && (
        <div className="lg:hidden">
          <div className="bg-[#111c33] border-b border-slate-800 px-3 sm:px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleSubmenuBack}
                className="inline-flex items-center gap-1.5 min-h-[36px] text-xs sm:text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Kembali ke Dashboard Admin</span>
              </button>
              <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase truncate">
                {activeTabTitle}
              </span>
            </div>
          </div>

          <nav
            aria-label="Navigasi Cepat Mobile Admin"
            className="bg-[#0d1424]/95 border-b border-slate-800/80 px-3 py-2"
          >
            <div className="flex items-stretch gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="shrink-0 w-[68px] min-h-[56px] flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl border bg-slate-900/70 border-slate-800 text-slate-300 active:scale-95 transition-all cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-[9.5px] font-bold leading-tight text-center line-clamp-1">
                  Dashboard
                </span>
              </button>
              {logoMenuItems.map((item) => {
                const IconComp = item.icon;
                const isTabunganActive = item.id === 'tabungan_umum' && item.active;
                return (
                  <button
                    key={`mob-strip-${item.id}`}
                    type="button"
                    onClick={item.onClick}
                    className={`relative shrink-0 w-[72px] min-h-[56px] flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl border active:scale-95 transition-all cursor-pointer ${
                      isTabunganActive
                        ? 'bg-sky-500/15 border-sky-500/60 text-sky-300'
                        : item.active
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge !== null && (
                      <span
                        className={`absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[8.5px] font-black flex items-center justify-center font-mono tabular-nums ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isTabunganActive
                          ? 'bg-sky-500 text-slate-950'
                          : item.active
                          ? 'bg-amber-500 text-slate-950'
                          : `bg-slate-800 ${item.iconClass}`
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span className="text-[9.5px] font-bold leading-tight text-center line-clamp-2">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {/* ================= DESKTOP SUBMENU WORKSPACE (SIDEBAR + CONTEXTUAL WORKSPACE PANEL) ================= */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {activeTab !== 'dashboard' && (
          <aside
            aria-label="Sidebar Navigasi Menu Admin PC"
            className="hidden lg:flex lg:w-64 xl:w-72 shrink-0 flex-col bg-[#0d1424] border-r border-slate-800/80"
          >
            <div className="p-3.5 border-b border-slate-800/80 space-y-2">
              <button
                type="button"
                onClick={handleSubmenuBack}
                className="w-full py-2 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-amber-400 text-xs font-extrabold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span className="truncate">Kembali ke Dashboard</span>
              </button>
              <div className="px-1 pt-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                <span>Menu Layanan Admin</span>
                <span className="font-mono tabular-nums text-emerald-400">{wibTime}</span>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-2.5 space-y-1">
              {logoMenuItems.map((item) => {
                const IconComp = item.icon;
                const isTabunganActive = item.id === 'tabungan_umum' && item.active;
                return (
                  <button
                    key={`pc-side-${item.id}`}
                    type="button"
                    onClick={item.onClick}
                    className={`w-full px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold transition-colors cursor-pointer ${
                      isTabunganActive
                        ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                        : item.active
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                        : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-900/90 hover:border-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isTabunganActive
                            ? 'bg-sky-500 text-slate-950'
                            : item.active
                            ? 'bg-amber-500 text-slate-950'
                            : `bg-slate-900 border border-slate-800 ${item.iconClass}`
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== null && (
                      <span
                        className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center font-mono tabular-nums shrink-0 ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-slate-800/80 space-y-2 bg-[#0b1120]/60">
              <button
                type="button"
                onClick={() => {
                  setSettingSubModal(null);
                  setShowSettings(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-[#111c33] hover:bg-slate-800 border border-amber-500/35 text-amber-300 text-xs font-extrabold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-amber-400" />
                  <span>Menu Setting Web</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-amber-400/70" />
              </button>
              <button
                type="button"
                onClick={() => onLogout()}
                className="w-full py-2 px-3 rounded-xl bg-rose-950/35 hover:bg-rose-900/50 border border-rose-500/35 text-rose-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          {activeTab !== 'dashboard' && (
            <div className="hidden lg:flex items-center justify-between px-6 py-3 bg-[#0f172a]/75 border-b border-slate-800/80 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="text-slate-400 hover:text-amber-400 font-semibold transition-colors cursor-pointer"
                >
                  Dashboard Admin
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-white font-extrabold tracking-wide">
                  {activeTabTitle}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSubmenuBack}
                  className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
                  <span>Dashboard Utama</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= MAIN CONTENT BODY ================= */}
          <main
            className={`${
              activeTab === 'dashboard'
                ? 'max-w-7xl'
                : 'max-w-[1440px]'
            } w-full mx-auto flex-1 overflow-x-hidden ${
              activeTab === 'chat'
                ? 'p-2 sm:p-4 lg:p-6 flex flex-col min-h-0'
                : 'p-4 sm:p-6 lg:p-7 space-y-6'
            }`}
          >
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

            {/* PENDING MUTASI ANGGOTA APPROVAL ALERT BANNER */}
            {(isSuperAdmin || isApproval) && pendingMutasiCount > 0 && (
              <div
                onClick={() => setActiveTab('anggota')}
                className="bg-gradient-to-r from-rose-950/80 via-red-950/70 to-slate-900 border border-rose-500/50 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-rose-400 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-white">
                        Ada {pendingMutasiCount} Pengajuan Mutasi / Penghapusan Mutasi Anggota Menunggu Persetujuan Anda
                      </h4>
                      <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                        Approval Mutasi
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-300/80 mt-0.5">
                      Klik untuk membuka menu Data Anggota atau Penyesuaian Saldo dan meninjau pengajuan.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-xl text-xs shrink-0 shadow-lg shadow-rose-500/20 transition-all cursor-pointer self-end sm:self-center"
                >
                  Tinjau Mutasi →
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
                        Ada {pendingKasCount} Transaksi Buku Kas Menunggu Persetujuan Anda
                      </h4>
                      <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full animate-pulse">
                        Approval Kas
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      Pengajuan input, edit, atau hapus Buku Kas Anggota & Koperasi. Klik untuk membuka Buku Kas dan menyetujui atau menolak.
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

            {/* ================= MOBILE KPI GRID (< lg) ================= */}
            <div className="grid grid-cols-2 lg:hidden gap-2.5">
              {/* 1. Total Simpanan Pokok */}
              <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-3.5 min-w-0 overflow-hidden flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block break-words">
                  TOTAL SIMPANAN POKOK
                </span>
                <div
                  className="text-base font-black text-[#f59e0b] mt-1.5 font-mono tabular-nums tracking-tight break-all"
                  title={formatRupiah(totalPokok)}
                >
                  {formatRupiah(totalPokok)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 break-words leading-tight">
                  Rp1.000 / hari • Terkunci
                </div>
              </div>

              {/* 2. Total Tabungan Umum */}
              <div
                onClick={() => setActiveTab('tabungan_umum')}
                className="bg-[#0d1424] border border-slate-800 hover:border-sky-500/60 rounded-2xl p-3.5 min-w-0 overflow-hidden flex flex-col justify-between cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block break-words">
                    TOTAL TABUNGAN UMUM
                  </span>
                  <Wallet className="w-4 h-4 text-sky-400 shrink-0" />
                </div>
                <div
                  className="text-base font-black text-sky-400 mt-1.5 font-mono tabular-nums tracking-tight break-all"
                  title={formatRupiah(totalUmum)}
                >
                  {formatRupiah(totalUmum)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between gap-1 leading-tight">
                  <span className="truncate">Setor & tarik bebas</span>
                  <span className="text-sky-400 font-bold shrink-0">Lihat ›</span>
                </div>
              </div>

              {/* 3. Dana Zakat & Qurban */}
              <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-3.5 min-w-0 overflow-hidden flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block break-words">
                  DANA ZAKAT & QURBAN
                </span>
                <div
                  className="text-base font-black text-emerald-400 mt-1.5 font-mono tabular-nums tracking-tight break-all"
                  title={formatRupiah(totalZakat + totalQurban)}
                >
                  {formatRupiah(totalZakat + totalQurban)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 break-words leading-tight">
                  Fitrah: {formatRupiah(totalZakat)} • Qurban: {formatRupiah(totalQurban)}
                </div>
              </div>

              {/* 4. Saldo Sedekah Koperasi */}
              <div
                onClick={() => {
                  setBerbagiInitialTab('laporan');
                  setShowBerbagiModal(true);
                }}
                className="bg-gradient-to-br from-[#0d1424] via-[#1a1c38] to-[#25152b] border border-rose-500/50 rounded-2xl p-3.5 cursor-pointer transition-all min-w-0 overflow-hidden flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-rose-300 font-bold uppercase tracking-wider block break-words">
                    SALDO SEDEKAH KOPERASI
                  </span>
                  <Heart className="w-4 h-4 text-rose-400 fill-rose-400/20 shrink-0" />
                </div>
                <div
                  className="text-base font-black text-rose-400 mt-1.5 font-mono tabular-nums tracking-tight break-all"
                  title={formatRupiah(saldoSedekahTersedia)}
                >
                  {formatRupiah(saldoSedekahTersedia)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between gap-1 min-w-0">
                  <span>Saldo Tersedia</span>
                  <span className="text-rose-400 font-bold underline shrink-0">Kelola ›</span>
                </div>
              </div>

              {/* 5. Saldo Kas Berjalan */}
              <div className="col-span-2 bg-[#0d1424] border border-emerald-500/40 rounded-2xl p-3.5 min-w-0 overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                    SALDO KAS BERJALAN
                  </span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                    Konsolidasi
                  </span>
                </div>
                <div className="text-lg font-black text-white mt-1.5 font-mono tabular-nums tracking-tight break-all">
                  {formatRupiah(saldoKasBerjalan)}
                </div>
                <div className="text-[10px] text-slate-300 mt-1 leading-tight font-medium">
                  Total Saldo Anggota (Pokok + Umum + Zakat + Qurban) + Kas Koperasi
                </div>
              </div>
            </div>

            {/* ================= PC & WEB EXECUTIVE OVERVIEW (hidden lg:grid) ================= */}
            <section aria-label="Ringkasan Keuangan Koperasi PC" className="hidden lg:grid grid-cols-12 gap-4">
              {/* Primary Anchor: Saldo Kas Berjalan */}
              <div className="col-span-5 bg-[#0d1424] border border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                        Saldo Kas Berjalan Koperasi
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                        Konsolidasi Aktif
                      </span>
                    </div>
                    <div
                      className="text-3xl xl:text-4xl font-black text-white font-mono tabular-nums tracking-tight mt-2"
                      title={formatRupiah(saldoKasBerjalan)}
                    >
                      {formatRupiah(saldoKasBerjalan)}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Total Saldo Anggota ({formatRupiah(totalSaldoAnggota)}) + Saldo Buku Kas Koperasi ({formatRupiah(saldoKasKoperasi)})
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-800/90 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Anggota</span>
                      <span className="font-mono tabular-nums font-extrabold text-white text-sm">{state.members.length} Orang</span>
                    </div>
                    <div className="h-6 w-px bg-slate-800" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Antrean Verifikasi</span>
                      <span className={`font-mono tabular-nums font-extrabold text-sm ${pendingDepositsCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {pendingDepositsCount} Setoran
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrintSummary}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    Cetak Ringkasan
                  </button>
                </div>
              </div>

              {/* 4 Sub-Balance KPI Tiles */}
              <div className="col-span-7 grid grid-cols-2 gap-3.5">
                {/* 1. Simpanan Pokok */}
                <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                      Total Simpanan Pokok
                    </span>
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded">
                      50%
                    </span>
                  </div>
                  <div className="text-2xl font-black text-[#f59e0b] font-mono tabular-nums tracking-tight mt-2">
                    {formatRupiah(totalPokok)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Rp1.000 / hari • Terkunci oleh Admin
                  </div>
                </div>

                {/* 2. Tabungan Umum */}
                <button
                  type="button"
                  onClick={() => setActiveTab('tabungan_umum')}
                  className="bg-[#0d1424] border border-slate-800 hover:border-sky-500/60 rounded-2xl p-4 flex flex-col justify-between text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                      Total Tabungan Umum
                    </span>
                    <Wallet className="w-4 h-4 text-sky-400 shrink-0" />
                  </div>
                  <div className="text-2xl font-black text-sky-400 font-mono tabular-nums tracking-tight mt-2">
                    {formatRupiah(totalUmum)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between w-full">
                    <span>{tabunganUmumMembersCount} anggota memiliki saldo</span>
                    <span className="text-sky-400 font-bold group-hover:translate-x-0.5 transition-transform">Daftar ›</span>
                  </div>
                </button>

                {/* 3. Dana Zakat & Qurban */}
                <button
                  type="button"
                  onClick={() => setActiveTab('zakat')}
                  className="bg-[#0d1424] border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 flex flex-col justify-between text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                      Dana Zakat & Qurban
                    </span>
                    <HeartHandshake className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums tracking-tight mt-2">
                    {formatRupiah(totalZakat + totalQurban)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
                    Fitrah {formatRupiah(totalZakat)} • Qurban {formatRupiah(totalQurban)}
                  </div>
                </button>

                {/* 4. Saldo Sedekah Koperasi */}
                <button
                  type="button"
                  onClick={() => {
                    setBerbagiInitialTab('laporan');
                    setShowBerbagiModal(true);
                  }}
                  className="bg-[#0d1424] border border-rose-500/40 hover:border-rose-400 rounded-2xl p-4 flex flex-col justify-between text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[11px] text-rose-300 font-bold uppercase tracking-wider">
                      Saldo Sedekah Koperasi
                    </span>
                    <Heart className="w-4 h-4 text-rose-400 fill-rose-400/20 shrink-0" />
                  </div>
                  <div className="text-2xl font-black text-rose-400 font-mono tabular-nums tracking-tight mt-2">
                    {formatRupiah(saldoSedekahTersedia)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between w-full">
                    <span>Siap disalurkan</span>
                    <span className="text-rose-400 font-bold group-hover:translate-x-0.5 transition-transform">Kelola ›</span>
                  </div>
                </button>
              </div>
            </section>

            {/* ================= 3 LEDGER PANELS (Clean Single-Elevation Accounting Tables) ================= */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              {/* Card 1: Buku Kas Anggota */}
              <div className="bg-[#0d1424] border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-4 min-w-0 overflow-hidden">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 shrink-0">
                        <BookOpen className="w-5 h-5 text-amber-500 shrink-0" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-base font-extrabold text-white break-words">Buku Kas Anggota</h4>
                        <div className="text-[11px] text-slate-400 leading-tight">
                          Rekapitulasi Simpanan & Tabungan Anggota
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded shrink-0">
                      Anggota
                    </span>
                  </div>

                  {/* Highlighted Total Row */}
                  <div className="py-2.5 px-3.5 bg-slate-900/70 border-l-4 border-amber-500 rounded-r-xl flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      Saldo Buku Kas Anggota
                    </span>
                    <div
                      className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tabular-nums tracking-tight mt-0.5 break-all"
                      title={formatRupiah(saldoKasAnggota)}
                    >
                      {formatRupiah(saldoKasAnggota)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Pokok + Tabungan Umum + Zakat Fitrah + Qurban
                    </div>
                  </div>

                  {/* Aligned Ledger Breakdown */}
                  <div className="divide-y divide-slate-800/80 text-xs">
                    <div className="py-2.5 flex items-center justify-between gap-2 min-w-0">
                      <span className="text-slate-300 leading-tight">Simpanan Pokok Anggota (50%)</span>
                      <span className="font-bold text-amber-400 font-mono tabular-nums shrink-0">{formatRupiah(totalPokok)}</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-2 min-w-0">
                      <span className="text-slate-300 leading-tight">Tabungan Umum Anggota</span>
                      <span className="font-bold text-sky-400 font-mono tabular-nums shrink-0">{formatRupiah(totalUmum)}</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-2 min-w-0">
                      <span className="text-slate-300 leading-tight">Tabungan Zakat Fitrah (25%)</span>
                      <span className="font-bold text-emerald-400 font-mono tabular-nums shrink-0">{formatRupiah(totalZakat)}</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-2 min-w-0">
                      <span className="text-slate-300 leading-tight">Tabungan Qurban (25%)</span>
                      <span className="font-bold text-teal-400 font-mono tabular-nums shrink-0">{formatRupiah(totalQurban)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-800/70">
                  <button
                    type="button"
                    onClick={() => setActiveTab('kas')}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    PDF Laporan
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('kas')}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Unduh Excel
                  </button>
                </div>
              </div>

              {/* Card 2: Buku Kas Koperasi */}
              <div className="bg-[#0d1424] border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-4 min-w-0 overflow-hidden">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-sky-500/10 rounded-xl border border-sky-500/20 shrink-0">
                        <Building className="w-5 h-5 text-sky-400 shrink-0" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-base font-extrabold text-white break-words">Buku Kas Koperasi</h4>
                        <div className="text-[11px] text-slate-400 leading-tight">
                          Operasional, Sedekah & Lembaga Koperasi
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded shrink-0">
                      Lembaga
                    </span>
                  </div>

                  {/* Highlighted Total Row */}
                  <div className="py-2.5 px-3.5 bg-slate-900/70 border-l-4 border-sky-500 rounded-r-xl flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                      Total Saldo Kas Koperasi
                    </span>
                    <div
                      className="text-2xl sm:text-3xl font-black text-sky-400 font-mono tabular-nums tracking-tight mt-0.5 break-all"
                      title={formatRupiah(saldoKasKoperasi)}
                    >
                      {formatRupiah(saldoKasKoperasi)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Kas Induk Operasional & Lembaga
                    </div>
                  </div>

                  {/* Aligned Ledger Breakdown */}
                  <div className="divide-y divide-slate-800/80 text-xs">
                    <div className="py-2.5 flex items-center justify-between gap-2 min-w-0">
                      <span className="text-slate-300">Total Bersedekah</span>
                      <span className="font-bold text-rose-400 font-mono tabular-nums shrink-0">{formatRupiah(saldoSedekahTersedia)}</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <div className="text-slate-300">Saldo Kas Operasional</div>
                        <div className="text-[10px] text-slate-500">Total Kas Koperasi - Total Bersedekah</div>
                      </div>
                      <span className="font-bold text-emerald-400 font-mono tabular-nums shrink-0">
                        {formatRupiah(Math.max(0, saldoKasKoperasi - saldoSedekahTersedia))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-800/70">
                  <button
                    type="button"
                    onClick={() => setActiveTab('kas')}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                    Input Kas Koperasi
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('zakat')}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <HeartHandshake className="w-3.5 h-3.5" />
                    Salurkan Zakat
                  </button>
                </div>
              </div>

              {/* Card 3: Kas Berbagi & Sedekah Koperasi */}
              <div className="bg-[#0d1424] border border-rose-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-4 min-w-0 overflow-hidden">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20 shrink-0">
                        <Heart className="w-5 h-5 text-rose-400 fill-rose-400/30 shrink-0" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-base font-extrabold text-white break-words">Kas Berbagi & Sedekah</h4>
                        <div className="text-[11px] text-rose-300/80 leading-tight truncate">
                          {namaSubuh}, {namaJumat} & {namaUmum}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded shrink-0">
                      Sedekah
                    </span>
                  </div>

                  {/* Highlighted Total Row */}
                  <div className="py-2.5 px-3.5 bg-slate-900/70 border-l-4 border-rose-500 rounded-r-xl flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                      Saldo Siap Disalurkan
                    </span>
                    <div
                      className="text-2xl sm:text-3xl font-black text-rose-400 font-mono tabular-nums tracking-tight mt-0.5 break-all"
                      title={formatRupiah(saldoSedekahTersedia)}
                    >
                      {formatRupiah(saldoSedekahTersedia)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Masuk {formatRupiah(totalSedekahMasuk)} • Disalurkan {formatRupiah(totalSedekahSalur)}
                    </div>
                  </div>

                  {/* Aligned Ledger Breakdown */}
                  <div className="divide-y divide-slate-800/80 text-xs">
                    <div className="py-2.5 flex items-center justify-between gap-2 min-w-0">
                      <span className="text-slate-300 truncate">{namaSubuh}</span>
                      <span className="font-bold text-amber-300 font-mono tabular-nums shrink-0">{formatRupiah(subuhSaldo)}</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-2 min-w-0">
                      <span className="text-slate-300 truncate">{namaJumat}</span>
                      <span className="font-bold text-emerald-400 font-mono tabular-nums shrink-0">{formatRupiah(jumatSaldo)}</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-2 min-w-0">
                      <span className="text-slate-300 truncate">{namaUmum}</span>
                      <span className="font-bold text-sky-400 font-mono tabular-nums shrink-0">{formatRupiah(umumSaldo)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800/70">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBerbagiInitialTab('konfirmasi');
                        setShowBerbagiModal(true);
                      }}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      <span>Kas Sedekah</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBerbagiInitialTab('salurkan');
                        setShowBerbagiModal(true);
                      }}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Salurkan</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBerbagiInitialTab('laporan');
                      setShowBerbagiModal(true);
                    }}
                    className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                    <span>Laporan Mutasi Sedekah (PDF / Excel)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ================= PC & WEB OPERATIONAL ACTIVITY PANELS (hidden lg:grid) ================= */}
            <section aria-label="Ringkasan Operasional PC" className="hidden lg:grid grid-cols-2 gap-5">
              {/* Left: Pending Setoran Queue */}
              <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky-400" />
                      <h4 className="text-sm font-extrabold text-white">Antrean Verifikasi Setoran</h4>
                    </div>
                    {!isLaporan && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('verifikasi')}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        Buka Semua ({pendingDepositsCount}) ›
                      </button>
                    )}
                  </div>

                  {pendingDepositsCount === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Semua pengajuan setoran anggota telah diverifikasi. Tidak ada antrean menunggu.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80 mt-1">
                      {pendingDeposits.slice(0, 4).map((dep) => (
                        <div
                          key={dep.id}
                          onClick={() => !isLaporan && setActiveTab('verifikasi')}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-800/40 px-2 rounded-lg transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{dep.memberNama}</div>
                            <div className="text-[11px] text-slate-400">
                              {dep.jenis.toUpperCase()} • {dep.metode}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono tabular-nums font-extrabold text-emerald-400">
                              {formatRupiah(dep.nominal)}
                            </div>
                            <div className="text-[10px] font-mono text-amber-300/90">
                              {dep.createdAt
                                ? new Date(dep.createdAt).toLocaleTimeString('id-ID', {
                                    timeZone: 'Asia/Jakarta',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false,
                                  }) + ' WIB'
                                : '-'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Top Tabungan Umum & Quick Directory */}
              <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-sky-400" />
                      <h4 className="text-sm font-extrabold text-white">Pemilik Simpanan Tabungan Umum</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('tabungan_umum')}
                      className="text-xs font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      Lihat ({tabunganUmumMembersCount} Anggota) ›
                    </button>
                  </div>

                  {tabunganUmumMembersCount === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Belum ada anggota yang memiliki saldo Tabungan Umum saat ini.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80 mt-1">
                      {state.members
                        .filter((m) => (m.saldoUmum || 0) > 0)
                        .sort((a, b) => (b.saldoUmum || 0) - (a.saldoUmum || 0))
                        .slice(0, 4)
                        .map((mem) => (
                          <div
                            key={mem.id}
                            onClick={() => setActiveTab('tabungan_umum')}
                            className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-800/40 px-2 rounded-lg transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-white truncate">{mem.nama}</div>
                              <div className="text-[11px] font-mono text-slate-400">
                                {mem.nomorRekening || mem.nomorAnggota} • {mem.wilayah}
                              </div>
                            </div>
                            <div className="font-mono tabular-nums font-extrabold text-sky-400 shrink-0">
                              {formatRupiah(mem.saldoUmum)}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

          </>
        ) : activeTab === 'verifikasi' ? (
          <MemberVerificationView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        ) : activeTab === 'anggota' ? (
          <MemberListView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        ) : activeTab === 'kas' ? (
          <BukuKasView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'penyesuaian_saldo' ? (
          <ErrorBoundary fallbackTitle="Menu Penyesuaian Saldo">
            <PenyesuaianSaldoView
              state={state}
              updateState={updateState}
              currentAdmin={currentAdmin}
            />
          </ErrorBoundary>
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
        ) : activeTab === 'tabungan_umum' ? (
          <TabunganUmumView
            state={state}
            currentAdmin={currentAdmin}
          />
        ) : null}
          </main>
        </div>
      </div>

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
        onBackToDashboard={() => setActiveTab('dashboard')}
      />

      {/* ================= MODAL HAPUS TRANSAKSI & RESET MUTASI ANGGOTA ================= */}
      {showHapusTxModal && (isSuperAdmin || isApproval || isWriter) && (
        <HapusTransaksiAnggotaModal
          state={state}
          updateState={updateState}
          currentAdmin={currentAdmin}
          initialWilayah="semua"
          initialMemberId="semua"
          onClose={() => setShowHapusTxModal(false)}
        />
      )}
    </div>
  );
};
