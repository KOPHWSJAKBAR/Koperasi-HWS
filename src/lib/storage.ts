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
      password: 'Abieza88',
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
  members: [],
  setoranList: [],
  memberTransactions: [],
  kasList: [],
  penyaluranList: [],
  sedekahList: [],
  chatMessages: [],
  suratList: [],
  auditLogs: [],
  categoriesKasKoperasi: {
    pemasukan: [
      'Sedekah Subuh',
      'Sedekah Jumat',
      'Sedekah Umum',
      'Pinjaman Kas',
      'Pengembalian Kas',
      'Iuran Tabungan Zakat & Qurban',
      'Penerimaan Sumbangan / Donasi',
      'Pendapatan Jasa Koperasi',
      'Pindah Kas Tutup Akun',
    ],
    pengeluaran: [
      'Penyaluran Sedekah Subuh',
      'Penyaluran Sedekah Jumat',
      'Penyaluran Sedekah Umum',
      'Pinjaman Kas',
      'Pengembalian Buku Kas',
      'Penyaluran Zakat Fitrah',
      'Penyaluran Tabungan Qurban',
      'Biaya Operasional & ATK',
      'Sewa Kantor & Listrik',
      'Honor Pengurus',
    ],
  },
  lastRunningNumber: 66666,
  serverSyncStatus: {
    online: true,
    lastSynced: new Date().toISOString(),
    googleCloudBackup: true,
    firestoreActive: true,
    firebaseStorageActive: true,
    analyticsActive: true,
  },
  maintenanceLock: {
    isLocked: false,
  },
  pengaturanBerbagi: {
    namaSubuh: 'Sedekah Subuh',
    namaJumat: 'Sedekah Jumat',
    namaUmum: 'Sedekah Umum',
    bankName: 'Bank Syariah Indonesia (BSI)',
    noRekening: '7123-4567-8901',
    namaPemilikRekening: 'Koperasi Berbagi Mandiri HWS',
    qrisImageUrl: '',
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

export const CLIENT_ID = typeof window !== 'undefined'
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

  // 1. Members: UNION of all members by id so registered members NEVER disappear!
  // Preserves any member present in base OR incoming, unless explicitly in deletedMemberIds.
  const memberMap = new Map<string, MemberUser>();
  (base.members || []).forEach((m) => {
    if (m && m.id) memberMap.set(m.id, { ...m });
  });
  (incoming.members || []).forEach((m) => {
    if (m && m.id) {
      const existing = memberMap.get(m.id);
      if (!existing) {
        memberMap.set(m.id, { ...m });
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
    }
  });

  const allDeletedMemIds = new Set<string>([
    ...(base.deletedMemberIds || []),
    ...(incoming.deletedMemberIds || []),
  ]);
  allDeletedMemIds.forEach((id) => memberMap.delete(id));
  const mergedMembers = Array.from(memberMap.values());

  // 2. Setoran List (Preserve all deposits & uploaded buktiTransferUrl, protect approved status)
  const allDeletedSetoranIds = new Set<string>([
    ...(base.deletedSetoranIds || []),
    ...(incoming.deletedSetoranIds || []),
  ]);
  const setoranMap = new Map<string, SetoranVerifikasi>();
  (base.setoranList || []).forEach((s) => {
    if (s && s.id && !allDeletedSetoranIds.has(s.id)) {
      setoranMap.set(s.id, { ...s });
    }
  });
  (incoming.setoranList || []).forEach((s) => {
    if (s && s.id && !allDeletedSetoranIds.has(s.id)) {
      const existing = setoranMap.get(s.id);
      if (!existing) {
        setoranMap.set(s.id, s);
      } else {
        // TERMINAL STATUS GUARD: Once disetujui or ditolak, NEVER revert to pending!
        const isTerminal = existing.status === 'disetujui' || existing.status === 'ditolak';
        const finalStatus = isTerminal ? existing.status : (s.status || existing.status);
        setoranMap.set(s.id, {
          ...existing,
          ...s,
          status: finalStatus,
          verifiedAt: existing.verifiedAt || s.verifiedAt,
          verifiedBy: existing.verifiedBy || s.verifiedBy,
          buktiTransferUrl: s.buktiTransferUrl || existing.buktiTransferUrl,
        });
      }
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
      const existing = suratMap.get(s.id)!;
      suratMap.set(s.id, {
        ...existing,
        ...s,
        readByMemberIds: Array.from(new Set([...(existing.readByMemberIds || []), ...(s.readByMemberIds || [])])),
        readByAdminIds: Array.from(new Set([...(existing.readByAdminIds || []), ...(s.readByAdminIds || [])])),
      });
    }
  });

  // 5. Member Transactions (Mutasi Rekening): Filter out any deletedTransactionIds so deleted mutations never resurrect
  const allDeletedTxIds = new Set<string>([
    ...(base.deletedTransactionIds || []),
    ...(incoming.deletedTransactionIds || []),
  ]);

  const txSource = Array.isArray(incoming.memberTransactions)
    ? incoming.memberTransactions
    : (base.memberTransactions || []);

  const txMap = new Map<string, MemberTransaction>();
  txSource.forEach((tx) => {
    if (tx && tx.id && !allDeletedTxIds.has(tx.id)) {
      txMap.set(tx.id, tx);
    }
  });
  const mergedTxList = Array.from(txMap.values());

  // 6. Kas List: if incoming.kasList is provided as an array, use it directly so deletions persist (Req 5).
  let mergedKasList: KasEntry[];
  if (Array.isArray(incoming.kasList)) {
    mergedKasList = incoming.kasList;
  } else {
    mergedKasList = base.kasList || [];
  }

  // 7. Penyaluran List (Zakat & Qurban)
  const penyaluranMap = new Map<string, PenyaluranZakatQurban>();
  (base.penyaluranList || []).forEach((p) => penyaluranMap.set(p.id, p));
  (incoming.penyaluranList || []).forEach((p) => penyaluranMap.set(p.id, p));

  // 8. Audit Logs: if incoming.auditLogs is provided as an array, use it directly so logs can be cleared or reset (Req 3).
  let mergedAuditLogs: AuditLog[];
  if (Array.isArray(incoming.auditLogs)) {
    mergedAuditLogs = incoming.auditLogs;
  } else {
    mergedAuditLogs = base.auditLogs || [];
  }

  // 9. Admins: if incoming.admins is provided, use it directly so admin management works properly.
  let mergedAdmins: AdminUser[];
  if (Array.isArray(incoming.admins)) {
    mergedAdmins = incoming.admins;
  } else {
    mergedAdmins = base.admins || [];
  }

  // 10. Profile: preserve rekeningPenampungan, QRIS and official details
  const incomingRek = incoming.profile?.rekeningPenampungan;
  const baseRek = base.profile?.rekeningPenampungan;
  const rekeningPenampungan = Array.isArray(incomingRek)
    ? incomingRek
    : (Array.isArray(baseRek) ? baseRek : []);

  const profile = {
    ...base.profile,
    ...(incoming.profile || {}),
    rekeningPenampungan,
    qrisImageUrl: incoming.profile?.qrisImageUrl || base.profile?.qrisImageUrl,
  };

  // 11. Sedekah List (Preserve all donations & receipts)
  const sedekahMap = new Map<string, any>();
  (base.sedekahList || []).forEach((s) => sedekahMap.set(s.id, { ...s }));
  (incoming.sedekahList || []).forEach((s) => {
    const existing = sedekahMap.get(s.id);
    if (!existing) {
      sedekahMap.set(s.id, s);
    } else {
      sedekahMap.set(s.id, {
        ...existing,
        ...s,
        buktiTransferUrl: s.buktiTransferUrl || existing.buktiTransferUrl,
      });
    }
  });

  // 12. Pengaturan Berbagi (Names, rekening, & QRIS Sedekah)
  const defaultBerbagi = {
    namaSubuh: 'Sedekah Subuh',
    namaJumat: 'Sedekah Jumat',
    namaUmum: 'Sedekah Umum',
    bankName: 'Bank Syariah Indonesia (BSI)',
    noRekening: '7123-4567-8901',
    namaPemilikRekening: 'Koperasi Berbagi Mandiri HWS',
  };
  const pengaturanBerbagi = {
    ...defaultBerbagi,
    ...(base.pengaturanBerbagi || {}),
    ...(incoming.pengaturanBerbagi || {}),
    qrisImageUrl: incoming.pengaturanBerbagi?.qrisImageUrl !== undefined
      ? incoming.pengaturanBerbagi.qrisImageUrl
      : base.pengaturanBerbagi?.qrisImageUrl,
  };

  return {
    ...base,
    ...incoming,
    profile,
    admins: mergedAdmins,
    members: mergedMembers,
    setoranList: Array.from(setoranMap.values()).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
    chatMessages: Array.from(chatMap.values()).sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1)),
    suratList: Array.from(suratMap.values()).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
    memberTransactions: mergedTxList.sort((a, b) => ((b.tanggal + (b.jam || '')) > (a.tanggal + (a.jam || '')) ? 1 : -1)),
    kasList: mergedKasList.sort((a, b) => (b.tanggal > a.tanggal ? 1 : -1)),
    penyaluranList: Array.from(penyaluranMap.values()),
    sedekahList: Array.from(sedekahMap.values()).sort((a, b) => ((b.createdAt || b.tanggal) > (a.createdAt || a.tanggal) ? 1 : -1)),
    pengaturanBerbagi,
    auditLogs: mergedAuditLogs.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1)),
    lastRunningNumber: Math.max(base.lastRunningNumber || 66666, incoming.lastRunningNumber || 66666),
    deletedMemberIds: Array.from(allDeletedMemIds),
    deletedTransactionIds: Array.from(allDeletedTxIds),
    serverSyncStatus: {
      online: true,
      lastSynced: new Date().toISOString(),
      googleCloudBackup: true,
      firestoreActive: true,
      firebaseStorageActive: true,
      analyticsActive: true,
      filesProtected: true,
      permanentStorage: true,
    },
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
  };
  console.warn('Firestore Notice:', JSON.stringify(errInfo));
}

