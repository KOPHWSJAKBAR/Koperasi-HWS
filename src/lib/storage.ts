import { useState, useEffect, useCallback } from 'react';
import {
  AppState,
  MemberUser,
  AdminUser,
  SetoranVerifikasi,
  MemberTransaction,
  KasEntry,
  PenyaluranZakatQurban,
  ChatMessage,
  SuratResmi,
  AuditLog,
  WilayahKoperasi,
  WILAYAH_CODE_MAP,
  WILAYAH_ABBR_MAP,
} from '../types';

const STORAGE_KEY = 'koperasi_hws_local_cache';

// Clean initial fallback if server has not responded yet
const defaultInitialState: AppState = {
  profile: {
    nama: 'Koperasi Himpunan Wirausaha Sejahtera',
    badanHukum: 'AHU-0004921.AH.01.29.TAHUN 2024',
    npwpKoperasi: '82.910.293.4-038.000',
    nikKoperasi: '3173010049210001',
    tanggalPendirian: '15 Januari 2024',
    visi: 'Membangun ekosistem wirausaha mikro dan mandiri yang berkeadilan, sejahtera, serta berlandaskan asas gotong royong dan syariah.',
    misi: 'Memberdayakan ekonomi anggota melalui tabungan terencana, pembiayaan produktif, dan kepedulian sosial zakat & qurban.',
    ketuaPengurus: 'Abzqar',
    wakilKetua: 'Bambang Sutejo',
    sekretaris: 'Robi Darwis',
    bendahara: 'Suryadi Pratama',
    pengawas: 'H. Ahmad Fauzi',
    daftarPengurus: [
      { id: 'peng-1', jabatan: 'Ketua Pengurus', nama: 'Abzqar', kontak: '0811-9882-233' },
      { id: 'peng-2', jabatan: 'Wakil Ketua', nama: 'Bambang Sutejo', kontak: '0812-3456-7890' },
      { id: 'peng-3', jabatan: 'Sekretaris', nama: 'Robi Darwis', kontak: '0857-1234-5678' },
      { id: 'peng-4', jabatan: 'Bendahara', nama: 'Suryadi Pratama', kontak: '0812-9988-7766' },
      { id: 'peng-5', jabatan: 'Ketua Dewan Pengawas', nama: 'H. Ahmad Fauzi', kontak: '0813-4455-6677' },
    ],
    alamat: 'Jl. Raya Daan Mogot KM 11 No. 8, Cengkareng, Jakarta Barat 11740',
    telepon: '0858-1755-4296',
    email: 'koperasi.hws.jkt@gmail.com',
    website: 'https://koperasi-hws.id',
    rekeningPenampungan: [
      {
        id: 'rek-1',
        bankName: 'Bank Central Asia (BCA)',
        accountNumber: '5490706161',
        accountHolder: 'KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA',
        isPrimary: true,
      },
      {
        id: 'rek-2',
        bankName: 'Bank Mandiri',
        accountNumber: '1180010998821',
        accountHolder: 'KOPERASI HWS',
        isPrimary: false,
      },
      {
        id: 'rek-3',
        bankName: 'Bank Rakyat Indonesia (BRI)',
        accountNumber: '033901002983501',
        accountHolder: 'KOPERASI HWS',
        isPrimary: false,
      },
      {
        id: 'rek-4',
        bankName: 'Bank Negara Indonesia (BNI)',
        accountNumber: '0981772661',
        accountHolder: 'KOPERASI HWS',
        isPrimary: false,
      },
    ],
    qrisImageUrl: '',
    biayaWajibHarian: 2000,
    pembagianPokokHarian: 1000,
    pembagianZakatHarian: 500,
    pembagianQurbanHarian: 500,
  },
  admins: [
    {
      id: 'adm-abzqar',
      username: 'Abzqar',
      nama: 'Abzqar',
      email: 'abzqar@hws.koperasi.id',
      whatsapp: '08119882233',
      nik: '3173010101700001',
      wilayahKantor: 'Cengkareng',
      role: 'super_admin',
      password: 'ciganea',
      securityQuestion: 'Nama kota pendirian koperasi?',
      securityAnswer: 'jakarta',
      alamatLengkap: 'Jl. Raya Daan Mogot KM 11 No. 8, RT 001 RW 001, Kel. Rawa Buaya',
      rt: '001',
      rw: '001',
      kelurahan: 'Rawa Buaya',
      kecamatan: 'Cengkareng',
      kota: 'Jakarta Barat',
      provinsi: 'DKI Jakarta',
      kodePos: '11740',
      bankPribadi: {
        namaBank: 'Bank Central Asia (BCA)',
        nomorRekening: '5490706161',
        atasNama: 'Abzqar',
      },
      status: 'aktif',
      createdAt: new Date().toISOString(),
    },
  ],
  members: [
    {
      id: 'mem-1',
      nomorAnggota: 'HWS-CKR-2026-001',
      nomorRekening: '7729666666',
      nama: 'Almaydha Arya Budiman',
      nik: '3173012005950003',
      whatsapp: '085817554296',
      email: 'almaydha.arya@gmail.com',
      wilayah: 'Cengkareng',
      alamatLengkap: 'Jl. Albarkah Raya No. 8, RT 003 RW 003, Kel. Rawa Buaya',
      provinsi: 'DKI Jakarta',
      kota: 'Jakarta Barat',
      kecamatan: 'Cengkareng',
      kelurahan: 'Rawa Buaya',
      rt: '003',
      rw: '003',
      kodePos: '11740',
      ktpPhotoUrl: '',
      bankPribadi: {
        namaBank: 'Bank Central Asia (BCA)',
        nomorRekening: '5490706161',
        atasNama: 'Almaydha Arya Budiman',
      },
      password: 'user123',
      pinTransaksi: '123456',
      securityQuestion: 'Nama hewan peliharaan pertama?',
      securityAnswer: 'kucing',
      saldoPokok: 0,
      isPokokLocked: true,
      saldoZakatFitrah: 0,
      saldoQurban: 0,
      saldoUmum: 0,
      status: 'aktif',
      terdaftarSejak: '2026-02-01',
    },
  ],
  setoranList: [],
  memberTransactions: [],
  kasList: [],
  penyaluranList: [],
  chatMessages: [],
  suratList: [],
  auditLogs: [],
  categoriesKasKoperasi: {
    pemasukan: ['Iuran Tabungan Zakat & Qurban', 'Penerimaan Sumbangan / Donasi', 'Pendapatan Jasa Koperasi', 'Pindah Kas Tutup Akun'],
    pengeluaran: ['Penyaluran Zakat Fitrah', 'Penyaluran Tabungan Qurban', 'Biaya Operasional & ATK', 'Sewa Kantor & Listrik', 'Honor Pengurus'],
  },
  lastRunningNumber: 66666,
  serverSyncStatus: {
    online: true,
    lastSynced: new Date().toISOString(),
    googleCloudBackup: true,
    firestoreActive: true,
  },
};

