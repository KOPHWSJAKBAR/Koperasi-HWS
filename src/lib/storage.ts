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

// Sync to backend
export async function syncStateToServer(state: AppState) {
  try {
    globalState = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
    notifyListeners();

    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch (err) {
    console.warn('Sync to server failed, cached in localStorage', err);
  }
}

// Load from server on startup
export async function fetchStateFromServer(): Promise<AppState> {
  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const data = await res.json();
      globalState = data;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {}
      notifyListeners();
      return data;
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
    const handler = (newState: AppState) => {
      setState(newState);
    };
    listeners.add(handler);

    // Initial fetch
    fetchStateFromServer();

    // Listen to realtime events via EventSource
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'STATE_UPDATED' || data.type === 'STATE_RESET') {
            globalState = data.payload;
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data.payload));
            } catch {}
            notifyListeners();
          } else if (data.type === 'NEW_CHAT_MESSAGE') {
            const msg = data.payload;
            if (!globalState.chatMessages.find((m) => m.id === msg.id)) {
              globalState = {
                ...globalState,
                chatMessages: [...globalState.chatMessages, msg],
              };
              notifyListeners();
            }
          }
        } catch (e) {
          console.error('Error handling SSE event', e);
        }
      };
    } catch {}

    return () => {
      listeners.delete(handler);
      if (eventSource) eventSource.close();
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

// Helper: Add Audit Log
export function createAuditLog(
  admin: AdminUser,
  action: string,
  detail: string,
  targetId?: string
): AuditLog {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    adminId: admin.id,
    adminNama: admin.nama,
    adminRole: admin.role,
    action,
    detail,
    targetId,
  };
}