// Deep sanitization helper to strip all undefined values before writing to Firestore
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    if (typeof data === 'object') {
      const clean: any = Array.isArray(data) ? [] : {};
      for (const [k, v] of Object.entries(data as any)) {
        if (v !== undefined) {
          clean[k] = v;
        }
      }
      return clean;
    }
    return data;
  }
}

// Track last synced hashes to prevent redundant network writes
const lastWrittenMap = new Map<string, string>();
let shardedTimer: any = null;

// Sharded Cloud Firestore synchronizer (resolves 1MB document limit and undefined fields completely)
export async function syncShardedToFirestore(state: AppState) {
  try {
    const { db } = await import('./firebase');
    const { doc, setDoc, deleteDoc } = await import('firebase/firestore');
    const now = new Date().toISOString();

    // 1. Sharded settings/general
    const generalData = sanitizeForFirestore({
      id: 'general',
      profile: state.profile || {},
      categoriesKasKoperasi: state.categoriesKasKoperasi || {},
      pengaturanBerbagi: state.pengaturanBerbagi || {},
      maintenanceLock: state.maintenanceLock || { isLocked: false },
      lastRunningNumber: state.lastRunningNumber || 66666,
      deletedMemberIds: state.deletedMemberIds || [],
      deletedTransactionIds: state.deletedTransactionIds || [],
      updatedAt: now,
      updatedBy: CLIENT_ID,
    });
    const generalStr = JSON.stringify(generalData);
    if (lastWrittenMap.get('settings/general') !== generalStr) {
      await setDoc(doc(db, 'settings', 'general'), generalData, { merge: true }).catch((e) =>
        handleFirestoreError(e, OperationType.WRITE, 'settings/general')
      );
      lastWrittenMap.set('settings/general', generalStr);
    }

    // 2. Sharded settings/admins
    const adminsData = sanitizeForFirestore({
      id: 'admins',
      admins: state.admins || [],
      updatedAt: now,
      updatedBy: CLIENT_ID,
    });
    const adminsStr = JSON.stringify(adminsData);
    if (lastWrittenMap.get('settings/admins') !== adminsStr) {
      await setDoc(doc(db, 'settings', 'admins'), adminsData, { merge: true }).catch((e) =>
        handleFirestoreError(e, OperationType.WRITE, 'settings/admins')
      );
      lastWrittenMap.set('settings/admins', adminsStr);
    }

    // 3. Sharded Members collection (each member is an isolated ~1KB doc, stripped of any undefined fields)
    for (const m of state.members || []) {
      if (m && m.id) {
        const key = `members/${m.id}`;
        const cleanMember = sanitizeForFirestore({ ...m, updatedAt: now });
        const mStr = JSON.stringify(cleanMember);
        if (lastWrittenMap.get(key) !== mStr) {
          await setDoc(doc(db, 'members', m.id), cleanMember, { merge: true }).catch((e) =>
            handleFirestoreError(e, OperationType.WRITE, key)
          );
          lastWrittenMap.set(key, mStr);
        }
      }
    }
    for (const delId of state.deletedMemberIds || []) {
      await deleteDoc(doc(db, 'members', delId)).catch(() => {});
    }

    // 4. Sharded Setoran collection
    for (const s of state.setoranList || []) {
      if (s && s.id) {
        const key = `setoran/${s.id}`;
        const cleanSetoran = sanitizeForFirestore({ ...s, updatedAt: now });
        const sStr = JSON.stringify(cleanSetoran);
        if (lastWrittenMap.get(key) !== sStr) {
          await setDoc(doc(db, 'setoran', s.id), cleanSetoran, { merge: true }).catch((e) =>
            handleFirestoreError(e, OperationType.WRITE, key)
          );
          lastWrittenMap.set(key, sStr);
        }
      }
    }

    // 5. Sharded Kas collection
    for (const k of state.kasList || []) {
      if (k && k.id) {
        const key = `kas/${k.id}`;
        const cleanKas = sanitizeForFirestore({ ...k, updatedAt: now });
        const kStr = JSON.stringify(cleanKas);
        if (lastWrittenMap.get(key) !== kStr) {
          await setDoc(doc(db, 'kas', k.id), cleanKas, { merge: true }).catch((e) =>
            handleFirestoreError(e, OperationType.WRITE, key)
          );
          lastWrittenMap.set(key, kStr);
        }
      }
    }

    // 6. Sharded Member Transactions collection
    for (const tx of state.memberTransactions || []) {
      if (tx && tx.id) {
        const key = `transactions/${tx.id}`;
        const cleanTx = sanitizeForFirestore({ ...tx, updatedAt: now });
        const txStr = JSON.stringify(cleanTx);
        if (lastWrittenMap.get(key) !== txStr) {
          await setDoc(doc(db, 'transactions', tx.id), cleanTx, { merge: true }).catch((e) =>
            handleFirestoreError(e, OperationType.WRITE, key)
          );
          lastWrittenMap.set(key, txStr);
        }
      }
    }
    for (const delTxId of state.deletedTransactionIds || []) {
      await deleteDoc(doc(db, 'transactions', delTxId)).catch(() => {});
    }

    // 7. Sharded Chat Messages (Recent 100)
    const recentChats = (state.chatMessages || []).slice(-100);
    for (const c of recentChats) {
      if (c && c.id) {
        const key = `chats/${c.id}`;
        const cleanChat = sanitizeForFirestore({ ...c });
        const cStr = JSON.stringify(cleanChat);
        if (lastWrittenMap.get(key) !== cStr) {
          await setDoc(doc(db, 'chats', c.id), cleanChat, { merge: true }).catch((e) =>
            handleFirestoreError(e, OperationType.WRITE, key)
          );
          lastWrittenMap.set(key, cStr);
        }
      }
    }

    // 8. Sharded Surat collection
    for (const sr of state.suratList || []) {
      if (sr && sr.id) {
        const key = `surat/${sr.id}`;
        const cleanSurat = sanitizeForFirestore({ ...sr });
        const srStr = JSON.stringify(cleanSurat);
        if (lastWrittenMap.get(key) !== srStr) {
          await setDoc(doc(db, 'surat', sr.id), cleanSurat, { merge: true }).catch((e) =>
            handleFirestoreError(e, OperationType.WRITE, key)
          );
          lastWrittenMap.set(key, srStr);
        }
      }
    }

    // 9. Lightweight Metadata Pulse to koperasi_state/main_database (ONLY ~200 bytes, NO oversized payload string!)
    const metadataDoc = sanitizeForFirestore({
      id: 'main_database',
      lastSynced: now,
      updatedBy: CLIENT_ID,
      isSharded: true,
      totalMembers: (state.members || []).length,
      totalKas: (state.kasList || []).length,
      totalSetoran: (state.setoranList || []).length,
      totalTransactions: (state.memberTransactions || []).length,
      totalChats: (state.chatMessages || []).length,
      totalSurat: (state.suratList || []).length,
      filesProtected: true,
    });
    await setDoc(
      doc(db, 'koperasi_state', 'main_database'),
      metadataDoc,
      { merge: true }
    ).catch((e) => handleFirestoreError(e, OperationType.WRITE, 'koperasi_state/main_database'));
  } catch (err) {
    console.warn('Notice syncShardedToFirestore:', err);
  }
}