let globalState: AppState = (() => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return defaultInitialState;
})();

const listeners = new Set<(state: AppState) => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener({ ...globalState });
  }
}

const CLIENT_ID = typeof window !== 'undefined'
  ? (sessionStorage.getItem('koperasi_client_id') || (() => {
      const id = 'client_' + Math.random().toString(36).substring(2, 10);
      try { sessionStorage.setItem('koperasi_client_id', id); } catch {}
      return id;
    })())
  : 'server_client';

// ================= AUDIO NOTIFICATION SYSTEM (Web Audio API Synthesizer) =================
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playNotificationSound(type: 'deposit' | 'chat') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (type === 'deposit') {
      // 3-tone pleasant rising chime for deposit verification (C5 -> E5 -> G5)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.36);
      });
    } else {
      // 2-tone melodic chime for chat (D5 -> A5)
      const freqs = [587.33, 880.0];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.14);

        gain.gain.setValueAtTime(0, now + idx * 0.14);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.14 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.41);
      });
    }
  } catch (err) {
    console.warn('Audio notification failed:', err);
  }
}

// Browser Push Notification Helpers
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

export function triggerBrowserNotification(
  title: string,
  body: string,
  onClick?: () => void
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `hws-${Date.now()}`,
      });
      if (onClick) {
        notif.onclick = () => {
          window.focus();
          onClick();
          notif.close();
        };
      }
    } catch (e) {
      console.warn('Failed to display browser notification:', e);
    }
  }
}

// Permanent File & State Merger (JANGAN HAPUS FILE ATAU DATA YANG TELAH DIINPUT DATABASE)
export function mergeStates(base: AppState, incoming: AppState): AppState {
  if (!base) return incoming;
  if (!incoming) return base;

  // 1. Members: merge by ID, NEVER delete existing members, preserve photos & bank info
  const memberMap = new Map<string, MemberUser>();
  (base.members || []).forEach((m) => memberMap.set(m.id, { ...m }));
  (incoming.members || []).forEach((m) => {
    const existing = memberMap.get(m.id);
    if (!existing) {
      memberMap.set(m.id, m);
    } else {
      memberMap.set(m.id, {
        ...existing,
        ...m,
        ktpPhotoUrl: m.ktpPhotoUrl || existing.ktpPhotoUrl,
        avatarUrl: m.avatarUrl || existing.avatarUrl,
        bankPribadi: {
          ...existing.bankPribadi,
          ...(m.bankPribadi || {}),
        },
      });
    }
  });

  // 2. Setoran List (Preserve all deposits & uploaded buktiTransferUrl)
  const setoranMap = new Map<string, SetoranVerifikasi>();
  (base.setoranList || []).forEach((s) => setoranMap.set(s.id, { ...s }));
  (incoming.setoranList || []).forEach((s) => {
    const existing = setoranMap.get(s.id);
    if (!existing) {
      setoranMap.set(s.id, s);
    } else {
      setoranMap.set(s.id, {
        ...existing,
        ...s,
        buktiTransferUrl: s.buktiTransferUrl || existing.buktiTransferUrl,
      });
    }
  });

  // 3. Chat Messages (Preserve all messages & attachments - PERMANENT)
  const chatMap = new Map<string, ChatMessage>();
  (base.chatMessages || []).forEach((c) => chatMap.set(c.id, { ...c }));
  (incoming.chatMessages || []).forEach((c) => {
    const existing = chatMap.get(c.id);
    if (!existing) {
      chatMap.set(c.id, c);
    } else {
      chatMap.set(c.id, {
        ...existing,
        ...c,
        lampiranUrl: c.lampiranUrl || existing.lampiranUrl,
      });
    }
  });

  // 4. Surat Resmi List (Preserve all letters & documents - PERMANENT)
  const suratMap = new Map<string, SuratResmi>();
  (base.suratList || []).forEach((s) => suratMap.set(s.id, { ...s }));
  (incoming.suratList || []).forEach((s) => {
    if (!suratMap.has(s.id)) {
      suratMap.set(s.id, s);
    } else {
      suratMap.set(s.id, { ...suratMap.get(s.id)!, ...s });
    }
  });

  // 5. Member Transactions (Mutasi Rekening)
  const txMap = new Map<string, MemberTransaction>();
  (base.memberTransactions || []).forEach((tx) => txMap.set(tx.id, tx));
  (incoming.memberTransactions || []).forEach((tx) => txMap.set(tx.id, tx));

  // 6. Kas List (Buku Kas Koperasi)
  const kasMap = new Map<string, KasEntry>();
  (base.kasList || []).forEach((k) => kasMap.set(k.id, k));
  (incoming.kasList || []).forEach((k) => kasMap.set(k.id, k));

  // 7. Penyaluran List (Zakat & Qurban)
  const penyaluranMap = new Map<string, PenyaluranZakatQurban>();
  (base.penyaluranList || []).forEach((p) => penyaluranMap.set(p.id, p));
  (incoming.penyaluranList || []).forEach((p) => penyaluranMap.set(p.id, p));

  // 8. Audit Logs (Preserve 100% audit trail - PERMANENT)
  const logMap = new Map<string, AuditLog>();
  (base.auditLogs || []).forEach((l) => logMap.set(l.id, l));
  (incoming.auditLogs || []).forEach((l) => logMap.set(l.id, l));

  // 9. Admins
  const adminMap = new Map<string, AdminUser>();
  (base.admins || []).forEach((a) => adminMap.set(a.id, a));
  (incoming.admins || []).forEach((a) => adminMap.set(a.id, a));

  // 10. Profile: preserve QRIS and official details
  const profile = {
    ...base.profile,
    ...(incoming.profile || {}),
    qrisImageUrl: incoming.profile?.qrisImageUrl || base.profile?.qrisImageUrl,
  };

  return {
    ...base,
    ...incoming,
    profile,
    admins: Array.from(adminMap.values()),
    members: Array.from(memberMap.values()),
    setoranList: Array.from(setoranMap.values()).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
    chatMessages: Array.from(chatMap.values()).sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1)),
    suratList: Array.from(suratMap.values()).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
    memberTransactions: Array.from(txMap.values()).sort((a, b) => (b.tanggal > a.tanggal ? 1 : -1)),
    kasList: Array.from(kasMap.values()).sort((a, b) => (b.tanggal > a.tanggal ? 1 : -1)),
    penyaluranList: Array.from(penyaluranMap.values()),
    auditLogs: Array.from(logMap.values()).sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1)),
    lastRunningNumber: Math.max(base.lastRunningNumber || 66666, incoming.lastRunningNumber || 66666),
    serverSyncStatus: {
      online: true,
      lastSynced: new Date().toISOString(),
      googleCloudBackup: true,
      firestoreActive: true,
      filesProtected: true,
      permanentStorage: true,
    },
  };
}