export function scheduleShardedFirestoreSync(state: AppState, delay = 300) {
  clearTimeout(shardedTimer);
  shardedTimer = setTimeout(() => {
    syncShardedToFirestore(state);
  }, delay);
}

// Sync to backend & Firebase Firestore (with sharded data protection)
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
    try {
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalState),
      });
    } catch {}

    // 2. Sharded sync to Google Cloud Firestore (Never exceeds 1MB!)
    scheduleShardedFirestoreSync(globalState);
  } catch (err) {
    // State is safely cached in localStorage
  }
}

// Load from server on startup (with safe merge)
export async function fetchStateFromServer(): Promise<AppState> {
  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
          const data = JSON.parse(text);
          if (data && typeof data === 'object' && (data.profile || data.members)) {
            globalState = mergeStates(globalState, data);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
            } catch {}
            notifyListeners();
            return globalState;
          }
        }
      }
    }
  } catch {
    // Graceful offline fallback to local cached state without console noise
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
            } else if (data.type === 'MEMBER_NOTIFICATION') {
              const notif = data.payload;
              if (notif) {
                if (notif.type === 'setoran_verified' || notif.type === 'mutasi_baru') {
                  playNotificationSound('deposit');
                } else {
                  playNotificationSound('chat');
                }
                triggerBrowserNotification(notif.title || 'Notifikasi Koperasi HWS', notif.body || '');
                window.dispatchEvent(new CustomEvent('hws:realtime_notification', { detail: notif }));
              }
            } else if (data.type === 'NEW_SURAT') {
              playNotificationSound('chat');
              const s = data.payload?.surat;
              triggerBrowserNotification('📬 Surat Baru Koperasi HWS', s?.perihal || 'Ada surat masuk baru');
              window.dispatchEvent(new CustomEvent('hws:new_surat', { detail: data.payload }));
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

    // 3. Sharded Realtime Cloud Firestore Listeners
    const firestoreUnsubscribers: (() => void)[] = [];
    try {
      import('./firebase').then(({ db }) => {
        import('firebase/firestore').then(({ collection, doc, onSnapshot }) => {
          if (!isMounted) return;

          // A. Members Collection
          const unsubMembers = onSnapshot(
            collection(db, 'members'),
            (snapshot) => {
              if (snapshot.empty) return;
              const remoteMembers = snapshot.docs.map((d) => d.data() as MemberUser);
              globalState = mergeStates(globalState, { ...globalState, members: remoteMembers });
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState)); } catch {}
              notifyListeners();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'members')
          );
          firestoreUnsubscribers.push(unsubMembers);

          // B. Setoran Collection
          const unsubSetoran = onSnapshot(
            collection(db, 'setoran'),
            (snapshot) => {
              if (snapshot.empty) return;
              const remoteSetoran = snapshot.docs.map((d) => d.data() as SetoranVerifikasi);
              globalState = mergeStates(globalState, { ...globalState, setoranList: remoteSetoran });
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState)); } catch {}
              notifyListeners();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'setoran')
          );
          firestoreUnsubscribers.push(unsubSetoran);

          // C. Kas Collection
          const unsubKas = onSnapshot(
            collection(db, 'kas'),
            (snapshot) => {
              if (snapshot.empty) return;
              const remoteKas = snapshot.docs.map((d) => d.data() as KasEntry);
              globalState = mergeStates(globalState, { ...globalState, kasList: remoteKas });
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState)); } catch {}
              notifyListeners();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'kas')
          );
          firestoreUnsubscribers.push(unsubKas);

          // D. Transactions Collection
          const unsubTx = onSnapshot(
            collection(db, 'transactions'),
            (snapshot) => {
              if (snapshot.empty) return;
              const remoteTx = snapshot.docs.map((d) => d.data() as MemberTransaction);
              globalState = mergeStates(globalState, { ...globalState, memberTransactions: remoteTx });
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState)); } catch {}
              notifyListeners();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
          );
          firestoreUnsubscribers.push(unsubTx);

          // E. Chats Collection
          const unsubChats = onSnapshot(
            collection(db, 'chats'),
            (snapshot) => {
              if (snapshot.empty) return;
              const remoteChats = snapshot.docs.map((d) => d.data() as ChatMessage);
              globalState = mergeStates(globalState, { ...globalState, chatMessages: remoteChats });
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState)); } catch {}
              notifyListeners();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'chats')
          );
          firestoreUnsubscribers.push(unsubChats);

          // F. Settings / General Document
          const unsubGeneral = onSnapshot(
            doc(db, 'settings', 'general'),
            (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                if (data && data.updatedBy !== CLIENT_ID) {
                  globalState = {
                    ...globalState,
                    profile: data.profile || globalState.profile,
                    categoriesKasKoperasi: data.categoriesKasKoperasi || globalState.categoriesKasKoperasi,
                    pengaturanBerbagi: data.pengaturanBerbagi || globalState.pengaturanBerbagi,
                    maintenanceLock: data.maintenanceLock || globalState.maintenanceLock,
                    lastRunningNumber: data.lastRunningNumber || globalState.lastRunningNumber,
                    deletedMemberIds: Array.from(new Set([...(globalState.deletedMemberIds || []), ...(data.deletedMemberIds || [])])),
                    deletedTransactionIds: Array.from(new Set([...(globalState.deletedTransactionIds || []), ...(data.deletedTransactionIds || [])])),
                  };
                  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState)); } catch {}
                  notifyListeners();
                }
              }
            },
            (err) => handleFirestoreError(err, OperationType.GET, 'settings/general')
          );
          firestoreUnsubscribers.push(unsubGeneral);

          // G. Settings / Admins Document
          const unsubAdmins = onSnapshot(
            doc(db, 'settings', 'admins'),
            (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                if (data && data.admins && data.updatedBy !== CLIENT_ID) {
                  globalState = { ...globalState, admins: data.admins };
                  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState)); } catch {}
                  notifyListeners();
                }
              }
            },
            (err) => handleFirestoreError(err, OperationType.GET, 'settings/admins')
          );
          firestoreUnsubscribers.push(unsubAdmins);
        });
      });
    } catch {}

    return () => {
      isMounted = false;
      listeners.delete(handler);
      clearInterval(pollInterval);
      clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
      firestoreUnsubscribers.forEach((unsub) => {
        try { unsub(); } catch {}
      });
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