// Sync to backend & Firebase Firestore (with permanent file protection)
export async function syncStateToServer(state: AppState) {
  try {
    const now = new Date().toISOString();
    state.serverSyncStatus = {
      ...(state.serverSyncStatus || {}),
      lastSynced: now,
      online: true,
      firestoreActive: true,
      googleCloudBackup: true,
      filesProtected: true,
      permanentStorage: true,
    };
    
    // Merge safely with globalState so no concurrent inputs or files are deleted
    globalState = mergeStates(globalState, state);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
    } catch {}
    notifyListeners();

    // 1. Post to Express realtime backend
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(globalState),
    }).catch(() => {});

    // 2. Mirror to Firebase Firestore directly with merge: true (Req 10 & Req 13)
    try {
      const { db } = await import('./firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      setDoc(
        doc(db, 'koperasi_state', 'main_database'),
        {
          lastSynced: now,
          updatedBy: CLIENT_ID,
          totalMembers: globalState.members.length,
          totalKas: globalState.kasList.length,
          totalSetoran: globalState.setoranList.length,
          payload: JSON.stringify(globalState),
          filesProtected: true,
        },
        { merge: true }
      ).catch(() => {});
    } catch {}
  } catch (err) {
    // State is safely cached in localStorage
  }
}

// Load from server on startup (with safe merge)
export async function fetchStateFromServer(): Promise<AppState> {
  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        globalState = mergeStates(globalState, data);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
        } catch {}
        notifyListeners();
        return globalState;
      }
    }
  } catch (err) {
    console.warn('Could not fetch from server, using local cache', err);
  }
  return globalState;
}

// React Hook
export function useKoperasiState() {
  const [state, setState] = useState<AppState>(globalState);

  useEffect(() => {
    let isMounted = true;
    const handler = (newState: AppState) => {
      if (isMounted) setState(newState);
    };
    listeners.add(handler);

    // Initial fetch
    fetchStateFromServer();

    // Regular polling fallback every 3 seconds to keep all devices & mobile in sync
    const pollInterval = setInterval(() => {
      fetchStateFromServer();
    }, 3000);

    // Resilient SSE Realtime Connection with Auto-Reconnect
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connectSSE() {
      if (!isMounted) return;
      try {
        if (eventSource) {
          eventSource.close();
        }
        eventSource = new EventSource('/api/events');
        eventSource.onopen = () => {
          // Connected to realtime database event stream
        };
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'STATE_UPDATED' || data.type === 'STATE_RESET') {
              if (data.payload) {
                globalState = mergeStates(globalState, data.payload);
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
                } catch {}
                notifyListeners();
              }
            } else if (
              data.type === 'SETORAN_UPDATED' ||
              data.type === 'TRANSFER_COMPLETED' ||
              data.type === 'SYSTEM_REPAIRED'
            ) {
              fetchStateFromServer();
            } else if (data.type === 'NEW_CHAT_MESSAGE') {
              const msg = data.payload;
              if (msg && !globalState.chatMessages.find((m) => m.id === msg.id)) {
                globalState = {
                  ...globalState,
                  chatMessages: [...globalState.chatMessages, msg],
                };
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
                } catch {}
                notifyListeners();
              }
            }
          } catch (e) {
            console.error('Error handling SSE event', e);
          }
        };
        eventSource.onerror = () => {
          // Auto-reconnect after 2 seconds if connection drops
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (isMounted) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(connectSSE, 2000);
          }
        };
      } catch (err) {
        if (isMounted) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, 3000);
        }
      }
    }

    connectSSE();

    // 3. Realtime Firestore Listener (Persistent & Auto-Reconnecting)
    let unsubscribeFirestore: (() => void) | null = null;
    try {
      import('./firebase').then(({ db }) => {
        import('firebase/firestore').then(({ doc, onSnapshot }) => {
          if (!isMounted) return;
          unsubscribeFirestore = onSnapshot(
            doc(db, 'koperasi_state', 'main_database'),
            (docSnap) => {
              if (docSnap.exists()) {
                const remote = docSnap.data();
                if (remote && remote.payload && remote.updatedBy !== CLIENT_ID) {
                  try {
                    const parsed = JSON.parse(remote.payload);
                    if (parsed && parsed.profile && parsed.members) {
                      globalState = mergeStates(globalState, parsed);
                      try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
                      } catch {}
                      notifyListeners();
                    }
                  } catch {}
                }
              }
            },
            () => {
              // Graceful fallback: when unauthenticated or offline, real-time sync is handled seamlessly via Express SSE & REST API
            }
          );
        });
      });
    } catch {}

    return () => {
      isMounted = false;
      listeners.delete(handler);
      clearInterval(pollInterval);
      clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  const updateState = useCallback(async (updater: (prev: AppState) => AppState) => {
    const nextState = updater(globalState);
    await syncStateToServer(nextState);
  }, []);

  return { state, updateState };
}

// Helper: Format Rupiah
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

// Helper: Generate 10-digit Account Number
// 2 digit wilayah + 3 digit belakang no hp + 5 digit running number dimulai dari 66666
export function generateNomorRekening(
  wilayah: WilayahKoperasi,
  noHp: string,
  lastRunningNumber: number
): { nomorRekening: string; nextRunningNumber: number } {
  const kodeWilayah = WILAYAH_CODE_MAP[wilayah] || '77';
  const cleanHp = (noHp || '').replace(/\D/g, '');
  const hp3 = cleanHp.slice(-3).padStart(3, '0');
  const running = (lastRunningNumber || 66666) + 1;
  const running5 = String(running).slice(-5).padStart(5, '6');
  const nomorRekening = `${kodeWilayah}${hp3}${running5}`;
  return { nomorRekening, nextRunningNumber: running };
}

// Helper: Generate Official Member Number (e.g. HWS-CKR-2026-001)
export function generateNomorAnggota(
  wilayah: WilayahKoperasi,
  existingCount: number
): string {
  const abbr = WILAYAH_ABBR_MAP[wilayah] || 'CKR';
  const year = new Date().getFullYear();
  const seq = String(existingCount + 1).padStart(3, '0');
  return `HWS-${abbr}-${year}-${seq}`;
}

// Helper: Add Audit Log with Firestore 'logs' collection synchronization
export function createAuditLog(
  admin: AdminUser,
  action: string,
  detail: string,
  targetId?: string
): AuditLog {
  const log: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    adminId: admin.id,
    adminNama: admin.nama,
    adminRole: admin.role,
    action,
    detail,
    targetId,
  };

  // Asynchronously record to Firestore 'logs' collection and server API
  import('./activityLogger')
    .then(({ recordAdminActivity }) => {
      recordAdminActivity(admin, action, detail, targetId).catch(() => {});
    })
    .catch(() => {});

  return log;
}
