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
  SedekahBerbagiEntry,
  PendingMutasiActionRequest,
  RedMutasiEntry,
  WilayahKoperasi,
  WILAYAH_CODE_MAP,
  WILAYAH_ABBR_MAP,
} from '../types';
import { getIsInternetConnected } from '../components/NetworkStatusGuard';

const STORAGE_KEY = 'koperasi_hws_local_cache';
const PENDING_OFFLINE_SYNC_KEY = 'koperasi_hws_pending_offline_sync';

function hasPendingOfflineSync(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(PENDING_OFFLINE_SYNC_KEY) === '1';
  } catch {
    return false;
  }
}

function setPendingOfflineSync(flag: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (flag) localStorage.setItem(PENDING_OFFLINE_SYNC_KEY, '1');
    else localStorage.removeItem(PENDING_OFFLINE_SYNC_KEY);
  } catch {}
}

export function isApprovalRole(role?: string): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'admin_approval' || r === 'admin_kelola' || r === 'admin_pembukuan';
}

export function isWriterRole(role?: string): boolean {
  return String(role || '').toLowerCase() === 'admin_write';
}

export function isDirectExecutionRole(role?: string): boolean {
  return String(role || '').toLowerCase() === 'super_admin';
}

export function canApproveByRole(requestedByRole?: string, approverRole?: string): boolean {
  const appRole = String(approverRole || '').toLowerCase();
  const reqRole = String(requestedByRole || 'admin_write').toLowerCase();
  if (appRole === 'super_admin') return true;
  if (isApprovalRole(appRole)) {
    return reqRole === 'admin_write';
  }
  return false;
}

export function getRequiredApproverLabel(requestedByRole?: string): string {
  const reqRole = String(requestedByRole || '').toLowerCase();
  if (isApprovalRole(reqRole)) {
    return 'Super Admin';
  }
  return 'Admin Approval / Super Admin';
}

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
      nama: 'Tezar Basith Hidayat',
      email: 'abzqar@hws.koperasi.id',
      whatsapp: '0816889171',
      nik: '3173012601880003',
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
        atasNama: 'Tezar Basith Hidayat',
      },
      status: 'aktif',
      createdAt: '2026-10-24T08:22:19.659Z',
    },
    {
      id: 'adm-1793187878545',
      username: 'arya3131',
      nama: 'Almaydha Arya Budiman',
      email: 'almahyraarya@gmail.com',
      whatsapp: '089626353299',
      nik: '3173013108011005',
      wilayahKantor: 'Cengkareng',
      role: 'admin_write',
      password: 'Araya3108',
      securityQuestion: 'Siapa nama ibu kandung Anda?',
      securityAnswer: 'siti',
      alamatLengkap: 'Jl. Raya Daan Mogot KM 11',
      rt: '001',
      rw: '001',
      kelurahan: 'Cengkareng Barat',
      kecamatan: 'Cengkareng',
      kota: 'Jakarta Barat',
      provinsi: 'DKI Jakarta',
      kodePos: '11740',
      bankPribadi: {
        namaBank: 'Bank Central Asia (BCA)',
        nomorRekening: '0000000000',
        atasNama: 'Almaydha Arya Budiman',
      },
      status: 'aktif',
      createdAt: '2026-10-27T11:44:30.505Z',
    },
    {
      id: 'adm-1793187953054',
      username: 'ziat',
      nama: 'Munziat',
      email: 'munziat5600@gmail.com',
      whatsapp: '089506667752',
      nik: '3173012512830020',
      wilayahKantor: 'Cengkareng',
      role: 'admin_kelola',
      password: '@bc123123',
      securityQuestion: 'Siapa nama ibu kandung Anda?',
      securityAnswer: 'siti',
      alamatLengkap: 'Jl. Pp kp. Bulakteko',
      rt: '004',
      rw: '011',
      kelurahan: 'Cengkareng Barat',
      kecamatan: 'Cengkareng',
      kota: 'Jakarta Barat',
      provinsi: 'DKI Jakarta',
      kodePos: '11740',
      bankPribadi: {
        namaBank: 'Bank Central Asia (BCA)',
        nomorRekening: '0000000000',
        atasNama: 'Munziat',
      },
      status: 'aktif',
      createdAt: '2026-10-27T11:47:14.876Z',
    },
    {
      id: 'adm-1793187995243',
      username: 'heriADLAP',
      nama: 'Heri Cahyono',
      email: 'hcahyono126@gmail.com',
      whatsapp: '082112553463',
      nik: '3314062205910002',
      wilayahKantor: 'Cengkareng',
      role: 'admin_laporan',
      password: 'heri91',
      securityQuestion: 'Siapa nama ibu kandung Anda?',
      securityAnswer: 'siti',
      alamatLengkap: 'Jl. Raya Daan Mogot KM 11',
      rt: '001',
      rw: '001',
      kelurahan: 'Cengkareng Barat',
      kecamatan: 'Cengkareng',
      kota: 'Jakarta Barat',
      provinsi: 'DKI Jakarta',
      kodePos: '11740',
      bankPribadi: {
        namaBank: 'Bank Central Asia (BCA)',
        nomorRekening: '0000000000',
        atasNama: 'Heri Cahyono',
      },
      status: 'aktif',
      createdAt: '2026-10-27T12:12:28.472Z',
    },
    {
      id: 'adm-1793188052410',
      username: 'fauziadlap',
      nama: 'Fauji Anwar',
      email: 'gantiemail1@gmail.com',
      whatsapp: '081282203086',
      nik: '3173017913760615',
      wilayahKantor: 'Kalideres',
      role: 'admin_kelola',
      password: 'Fauzi45',
      securityQuestion: 'Nama kota kelahiran Anda?',
      securityAnswer: 'jakarta',
      alamatLengkap: 'Jl. Raya Daan Mogot KM 11',
      rt: '001',
      rw: '001',
      kelurahan: 'Kalideres',
      kecamatan: 'Cengkareng',
      kota: 'Jakarta Barat',
      provinsi: 'DKI Jakarta',
      kodePos: '11740',
      bankPribadi: {
        namaBank: 'Bank Central Asia (BCA)',
        nomorRekening: '0000000000',
        atasNama: 'Fauji Anwar',
      },
      status: 'aktif',
      createdAt: '2026-10-28T11:47:32.410Z',
    },
    {
      id: 'adm-1793188102426',
      username: 'budiadlap',
      nama: 'Budiawan',
      email: 'budi.one1905@gmail.com',
      whatsapp: '083892381987',
      nik: '3173011905930005',
      wilayahKantor: 'Cengkareng',
      role: 'admin_laporan',
      password: 'budi93',
      securityQuestion: 'Siapa nama ibu kandung Anda?',
      securityAnswer: 'siti',
      alamatLengkap: 'Jl. Raya Daan Mogot KM 11',
      rt: '001',
      rw: '001',
      kelurahan: 'Cengkareng Barat',
      kecamatan: 'Cengkareng',
      kota: 'Jakarta Barat',
      provinsi: 'DKI Jakarta',
      kodePos: '11740',
      bankPribadi: {
        namaBank: 'Bank Central Asia (BCA)',
        nomorRekening: '0000000000',
        atasNama: 'Budiawan',
      },
      status: 'aktif',
      createdAt: '2026-10-27T12:18:44.739Z',
    },
  ],
  members: [],
  setoranList: [],
  memberTransactions: [],
  kasList: [],
  penyaluranList: [],
  sedekahList: [],
  pendingMutasiRequests: [],
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
      'Biaya Operasional & ATK',
      'Sewa Kantor & Listrik',
      'Honor Pengurus',
    ],
  },
  lastRunningNumber: 769,
  accountNumberSchemaVersion: 2,
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
    bankName: 'Bank Negara Indonesia (BNI)',
    noRekening: '048-963-2761',
    namaPemilikRekening: 'Koperasi Berbagi Mandiri HWS',
    qrisImageUrl: '',
  },
  usedAccountNumbers: [],
  usedMemberNumbers: [],
};

function deterministicMemberHashClient(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function normalizeMemberName(name?: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePhoneIndonesia(phone?: string): string {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62') && digits.length >= 10) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('8') && digits.length >= 8) {
    digits = '0' + digits;
  }
  return digits;
}

export function normalizeNik(nik?: string): string {
  const digits = String(nik || '').replace(/\D/g, '');
  return digits || String(nik || '').trim();
}

export function normalizeBankRek(rek?: string): string {
  return String(rek || '')
    .replace(/[\s.-]+/g, '')
    .toLowerCase()
    .trim();
}

export function isBankRekPlaceholder(rek?: string): boolean {
  const clean = normalizeBankRek(rek);
  return !clean || clean === '-' || /^0+$/.test(clean) || clean.length < 5;
}

export interface BiodataValidationInput {
  nama?: string;
  nik?: string;
  email?: string;
  whatsapp?: string;
  bankPribadi?: {
    namaBank?: string;
    nomorRekening?: string;
    atasNama?: string;
  };
}

export function validateMemberBiodata(
  candidate: BiodataValidationInput,
  members: MemberUser[],
  excludeMemberId?: string
): string | null {
  const cleanName = normalizeMemberName(candidate.nama);
  const cleanNik = normalizeNik(candidate.nik);
  const cleanEmail = String(candidate.email || '').trim().toLowerCase();
  const cleanHp = normalizePhoneIndonesia(candidate.whatsapp);
  const rawRek = String(candidate.bankPribadi?.nomorRekening || '').trim();
  const cleanRek = normalizeBankRek(rawRek);
  const cleanAtasNama = normalizeMemberName(candidate.bankPribadi?.atasNama);

  if (!cleanName || cleanName.length < 2) {
    return 'Nama lengkap wajib diisi.';
  }
  if (!cleanNik || cleanNik.length < 6) {
    return 'NIK wajib diisi dengan benar.';
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return 'Alamat email aktif wajib diisi dengan format yang benar.';
  }
  if (!cleanHp || cleanHp.length < 8) {
    return 'Nomor HP / WhatsApp aktif wajib diisi (minimal 8 digit).';
  }
  if (isBankRekPlaceholder(rawRek)) {
    return 'Nomor rekening bank pribadi wajib diisi (tidak boleh kosong atau tanda "-").';
  }
  if (!cleanAtasNama || cleanAtasNama === '-' || cleanAtasNama.length < 2) {
    return 'Nama pemilik rekening bank pribadi wajib diisi.';
  }

  const others = (members || []).filter((m) => m && m.id !== excludeMemberId);

  const dupName = others.find((m) => normalizeMemberName(m.nama) === cleanName);
  if (dupName) {
    return `Nama anggota "${candidate.nama}" sudah terdaftar (${dupName.nomorRekening || dupName.nomorAnggota}). Nama anggota tidak boleh sama dengan anggota lain.`;
  }

  const dupNik = others.find((m) => m.nik && normalizeNik(m.nik) === cleanNik);
  if (dupNik) {
    return `NIK "${cleanNik}" sudah digunakan oleh anggota lain (${dupNik.nama}).`;
  }

  const dupEmail = others.find((m) => m.email && m.email.trim().toLowerCase() === cleanEmail);
  if (dupEmail) {
    return `Alamat email "${candidate.email}" sudah digunakan oleh anggota lain (${dupEmail.nama}).`;
  }

  const dupHp = others.find((m) => m.whatsapp && normalizePhoneIndonesia(m.whatsapp) === cleanHp);
  if (dupHp) {
    return `Nomor HP / WhatsApp "${candidate.whatsapp}" sudah digunakan oleh anggota lain (${dupHp.nama}).`;
  }

  const dupRek = others.find((m) => {
    const mRek = m.bankPribadi?.nomorRekening;
    return mRek && !isBankRekPlaceholder(mRek) && normalizeBankRek(mRek) === cleanRek;
  });
  if (dupRek) {
    return `Nomor rekening bank "${rawRek}" sudah digunakan oleh anggota lain (${dupRek.nama}).`;
  }

  const dupHolder = others.find((m) => {
    const mHolder = normalizeMemberName(m.bankPribadi?.atasNama);
    return mHolder && mHolder !== '-' && mHolder === cleanAtasNama;
  });
  if (dupHolder) {
    return `Nama pemilik rekening "${candidate.bankPribadi?.atasNama}" sudah digunakan oleh anggota lain (${dupHolder.nama}).`;
  }

  return null;
}

export function isMemberBiodataIncomplete(m?: MemberUser | null): boolean {
  if (!m) return false;
  const cleanName = normalizeMemberName(m.nama);
  const cleanNik = String(m.nik || '').trim();
  const cleanEmail = String(m.email || '').trim();
  const cleanHp = String(m.whatsapp || '').replace(/\D/g, '');
  const cleanRek = String(m.bankPribadi?.nomorRekening || '').trim();
  const cleanHolder = normalizeMemberName(m.bankPribadi?.atasNama);
  return (
    !cleanName ||
    !cleanNik ||
    !cleanEmail ||
    !cleanHp ||
    isBankRekPlaceholder(cleanRek) ||
    !cleanHolder ||
    cleanHolder === '-'
  );
}

export function deduplicateMembersClient(members: MemberUser[], deletedIds: string[] = []): MemberUser[] {
  const deletedSet = new Set<string>(deletedIds || []);
  const cleanList = (Array.isArray(members) ? members : []).filter(
    (m) => m && m.id && !deletedSet.has(m.id)
  );

  const biodataScore = (m: any) => {
    let s = 0;
    if (m.nik && String(m.nik).trim()) s += 2;
    if (m.whatsapp && String(m.whatsapp).replace(/\D/g, '').length >= 8) s += 2;
    if (m.email && String(m.email).trim()) s += 2;
    if (m.bankPribadi?.nomorRekening && !isBankRekPlaceholder(m.bankPribadi.nomorRekening)) s += 2;
    if (isValidUnifiedAccountV2Client(m.nomorRekening)) s += 2;
    else if (/^115\d{9}$/.test(String(m.nomorAnggota || ''))) s += 1;
    return s;
  };

  cleanList.sort((a, b) => {
    const aDup = String(a.id).includes('-dup-') ? 1 : 0;
    const bDup = String(b.id).includes('-dup-') ? 1 : 0;
    if (aDup !== bDup) return aDup - bDup;
    const aPh = (a as any).isRestoredPlaceholder ? 1 : 0;
    const bPh = (b as any).isRestoredPlaceholder ? 1 : 0;
    if (aPh !== bPh) return aPh - bPh;
    const balDiff = (Number(b.totalSimpanan) || 0) - (Number(a.totalSimpanan) || 0);
    if (balDiff !== 0) return balDiff;
    return biodataScore(b) - biodataScore(a);
  });

  const result: MemberUser[] = [];
  const byId = new Map<string, MemberUser>();

  for (const raw of cleanList) {
    const m: any = { ...raw };
    delete m.biometricActive;
    const isDupId = String(m.id).includes('-dup-');
    const cleanName = normalizeMemberName(m.nama);
    const cleanHp = String(m.whatsapp || '').replace(/\D/g, '');
    const cleanEmail = String(m.email || '').toLowerCase().trim();
    const cleanNik = String(m.nik || '').trim();

    let match = byId.get(m.id);
    if (!match && cleanName) {
      // Hapus semua duplikasi data anggota apabila memiliki nama yang sama (case-insensitive)
      match = result.find((existing) => normalizeMemberName(existing.nama) === cleanName);
    }

    if (match) {
      if (!match.nik && cleanNik) match.nik = cleanNik;
      if (!match.whatsapp && m.whatsapp) match.whatsapp = m.whatsapp;
      if (!match.email && m.email) match.email = m.email;
      if (!match.password && m.password) match.password = m.password;
      if (!match.pinTransaksi && m.pinTransaksi) match.pinTransaksi = m.pinTransaksi;
      if (!match.alamatLengkap && m.alamatLengkap) match.alamatLengkap = m.alamatLengkap;
      if (!match.ktpPhotoUrl && m.ktpPhotoUrl) match.ktpPhotoUrl = m.ktpPhotoUrl;
      if (!match.avatarUrl && m.avatarUrl) match.avatarUrl = m.avatarUrl;
      if (isBankRekPlaceholder(match.bankPribadi?.nomorRekening) && !isBankRekPlaceholder(m.bankPribadi?.nomorRekening)) {
        match.bankPribadi = {
          namaBank: m.bankPribadi?.namaBank || match.bankPribadi?.namaBank || 'Bank Central Asia (BCA)',
          nomorRekening: m.bankPribadi.nomorRekening,
          atasNama: m.bankPribadi?.atasNama || match.bankPribadi?.atasNama || match.nama,
        };
      }
      if ((match as any).isRestoredPlaceholder && match.nik && match.whatsapp) {
        (match as any).isRestoredPlaceholder = false;
      }
      continue;
    }

    if (isDupId) {
      const baseSlug = cleanName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'ang';
      const stableId = `mem-${baseSlug}-${deterministicMemberHashClient(`${cleanName}|${cleanHp}|${cleanEmail}`)}`;
      if (deletedSet.has(stableId)) continue;
      m.id = stableId;
    }

    byId.set(m.id, m);
    result.push(m);
  }

  return sortMembersDesc(result);
}

export function isValidUnifiedAccountV2Client(no?: string): boolean {
  const clean = String(no || '').trim();
  if (!/^(7[2-9])\d{6}(\d{3,})$/.test(clean)) return false;
  const dd = parseInt(clean.slice(2, 4), 10);
  if (dd < 1 || dd > 31) return false;
  const seqStr = clean.slice(8);
  const seq = parseInt(seqStr, 10);
  return Number.isFinite(seq) && seq >= 770 && String(seq) === seqStr;
}

export function extractUnifiedSeqClient(no?: string): number | null {
  const clean = String(no || '').trim();
  if (isValidUnifiedAccountV2Client(clean)) {
    return parseInt(clean.slice(8), 10);
  }
  return null;
}

export function extractMemberSuffixSeqClient(nomorAnggota?: string): number | null {
  const clean = String(nomorAnggota || '').trim();
  const v2Seq = extractUnifiedSeqClient(clean);
  if (v2Seq !== null) return v2Seq;
  if (/^115\d{9,}$/.test(clean)) {
    const seq = parseInt(clean.slice(9), 10);
    return Number.isFinite(seq) && seq > 0 ? seq : null;
  }
  return null;
}

export function sanitizeUsedUnifiedNumbersClient(usedList: any[], members: MemberUser[] = []): string[] {
  const result = new Set<string>();
  (members || []).forEach((m: any) => {
    const r = String(m?.nomorRekening || '').trim();
    const a = String(m?.nomorAnggota || '').trim();
    if (isValidUnifiedAccountV2Client(r)) result.add(r);
    if (isValidUnifiedAccountV2Client(a)) result.add(a);
  });
  (Array.isArray(usedList) ? usedList : []).forEach((item: any) => {
    const n = String(item || '').trim();
    if (isValidUnifiedAccountV2Client(n)) {
      result.add(n);
    }
  });
  return Array.from(result);
}

export function sanitizeUsedMemberNumbersClient(usedList: any[], members: MemberUser[] = []): string[] {
  return sanitizeUsedUnifiedNumbersClient(usedList, members);
}

function getDatePartsDdYyClient(dateStr?: string): { dd: string; yy: string } {
  const raw = String(dateStr || '').trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      dd: isoMatch[3],
      yy: isoMatch[1].slice(-2),
    };
  }
  try {
    const d = raw ? new Date(raw) : new Date();
    const valid = isNaN(d.getTime()) ? new Date() : d;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      day: '2-digit',
    }).formatToParts(valid);
    const dd = parts.find((p) => p.type === 'day')?.value || String(valid.getDate()).padStart(2, '0');
    const yyyy = parts.find((p) => p.type === 'year')?.value || String(valid.getFullYear());
    return { dd: dd.padStart(2, '0'), yy: yyyy.slice(-2) };
  } catch {
    const now = new Date();
    return {
      dd: String(now.getDate()).padStart(2, '0'),
      yy: String(now.getFullYear()).slice(-2),
    };
  }
}

function resolveDuplicateMemberSuffixesClient(
  members: MemberUser[],
  usedNumbers: string[] = [],
  schemaVersion?: number
): MemberUser[] {
  if (!Array.isArray(members) || members.length === 0) return members;

  // Case A: Initial clean migration from legacy numbering (no member on V2 yet)
  const noMemberOnV2Yet =
    schemaVersion !== 2 &&
    members.every((m) => !isValidUnifiedAccountV2Client(m?.nomorRekening));

  if (noMemberOnV2Yet) {
    const getLegacyScore = (m: any) => {
      const no = String(m?.nomorAnggota || m?.legacyNomorAnggota || '').trim();
      if (/^115\d{9,}$/.test(no)) {
        const seq = parseInt(no.slice(9), 10);
        if (Number.isFinite(seq) && seq > 0) return seq;
      }
      const idTs = String(m?.id || '').match(/(\d{10,})/);
      if (idTs) return 1_000_000_000_000 + Number(idTs[1]);
      if (m?.createdAt) return 1_000_000_000_000 + new Date(m.createdAt).getTime();
      if (m?.terdaftarSejak) return 1_000_000_000_000 + new Date(m.terdaftarSejak).getTime();
      return Number.MAX_SAFE_INTEGER;
    };

    let seq = 769;
    const chronological = [...members].sort((a, b) => getLegacyScore(a) - getLegacyScore(b));
    const migrated = chronological.map((m) => {
      seq++;
      const kw = WILAYAH_CODE_MAP[m.wilayah] || '77';
      const { dd, yy } = getDatePartsDdYyClient(m.terdaftarSejak);
      const cleanHp = String(m.whatsapp || '').replace(/\D/g, '');
      const hp2 = cleanHp.slice(-2).padStart(2, '0');
      const unifiedNo = `${kw}${dd}${hp2}${yy}${seq}`;
      const prevNo = String(m.nomorAnggota || '').trim();
      const legacyNo =
        (m as any).legacyNomorAnggota ||
        (prevNo && !isValidUnifiedAccountV2Client(prevNo) ? prevNo : undefined);
      return {
        ...m,
        ...(legacyNo ? { legacyNomorAnggota: legacyNo } : {}),
        nomorRekening: unifiedNo,
        nomorAnggota: unifiedNo,
      } as MemberUser;
    });
    return sortMembersDesc(migrated);
  }

  // Case B: Schema V2 Active -> Sanitize used lists & auto-correct duplicates, retired reuse, or mismatches
  const activeV2Set = new Set<string>(
    members
      .map((m) => String(m?.nomorRekening || '').trim())
      .filter((r) => isValidUnifiedAccountV2Client(r))
  );
  const sanitizedUsed = sanitizeUsedUnifiedNumbersClient(usedNumbers, members);
  const retiredNos = new Set<string>();
  const retiredSeqs = new Set<number>();
  sanitizedUsed.forEach((n) => {
    if (!activeV2Set.has(n)) {
      retiredNos.add(n);
      const sq = extractUnifiedSeqClient(n);
      if (sq !== null) retiredSeqs.add(sq);
    }
  });

  const getScore = (m: any) => {
    const v2Seq = extractUnifiedSeqClient(m?.nomorRekening);
    if (v2Seq !== null) return v2Seq;
    const idTs = String(m.id || '').match(/(\d{10,})/);
    if (idTs) return 1_000_000_000_000 + Number(idTs[1]);
    if (m.createdAt) return 1_000_000_000_000 + new Date(m.createdAt).getTime();
    if (m.terdaftarSejak) return 1_000_000_000_000 + new Date(m.terdaftarSejak).getTime();
    return Number.MAX_SAFE_INTEGER;
  };

  const chronological = [...members].sort((a, b) => getScore(a) - getScore(b));
  const assignedNos = new Set<string>();
  const assignedSeqs = new Set<number>();
  const needsNew = new Set<string>();

  for (const m of chronological) {
    const rek = String(m?.nomorRekening || '').trim();
    const seq = extractUnifiedSeqClient(rek);
    if (
      isValidUnifiedAccountV2Client(rek) &&
      seq !== null &&
      !assignedNos.has(rek) &&
      !assignedSeqs.has(seq) &&
      !retiredNos.has(rek) &&
      !retiredSeqs.has(seq)
    ) {
      assignedNos.add(rek);
      assignedSeqs.add(seq);
    } else {
      needsNew.add(m.id);
    }
  }

  const usedNoSet = new Set<string>([...sanitizedUsed, ...assignedNos]);
  const usedSeqSet = new Set<number>([...assignedSeqs, ...retiredSeqs]);
  sanitizedUsed.forEach((n) => {
    const sq = extractUnifiedSeqClient(n);
    if (sq !== null) usedSeqSet.add(sq);
  });

  let maxSeq = 769;
  usedSeqSet.forEach((s) => {
    if (s > maxSeq) maxSeq = s;
  });

  const updated = chronological.map((m) => {
    const rek = String(m.nomorRekening || '').trim();
    if (!needsNew.has(m.id)) {
      if (m.nomorAnggota === rek) return m;
      const prevNo = String(m.nomorAnggota || '').trim();
      const legacyNo =
        (m as any).legacyNomorAnggota ||
        (prevNo && !isValidUnifiedAccountV2Client(prevNo) ? prevNo : undefined);
      return {
        ...m,
        ...(legacyNo ? { legacyNomorAnggota: legacyNo } : {}),
        nomorAnggota: rek,
      } as MemberUser;
    }

    const { dd, yy } = getDatePartsDdYyClient(m.terdaftarSejak);
    const kw = WILAYAH_CODE_MAP[m.wilayah] || '77';
    const cleanHp = String(m.whatsapp || '').replace(/\D/g, '');
    const hp2 = cleanHp.slice(-2).padStart(2, '0');

    let seq = Math.max(maxSeq + 1, 770);
    let candidate = `${kw}${dd}${hp2}${yy}${seq}`;
    while (usedNoSet.has(candidate) || usedSeqSet.has(seq)) {
      seq++;
      candidate = `${kw}${dd}${hp2}${yy}${seq}`;
    }

    maxSeq = Math.max(maxSeq, seq);
    usedNoSet.add(candidate);
    usedSeqSet.add(seq);
    const prevNo = String(m.nomorAnggota || '').trim();
    const legacyNo =
      (m as any).legacyNomorAnggota ||
      (prevNo && !isValidUnifiedAccountV2Client(prevNo) ? prevNo : undefined) ||
      (rek && !isValidUnifiedAccountV2Client(rek) ? rek : undefined);
    return {
      ...m,
      ...(legacyNo ? { legacyNomorAnggota: legacyNo } : {}),
      nomorRekening: candidate,
      nomorAnggota: candidate,
    } as MemberUser;
  });

  return sortMembersDesc(updated);
}

export function getMemberSeqNum(nomorOrRek?: string): number {
  const clean = String(nomorOrRek || '').trim();
  const v2Seq = extractUnifiedSeqClient(clean);
  if (v2Seq !== null) return v2Seq;
  if (/^115\d{9,}$/.test(clean)) return parseInt(clean.slice(9), 10) || 0;
  const match = clean.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) || 0 : 0;
}

export function getMemberRegistrationTimeInfo(
  m: { terdaftarSejak?: string; createdAt?: string; id?: string } | null | undefined
): { dayMs: number; tsMs: number } {
  const rawDate = String(m?.terdaftarSejak || '').trim();
  const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmyMatch = rawDate.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  let dayMs = 0;
  if (isoMatch) {
    dayMs = Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  } else if (dmyMatch) {
    dayMs = Date.UTC(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
  } else if (rawDate) {
    const parsedRaw = new Date(rawDate);
    if (!isNaN(parsedRaw.getTime())) {
      dayMs = Date.UTC(parsedRaw.getUTCFullYear(), parsedRaw.getUTCMonth(), parsedRaw.getUTCDate());
    }
  }
  let tsMs = 0;
  if (m?.createdAt) {
    const parsed = new Date(m.createdAt).getTime();
    if (Number.isFinite(parsed) && parsed > 0) tsMs = parsed;
  }
  if (!tsMs && m?.id) {
    const idMatch = String(m.id).match(/(\d{12,15})/);
    if (idMatch) tsMs = Number(idMatch[1]);
  }
  if (!dayMs && tsMs > 0) {
    const d = new Date(tsMs);
    dayMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return { dayMs, tsMs };
}

export function sortMembersDesc<
  T extends { terdaftarSejak?: string; createdAt?: string; nomorRekening?: string; nomorAnggota?: string; id?: string }
>(members: T[]): T[] {
  return [...(Array.isArray(members) ? members : [])].sort((a, b) => {
    const ra = getMemberRegistrationTimeInfo(a);
    const rb = getMemberRegistrationTimeInfo(b);
    if (rb.dayMs !== ra.dayMs) return rb.dayMs - ra.dayMs;
    if (rb.tsMs !== ra.tsMs) return rb.tsMs - ra.tsMs;
    const aKey = a?.nomorRekening || a?.nomorAnggota;
    const bKey = b?.nomorRekening || b?.nomorAnggota;
    const seqDiff = getMemberSeqNum(bKey) - getMemberSeqNum(aKey);
    if (seqDiff !== 0) return seqDiff;
    const noDiff = String(bKey || '').localeCompare(String(aKey || ''));
    if (noDiff !== 0) return noDiff;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });
}

let globalState: AppState = (() => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.members)) {
        const deduped = deduplicateMembersClient(parsed.members, parsed.deletedMemberIds || []);
        const sanitizedUsed = sanitizeUsedUnifiedNumbersClient(
          [...(parsed.usedAccountNumbers || []), ...(parsed.usedMemberNumbers || [])],
          deduped
        );
        parsed.members = resolveDuplicateMemberSuffixesClient(
          deduped,
          sanitizedUsed,
          parsed.accountNumberSchemaVersion
        );
        const finalUsed = sanitizeUsedUnifiedNumbersClient(sanitizedUsed, parsed.members);
        let maxSeq = 769;
        finalUsed.forEach((n) => {
          const sq = extractUnifiedSeqClient(n);
          if (sq !== null && sq > maxSeq) maxSeq = sq;
        });
        parsed.usedAccountNumbers = finalUsed;
        parsed.usedMemberNumbers = finalUsed;
        parsed.accountNumberSchemaVersion = 2;
        parsed.lastRunningNumber = maxSeq;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch {}
      }
      return parsed;
    }
  } catch {}
  return defaultInitialState;
})();

const listeners = new Set<(state: AppState) => void>();
let debounceNotifyTimer: any = null;
let serverPushTimer: any = null;

function scheduleDebouncedServerPush(delay = 1500) {
  if (typeof window === 'undefined') return;
  if (serverPushTimer) clearTimeout(serverPushTimer);
  serverPushTimer = setTimeout(() => {
    try {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalState),
      }).catch(() => {});
    } catch {}
  }, delay);
}

export function maxIsoTsClient(a?: string, b?: string): string {
  const ta = a ? new Date(a).getTime() : NaN;
  const tb = b ? new Date(b).getTime() : NaN;
  if (!Number.isFinite(ta) || isNaN(ta)) return b || '';
  if (!Number.isFinite(tb) || isNaN(tb)) return a || '';
  return ta >= tb ? (a as string) : (b as string);
}

export function isChatMessageClearedClient(
  msg: Partial<ChatMessage> | null | undefined,
  delChatSet: Set<string>,
  chatClearedAt?: string,
  chatClearedByMember?: Record<string, string>
): boolean {
  if (!msg || !msg.id || delChatSet.has(msg.id)) return true;
  const msgTs = msg.timestamp ? new Date(msg.timestamp).getTime() : NaN;
  if (chatClearedAt && Number.isFinite(msgTs)) {
    const clearTs = new Date(chatClearedAt).getTime();
    if (Number.isFinite(clearTs) && msgTs <= clearTs) return true;
  }
  const memClear = msg.memberId ? chatClearedByMember?.[msg.memberId] : '';
  if (memClear && Number.isFinite(msgTs)) {
    const mTs = new Date(memClear).getTime();
    if (Number.isFinite(mTs) && msgTs <= mTs) return true;
  }
  return false;
}

export function isSuratDeletedClient(
  s: Partial<SuratResmi> | null | undefined,
  delSuratSet: Set<string>,
  suratResetAt?: string
): boolean {
  if (!s || !s.id || delSuratSet.has(s.id)) return true;
  if (suratResetAt && s.createdAt) {
    const sTs = new Date(s.createdAt).getTime();
    const rTs = new Date(suratResetAt).getTime();
    if (Number.isFinite(sTs) && Number.isFinite(rTs) && sTs <= rTs) return true;
  }
  return false;
}

let storagePersistTimer: any = null;
function scheduleLocalStoragePersist() {
  if (typeof window === 'undefined') return;
  if (storagePersistTimer) clearTimeout(storagePersistTimer);
  storagePersistTimer = setTimeout(() => {
    storagePersistTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
    } catch {}
  }, 150);
}

function flushLocalStoragePersist() {
  if (typeof window === 'undefined') return;
  if (storagePersistTimer) {
    clearTimeout(storagePersistTimer);
    storagePersistTimer = null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
  } catch {}
}

let lastServerStateDigest = '';
let inFlightServerFetch: Promise<AppState> | null = null;
let activeFetchAbortController: AbortController | null = null;

function abortInFlightServerFetch() {
  if (activeFetchAbortController) {
    try {
      activeFetchAbortController.abort();
    } catch {}
    activeFetchAbortController = null;
  }
  inFlightServerFetch = null;
}

function notifyListeners() {
  if (debounceNotifyTimer) {
    clearTimeout(debounceNotifyTimer);
    debounceNotifyTimer = null;
  }
  for (const listener of listeners) {
    listener({ ...globalState });
  }
}

export function commitLocalStatePatch(updater: (prev: AppState) => AppState): AppState {
  hasHydratedRemoteState = true;
  globalState = updater(globalState);
  lastServerStateDigest = '';
  scheduleLocalStoragePersist();
  notifyListeners();
  return globalState;
}

// Apply authoritative server state returned by dedicated mutation endpoints (/api/kas/delete, /api/kas/approve, /api/setoran/verify, etc.)
// without re-merging stale deleted items or bouncing a redundant POST /api/state
export function applyAuthoritativeServerState(serverState: AppState, syncToFirestore = true): AppState {
  if (!serverState || typeof serverState !== 'object') return globalState;
  hasHydratedRemoteState = true;
  const reconciled = reconcileBalancesWithDeposits({
    ...serverState,
    deletedMemberIds: Array.from(new Set([...(globalState.deletedMemberIds || []), ...(serverState.deletedMemberIds || [])])),
    deletedAdminIds: Array.from(new Set([...(globalState.deletedAdminIds || []), ...(serverState.deletedAdminIds || [])])),
    deletedKasIds: Array.from(new Set([...(globalState.deletedKasIds || []), ...(serverState.deletedKasIds || [])])),
    deletedTransactionIds: Array.from(new Set([...(globalState.deletedTransactionIds || []), ...(serverState.deletedTransactionIds || [])])),
    deletedSetoranIds: Array.from(new Set([...(globalState.deletedSetoranIds || []), ...(serverState.deletedSetoranIds || [])])),
    deletedSuratIds: Array.from(new Set([...(globalState.deletedSuratIds || []), ...(serverState.deletedSuratIds || [])])),
    deletedChatIds: Array.from(new Set([...(globalState.deletedChatIds || []), ...(serverState.deletedChatIds || [])])),
  });
  globalState = reconciled;
  lastServerStateDigest = '';
  scheduleLocalStoragePersist();
  notifyListeners();
  if (syncToFirestore && getIsInternetConnected()) {
    scheduleShardedFirestoreSync(globalState, 50);
  }
  return globalState;
}

export function scheduleDebouncedNotify(delay = 120, pushToServer = false) {
  if (debounceNotifyTimer) {
    clearTimeout(debounceNotifyTimer);
  }
  debounceNotifyTimer = setTimeout(() => {
    debounceNotifyTimer = null;
    scheduleLocalStoragePersist();
    for (const listener of listeners) {
      listener({ ...globalState });
    }
    if (pushToServer) {
      scheduleDebouncedServerPush(1500);
    }
  }, delay);
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

const activeBrowserNotifications = new Map<string, Notification>();

export function dismissBrowserNotification(tag: string) {
  if (typeof window === 'undefined' || !tag) return;
  try {
    const existing = activeBrowserNotifications.get(tag);
    if (existing) {
      existing.close();
      activeBrowserNotifications.delete(tag);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          if (typeof reg.getNotifications === 'function') {
            return reg.getNotifications({ tag }).then((list) => {
              list.forEach((n) => n.close());
            });
          }
        })
        .catch(() => {});
    }
  } catch {}
}

export function triggerBrowserNotification(
  title: string,
  body: string,
  onClick?: () => void,
  tag?: string
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      const notifTag = tag || `hws-${Date.now()}`;
      if (tag) {
        dismissBrowserNotification(tag);
      }
      const notif = new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: notifTag,
      });
      activeBrowserNotifications.set(notifTag, notif);
      notif.onclose = () => {
        if (activeBrowserNotifications.get(notifTag) === notif) {
          activeBrowserNotifications.delete(notifTag);
        }
      };
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

  const allDeletedMemIds = new Set<string>([
    ...(base.deletedMemberIds || []),
    ...(incoming.deletedMemberIds || []),
  ]);

  // 1. Members: UNION without generating duplicate names or -dup- clones!
  const memberMap = new Map<string, MemberUser>();
  const findMemberByIdentity = (m: MemberUser): MemberUser | undefined => {
    const cleanName = normalizeMemberName(m.nama);
    if (!cleanName) return undefined;
    for (const existing of memberMap.values()) {
      if (normalizeMemberName(existing.nama) === cleanName) {
        return existing;
      }
    }
    return undefined;
  };

  deduplicateMembersClient(base.members || [], Array.from(allDeletedMemIds)).forEach((m) => {
    if (m && m.id) memberMap.set(m.id, { ...m });
  });

  (incoming.members || []).forEach((m) => {
    if (!m || !m.id || allDeletedMemIds.has(m.id)) return;
    const isIncomingDup = String(m.id).includes('-dup-');

    const bySameId = memberMap.get(m.id);
    const byIdNik = normalizeNik(bySameId?.nik);
    const mNik = normalizeNik(m.nik);
    const byIdRek = String(bySameId?.nomorRekening || bySameId?.nomorAnggota || '').trim();
    const mRek = String(m.nomorRekening || m.nomorAnggota || '').trim();
    const isSamePersonOnId =
      bySameId &&
      (normalizeMemberName(bySameId.nama) === normalizeMemberName(m.nama) ||
        (bySameId.whatsapp &&
          m.whatsapp &&
          bySameId.whatsapp.replace(/\D/g, '') === m.whatsapp.replace(/\D/g, '')) ||
        (byIdNik.length >= 6 && mNik.length >= 6 && byIdNik === mNik) ||
        (byIdRek && mRek && byIdRek === mRek));

    if (bySameId && isSamePersonOnId) {
      const mHasV2 = isValidUnifiedAccountV2Client(m.nomorRekening);
      const bHasV2 = isValidUnifiedAccountV2Client(bySameId.nomorRekening);
      // Selalu pertahankan No. Rekening V2 awal dari anggota yang sudah terdaftar meskipun wilayah/biodata diubah
      const resolvedNo = bHasV2
        ? String(bySameId.nomorRekening).trim()
        : mHasV2
        ? String(m.nomorRekening).trim()
        : String(bySameId.nomorRekening || m.nomorRekening || '').trim();
      const resolvedLegacy =
        (bySameId as any).legacyNomorAnggota ||
        (m as any).legacyNomorAnggota ||
        (!isValidUnifiedAccountV2Client(bySameId.nomorAnggota) ? bySameId.nomorAnggota : undefined);

      const baseTs = bySameId.updatedAt ? new Date(bySameId.updatedAt).getTime() : 0;
      const incomingTs = m.updatedAt ? new Date(m.updatedAt).getTime() : 0;
      const keepBaseNewerBiodata =
        Number.isFinite(baseTs) &&
        Number.isFinite(incomingTs) &&
        baseTs > 0 &&
        incomingTs > 0 &&
        baseTs > incomingTs;

      const primary = keepBaseNewerBiodata ? bySameId : m;
      const secondary = keepBaseNewerBiodata ? m : bySameId;

      memberMap.set(m.id, {
        ...secondary,
        ...primary,
        id: bySameId.id,
        ...(resolvedLegacy ? { legacyNomorAnggota: resolvedLegacy } : {}),
        nomorRekening: resolvedNo,
        nomorAnggota: resolvedNo || primary.nomorAnggota || secondary.nomorAnggota,
        nama: primary.nama && primary.nama.trim() ? primary.nama : secondary.nama,
        wilayah: primary.wilayah || secondary.wilayah,
        nik: primary.nik || secondary.nik || '',
        whatsapp: primary.whatsapp || secondary.whatsapp || '',
        email: primary.email || secondary.email || '',
        password: primary.password || secondary.password || '',
        pinTransaksi: primary.pinTransaksi || secondary.pinTransaksi || '',
        alamatLengkap: primary.alamatLengkap || secondary.alamatLengkap || '',
        ktpPhotoUrl: primary.ktpPhotoUrl || secondary.ktpPhotoUrl,
        avatarUrl: primary.avatarUrl || secondary.avatarUrl,
        bankPribadi: {
          namaBank: primary.bankPribadi?.namaBank || secondary.bankPribadi?.namaBank || 'Bank Central Asia (BCA)',
          nomorRekening:
            !isBankRekPlaceholder(primary.bankPribadi?.nomorRekening)
              ? primary.bankPribadi!.nomorRekening
              : secondary.bankPribadi?.nomorRekening || '-',
          atasNama:
            primary.bankPribadi?.atasNama && primary.bankPribadi.atasNama.trim() && primary.bankPribadi.atasNama.trim() !== '-'
              ? primary.bankPribadi.atasNama
              : secondary.bankPribadi?.atasNama || secondary.nama,
        },
      });
      return;
    }

    const identityMatch = findMemberByIdentity(m);
    if (identityMatch) {
      const mHasV2 = isValidUnifiedAccountV2Client(m.nomorRekening);
      const eHasV2 = isValidUnifiedAccountV2Client(identityMatch.nomorRekening);
      const resolvedNo = mHasV2 && !eHasV2
        ? String(m.nomorRekening).trim()
        : eHasV2
        ? String(identityMatch.nomorRekening).trim()
        : String(identityMatch.nomorRekening || m.nomorRekening || '').trim();
      const resolvedLegacy =
        (identityMatch as any).legacyNomorAnggota ||
        (m as any).legacyNomorAnggota ||
        (!isValidUnifiedAccountV2Client(identityMatch.nomorAnggota) ? identityMatch.nomorAnggota : undefined);

      memberMap.set(identityMatch.id, {
        ...identityMatch,
        ...(resolvedLegacy ? { legacyNomorAnggota: resolvedLegacy } : {}),
        nomorRekening: resolvedNo,
        nomorAnggota: resolvedNo || identityMatch.nomorAnggota,
        nik: identityMatch.nik || m.nik || '',
        whatsapp: identityMatch.whatsapp || m.whatsapp || '',
        email: identityMatch.email || m.email || '',
        password: identityMatch.password || m.password || '',
        pinTransaksi: identityMatch.pinTransaksi || m.pinTransaksi || '',
        alamatLengkap: identityMatch.alamatLengkap || m.alamatLengkap || '',
        ktpPhotoUrl: identityMatch.ktpPhotoUrl || m.ktpPhotoUrl,
        avatarUrl: identityMatch.avatarUrl || m.avatarUrl,
      });
      return;
    }

    if (isIncomingDup) return;

    if (!bySameId) {
      memberMap.set(m.id, { ...m });
    } else {
      const cleanName = String(m.nama || '').toLowerCase().trim();
      const cleanHp = String(m.whatsapp || '').replace(/\D/g, '');
      const cleanEmail = String(m.email || '').toLowerCase().trim();
      const baseSlug = cleanName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'alt';
      const deterministicId = `mem-${baseSlug}-${deterministicMemberHashClient(`${cleanName}|${cleanHp}|${cleanEmail}`)}`;
      if (!allDeletedMemIds.has(deterministicId) && !memberMap.has(deterministicId)) {
        memberMap.set(deterministicId, { ...m, id: deterministicId });
      }
    }
  });

  const dedupedMembers = deduplicateMembersClient(
    Array.from(memberMap.values()),
    Array.from(allDeletedMemIds)
  );
  const isSchemaV2 =
    base.accountNumberSchemaVersion === 2 ||
    incoming.accountNumberSchemaVersion === 2 ||
    dedupedMembers.some((m) => isValidUnifiedAccountV2Client(m?.nomorRekening));
  const sanitizedUsedUnifiedBefore = sanitizeUsedUnifiedNumbersClient(
    [
      ...(base.usedAccountNumbers || []),
      ...(incoming.usedAccountNumbers || []),
      ...(base.usedMemberNumbers || []),
      ...(incoming.usedMemberNumbers || []),
      ...dedupedMembers.map((m) => m?.nomorRekening).filter(Boolean),
    ],
    dedupedMembers
  );
  const mergedMembers = resolveDuplicateMemberSuffixesClient(
    dedupedMembers,
    sanitizedUsedUnifiedBefore,
    isSchemaV2 ? 2 : (base.accountNumberSchemaVersion || incoming.accountNumberSchemaVersion)
  );
  const finalSanitizedUsed = sanitizeUsedUnifiedNumbersClient(sanitizedUsedUnifiedBefore, mergedMembers);

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

  // 3. Chat Messages (Filter deletedChatIds + clear cutoffs so cleared chats never resurrect)
  const allDeletedChatIds = new Set<string>([
    ...(base.deletedChatIds || []),
    ...(incoming.deletedChatIds || []),
  ]);
  const mergedChatClearedAt = maxIsoTsClient(base.chatClearedAt, incoming.chatClearedAt);
  const mergedChatClearedByMember: Record<string, string> = {
    ...(base.chatClearedBeforeByMember || {}),
  };
  Object.entries(incoming.chatClearedBeforeByMember || {}).forEach(([mid, ts]) => {
    mergedChatClearedByMember[mid] = maxIsoTsClient(mergedChatClearedByMember[mid], String(ts || ''));
  });

  const chatMap = new Map<string, ChatMessage>();
  (base.chatMessages || []).forEach((c) => {
    if (!isChatMessageClearedClient(c, allDeletedChatIds, mergedChatClearedAt, mergedChatClearedByMember)) {
      chatMap.set(c.id, { ...c });
    }
  });
  (incoming.chatMessages || []).forEach((c) => {
    if (isChatMessageClearedClient(c, allDeletedChatIds, mergedChatClearedAt, mergedChatClearedByMember)) {
      return;
    }
    const existing = chatMap.get(c.id);
    if (!existing) {
      chatMap.set(c.id, c);
    } else {
      chatMap.set(c.id, {
        ...existing,
        ...c,
        lampiranUrl: c.lampiranUrl || existing.lampiranUrl,
        isReadByAdmin: Boolean(existing.isReadByAdmin || c.isReadByAdmin),
        isReadByMember: Boolean(existing.isReadByMember || c.isReadByMember),
      });
    }
  });

  // 4. Surat Resmi List (Filter deletedSuratIds + suratResetAt)
  const allDeletedSuratIds = new Set<string>([
    ...(base.deletedSuratIds || []),
    ...(incoming.deletedSuratIds || []),
  ]);
  const mergedSuratResetAt = maxIsoTsClient(base.suratResetAt, incoming.suratResetAt);

  const suratMap = new Map<string, SuratResmi>();
  (base.suratList || []).forEach((s) => {
    if (!isSuratDeletedClient(s, allDeletedSuratIds, mergedSuratResetAt)) {
      suratMap.set(s.id, { ...s });
    }
  });
  (incoming.suratList || []).forEach((s) => {
    if (isSuratDeletedClient(s, allDeletedSuratIds, mergedSuratResetAt)) {
      return;
    }
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

  // 5. Member Transactions (Mutasi Rekening): UNION base + incoming filtered out by deletedTransactionIds so neither platform loses records
  const allDeletedTxIds = new Set<string>([
    ...(base.deletedTransactionIds || []),
    ...(incoming.deletedTransactionIds || []),
  ]);

  const txMap = new Map<string, MemberTransaction>();
  (base.memberTransactions || []).forEach((tx) => {
    if (tx && tx.id && !allDeletedTxIds.has(tx.id)) {
      txMap.set(tx.id, tx);
    }
  });
  (incoming.memberTransactions || []).forEach((tx) => {
    if (tx && tx.id && !allDeletedTxIds.has(tx.id)) {
      const existing = txMap.get(tx.id);
      if (existing && existing.splitOverride && !tx.splitOverride) {
        return;
      }
      txMap.set(tx.id, tx);
    }
  });
  const mergedTxList = Array.from(txMap.values());

  // 6. Kas List: UNION base + incoming filtered out by deletedKasIds so deletions persist across all devices & snapshots (Req 5).
  const allDeletedKasIds = new Set<string>([
    ...(base.deletedKasIds || []),
    ...(incoming.deletedKasIds || []),
  ]);
  const kasMap = new Map<string, KasEntry>();
  (base.kasList || []).forEach((k) => {
    if (k && k.id && !allDeletedKasIds.has(k.id)) {
      kasMap.set(k.id, { ...k });
    }
  });
  (incoming.kasList || []).forEach((k) => {
    if (k && k.id && !allDeletedKasIds.has(k.id)) {
      const existing = kasMap.get(k.id);
      if (!existing) {
        kasMap.set(k.id, k);
      } else {
        const isIncomingPendingReq =
          k.status === 'pending_approval' &&
          (k.pendingAction === 'delete' || k.pendingAction === 'update');
        const isResolvingPending =
          existing.status === 'pending_approval' &&
          (k.status === 'approved' || k.status === 'rejected');
        const existingUpdated = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const incomingUpdated = k.updatedAt ? new Date(k.updatedAt).getTime() : 0;
        const hasNewerIncoming =
          Number.isFinite(incomingUpdated) &&
          Number.isFinite(existingUpdated) &&
          incomingUpdated > existingUpdated;
        const isTerminal = existing.status === 'approved' || existing.status === 'rejected';
        const finalStatus =
          (isIncomingPendingReq && (!existingUpdated || hasNewerIncoming || !existing.pendingAction)) ||
          (isResolvingPending && (!existingUpdated || hasNewerIncoming || Boolean(k.approvedBy)))
            ? k.status
            : isTerminal
            ? existing.status
            : (k.status || existing.status);
        kasMap.set(k.id, {
          ...existing,
          ...k,
          status: finalStatus,
          approvedBy: isResolvingPending ? k.approvedBy : (existing.approvedBy || k.approvedBy),
        });
      }
    }
  });
  const mergedKasList = Array.from(kasMap.values());

  // 7. Penyaluran List (Zakat & Qurban)
  const penyaluranMap = new Map<string, PenyaluranZakatQurban>();
  (base.penyaluranList || []).forEach((p) => penyaluranMap.set(p.id, p));
  (incoming.penyaluranList || []).forEach((p) => penyaluranMap.set(p.id, p));

  // 8. Audit Logs: UNION of base and incoming auditLogs so every connected admin's activity is permanently preserved in Super Admin log history!
  const logMap = new Map<string, AuditLog>();
  (base.auditLogs || []).forEach((l) => {
    if (l && l.id) logMap.set(l.id, { ...l });
  });
  (incoming.auditLogs || []).forEach((l) => {
    if (l && l.id) {
      const existing = logMap.get(l.id);
      logMap.set(l.id, existing ? { ...existing, ...l } : { ...l });
    }
  });
  const mergedAuditLogs = Array.from(logMap.values())
    .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))
    .slice(0, 300);

  // 9. Admins: UNION of base and incoming admins by ID and username (filtering deletedAdminIds) so registered admins & admin names NEVER change or disappear on update!
  const allDeletedAdminIds = new Set<string>([
    ...((base as any).deletedAdminIds || []),
    ...((incoming as any).deletedAdminIds || []),
  ]);
  const adminMap = new Map<string, AdminUser>();
  const usernameToIdMap = new Map<string, string>();

  const upsertAdmin = (a: AdminUser) => {
    if (!a || (!a.id && !a.username)) return;
    if (a.id && allDeletedAdminIds.has(a.id)) return;
    const uKey = String(a.username || '').trim().toLowerCase();
    const targetId = (uKey && usernameToIdMap.get(uKey)) || a.id || uKey;
    if (allDeletedAdminIds.has(targetId)) return;

    const existing = adminMap.get(targetId);
    if (!existing) {
      adminMap.set(targetId, { ...a, id: targetId });
      if (uKey) usernameToIdMap.set(uKey, targetId);
    } else {
      // Never let a generic fallback name ('Abzqar') overwrite a personalized Super Admin name (e.g. 'Tezar Basith Hidayat')
      const incomingIsDefaultPlaceholder =
        targetId === 'adm-abzqar' &&
        a.nama === 'Abzqar' &&
        existing.nama &&
        existing.nama !== 'Abzqar';
      const preservedNama = incomingIsDefaultPlaceholder ? existing.nama : (a.nama || existing.nama);
      const preservedEmail = incomingIsDefaultPlaceholder ? existing.email : (a.email || existing.email);
      const preservedWa = incomingIsDefaultPlaceholder ? existing.whatsapp : (a.whatsapp || existing.whatsapp);
      const preservedNik = incomingIsDefaultPlaceholder ? existing.nik : (a.nik || existing.nik);

      adminMap.set(targetId, {
        ...existing,
        ...a,
        id: targetId,
        nama: preservedNama,
        email: preservedEmail,
        whatsapp: preservedWa,
        nik: preservedNik,
        bankPribadi: {
          namaBank: a.bankPribadi?.namaBank || existing.bankPribadi?.namaBank || 'Bank Mandiri',
          nomorRekening: a.bankPribadi?.nomorRekening || existing.bankPribadi?.nomorRekening || '',
          atasNama: incomingIsDefaultPlaceholder
            ? (existing.bankPribadi?.atasNama || preservedNama)
            : (a.bankPribadi?.atasNama || existing.bankPribadi?.atasNama || preservedNama),
        },
      });
    }
  };

  (base.admins || []).forEach(upsertAdmin);
  (incoming.admins || []).forEach(upsertAdmin);
  const mergedAdmins = Array.from(adminMap.values()).map((a) => {
    const clean = { ...a };
    delete (clean as any).biometricActive;
    return clean;
  });

  // 10. Profile: preserve rekeningPenampungan, QRIS and official details
  const incomingRek = incoming.profile?.rekeningPenampungan;
  const baseRek = base.profile?.rekeningPenampungan;
  const rekeningPenampungan = Array.isArray(incomingRek) && incomingRek.length > 0
    ? incomingRek
    : (Array.isArray(baseRek) ? baseRek : []);

  const profile = {
    ...base.profile,
    ...(incoming.profile || {}),
    rekeningPenampungan,
    qrisImageUrl: incoming.profile?.qrisImageUrl || base.profile?.qrisImageUrl,
  };

  // 11. Sedekah List (Preserve all donations, terminal status & receipts, never resurrect deleted items)
  const sedekahMap = new Map<string, any>();
  (base.sedekahList || []).forEach((s) => {
    if (s && s.id && !allDeletedSetoranIds.has(s.id)) {
      sedekahMap.set(s.id, { ...s });
    }
  });
  (incoming.sedekahList || []).forEach((s) => {
    if (!s || !s.id || allDeletedSetoranIds.has(s.id)) return;
    const existing = sedekahMap.get(s.id);
    if (!existing) {
      sedekahMap.set(s.id, s);
    } else {
      const isTerminal = existing.status === 'approved' || existing.status === 'rejected';
      const finalStatus = isTerminal ? existing.status : (s.status || existing.status);
      sedekahMap.set(s.id, {
        ...existing,
        ...s,
        status: finalStatus,
        verifiedBy: existing.verifiedBy || s.verifiedBy,
        verifiedAt: existing.verifiedAt || s.verifiedAt,
        buktiTransferUrl: s.buktiTransferUrl || existing.buktiTransferUrl,
      });
    }
  });

  // 12. Pengaturan Berbagi (Names, rekening, & QRIS Sedekah)
  const defaultBerbagi = {
    namaSubuh: 'Sedekah Subuh',
    namaJumat: 'Sedekah Jumat',
    namaUmum: 'Sedekah Umum',
    bankName: 'Bank Negara Indonesia (BNI)',
    noRekening: '048-963-2761',
    namaPemilikRekening: 'Koperasi Berbagi Mandiri HWS',
  };
  const pengaturanBerbagi = {
    ...defaultBerbagi,
    ...(base.pengaturanBerbagi || {}),
    ...(incoming.pengaturanBerbagi || {}),
    qrisImageUrl: incoming.pengaturanBerbagi?.qrisImageUrl || base.pengaturanBerbagi?.qrisImageUrl,
  };

  // Pastikan setiap setoran sedekah anggota (tipe === 'penerimaan') muncul di antrian verifikasi admin (setoranList)
  sedekahMap.forEach((sdk) => {
    if (sdk && sdk.id && sdk.tipe === 'penerimaan' && !allDeletedSetoranIds.has(sdk.id)) {
      const mappedStatus =
        sdk.status === 'approved'
          ? 'disetujui'
          : sdk.status === 'rejected'
          ? 'ditolak'
          : 'pending';
      const existingSetoran = setoranMap.get(sdk.id);
      if (!existingSetoran) {
        setoranMap.set(sdk.id, {
          id: sdk.id,
          memberId: sdk.donaturMemberId || 'donatur-umum',
          memberNama: sdk.donaturNama || 'Donatur Hamba Allah',
          memberRekening: sdk.donaturRekening || '-',
          memberNomorAnggota: sdk.donaturNomorAnggota,
          memberWilayah: sdk.donaturWilayah,
          jenis: 'sedekah',
          nominal: sdk.nominal,
          rekeningTujuan: 'Kas Berbagi Koperasi',
          metode: (sdk.sumberDana === 'tabungan_umum' ? 'tabungan_umum' : 'qris') as any,
          buktiTransferUrl: sdk.buktiTransferUrl,
          catatanAnggota: sdk.keterangan || `Donasi ${sdk.namaBerbagiKustom || 'Sedekah'}`,
          status: mappedStatus,
          verifiedBy: sdk.verifiedBy,
          verifiedAt: sdk.verifiedAt,
          createdAt: sdk.createdAt || `${sdk.tanggal}T${sdk.jam || '08:00'}:00.000Z`,
          nomorReferensi: `SDK-${String(sdk.id).slice(-6).toUpperCase()}`,
        });
      } else if (mappedStatus !== 'pending' && existingSetoran.status === 'pending') {
        setoranMap.set(sdk.id, {
          ...existingSetoran,
          status: mappedStatus,
          verifiedBy: sdk.verifiedBy || existingSetoran.verifiedBy,
          verifiedAt: sdk.verifiedAt || existingSetoran.verifiedAt,
        });
      }
    }
  });

  // Reverse sync: jika setoranMap sudah terminal (disetujui/ditolak), pastikan sedekahMap ikut tersinkron
  setoranMap.forEach((setItem, setId) => {
    if (!setItem || allDeletedSetoranIds.has(setId)) return;
    if (setItem.status === 'disetujui' || setItem.status === 'ditolak') {
      const existingSdk = sedekahMap.get(setId);
      if (existingSdk && existingSdk.status === 'pending') {
        sedekahMap.set(setId, {
          ...existingSdk,
          status: setItem.status === 'disetujui' ? 'approved' : 'rejected',
          verifiedBy: setItem.verifiedBy || existingSdk.verifiedBy,
          verifiedAt: setItem.verifiedAt || existingSdk.verifiedAt,
        });
      }
    }
  });

  const mergedState: AppState = {
    ...base,
    ...incoming,
    profile,
    admins: mergedAdmins,
    members: mergedMembers,
    setoranList: Array.from(setoranMap.values()).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
    chatMessages: Array.from(chatMap.values())
      .filter((c) => {
        const t = new Date(c.timestamp).getTime();
        return !isNaN(t) ? Date.now() - t <= 10 * 24 * 60 * 60 * 1000 : false;
      })
      .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1)),
    suratList: Array.from(suratMap.values()).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
    memberTransactions: mergedTxList.sort((a, b) => ((b.tanggal + (b.jam || '')) > (a.tanggal + (a.jam || '')) ? 1 : -1)),
    kasList: mergedKasList.sort((a, b) => {
      const cmp = `${b.tanggal || ''} ${b.createdAt || ''}`.localeCompare(`${a.tanggal || ''} ${a.createdAt || ''}`);
      return cmp !== 0 ? cmp : String(b.id || '').localeCompare(String(a.id || ''));
    }),
    penyaluranList: Array.from(penyaluranMap.values()),
    sedekahList: Array.from(sedekahMap.values()).sort((a, b) => ((b.createdAt || b.tanggal) > (a.createdAt || a.tanggal) ? 1 : -1)),
    pengaturanBerbagi,
    pendingMutasiRequests: (() => {
      const reqMap = new Map<string, PendingMutasiActionRequest>();
      (base.pendingMutasiRequests || []).forEach((r) => {
        if (r && r.id) reqMap.set(r.id, { ...r });
      });
      (incoming.pendingMutasiRequests || []).forEach((r) => {
        if (!r || !r.id) return;
        const existing = reqMap.get(r.id);
        if (!existing) {
          reqMap.set(r.id, { ...r });
        } else {
          const isTerminal = existing.status === 'approved' || existing.status === 'rejected';
          const finalStatus = isTerminal ? existing.status : (r.status || existing.status);
          reqMap.set(r.id, {
            ...existing,
            ...r,
            status: finalStatus,
            approvedBy: existing.approvedBy || r.approvedBy,
            approvedByRole: existing.approvedByRole || r.approvedByRole,
            approvedAt: existing.approvedAt || r.approvedAt,
          });
        }
      });
      return Array.from(reqMap.values()).sort((a, b) => (b.requestedAt > a.requestedAt ? 1 : -1));
    })(),
    categoriesKasKoperasi:
      incoming.categoriesKasKoperasi &&
      (Array.isArray(incoming.categoriesKasKoperasi.pemasukan) ||
        Array.isArray(incoming.categoriesKasKoperasi.pengeluaran))
        ? incoming.categoriesKasKoperasi
        : base.categoriesKasKoperasi || { pemasukan: [], pengeluaran: [] },
    maintenanceLock: incoming.maintenanceLock || base.maintenanceLock || { isLocked: false },
    auditLogs: mergedAuditLogs.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1)),
    accountNumberSchemaVersion: 2,
    lastRunningNumber: (() => {
      let maxV2 = 769;
      finalSanitizedUsed.forEach((n) => {
        const sq = extractUnifiedSeqClient(n);
        if (sq !== null && sq > maxV2) maxV2 = sq;
      });
      mergedMembers.forEach((m) => {
        const sq = extractUnifiedSeqClient(m?.nomorRekening);
        if (sq !== null && sq > maxV2) maxV2 = sq;
      });
      return maxV2;
    })(),
    deletedMemberIds: Array.from(allDeletedMemIds),
    deletedTransactionIds: Array.from(allDeletedTxIds),
    deletedKasIds: Array.from(allDeletedKasIds),
    deletedSetoranIds: Array.from(allDeletedSetoranIds),
    deletedAdminIds: Array.from(allDeletedAdminIds),
    deletedSuratIds: Array.from(allDeletedSuratIds),
    deletedChatIds: Array.from(allDeletedChatIds),
    suratResetAt: mergedSuratResetAt,
    chatClearedAt: mergedChatClearedAt,
    chatClearedBeforeByMember: mergedChatClearedByMember,
    usedAccountNumbers: finalSanitizedUsed,
    usedMemberNumbers: finalSanitizedUsed,
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

  // Reconcile member balances and cash books to ensure 100% fidelity with verified deposits
  return reconcileBalancesWithDeposits(mergedState);
}

export function extractDepositRefId(tx: any): string {
  if (!tx) return '';
  const id = String(tx.id || '').trim();
  const refId = String(tx.referensiId || '').trim();
  if (refId.startsWith('dep-') || refId.startsWith('sdk-')) return refId;
  if (id.startsWith('tx-dep-')) return id.slice('tx-dep-'.length);
  if (id.startsWith('tx-sdk-sdk-') || id.startsWith('tx-sdk-dep-')) return id.slice('tx-sdk-'.length);
  return '';
}

export function isDepositSourcedTransaction(tx: any): boolean {
  if (!tx) return false;
  const id = String(tx.id || '').trim();
  const refId = String(tx.referensiId || '').trim();
  if (
    refId.startsWith('KAS-') ||
    refId.startsWith('ADJ-') ||
    refId.startsWith('SHU-') ||
    refId.startsWith('TF-')
  ) {
    return false;
  }
  if (refId.startsWith('dep-') || refId.startsWith('sdk-')) return true;
  if (id.startsWith('tx-dep-') || id.startsWith('tx-sdk-sdk-') || id.startsWith('tx-sdk-dep-')) return true;
  if ((id.startsWith('tx-wajib-') || id.startsWith('tx-umum-')) && !refId) return true;
  return false;
}

export function extractTxSequenceTs(tx: any): number {
  if (!tx) return 0;
  const refMatch = String(tx.referensiId || '').match(/(\d{10,})/);
  if (refMatch) return Number(refMatch[1]) || 0;
  const idMatch = String(tx.id || '').match(/(\d{10,})/);
  if (idMatch) return Number(idMatch[1]) || 0;
  return 0;
}

export function compareMemberTransactionsChrono(a: any, b: any): number {
  const da = `${a?.tanggal || ''} ${a?.jam || '00:00'}`;
  const db = `${b?.tanggal || ''} ${b?.jam || '00:00'}`;
  const cmp = da.localeCompare(db);
  if (cmp !== 0) return cmp;
  const tsA = extractTxSequenceTs(a);
  const tsB = extractTxSequenceTs(b);
  if (tsA !== tsB) return tsA - tsB;
  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

export function compareMemberTransactionsDesc(a: any, b: any): number {
  return compareMemberTransactionsChrono(b, a);
}

export function filterAndDeduplicateMemberTransactions(params: {
  transactions: MemberTransaction[];
  setoranList: SetoranVerifikasi[];
  deletedTransactionIds?: string[];
  deletedSetoranIds?: string[];
  activeMemberIds?: Set<string>;
  members?: MemberUser[];
  deletedMemberIds?: string[];
  kasList?: KasEntry[];
  deletedKasIds?: string[];
}): {
  transactions: MemberTransaction[];
  removedTxIds: string[];
  removedNumericTokens: Set<string>;
} {
  const delTxSet = new Set<string>(params.deletedTransactionIds || []);
  const delSetoranSet = new Set<string>(params.deletedSetoranIds || []);
  const delMemSet = new Set<string>(params.deletedMemberIds || []);
  const approvedDepositMap = new Map<string, SetoranVerifikasi>();

  (Array.isArray(params.setoranList) ? params.setoranList : []).forEach((s) => {
    if (!s || !s.id || delSetoranSet.has(s.id)) return;
    if (s.status !== 'disetujui' && (s as any).status !== 'approved') return;
    approvedDepositMap.set(s.id, s);
    // Active verified deposit must never be suppressed by a stale canonical tx tombstone
    const isSedekah = s.jenis === 'sedekah' || String(s.id).startsWith('sdk-');
    delTxSet.delete(isSedekah ? `tx-sdk-${s.id}` : `tx-dep-${s.id}`);
  });

  const removedTxIds: string[] = [];
  const removedNumericTokens = new Set<string>();
  const depositClusters = new Map<string, MemberTransaction[]>();
  const nonDepositTxs: MemberTransaction[] = [];
  const nonDepositSeenKeys = new Set<string>();

  const recordRemoved = (txId: string) => {
    if (!txId) return;
    if (!delTxSet.has(txId)) {
      removedTxIds.push(txId);
      delTxSet.add(txId);
    }
    const tsMatch = String(txId).match(/^tx-(?:wajib|umum)-(\d{10,})$/);
    if (tsMatch) removedNumericTokens.add(tsMatch[1]);
  };

  (Array.isArray(params.transactions) ? params.transactions : []).forEach((tx) => {
    if (!tx || !tx.id || (tx as any).status === 'deleted') return;
    if (delTxSet.has(tx.id)) return;
    if (params.activeMemberIds && !params.activeMemberIds.has(tx.memberId)) return;

    if (isDepositSourcedTransaction(tx)) {
      const depRefId = extractDepositRefId(tx);
      const dep = depRefId ? approvedDepositMap.get(depRefId) : undefined;
      if (!dep) {
        // Strict Req 1: mutasi setoran hanya mengikuti daftar setoran yang telah diverifikasi
        recordRemoved(tx.id);
        return;
      }

      const resolvedMember = params.members
        ? findMemberForDeposit(dep, params.members, delMemSet)
        : null;
      const expectedMemberId = resolvedMember?.id || dep.memberId;
      if (expectedMemberId && expectedMemberId !== 'donatur-umum' && tx.memberId !== expectedMemberId) {
        recordRemoved(tx.id);
        return;
      }

      if (!depositClusters.has(depRefId)) {
        depositClusters.set(depRefId, []);
      }
      depositClusters.get(depRefId)!.push(tx);
    } else {
      if (tx.referensiId && delSetoranSet.has(tx.referensiId)) {
        recordRemoved(tx.id);
        return;
      }
      const refKey = tx.referensiId
        ? `${tx.memberId}|${tx.referensiId}|${tx.kategori}|${tx.tipe}`
        : `id|${tx.id}`;
      if (nonDepositSeenKeys.has(tx.id) || (tx.referensiId && nonDepositSeenKeys.has(refKey))) {
        recordRemoved(tx.id);
        return;
      }
      nonDepositSeenKeys.add(tx.id);
      if (tx.referensiId) nonDepositSeenKeys.add(refKey);
      nonDepositTxs.push(tx);
    }
  });

  const dedupedDepositTxs: MemberTransaction[] = [];
  depositClusters.forEach((cluster, depRefId) => {
    const dep = approvedDepositMap.get(depRefId)!;
    const isSedekah = dep.jenis === 'sedekah' || depRefId.startsWith('sdk-');
    const canonicalId = isSedekah ? `tx-sdk-${depRefId}` : `tx-dep-${depRefId}`;
    const canonicalTx = cluster.find((t) => t.id === canonicalId);
    const survivor = canonicalTx || cluster[0];

    dedupedDepositTxs.push({
      ...survivor,
      id: canonicalId,
      referensiId: depRefId,
    });

    cluster.forEach((t) => {
      if (t.id !== canonicalId) {
        recordRemoved(t.id);
      }
    });
  });

  return {
    transactions: [...dedupedDepositTxs, ...nonDepositTxs],
    removedTxIds,
    removedNumericTokens,
  };
}

export function isSriParawatiMember(
  m: { id?: string; nama?: string } | null | undefined
): boolean {
  if (!m) return false;
  const id = String(m.id || '').trim();
  const nama = String(m.nama || '').trim().toLowerCase();
  return id === 'mem-1792744119364' || nama === 'sri parawati';
}

export function getRedUnpostedMutasiEntries(
  state: AppState,
  memberId?: string
): RedMutasiEntry[] {
  if (!state || typeof state !== 'object') return [];
  const delMemSet = new Set<string>(state.deletedMemberIds || []);
  const delSetSet = new Set<string>(state.deletedSetoranIds || []);
  const delTxSet = new Set<string>(state.deletedTransactionIds || []);
  const members = (Array.isArray(state.members) ? state.members : []).filter(
    (m) => m && m.id && !delMemSet.has(m.id)
  );
  const activeTxs = (Array.isArray(state.memberTransactions) ? state.memberTransactions : []).filter(
    (t) => t && t.id && (t as any).status !== 'deleted' && !delTxSet.has(t.id)
  );
  const activeTxRefs = new Set<string>();
  const activeTxIds = new Set<string>();
  activeTxs.forEach((t) => {
    activeTxIds.add(t.id);
    if (t.referensiId) activeTxRefs.add(t.referensiId);
  });

  const results: RedMutasiEntry[] = [];
  (Array.isArray(state.setoranList) ? state.setoranList : []).forEach((s) => {
    if (!s || !s.id || delSetSet.has(s.id)) return;
    if (s.status !== 'disetujui' && (s as any).status !== 'approved') return;
    const resolvedM = findMemberForDeposit(s, members, delMemSet);
    const mId = resolvedM?.id || s.memberId;
    if (!mId || mId === 'donatur-umum') return;
    if (memberId && mId !== memberId) return;

    const isSedekah = s.jenis === 'sedekah' || String(s.id).startsWith('sdk-');
    const canonTxId = isSedekah ? `tx-sdk-${s.id}` : `tx-dep-${s.id}`;
    const hasActiveTx = activeTxRefs.has(s.id) || activeTxIds.has(canonTxId);
    if (hasActiveTx) return;

    const createdDate = s.createdAt && !isNaN(new Date(s.createdAt).getTime()) ? new Date(s.createdAt) : null;
    const tgl = (s as any).tanggal || (createdDate ? getWibDateStr(createdDate) : getWibDateStr());
    const jam = (s as any).jam || (createdDate ? getWibTimeStr(createdDate, false) : '09:00');
    const isTftu = s.metode === 'tabungan_umum';
    const kategori: RedMutasiEntry['kategori'] = isSedekah
      ? isTftu
        ? 'umum'
        : 'sedekah'
      : s.jenis === 'kewajiban'
      ? 'pokok'
      : 'umum';
    const tipe: RedMutasiEntry['tipe'] = isSedekah && isTftu ? 'keluar' : 'masuk';

    results.push({
      id: `red-dep-${s.id}`,
      memberId: mId,
      setoranId: s.id,
      txId: canonTxId,
      tanggal: tgl,
      jam,
      keterangan:
        s.jenis === 'kewajiban'
          ? `SETORAN KEWAJIBAN ${s.jumlahHari || Math.round((Number(s.nominal) || 0) / 2000) || 1} HARI (POKOK, ZAKAT, QURBAN)`
          : isSedekah
          ? `${isTftu ? 'TFTU ' : ''}Sedekah dari ${resolvedM?.nama || s.memberNama || 'Anggota'}`
          : `Setoran Tunai ${resolvedM?.nama || s.memberNama || 'Anggota'}`,
      kategori,
      tipe,
      nominal: Number(s.nominal) || 0,
      nomorReferensi: s.nomorReferensi,
      reason: 'Setoran terverifikasi belum tercatat ke Mutasi & Daftar Anggota',
    });
  });

  return results.sort(compareMemberTransactionsDesc);
}

function cleanStr(str: any): string {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findMemberForDeposit(s: any, members: MemberUser[], deletedMemSet?: Set<string>): MemberUser | null {
  if (!Array.isArray(members) || members.length === 0 || !s) return null;
  const sMemId = String(s.memberId || '').trim();
  const sRek = cleanStr(s.memberRekening || (s as any).nomorRekening);
  const sNo = cleanStr(s.memberNomorAnggota || (s as any).nomorAnggota);

  // If the deposit explicitly belonged to a deleted member ID, NEVER reassign it to a new member
  if (sMemId && deletedMemSet && deletedMemSet.has(sMemId)) {
    return null;
  }

  // 1. Exact ID
  if (sMemId) {
    const found = members.find((m) => m && m.id === sMemId);
    if (found) return found;
    // If deposit had a specific memberId (e.g. mem-1791933449621) that is no longer in active members, do NOT fuzzy-match to a new member
    return null;
  }
  // 2. Exact Rekening (only when memberId was empty)
  if (sRek && sRek.length >= 6) {
    const found = members.find((m) => m && cleanStr(m.nomorRekening) === sRek);
    if (found) return found;
  }
  // 3. Exact Nomor Anggota (only when memberId was empty)
  if (sNo && sNo.length >= 5) {
    const found = members.find((m) => m && cleanStr(m.nomorAnggota) === sNo);
    if (found) return found;
  }
  return null;
}

export const DOUBLE_DEPOSIT_START_DATE = '2026-11-24';

export function getDepositWibDateStr(s: any): string {
  if (!s) return '';
  const rawCreated = String(s.createdAt || '').trim();
  if (rawCreated) {
    const parsed = new Date(rawCreated);
    if (!isNaN(parsed.getTime())) {
      return getWibDateStr(parsed);
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(rawCreated)) {
      return rawCreated.slice(0, 10);
    }
  }
  const rawTgl = String(s.tanggal || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(rawTgl)) {
    return rawTgl.slice(0, 10);
  }
  return '';
}

export function isDoubleDepositDetectionActive(s: any): boolean {
  const wibDate = getDepositWibDateStr(s);
  return Boolean(wibDate && wibDate >= DOUBLE_DEPOSIT_START_DATE);
}

export function getDepositDoubleSignature(
  s: any,
  members: MemberUser[] = [],
  deletedMemSet?: Set<string>
): string {
  if (!s) return '';
  const wibDate = getDepositWibDateStr(s);
  if (!wibDate || wibDate < DOUBLE_DEPOSIT_START_DATE) return '';

  const matchedMember = findMemberForDeposit(s, members, deletedMemSet);
  let memKey = matchedMember?.id ? String(matchedMember.id).trim() : '';
  if (!memKey && s.memberId && String(s.memberId).trim() && String(s.memberId).trim() !== 'donatur-umum') {
    memKey = String(s.memberId).trim();
  }
  if (!memKey && s.memberRekening && String(s.memberRekening).trim() !== '-') {
    memKey = `rek:${cleanStr(s.memberRekening)}`;
  }
  if (!memKey) {
    memKey = `nama:${String(s.memberNama || s.donaturNama || '').trim().toLowerCase()}`;
  }

  let jenisKey = String(
    s.jenis || (String(s.id || '').startsWith('sdk-') ? 'sedekah' : 'kewajiban')
  )
    .trim()
    .toLowerCase();
  if (jenisKey === 'sedekah') {
    const note = String(s.catatanAnggota || s.namaBerbagiKustom || s.keterangan || '').toLowerCase();
    if (note.includes('subuh')) jenisKey = 'sedekah_subuh';
    else if (note.includes('jumat')) jenisKey = 'sedekah_jumat';
    else if (note.includes('umum')) jenisKey = 'sedekah_umum';
  }
  const metodeKey = s.metode === 'tabungan_umum' || s.sumberDana === 'tabungan_umum' ? 'tabungan_umum' : 'qris';
  const nom = Number(s.nominal) || 0;
  return `${memKey}|${jenisKey}|${metodeKey}|${nom}|${wibDate}`;
}

export function findBlockingDoubleDepositClient(
  candidate: any,
  existingList: SetoranVerifikasi[],
  members: MemberUser[] = [],
  deletedSetoranIds: string[] = [],
  deletedMemberIds: string[] = []
): SetoranVerifikasi | null {
  if (!candidate || !isDoubleDepositDetectionActive(candidate)) return null;
  const delSetSet = new Set(deletedSetoranIds || []);
  const delMemSet = new Set(deletedMemberIds || []);
  const targetSig = getDepositDoubleSignature(candidate, members, delMemSet);
  if (!targetSig) return null;

  for (const existing of existingList || []) {
    if (!existing || !existing.id || delSetSet.has(existing.id)) continue;
    if (candidate.id && existing.id === candidate.id) continue;
    const st = String(existing.status || '').toLowerCase();
    if (st !== 'pending' && st !== 'disetujui' && st !== 'approved') continue;
    if (getDepositDoubleSignature(existing, members, delMemSet) === targetSig) {
      return existing;
    }
  }
  return null;
}

export function deduplicateSetoranListPostCutoffClient(
  list: SetoranVerifikasi[],
  members: MemberUser[] = [],
  deletedMemSet?: Set<string>
): { list: SetoranVerifikasi[]; removedIds: string[] } {
  const input = Array.isArray(list) ? list : [];
  if (input.length <= 1) return { list: input, removedIds: [] };

  const sigGroups = new Map<string, SetoranVerifikasi[]>();
  input.forEach((s) => {
    if (!s || !s.id) return;
    const sig = getDepositDoubleSignature(s, members, deletedMemSet);
    if (!sig) return;
    if (!sigGroups.has(sig)) sigGroups.set(sig, []);
    sigGroups.get(sig)!.push(s);
  });

  const suppressSet = new Set<string>();
  const toTs = (iso?: string) => {
    const t = iso ? new Date(iso).getTime() : 0;
    return isNaN(t) ? 0 : t;
  };
  const isApprovedSt = (s: any) => s?.status === 'disetujui' || s?.status === 'approved';
  const isRejectedSt = (s: any) => s?.status === 'ditolak' || s?.status === 'rejected';

  sigGroups.forEach((group) => {
    if (group.length <= 1) return;
    const activeItems = group.filter((s) => !isRejectedSt(s));
    const rejectedItems = group.filter((s) => isRejectedSt(s));

    let keptActive: SetoranVerifikasi | null = null;
    if (activeItems.length > 0) {
      const sortedActive = activeItems.slice().sort((a, b) => {
        const aApp = isApprovedSt(a);
        const bApp = isApprovedSt(b);
        if (aApp !== bApp) return aApp ? -1 : 1;
        if (aApp && bApp) {
          const vDiff = toTs(a.verifiedAt || a.createdAt) - toTs(b.verifiedAt || b.createdAt);
          if (vDiff !== 0) return vDiff;
        }
        const cDiff = toTs(a.createdAt) - toTs(b.createdAt);
        if (cDiff !== 0) return cDiff;
        return String(a.id).localeCompare(String(b.id));
      });
      keptActive = sortedActive[0];
      for (let i = 1; i < sortedActive.length; i++) {
        suppressSet.add(sortedActive[i].id);
      }
    }

    if (rejectedItems.length > 0) {
      const refCutoffTs = keptActive
        ? toTs(keptActive.verifiedAt || keptActive.createdAt)
        : 0;
      const nonDupRejected: SetoranVerifikasi[] = [];
      rejectedItems.forEach((r) => {
        const reason = String(r.alasanTolak || r.catatanAdmin || '').toLowerCase();
        if (reason.includes('duplikat') || reason.includes('double')) {
          suppressSet.add(r.id);
          return;
        }
        if (keptActive && toTs(r.createdAt) <= refCutoffTs) {
          suppressSet.add(r.id);
          return;
        }
        nonDupRejected.push(r);
      });
      if (nonDupRejected.length > 1) {
        const sortedRej = nonDupRejected.slice().sort((a, b) => toTs(b.createdAt) - toTs(a.createdAt));
        for (let i = 1; i < sortedRej.length; i++) {
          suppressSet.add(sortedRej[i].id);
        }
      }
    }
  });

  if (suppressSet.size === 0) return { list: input, removedIds: [] };
  return {
    list: input.filter((s) => s && s.id && !suppressSet.has(s.id)),
    removedIds: Array.from(suppressSet),
  };
}

export function reconcileBalancesWithDeposits(state: AppState): AppState {
  if (!state || typeof state !== 'object') return state;

  const delMemSet = new Set<string>(state.deletedMemberIds || []);
  const delSetoranSet = new Set<string>(state.deletedSetoranIds || []);
  const delTxSet = new Set<string>(state.deletedTransactionIds || []);
  const delKasSet = new Set<string>(state.deletedKasIds || []);

  // Filter out any deleted records immediately so deleted data never reappears
  const members = (Array.isArray(state.members) ? state.members : []).filter(
    (m) => m && m.id && !delMemSet.has(m.id)
  );
  const activeMemberIds = new Set(members.map((m) => m.id));

  const rawSetoranList = (Array.isArray(state.setoranList) ? state.setoranList : []).filter(
    (s) => s && s.id && !delSetoranSet.has(s.id)
  );
  const rawSedekahList = (Array.isArray(state.sedekahList) ? state.sedekahList : []).filter(
    (sdk) => sdk && sdk.id && !delSetoranSet.has(sdk.id)
  );

  // Two-way synchronize sedekahList <-> setoranList (jenis === 'sedekah')
  const sedekahMap = new Map<string, any>();
  rawSedekahList.forEach((sdk) => {
    sedekahMap.set(sdk.id, { ...sdk });
  });

  const setoranMap = new Map<string, SetoranVerifikasi>();
  rawSetoranList.forEach((s) => {
    // Keep sedekah or deposits belonging to active members
    if (s.jenis === 'sedekah' || activeMemberIds.has(s.memberId)) {
      setoranMap.set(s.id, { ...s });
    }
  });

  // 1) Sync from setoranList (jenis === 'sedekah') -> sedekahMap
  setoranMap.forEach((s) => {
    if (s.jenis !== 'sedekah') return;
    const mappedStatus =
      s.status === 'disetujui' || (s as any).status === 'approved'
        ? 'approved'
        : s.status === 'ditolak' || (s as any).status === 'rejected'
        ? 'rejected'
        : 'pending';

    const existingSdk = sedekahMap.get(s.id);
    const m = members.find((mem) => mem.id === s.memberId);
    const catatanLower = String(s.catatanAnggota || '').toLowerCase();
    const inferredJenis = catatanLower.includes('jumat')
      ? 'sedekah_jumat'
      : catatanLower.includes('umum')
      ? 'sedekah_umum'
      : 'sedekah_subuh';
    const rawUmumName = state.pengaturanBerbagi?.namaUmum || 'Sedekah Umum';
    const safeUmumName = rawUmumName === 'Sedekah' ? 'Sedekah Umum' : rawUmumName;
    const inferredLabel =
      inferredJenis === 'sedekah_jumat'
        ? state.pengaturanBerbagi?.namaJumat || 'Sedekah Jumat'
        : inferredJenis === 'sedekah_umum'
        ? safeUmumName
        : state.pengaturanBerbagi?.namaSubuh || 'Sedekah Subuh';

    const createdDate = s.createdAt && !isNaN(new Date(s.createdAt).getTime()) ? new Date(s.createdAt) : null;
    const tgl = (s as any).tanggal || (createdDate ? getWibDateStr(createdDate) : getWibDateStr());
    const jam = (s as any).jam || (createdDate ? getWibTimeStr(createdDate, false) : '08:00');

    if (!existingSdk) {
      sedekahMap.set(s.id, {
        id: s.id,
        tanggal: tgl,
        jam,
        jenis: inferredJenis,
        namaBerbagiKustom: inferredLabel,
        tipe: 'penerimaan',
        donaturTipe: m ? 'anggota' : 'bukan_anggota',
        donaturMemberId: s.memberId,
        donaturNama: m?.nama || s.memberNama || 'Donatur Hamba Allah',
        donaturNomorAnggota: m?.nomorAnggota || s.memberNomorAnggota || '-',
        donaturRekening: m?.nomorRekening || s.memberRekening || '-',
        donaturWilayah: m?.wilayah || s.memberWilayah || 'Cengkareng',
        sumberDana: s.metode === 'tabungan_umum' ? 'tabungan_umum' : 'qris',
        nominal: Number(s.nominal) || 0,
        keterangan: s.catatanAnggota || `Donasi ${inferredLabel}`,
        buktiTransferUrl: s.buktiTransferUrl,
        status: mappedStatus,
        verifiedBy: s.verifiedBy,
        verifiedAt: s.verifiedAt,
        createdAt: s.createdAt || new Date().toISOString(),
      });
    } else {
      const finalStatus =
        existingSdk.status === 'approved' || mappedStatus === 'approved'
          ? 'approved'
          : existingSdk.status === 'rejected' || mappedStatus === 'rejected'
          ? 'rejected'
          : 'pending';
      sedekahMap.set(s.id, {
        ...existingSdk,
        status: finalStatus,
        verifiedBy: s.verifiedBy || existingSdk.verifiedBy,
        verifiedAt: s.verifiedAt || existingSdk.verifiedAt,
        buktiTransferUrl: s.buktiTransferUrl || existingSdk.buktiTransferUrl,
      });
    }
  });

  // 2) Sync from sedekahMap (tipe === 'penerimaan') -> setoranMap
  sedekahMap.forEach((sdk) => {
    if (!sdk || sdk.tipe !== 'penerimaan') return;
    const mappedStatus =
      sdk.status === 'approved'
        ? 'disetujui'
        : sdk.status === 'rejected'
        ? 'ditolak'
        : 'pending';
    const existingSetoran = setoranMap.get(sdk.id);
    if (!existingSetoran) {
      setoranMap.set(sdk.id, {
        id: sdk.id,
        memberId: sdk.donaturMemberId || 'donatur-umum',
        memberNama: sdk.donaturNama || 'Donatur Hamba Allah',
        memberRekening: sdk.donaturRekening || '-',
        memberNomorAnggota: sdk.donaturNomorAnggota,
        memberWilayah: sdk.donaturWilayah,
        jenis: 'sedekah',
        nominal: Number(sdk.nominal) || 0,
        rekeningTujuan: 'Kas Berbagi Koperasi',
        metode: (sdk.sumberDana === 'tabungan_umum' ? 'tabungan_umum' : 'qris') as any,
        buktiTransferUrl: sdk.buktiTransferUrl,
        catatanAnggota: sdk.keterangan || `Donasi ${sdk.namaBerbagiKustom || 'Sedekah'}`,
        status: mappedStatus,
        verifiedBy: sdk.verifiedBy,
        verifiedAt: sdk.verifiedAt,
        createdAt: sdk.createdAt || `${sdk.tanggal}T${sdk.jam || '08:00'}:00.000Z`,
        nomorReferensi: `SDK-${String(sdk.id).slice(-6).toUpperCase()}`,
      });
    } else if (mappedStatus !== 'pending' && existingSetoran.status === 'pending') {
      setoranMap.set(sdk.id, {
        ...existingSetoran,
        status: mappedStatus,
        verifiedBy: sdk.verifiedBy || existingSetoran.verifiedBy,
        verifiedAt: sdk.verifiedAt || existingSetoran.verifiedAt,
      });
    }
  });

  const dedupedSetoran = deduplicateSetoranListPostCutoffClient(
    Array.from(setoranMap.values()),
    members,
    delMemSet
  );
  dedupedSetoran.removedIds.forEach((remId) => {
    delSetoranSet.add(remId);
    sedekahMap.delete(remId);
  });

  const setoranList = dedupedSetoran.list;
  const sedekahList = Array.from(sedekahMap.values());

  // Heal stale canonical tx tombstones for active verified deposits (not in deletedSetoranIds)
  setoranList.forEach((s) => {
    if (!s || !s.id || delSetoranSet.has(s.id)) return;
    if (s.status !== 'disetujui' && (s as any).status !== 'approved') return;
    const isSedekah = s.jenis === 'sedekah' || String(s.id).startsWith('sdk-');
    delTxSet.delete(isSedekah ? `tx-sdk-${s.id}` : `tx-dep-${s.id}`);
  });

  // Strictly filter & deduplicate memberTransactions against verified deposits, deleted IDs, and active members
  const txClean = filterAndDeduplicateMemberTransactions({
    transactions: Array.isArray(state.memberTransactions) ? state.memberTransactions : [],
    setoranList,
    deletedTransactionIds: Array.from(delTxSet),
    deletedSetoranIds: Array.from(delSetoranSet),
    activeMemberIds,
    members,
    deletedMemberIds: Array.from(delMemSet),
  });
  const memberTransactions = txClean.transactions;
  txClean.removedTxIds.forEach((id) => delTxSet.add(id));

  // Build set of numeric tokens from deleted/deduplicated tx-wajib-/tx-umum- entries to prune companion duplicate kas entries
  const dupKasTokens = new Set<string>(txClean.removedNumericTokens);
  delTxSet.forEach((id) => {
    const m = String(id).match(/^tx-(?:wajib|umum)-(\d{10,})$/);
    if (m) dupKasTokens.add(m[1]);
  });

  const rawFilteredKas = (Array.isArray(state.kasList) ? state.kasList : []).filter((k) => {
    if (!k || !k.id) return false;
    if (delKasSet.has(k.id)) return false;
    if (k.referensiId && delSetoranSet.has(k.referensiId)) {
      delKasSet.add(k.id);
      return false;
    }
    return true;
  });

  // Deduplicate legacy no-ref kas-ang-*-<ts> entries that duplicate canonical deposit kas entries
  const kasWithRefSigs = new Set<string>();
  rawFilteredKas.forEach((k) => {
    if (k.bukuKas === 'anggota' && k.referensiId) {
      kasWithRefSigs.add(
        `${k.tanggal || ''}|${k.kategori || ''}|${String(k.namaPenerima || '').trim().toLowerCase()}|${Number(k.nominal) || 0}|${k.tipe || ''}`
      );
    }
  });

  const activeTxRefsSet = new Set<string>();
  memberTransactions.forEach((t) => {
    if (t && t.referensiId) activeTxRefsSet.add(t.referensiId);
  });

  const kasList = rawFilteredKas.filter((k) => {
    if (k.bukuKas === 'anggota' && !k.referensiId) {
      const m = String(k.id).match(/^kas-ang-(?:pokok|zakat|qurban|umum)-(\d{10,})$/);
      if (m) {
        const tsNum = Number(m[1]);
        const sig = `${k.tanggal || ''}|${k.kategori || ''}|${String(k.namaPenerima || '').trim().toLowerCase()}|${Number(k.nominal) || 0}|${k.tipe || ''}`;
        const matchesRemovedTx =
          dupKasTokens.has(m[1]) ||
          dupKasTokens.has(String(tsNum - 1)) ||
          dupKasTokens.has(String(tsNum - 2));
        if (matchesRemovedTx || kasWithRefSigs.has(sig)) {
          delKasSet.add(k.id);
          return false;
        }
      }
    }
    return true;
  });

  const approvedDeposits = setoranList.filter(
    (s) => s && (s.status === 'disetujui' || (s as any).status === 'approved')
  );

  const memberAccum = new Map<string, {
    pokok: number;
    umum: number;
    zakat: number;
    qurban: number;
  }>();

  members.forEach((m) => {
    if (m && m.id) {
      memberAccum.set(m.id, { pokok: 0, umum: 0, zakat: 0, qurban: 0 });
    }
  });

  // Accumulate approved deposits for active members (skip any deposit whose canonical mutasi tx was explicitly deleted)
  const countedDepositIds = new Set<string>();
  approvedDeposits.forEach((s) => {
    const m = findMemberForDeposit(s, members, delMemSet);
    if (!m) return;

    s.memberId = m.id;
    s.memberNama = m.nama;
    s.memberRekening = m.nomorRekening;
    s.memberNomorAnggota = m.nomorAnggota;

    if (countedDepositIds.has(s.id)) return;
    countedDepositIds.add(s.id);

    const acc = memberAccum.get(m.id);
    if (!acc) return;

    const nom = Number(s.nominal) || 0;
    const activeKasForDep = kasList.filter((k) => k.referensiId === s.id && k.bukuKas === 'anggota');
    if (s.jenis === 'kewajiban') {
      const linkedTx = memberTransactions.find((t) => t.referensiId === s.id || t.id === `tx-dep-${s.id}`);
      if (!linkedTx && delTxSet.has(`tx-dep-${s.id}`)) return;
      if (linkedTx?.splitOverride) {
        acc.pokok += Number(linkedTx.splitOverride.pokok) || 0;
        acc.qurban += Number(linkedTx.splitOverride.qurban) || 0;
        acc.zakat += Number(linkedTx.splitOverride.zakat) || 0;
      } else if (activeKasForDep.length > 0) {
        const pSum = activeKasForDep
          .filter((k) => k.kategori === 'Tabungan Pokok')
          .reduce((a, k) => a + (Number(k.nominal) || 0), 0);
        const qSum = activeKasForDep
          .filter((k) => k.kategori === 'Tabungan Qurban')
          .reduce((a, k) => a + (Number(k.nominal) || 0), 0);
        const zSum = activeKasForDep
          .filter((k) => k.kategori === 'Tabungan Zakat')
          .reduce((a, k) => a + (Number(k.nominal) || 0), 0);
        if (pSum + qSum + zSum > 0) {
          acc.pokok += pSum;
          acc.qurban += qSum;
          acc.zakat += zSum;
        } else {
          const p = Math.floor(nom * 0.5);
          const q = Math.floor(nom * 0.25);
          const z = nom - p - q;
          acc.pokok += p;
          acc.qurban += q;
          acc.zakat += z;
        }
      } else {
        const p = Math.floor(nom * 0.5);
        const q = Math.floor(nom * 0.25);
        const z = nom - p - q;
        acc.pokok += p;
        acc.qurban += q;
        acc.zakat += z;
      }
    } else if (s.jenis === 'umum') {
      const linkedTx = memberTransactions.find((t) => t.referensiId === s.id || t.id === `tx-dep-${s.id}`);
      if (!linkedTx && delTxSet.has(`tx-dep-${s.id}`)) return;
      const hasActiveUmumKas = activeKasForDep.some((k) => k.tipe === 'masuk');
      if (!isSriParawatiMember(m) && !hasActiveUmumKas && (delKasSet.has(`kas-ang-umum-${s.id}`) || delKasSet.has(`kas-ang-u-${s.id}`))) return;
      acc.umum += nom;
    } else if (s.jenis === 'sedekah') {
      if (s.metode === 'tabungan_umum') {
        const hasActiveTftuKas = activeKasForDep.some((k) => k.tipe === 'keluar');
        if (!hasActiveTftuKas && delKasSet.has(`kas-ang-tftu-${s.id}`)) return;
        acc.umum = Math.max(0, acc.umum - nom);
      }
    }
  });

  // Factor ONLY non-deposit member transactions (manual adjustments, withdrawals, SHU, transfers)
  memberTransactions.forEach((tx) => {
    if (!tx || !tx.memberId) return;
    if (isDepositSourcedTransaction(tx)) return;
    if (tx.kategori === 'sedekah') return; // Mutasi Sedekah QRIS tidak mengubah saldo tabungan
    const acc = memberAccum.get(tx.memberId);
    if (!acc) return;

    const nom = Number(tx.nominal) || 0;
    const isKewajibanSplit =
      tx.kategori === 'pokok' ||
      String(tx.id).startsWith('tx-wajib-') ||
      String(tx.keterangan || '').toUpperCase().includes('KEWAJIBAN') ||
      String(tx.keterangan || '').includes('50% Pokok');

    if (tx.tipe === 'masuk') {
      if (isKewajibanSplit) {
        const pPart = tx.splitOverride ? (Number(tx.splitOverride.pokok) || 0) : Math.floor(nom * 0.5);
        const qPart = tx.splitOverride ? (Number(tx.splitOverride.qurban) || 0) : Math.floor(nom * 0.25);
        const zPart = tx.splitOverride ? (Number(tx.splitOverride.zakat) || 0) : (nom - pPart - qPart);
        acc.pokok += pPart;
        acc.qurban += qPart;
        acc.zakat += zPart;
      } else if (tx.kategori === 'qurban') {
        acc.qurban += nom;
      } else if (tx.kategori === 'zakat') {
        acc.zakat += nom;
      } else {
        acc.umum += nom;
      }
    } else if (tx.tipe === 'keluar') {
      if (isKewajibanSplit) {
        const pPart = tx.splitOverride ? (Number(tx.splitOverride.pokok) || 0) : Math.floor(nom * 0.5);
        const qPart = tx.splitOverride ? (Number(tx.splitOverride.qurban) || 0) : Math.floor(nom * 0.25);
        const zPart = tx.splitOverride ? (Number(tx.splitOverride.zakat) || 0) : (nom - pPart - qPart);
        acc.pokok = Math.max(0, acc.pokok - pPart);
        acc.qurban = Math.max(0, acc.qurban - qPart);
        acc.zakat = Math.max(0, acc.zakat - zPart);
      } else if (tx.kategori === 'qurban') {
        acc.qurban = Math.max(0, acc.qurban - nom);
      } else if (tx.kategori === 'zakat') {
        acc.zakat = Math.max(0, acc.zakat - nom);
      } else {
        acc.umum = Math.max(0, acc.umum - nom);
      }
    }
  });

  const updatedMembers = members.map((m) => {
    const acc = memberAccum.get(m.id);
    if (!acc) return m;

    const p = acc.pokok;
    const u = acc.umum;
    const z = acc.zakat;
    const q = acc.qurban;
    const total = p + u + z + q;

    return {
      ...m,
      saldoPokok: p,
      saldoUmum: u,
      saldoZakatFitrah: z,
      saldoQurban: q,
      totalSimpanan: total,
    };
  });

  // Synchronize memberTransactions for approved deposits (tabungan & sedekah), strictly 1 entry per verified deposit
  const nextTxList = [...memberTransactions];
  const existingDepositRefs = new Set<string>();
  nextTxList.forEach((t) => {
    if (isDepositSourcedTransaction(t)) {
      const depRef = extractDepositRefId(t);
      if (depRef) existingDepositRefs.add(depRef);
    }
    if (t.id) existingDepositRefs.add(t.id);
  });

  const resolveSedekahCat = (s: any, sdk?: any) => {
    const rawUmum = state.pengaturanBerbagi?.namaUmum || 'Sedekah Umum';
    const safeUmum = rawUmum === 'Sedekah' ? 'Sedekah Umum' : rawUmum;
    if (sdk?.namaBerbagiKustom && sdk.namaBerbagiKustom !== 'Sedekah') return sdk.namaBerbagiKustom;
    const ketLow = String(s.catatanAnggota || sdk?.keterangan || '').toLowerCase();
    const jenisSdk = sdk?.jenis || (ketLow.includes('jumat') ? 'sedekah_jumat' : ketLow.includes('subuh') ? 'sedekah_subuh' : 'sedekah_umum');
    if (jenisSdk === 'sedekah_jumat') return state.pengaturanBerbagi?.namaJumat || 'Sedekah Jumat';
    if (jenisSdk === 'sedekah_subuh') return state.pengaturanBerbagi?.namaSubuh || 'Sedekah Subuh';
    return safeUmum;
  };

  approvedDeposits.forEach((s) => {
    const m = findMemberForDeposit(s, updatedMembers, delMemSet);
    if (!m) return;

    const isSedekah = s.jenis === 'sedekah';
    const txId = isSedekah ? `tx-sdk-${s.id}` : `tx-dep-${s.id}`;

    const isPresent =
      existingDepositRefs.has(s.id) ||
      existingDepositRefs.has(txId) ||
      nextTxList.some((t) => t.referensiId === s.id || t.id === txId);

    if (!isPresent) {
      const createdDate = s.createdAt && !isNaN(new Date(s.createdAt).getTime()) ? new Date(s.createdAt) : null;
      const tgl = (s as any).tanggal || (createdDate ? getWibDateStr(createdDate) : getWibDateStr());
      const jam = (s as any).jam || (createdDate ? getWibTimeStr(createdDate, false) : '09:00');
      if (isSedekah) {
        const sdk = sedekahMap.get(s.id);
        const jenisLabel = resolveSedekahCat(s, sdk);
        const isTftu = s.metode === 'tabungan_umum' || sdk?.sumberDana === 'tabungan_umum';
        nextTxList.push({
          id: txId,
          memberId: m.id,
          tanggal: tgl,
          jam,
          keterangan: isTftu
            ? `TFTU Sedekah ${jenisLabel} dari ${m.nama}`
            : `Sedekah ${jenisLabel} dari ${m.nama} (QRIS)`,
          cbg: '53532',
          tipe: isTftu ? 'keluar' : 'masuk',
          nominal: s.nominal,
          saldoSetelah: 0,
          kategori: isTftu ? 'umum' : 'sedekah',
          referensiId: s.id,
        });
      } else {
        nextTxList.push({
          id: txId,
          memberId: m.id,
          tanggal: tgl,
          jam,
          keterangan: s.jenis === 'kewajiban'
            ? `SETORAN KEWAJIBAN ${s.jumlahHari || Math.round(s.nominal / 2000) || 1} HARI (POKOK, ZAKAT, QURBAN)`
            : `Setoran Tunai ${m.nama}`,
          cbg: s.jenis === 'kewajiban' ? '53732' : '53745',
          tipe: 'masuk',
          nominal: s.nominal,
          saldoSetelah: 0,
          kategori: s.jenis === 'kewajiban' ? 'pokok' : 'umum',
          referensiId: s.id,
        });
      }
      existingDepositRefs.add(s.id);
      existingDepositRefs.add(txId);
    }
  });

  updatedMembers.forEach((m, idx) => {
    const mTransactions = nextTxList
      .filter((t) => t.memberId === m.id)
      .sort(compareMemberTransactionsChrono);

    if (isSriParawatiMember(m)) {
      // Khusus Sri Parawati: Data Anggota wajib sinkron mengikuti Mutasi Rekening (memberTransactions) secara penuh
      let p = 0;
      let u = 0;
      let z = 0;
      let q = 0;
      mTransactions.forEach((t) => {
        if (t.kategori === 'sedekah') {
          t.saldoSetelah = p + u + z + q;
          return;
        }
        const nom = Number(t.nominal) || 0;
        const isKewajibanSplit =
          t.kategori === 'pokok' ||
          String(t.id).startsWith('tx-wajib-') ||
          String(t.keterangan || '').toUpperCase().includes('KEWAJIBAN') ||
          String(t.keterangan || '').includes('50% Pokok');
        if (t.tipe === 'masuk') {
          if (isKewajibanSplit) {
            const pPart = t.splitOverride ? (Number(t.splitOverride.pokok) || 0) : Math.floor(nom * 0.5);
            const qPart = t.splitOverride ? (Number(t.splitOverride.qurban) || 0) : Math.floor(nom * 0.25);
            const zPart = t.splitOverride ? (Number(t.splitOverride.zakat) || 0) : (nom - pPart - qPart);
            p += pPart;
            q += qPart;
            z += zPart;
          } else if (t.kategori === 'qurban') {
            q += nom;
          } else if (t.kategori === 'zakat') {
            z += nom;
          } else {
            u += nom;
          }
        } else {
          if (isKewajibanSplit) {
            const pPart = t.splitOverride ? (Number(t.splitOverride.pokok) || 0) : Math.floor(nom * 0.5);
            const qPart = t.splitOverride ? (Number(t.splitOverride.qurban) || 0) : Math.floor(nom * 0.25);
            const zPart = t.splitOverride ? (Number(t.splitOverride.zakat) || 0) : (nom - pPart - qPart);
            p = Math.max(0, p - pPart);
            q = Math.max(0, q - qPart);
            z = Math.max(0, z - zPart);
          } else if (t.kategori === 'qurban') {
            q = Math.max(0, q - nom);
          } else if (t.kategori === 'zakat') {
            z = Math.max(0, z - nom);
          } else {
            u = Math.max(0, u - nom);
          }
        }
        t.saldoSetelah = p + u + z + q;
      });
      updatedMembers[idx] = {
        ...m,
        saldoPokok: p,
        saldoUmum: u,
        saldoZakatFitrah: z,
        saldoQurban: q,
        totalSimpanan: p + u + z + q,
        jumlahHariPokok: Math.floor(p / (state.profile?.pembagianPokokHarian || 1000)),
      };
      return;
    }

    let running = 0;
    mTransactions.forEach((t) => {
      if (t.kategori !== 'sedekah') {
        running = t.tipe === 'masuk' ? running + t.nominal : Math.max(0, running - t.nominal);
      }
      t.saldoSetelah = running;
    });
  });

  // Synchronize kasList (Buku Kas Anggota & Buku Kas Koperasi) for approved deposits without duplicating existing kas entries
  const nextKasList = [...kasList];
  const approvedDepositById = new Map<string, SetoranVerifikasi>();
  approvedDeposits.forEach((s) => approvedDepositById.set(s.id, s));
  const txByRef = new Map<string, MemberTransaction>();
  nextTxList.forEach((t) => {
    if (t.referensiId && t.kategori !== 'sedekah') txByRef.set(t.referensiId, t);
  });

  const resolveDepositJam = (s: any, matchingTx?: MemberTransaction): string => {
    if (matchingTx?.jam) return matchingTx.jam;
    if (s?.jam) return s.jam;
    if (s?.createdAt && String(s.createdAt).includes('T')) return String(s.createdAt).split('T')[1].slice(0, 5);
    if (s?.verifiedAt && String(s.verifiedAt).includes('T')) return String(s.verifiedAt).split('T')[1].slice(0, 5);
    return '09:00';
  };

  // Backfill missing memberId and jam on existing kas entries linked to deposits or members
  nextKasList.forEach((k, idx) => {
    if (!k) return;
    const refDep = k.referensiId ? approvedDepositById.get(k.referensiId) : undefined;
    const refTx = k.referensiId ? txByRef.get(k.referensiId) : undefined;
    let patched = false;
    const nextK = { ...k };

    if (!nextK.memberId && (k.bukuKas === 'anggota' || refDep)) {
      const matchedM =
        (refDep && findMemberForDeposit(refDep, updatedMembers, delMemSet)) ||
        (refTx && updatedMembers.find((m) => m.id === refTx.memberId)) ||
        (nextK.namaPenerima &&
          updatedMembers.find(
            (m) => m.nama.trim().toLowerCase() === String(nextK.namaPenerima).trim().toLowerCase()
          ));
      if (matchedM) {
        nextK.memberId = matchedM.id;
        patched = true;
      }
    }

    if (!nextK.jam && (k.bukuKas === 'anggota' || refDep)) {
      const resolvedJam =
        refTx?.jam ||
        (refDep && resolveDepositJam(refDep, refTx)) ||
        (nextK.createdAt && String(nextK.createdAt).includes('T')
          ? String(nextK.createdAt).split('T')[1].slice(0, 5)
          : undefined);
      if (resolvedJam) {
        nextK.jam = resolvedJam;
        patched = true;
      }
    }

    if (patched) nextKasList[idx] = nextK;
  });

  const existingKasRefs = new Set<string>();
  nextKasList.forEach((k) => {
    if (k.id) existingKasRefs.add(k.id);
    if (k.referensiId) existingKasRefs.add(k.referensiId);
  });

  approvedDeposits.forEach((s) => {
    if (s.jenis === 'sedekah') {
      const sdk = sedekahMap.get(s.id);
      const m = findMemberForDeposit(s, updatedMembers, delMemSet);
      const mNama = m?.nama || s.memberNama || sdk?.donaturNama || 'Anggota Koperasi';
      const jenisLabel = resolveSedekahCat(s, sdk);
      const isTftu = s.metode === 'tabungan_umum' || sdk?.sumberDana === 'tabungan_umum';
      const tgl = (s as any).tanggal || sdk?.tanggal || (s.createdAt ? s.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
      const nowIso = s.createdAt || sdk?.createdAt || new Date().toISOString();

      const kopId = sdk?.kasKoperasiId || `kas-sedekah-${s.id}`;
      const hasKop = nextKasList.some((k) => k.id === kopId || (k.referensiId === s.id && k.bukuKas === 'koperasi'));
      if (!hasKop && !delKasSet.has(kopId)) {
        nextKasList.push({
          id: kopId,
          bukuKas: 'koperasi',
          tanggal: tgl,
          kategori: jenisLabel,
          keterangan: isTftu ? `TFTU Sedekah dari ${mNama}` : `Sedekah dari ${mNama}`,
          namaPenerima: mNama,
          memberId: m?.id || s.memberId,
          referensiId: s.id,
          tipe: 'masuk',
          nominal: s.nominal,
          saldoKasSetelah: 0,
          inputBy: s.verifiedBy || sdk?.verifiedBy || 'Admin Koperasi',
          status: 'approved',
          createdAt: nowIso,
        });
      }

      if (isTftu) {
        const angId = sdk?.kasAnggotaId || `kas-ang-tftu-${s.id}`;
        const hasAng = nextKasList.some((k) => k.id === angId || (k.referensiId === s.id && k.bukuKas === 'anggota' && k.tipe === 'keluar'));
        if (!hasAng && !delKasSet.has(angId)) {
          nextKasList.push({
            id: angId,
            bukuKas: 'anggota',
            tanggal: tgl,
            kategori: 'Tabungan Bebas',
            keterangan: `TFTU Sedekah ${jenisLabel} dari ${mNama}`,
            namaPenerima: mNama,
            memberId: m?.id || s.memberId,
            referensiId: s.id,
            tipe: 'keluar',
            nominal: s.nominal,
            saldoKasSetelah: 0,
            inputBy: s.verifiedBy || sdk?.verifiedBy || mNama,
            status: 'approved',
            createdAt: nowIso,
          });
        }
      }
      return;
    }

    const m = findMemberForDeposit(s, updatedMembers, delMemSet);
    if (!m) return;

    if (delTxSet.has(`tx-dep-${s.id}`)) return;
    if (existingKasRefs.has(s.id)) return;

    const tgl = (s as any).tanggal || (s.createdAt ? s.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    const jam = resolveDepositJam(s, txByRef.get(s.id));
    const nowIso = s.createdAt || new Date().toISOString();
    const jlhHari = s.jumlahHari || Math.round(s.nominal / 2000) || 1;

    if (s.jenis === 'kewajiban') {
      const pokokNom = Math.floor(s.nominal * 0.5);
      const qurbanNom = Math.floor(s.nominal * 0.25);
      const zakatNom = s.nominal - pokokNom - qurbanNom;
      const idP = `kas-ang-pokok-${s.id}`;
      const idZ = `kas-ang-zakat-${s.id}`;
      const idQ = `kas-ang-qurban-${s.id}`;
      if (!delKasSet.has(idP) && !existingKasRefs.has(idP)) {
        nextKasList.push({
          id: idP,
          bukuKas: 'anggota',
          tanggal: tgl,
          jam,
          kategori: 'Tabungan Pokok',
          keterangan: `Setoran Tabungan Pokok ${m.nama} (${jlhHari} Hari)`,
          namaPenerima: m.nama,
          memberId: m.id,
          tipe: 'masuk',
          nominal: pokokNom,
          saldoKasSetelah: 0,
          inputBy: s.verifiedBy || 'Admin Koperasi',
          status: 'approved',
          createdAt: nowIso,
          referensiId: s.id,
        });
      }
      if (!delKasSet.has(idZ) && !existingKasRefs.has(idZ)) {
        nextKasList.push({
          id: idZ,
          bukuKas: 'anggota',
          tanggal: tgl,
          jam,
          kategori: 'Tabungan Zakat',
          keterangan: `Setoran Tabungan Zakat ${m.nama} (${jlhHari} Hari)`,
          namaPenerima: m.nama,
          memberId: m.id,
          tipe: 'masuk',
          nominal: zakatNom,
          saldoKasSetelah: 0,
          inputBy: s.verifiedBy || 'Admin Koperasi',
          status: 'approved',
          createdAt: nowIso,
          referensiId: s.id,
        });
      }
      if (!delKasSet.has(idQ) && !existingKasRefs.has(idQ)) {
        nextKasList.push({
          id: idQ,
          bukuKas: 'anggota',
          tanggal: tgl,
          jam,
          kategori: 'Tabungan Qurban',
          keterangan: `Setoran Tabungan Qurban ${m.nama} (${jlhHari} Hari)`,
          namaPenerima: m.nama,
          memberId: m.id,
          tipe: 'masuk',
          nominal: qurbanNom,
          saldoKasSetelah: 0,
          inputBy: s.verifiedBy || 'Admin Koperasi',
          status: 'approved',
          createdAt: nowIso,
          referensiId: s.id,
        });
      }
      existingKasRefs.add(s.id);
    } else if (s.jenis === 'umum') {
      const idU = `kas-ang-umum-${s.id}`;
      if (!delKasSet.has(idU) && !existingKasRefs.has(idU)) {
        nextKasList.push({
          id: idU,
          bukuKas: 'anggota',
          tanggal: tgl,
          jam,
          kategori: 'Tabungan Bebas',
          keterangan: `Setoran Tunai ${m.nama}`,
          namaPenerima: m.nama,
          memberId: m.id,
          tipe: 'masuk',
          nominal: s.nominal,
          saldoKasSetelah: 0,
          inputBy: s.verifiedBy || 'Admin Koperasi',
          status: 'approved',
          createdAt: nowIso,
          referensiId: s.id,
        });
      }
      existingKasRefs.add(s.id);
    }
  });

  // Synchronize active balance adjustment mutations (tx-adj- / ADJ-) into Buku Kas Anggota (1-to-1 & per-split exact)
  const claimedAdjKasIds = new Set<string>();
  const duplicateAdjKasIdsToRemove = new Set<string>();
  nextTxList.forEach((tx) => {
    const isAdj = String(tx.id || '').startsWith('tx-adj-') || String(tx.referensiId || '').startsWith('ADJ-');
    if (!isAdj) return;
    if (tx.referensiId && delSetoranSet.has(tx.referensiId)) return;
    const m = updatedMembers.find((mem) => mem.id === tx.memberId);
    if (!m) return;

    const nom = Number(tx.nominal) || 0;
    if (nom <= 0) return;

    const tsMatch = String(tx.id).match(/(\d{10,})/);
    const tsBase = tsMatch ? Number(tsMatch[1]) : Date.now();
    const mSuffix = m.id.slice(-4);
    const refId = tx.referensiId || `ADJ-${String(tsBase).slice(-6)}-${m.id.slice(-3)}`;

    const isPokokSplit =
      tx.kategori === 'pokok' ||
      String(tx.keterangan || '').toLowerCase().includes('tabungan pokok') ||
      String(tx.keterangan || '').includes('50% Pokok');

    let matchedKasRows = nextKasList.filter(
      (k) =>
        !claimedAdjKasIds.has(k.id) &&
        k.bukuKas === 'anggota' &&
        ((k.referensiId && k.referensiId === refId) ||
          (tsMatch && String(k.id || '').includes(tsMatch[1])))
    );

    // Legacy unlinked fallback (1-to-1 only via claimedAdjKasIds)
    if (matchedKasRows.length === 0) {
      if (isPokokSplit) {
        const leg = nextKasList.find(
          (k) =>
            !claimedAdjKasIds.has(k.id) &&
            k.bukuKas === 'anggota' &&
            !k.referensiId &&
            k.memberId === m.id &&
            k.tanggal === tx.tanggal &&
            k.tipe === tx.tipe &&
            k.kategori === 'Tabungan Pokok' &&
            Number(k.nominal) === Math.floor(nom * 0.5)
        );
        if (leg) matchedKasRows = [leg];
      } else {
        const leg = nextKasList.find(
          (k) =>
            !claimedAdjKasIds.has(k.id) &&
            k.bukuKas === 'anggota' &&
            !k.referensiId &&
            k.memberId === m.id &&
            k.tanggal === tx.tanggal &&
            k.tipe === tx.tipe &&
            Number(k.nominal) === nom
        );
        if (leg) matchedKasRows = [leg];
      }
    }

    if (matchedKasRows.length > 1) {
      const winnerByCat = new Map<string, any>();
      const losers: any[] = [];
      matchedKasRows.forEach((k) => {
        const catKey = isPokokSplit ? String(k.kategori || '') : 'SINGLE';
        const existing = winnerByCat.get(catKey);
        if (!existing) {
          winnerByCat.set(catKey, k);
        } else {
          const existingIsSystem = existing.inputBy === 'Admin Koperasi';
          const currentIsSystem = k.inputBy === 'Admin Koperasi';
          if (existingIsSystem && !currentIsSystem) {
            losers.push(existing);
            winnerByCat.set(catKey, k);
          } else {
            losers.push(k);
          }
        }
      });
      if (losers.length > 0) {
        losers.forEach((l) => {
          duplicateAdjKasIdsToRemove.add(l.id);
          delKasSet.add(l.id);
        });
        matchedKasRows = Array.from(winnerByCat.values());
      }
    }

    matchedKasRows.forEach((k) => claimedAdjKasIds.add(k.id));

    const pId = `kas-adj-p-${tsBase}-${mSuffix}`;
    const qId = `kas-adj-q-${tsBase + 1}-${mSuffix}`;
    const zId = `kas-adj-z-${tsBase + 2}-${mSuffix}`;
    const uId = `kas-adj-u-${tsBase}-${mSuffix}`;

    const isAdjSplitDeleted = (splitPrefix: string, canonicalId: string): boolean => {
      if (delKasSet.has(canonicalId)) return true;
      if (!tsMatch) return false;
      const nTs = Number(tsMatch[1]);
      for (const delId of delKasSet) {
        if (String(delId).startsWith(splitPrefix)) {
          const dm = String(delId).match(/(\d{10,})/);
          if (dm && Math.abs(Number(dm[1]) - nTs) <= 5 && (!mSuffix || String(delId).endsWith(`-${mSuffix}`))) {
            return true;
          }
        }
      }
      return false;
    };

    const tgl = tx.tanggal || getWibDateStr();
    const jam = tx.jam || '09:00';
    const createdIso = `${tgl}T${jam}:00.000Z`;
    const cleanKet = String(tx.keterangan || 'Penyesuaian Saldo')
      .replace(/^KOREKSI TABUNGAN POKOK\s*\([^)]*\)\s*:\s*/i, '')
      .replace(/^KOREKSI SALDO UMUM\s*:\s*/i, '')
      .trim() || 'Penyesuaian Saldo';
    const hari = tx.jumlahHari || Math.max(1, Math.round(nom / (state.profile?.biayaWajibHarian || 2000)));
    const tipeVal = tx.tipe === 'keluar' ? 'keluar' : 'masuk';

    if (isPokokSplit) {
      const pPart = tx.splitOverride ? (Number(tx.splitOverride.pokok) || 0) : Math.floor(nom * 0.5);
      const qPart = tx.splitOverride ? (Number(tx.splitOverride.qurban) || 0) : Math.floor(nom * 0.25);
      const zPart = tx.splitOverride ? (Number(tx.splitOverride.zakat) || 0) : (nom - pPart - qPart);
      const hasPokok = matchedKasRows.some(
        (k) => k.kategori === 'Tabungan Pokok' || String(k.id || '').startsWith('kas-adj-p-')
      );
      const hasQurban = matchedKasRows.some(
        (k) => k.kategori === 'Tabungan Qurban' || String(k.id || '').startsWith('kas-adj-q-')
      );
      const hasZakat = matchedKasRows.some(
        (k) => k.kategori === 'Tabungan Zakat' || String(k.id || '').startsWith('kas-adj-z-')
      );

      if (!hasPokok && pPart > 0 && !isAdjSplitDeleted('kas-adj-p-', pId)) {
        claimedAdjKasIds.add(pId);
        nextKasList.push({
          id: pId,
          bukuKas: 'anggota',
          tanggal: tgl,
          jam,
          kategori: 'Tabungan Pokok',
          keterangan: `Koreksi Tabungan Pokok 50% ${m.nama} (${hari} Hari): ${cleanKet}`,
          namaPenerima: m.nama,
          memberId: m.id,
          referensiId: refId,
          jumlahHari: hari,
          tipe: tipeVal,
          nominal: pPart,
          saldoKasSetelah: 0,
          inputBy: 'Admin Koperasi',
          approvedBy: 'Super Admin',
          status: 'approved',
          createdAt: createdIso,
        });
      }
      if (!hasQurban && qPart > 0 && !isAdjSplitDeleted('kas-adj-q-', qId)) {
        claimedAdjKasIds.add(qId);
        nextKasList.push({
          id: qId,
          bukuKas: 'anggota',
          tanggal: tgl,
          jam,
          kategori: 'Tabungan Qurban',
          keterangan: `Koreksi Tabungan Qurban 25% ${m.nama} (${hari} Hari): ${cleanKet}`,
          namaPenerima: m.nama,
          memberId: m.id,
          referensiId: refId,
          jumlahHari: hari,
          tipe: tipeVal,
          nominal: qPart,
          saldoKasSetelah: 0,
          inputBy: 'Admin Koperasi',
          approvedBy: 'Super Admin',
          status: 'approved',
          createdAt: createdIso,
        });
      }
      if (!hasZakat && zPart > 0 && !isAdjSplitDeleted('kas-adj-z-', zId)) {
        claimedAdjKasIds.add(zId);
        nextKasList.push({
          id: zId,
          bukuKas: 'anggota',
          tanggal: tgl,
          jam,
          kategori: 'Tabungan Zakat',
          keterangan: `Koreksi Tabungan Zakat 25% ${m.nama} (${hari} Hari): ${cleanKet}`,
          namaPenerima: m.nama,
          memberId: m.id,
          referensiId: refId,
          jumlahHari: hari,
          tipe: tipeVal,
          nominal: zPart,
          saldoKasSetelah: 0,
          inputBy: 'Admin Koperasi',
          approvedBy: 'Super Admin',
          status: 'approved',
          createdAt: createdIso,
        });
      }
    } else if (matchedKasRows.length === 0 && !isAdjSplitDeleted('kas-adj-u-', uId)) {
      claimedAdjKasIds.add(uId);
      nextKasList.push({
        id: uId,
        bukuKas: 'anggota',
        tanggal: tgl,
        jam,
        kategori: 'Tabungan Bebas',
        keterangan: `Koreksi Saldo Umum ${tipeVal === 'keluar' ? 'Keluar' : 'Masuk'} ${m.nama}: ${cleanKet}`,
        namaPenerima: m.nama,
        memberId: m.id,
        referensiId: refId,
        tipe: tipeVal,
        nominal: nom,
        saldoKasSetelah: 0,
        inputBy: 'Admin Koperasi',
        approvedBy: 'Super Admin',
        status: 'approved',
        createdAt: createdIso,
      });
    }
  });

  if (duplicateAdjKasIdsToRemove.size > 0) {
    for (let i = nextKasList.length - 1; i >= 0; i--) {
      if (duplicateAdjKasIdsToRemove.has(nextKasList[i]?.id)) {
        nextKasList.splice(i, 1);
      }
    }
  }

  const recomputeType = (type: string) => {
    const items = nextKasList
      .filter((k) => k.bukuKas === type)
      .slice()
      .sort((a, b) => {
        const cmp = `${a.tanggal || ''} ${a.createdAt || ''}`.localeCompare(`${b.tanggal || ''} ${b.createdAt || ''}`);
        return cmp !== 0 ? cmp : String(a.id || '').localeCompare(String(b.id || ''));
      });
    let run = 0;
    const map = new Map<string, number>();
    items.forEach((it) => {
      if (it.status === 'approved') {
        run = it.tipe === 'masuk' ? run + it.nominal : Math.max(0, run - it.nominal);
      }
      map.set(it.id, run);
    });
    return map;
  };

  const mapAnggota = recomputeType('anggota');
  const mapKoperasi = recomputeType('koperasi');
  const updatedKasList = nextKasList
    .map((k) => ({
      ...k,
      saldoKasSetelah:
        k.bukuKas === 'anggota'
          ? (mapAnggota.get(k.id) ?? k.saldoKasSetelah)
          : (mapKoperasi.get(k.id) ?? k.saldoKasSetelah),
    }))
    .sort((a, b) => {
      const cmp = `${b.tanggal || ''} ${b.createdAt || ''}`.localeCompare(`${a.tanggal || ''} ${a.createdAt || ''}`);
      return cmp !== 0 ? cmp : String(b.id || '').localeCompare(String(a.id || ''));
    });

  return {
    ...state,
    members: updatedMembers,
    setoranList: setoranList.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
    sedekahList: sedekahList.sort((a, b) => ((b.createdAt || b.tanggal) > (a.createdAt || a.tanggal) ? 1 : -1)),
    memberTransactions: nextTxList.sort(compareMemberTransactionsDesc),
    kasList: updatedKasList,
    deletedTransactionIds: Array.from(delTxSet),
    deletedKasIds: Array.from(delKasSet),
    deletedSetoranIds: Array.from(delSetoranSet),
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
  const errMsg = error instanceof Error ? error.message : String(error);
  // Silently ignore normal WebChannel / long-polling reconnect events
  if (
    !errMsg ||
    errMsg.includes('Listen') ||
    errMsg.includes('transport errored') ||
    errMsg.includes('WebChannelConnection') ||
    errMsg.includes('Name: Message:') ||
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('cancelled') ||
    errMsg.includes('unavailable') ||
    errMsg.includes('offline mode') ||
    errMsg.includes('client is offline') ||
    errMsg.includes('network-request-failed') ||
    errMsg.includes('Could not reach Cloud Firestore') ||
    errMsg.includes('The operation could not be completed') ||
    errMsg.includes('permission')
  ) {
    return;
  }
  const errInfo = {
    error: errMsg,
    operationType,
    path,
  };
  console.warn('Firestore Notice:', JSON.stringify(errInfo));
}

// Unified Sedekah List Helper (Cross-matches setoran with jenis: sedekah and sedekahList)
export function getUnifiedSedekahList(state: AppState): SedekahBerbagiEntry[] {
  const sedekahMap = new Map<string, SedekahBerbagiEntry>();
  (state.sedekahList || []).forEach((s) => {
    if (s && s.id) sedekahMap.set(s.id, s);
  });
  (state.setoranList || []).forEach((st) => {
    if (st && st.jenis === 'sedekah' && !sedekahMap.has(st.id)) {
      const isApproved = st.status === 'disetujui' || (st as any).status === 'approved';
      sedekahMap.set(st.id, {
        id: st.id,
        tanggal: (st.createdAt || new Date().toISOString()).slice(0, 10),
        jam: (st.createdAt || new Date().toISOString()).slice(11, 16),
        tipe: 'penerimaan',
        jenis: (st.catatanAnggota?.toLowerCase().includes('jumat')
          ? 'sedekah_jumat'
          : st.catatanAnggota?.toLowerCase().includes('subuh')
          ? 'sedekah_subuh'
          : 'sedekah_umum') as any,
        namaBerbagiKustom: st.catatanAnggota || 'Donasi Sedekah',
        nominal: st.nominal,
        donaturMemberId: st.memberId,
        donaturNama: st.memberNama,
        donaturRekening: st.memberRekening,
        donaturNomorAnggota: st.memberNomorAnggota,
        donaturWilayah: (st as any).memberWilayah || '',
        sumberDana: st.metode === 'tabungan_umum' ? 'tabungan_umum' : 'qris',
        buktiTransferUrl: st.buktiTransferUrl,
        keterangan: st.catatanAnggota || 'Donasi Sedekah',
        status: isApproved ? 'approved' : 'pending',
        inputBy: st.memberNama || 'Anggota',
        verifiedBy: st.verifiedBy,
        verifiedAt: st.verifiedAt,
        createdAt: st.createdAt || new Date().toISOString(),
      });
    }
  });
  return Array.from(sedekahMap.values());
}

function canonicalizeSanitizedValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map((item) => canonicalizeSanitizedValue(item));
  }
  const sorted: Record<string, any> = {};
  for (const k of Object.keys(val).sort()) {
    const v = val[k];
    if (v !== undefined) {
      sorted[k] = canonicalizeSanitizedValue(v);
    }
  }
  return sorted;
}

// Deep sanitization helper to strip all undefined values & stabilize key order before hashing/writing to Firestore
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  try {
    return canonicalizeSanitizedValue(JSON.parse(JSON.stringify(data))) as T;
  } catch {
    if (typeof data === 'object') {
      const clean: any = Array.isArray(data) ? [] : {};
      for (const k of Object.keys(data as any).sort()) {
        const v = (data as any)[k];
        if (v !== undefined) {
          clean[k] = v;
        }
      }
      return clean;
    }
    return data;
  }
}

// Track last synced hashes to prevent redundant network writes & enforce single-flight write queue
const lastWrittenMap = new Map<string, string>();
let shardedTimer: any = null;
let isFirestoreSyncRunning = false;
let queuedFirestoreSyncState: AppState | null = null;
let hasHydratedRemoteState = false;

export function getHasHydratedRemoteState(): boolean {
  return hasHydratedRemoteState;
}

// Seed known server-authoritative hashes so unchanged documents are NOT re-blasted to Firestore on every mutation
function seedFirestoreSyncedHashesFromServer(serverData: Partial<AppState>, forceOverwrite = false) {
  if (!serverData || typeof serverData !== 'object') return;
  try {
    const setHash = (key: string, val: string) => {
      if (forceOverwrite || !lastWrittenMap.has(key)) {
        lastWrittenMap.set(key, val);
      }
    };
    if (serverData.profile) {
      const generalCore = sanitizeForFirestore({
        id: 'general',
        profile: serverData.profile || {},
        categoriesKasKoperasi: serverData.categoriesKasKoperasi || {},
        pengaturanBerbagi: serverData.pengaturanBerbagi || {},
        sedekahList: serverData.sedekahList || [],
        penyaluranList: serverData.penyaluranList || [],
        pendingMutasiRequests: serverData.pendingMutasiRequests || [],
        maintenanceLock: serverData.maintenanceLock || { isLocked: false },
        accountNumberSchemaVersion: serverData.accountNumberSchemaVersion || 2,
        lastRunningNumber: serverData.lastRunningNumber || 769,
        deletedMemberIds: serverData.deletedMemberIds || [],
        deletedTransactionIds: serverData.deletedTransactionIds || [],
        deletedKasIds: serverData.deletedKasIds || [],
        deletedSetoranIds: serverData.deletedSetoranIds || [],
        deletedSuratIds: (serverData.deletedSuratIds || []).slice(-500),
        deletedChatIds: (serverData.deletedChatIds || []).slice(-1000),
        suratResetAt: serverData.suratResetAt || '',
        chatClearedAt: serverData.chatClearedAt || '',
        chatClearedBeforeByMember: serverData.chatClearedBeforeByMember || {},
        usedAccountNumbers: serverData.usedAccountNumbers || [],
        usedMemberNumbers: serverData.usedMemberNumbers || [],
      });
      setHash('settings/general', JSON.stringify(generalCore));
    }
    if (Array.isArray(serverData.admins)) {
      const adminsCore = sanitizeForFirestore({
        id: 'admins',
        admins: serverData.admins,
        deletedAdminIds: (serverData as any).deletedAdminIds || [],
      });
      setHash('settings/admins', JSON.stringify(adminsCore));
      for (const adm of serverData.admins) {
        if (adm && adm.id) {
          setHash(`admins/${adm.id}`, JSON.stringify(sanitizeForFirestore({ ...adm })));
        }
      }
    }
    if (Array.isArray(serverData.members)) {
      for (const m of serverData.members) {
        if (m && m.id && !String(m.id).includes('-dup-')) {
          setHash(`members/${m.id}`, JSON.stringify(sanitizeForFirestore({ ...m })));
        }
      }
    }
    if (Array.isArray(serverData.setoranList)) {
      for (const s of serverData.setoranList) {
        if (s && s.id) {
          setHash(`setoran/${s.id}`, JSON.stringify(sanitizeForFirestore({ ...s })));
        }
      }
    }
    if (Array.isArray(serverData.sedekahList)) {
      for (const sdk of serverData.sedekahList) {
        if (sdk && sdk.id) {
          setHash(`sedekah/${sdk.id}`, JSON.stringify(sanitizeForFirestore({ ...sdk })));
        }
      }
    }
    if (Array.isArray(serverData.kasList)) {
      for (const k of serverData.kasList) {
        if (k && k.id) {
          const coreK: any = sanitizeForFirestore({ ...k });
          if (coreK && typeof coreK === 'object') {
            delete coreK.saldoKasSetelah;
            delete coreK.updatedAt;
          }
          setHash(`kas/${k.id}`, JSON.stringify(coreK));
        }
      }
    }
    if (Array.isArray(serverData.memberTransactions)) {
      for (const tx of serverData.memberTransactions) {
        if (tx && tx.id) {
          const coreTx: any = sanitizeForFirestore({ ...tx });
          if (coreTx && typeof coreTx === 'object') {
            delete coreTx.saldoSetelah;
            delete coreTx.updatedAt;
          }
          setHash(`transactions/${tx.id}`, JSON.stringify(coreTx));
        }
      }
    }
    if (Array.isArray(serverData.chatMessages)) {
      for (const c of serverData.chatMessages.slice(-100)) {
        if (c && c.id) {
          setHash(`chats/${c.id}`, JSON.stringify(sanitizeForFirestore({ ...c })));
        }
      }
    }
    if (Array.isArray(serverData.suratList)) {
      for (const sr of serverData.suratList) {
        if (sr && sr.id) {
          setHash(`surat/${sr.id}`, JSON.stringify(sanitizeForFirestore({ ...sr })));
        }
      }
    }
  } catch {}
}

// Merge realtime chat snapshots locally without triggering a full /api/state or 260-doc Firestore writeback
export function applyRealtimeChatMessages(incoming: ChatMessage[]): boolean {
  if (!Array.isArray(incoming) || incoming.length === 0) return false;
  const delChatSet = new Set<string>(globalState.deletedChatIds || []);
  const existingMap = new Map<string, ChatMessage>();
  (globalState.chatMessages || []).forEach((m) => {
    if (!isChatMessageClearedClient(m, delChatSet, globalState.chatClearedAt, globalState.chatClearedBeforeByMember)) {
      existingMap.set(m.id, m);
    }
  });
  let hasChanges = false;
  incoming.forEach((inMsg) => {
    if (isChatMessageClearedClient(inMsg, delChatSet, globalState.chatClearedAt, globalState.chatClearedBeforeByMember)) {
      return;
    }
    const ex = existingMap.get(inMsg.id);
    if (!ex) {
      existingMap.set(inMsg.id, inMsg);
      hasChanges = true;
    } else if (
      ex.isReadByAdmin !== inMsg.isReadByAdmin ||
      ex.isReadByMember !== inMsg.isReadByMember ||
      ex.pesan !== inMsg.pesan
    ) {
      existingMap.set(inMsg.id, { ...ex, ...inMsg });
      hasChanges = true;
    }
  });
  if (!hasChanges) return false;
  globalState = {
    ...globalState,
    chatMessages: Array.from(existingMap.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ),
  };
  scheduleLocalStoragePersist();
  notifyListeners();
  return true;
}

async function runFirestoreTasksInChunks(tasks: Array<() => Promise<any>>, chunkSize = 25) {
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const batch = tasks.slice(i, i + chunkSize);
    await Promise.all(batch.map((fn) => fn().catch(() => {})));
  }
}

// Sharded Cloud Firestore synchronizer (resolves 1MB document limit, undefined fields, and concurrent write storms)
export async function syncShardedToFirestore(state: AppState) {
  if (!getIsInternetConnected()) {
    queuedFirestoreSyncState = state;
    return;
  }
  if (isFirestoreSyncRunning) {
    queuedFirestoreSyncState = state;
    return;
  }

  isFirestoreSyncRunning = true;
  try {
    const { db } = await import('./firebase');
    const { doc, setDoc, deleteDoc } = await import('firebase/firestore');
    const now = new Date().toISOString();
    let hasAnyDocWritten = false;
    const tasks: Array<() => Promise<any>> = [];

    // 1. Sharded settings/general (includes sedekahList & penyaluranList so Sedekah is synced across all devices)
    const generalCore = sanitizeForFirestore({
      id: 'general',
      profile: state.profile || {},
      categoriesKasKoperasi: state.categoriesKasKoperasi || {},
      pengaturanBerbagi: state.pengaturanBerbagi || {},
      sedekahList: state.sedekahList || [],
      penyaluranList: state.penyaluranList || [],
      pendingMutasiRequests: state.pendingMutasiRequests || [],
      maintenanceLock: state.maintenanceLock || { isLocked: false },
      accountNumberSchemaVersion: state.accountNumberSchemaVersion || 2,
      lastRunningNumber: state.lastRunningNumber || 769,
      deletedMemberIds: state.deletedMemberIds || [],
      deletedTransactionIds: state.deletedTransactionIds || [],
      deletedKasIds: state.deletedKasIds || [],
      deletedSetoranIds: state.deletedSetoranIds || [],
      deletedSuratIds: (state.deletedSuratIds || []).slice(-500),
      deletedChatIds: (state.deletedChatIds || []).slice(-1000),
      suratResetAt: state.suratResetAt || '',
      chatClearedAt: state.chatClearedAt || '',
      chatClearedBeforeByMember: state.chatClearedBeforeByMember || {},
      usedAccountNumbers: state.usedAccountNumbers || [],
      usedMemberNumbers: state.usedMemberNumbers || [],
    });
    const generalStr = JSON.stringify(generalCore);
    if (hasHydratedRemoteState && lastWrittenMap.get('settings/general') !== generalStr) {
      tasks.push(async () => {
        await setDoc(
          doc(db, 'settings', 'general'),
          { ...generalCore, updatedAt: now, updatedBy: CLIENT_ID },
          { merge: true }
        ).catch((e) => handleFirestoreError(e, OperationType.WRITE, 'settings/general'));
        lastWrittenMap.set('settings/general', generalStr);
      });
      hasAnyDocWritten = true;
    }

    // 2. Sharded settings/admins + sharded admins collection
    const adminsCore = sanitizeForFirestore({
      id: 'admins',
      admins: state.admins || [],
      deletedAdminIds: (state as any).deletedAdminIds || [],
    });
    const adminsStr = JSON.stringify(adminsCore);
    if (lastWrittenMap.get('settings/admins') !== adminsStr) {
      tasks.push(async () => {
        await setDoc(
          doc(db, 'settings', 'admins'),
          { ...adminsCore, updatedAt: now, updatedBy: CLIENT_ID },
          { merge: true }
        ).catch((e) => handleFirestoreError(e, OperationType.WRITE, 'settings/admins'));
        lastWrittenMap.set('settings/admins', adminsStr);
      });
      hasAnyDocWritten = true;
    }
    for (const adm of state.admins || []) {
      if (adm && adm.id) {
        const key = `admins/${adm.id}`;
        const cleanAdm = sanitizeForFirestore({ ...adm });
        const aStr = JSON.stringify(cleanAdm);
        if (lastWrittenMap.get(key) !== aStr) {
          tasks.push(async () => {
            await setDoc(doc(db, 'admins', adm.id), { ...cleanAdm, updatedAt: now }, { merge: true }).catch(() => {});
            lastWrittenMap.set(key, aStr);
          });
          hasAnyDocWritten = true;
        }
      }
    }
    for (const delAdmId of (state as any).deletedAdminIds || []) {
      const delKey = `deleted_admins/${delAdmId}`;
      if (!lastWrittenMap.has(delKey)) {
        tasks.push(async () => {
          await deleteDoc(doc(db, 'admins', delAdmId)).catch(() => {});
          lastWrittenMap.set(delKey, '1');
        });
        hasAnyDocWritten = true;
      }
    }

    // 3. Sharded Members collection (each member is an isolated ~1KB doc, strictly deduplicated and free of -dup- artifacts)
    const cleanMembersForFs = deduplicateMembersClient(state.members || [], state.deletedMemberIds || []);
    for (const m of cleanMembersForFs) {
      if (m && m.id && !String(m.id).includes('-dup-')) {
        const key = `members/${m.id}`;
        const cleanMember = sanitizeForFirestore({ ...m });
        const mStr = JSON.stringify(cleanMember);
        if (lastWrittenMap.get(key) !== mStr) {
          tasks.push(async () => {
            await setDoc(doc(db, 'members', m.id), { ...cleanMember, updatedAt: now }, { merge: true }).catch((e) =>
              handleFirestoreError(e, OperationType.WRITE, key)
            );
            lastWrittenMap.set(key, mStr);
          });
          hasAnyDocWritten = true;
        }
      }
    }
    for (const delId of state.deletedMemberIds || []) {
      const delKey = `deleted_members/${delId}`;
      if (!lastWrittenMap.has(delKey)) {
        tasks.push(async () => {
          await deleteDoc(doc(db, 'members', delId)).catch(() => {});
          lastWrittenMap.set(delKey, '1');
        });
        hasAnyDocWritten = true;
      }
    }

    // 4. Sharded Setoran & Sedekah collections
    for (const s of state.setoranList || []) {
      if (s && s.id) {
        const key = `setoran/${s.id}`;
        const cleanSetoran = sanitizeForFirestore({ ...s });
        const sStr = JSON.stringify(cleanSetoran);
        if (lastWrittenMap.get(key) !== sStr) {
          tasks.push(async () => {
            await setDoc(doc(db, 'setoran', s.id), { ...cleanSetoran, updatedAt: now }, { merge: true }).catch((e) =>
              handleFirestoreError(e, OperationType.WRITE, key)
            );
            lastWrittenMap.set(key, sStr);
          });
          hasAnyDocWritten = true;
        }
      }
    }
    for (const sdk of state.sedekahList || []) {
      if (sdk && sdk.id) {
        const key = `sedekah/${sdk.id}`;
        const cleanSdk = sanitizeForFirestore({ ...sdk });
        const sdkStr = JSON.stringify(cleanSdk);
        if (lastWrittenMap.get(key) !== sdkStr) {
          tasks.push(async () => {
            await setDoc(doc(db, 'sedekah', sdk.id), { ...cleanSdk, updatedAt: now }, { merge: true }).catch(() => {});
            lastWrittenMap.set(key, sdkStr);
          });
          hasAnyDocWritten = true;
        }
      }
    }
    for (const delSetId of state.deletedSetoranIds || []) {
      const delKey = `deleted_setoran/${delSetId}`;
      if (!lastWrittenMap.has(delKey)) {
        tasks.push(async () => {
          await deleteDoc(doc(db, 'setoran', delSetId)).catch(() => {});
          await deleteDoc(doc(db, 'sedekah', delSetId)).catch(() => {});
          lastWrittenMap.set(delKey, '1');
        });
        hasAnyDocWritten = true;
      }
    }

    // 5. Sharded Kas collection
    for (const k of state.kasList || []) {
      if (k && k.id) {
        const key = `kas/${k.id}`;
        const cleanKas = sanitizeForFirestore({ ...k });
        const coreKas: any = { ...cleanKas };
        delete coreKas.saldoKasSetelah;
        delete coreKas.updatedAt;
        const kStr = JSON.stringify(coreKas);
        if (lastWrittenMap.get(key) !== kStr) {
          tasks.push(async () => {
            await setDoc(doc(db, 'kas', k.id), { ...cleanKas, updatedAt: now }, { merge: true }).catch((e) =>
              handleFirestoreError(e, OperationType.WRITE, key)
            );
            lastWrittenMap.set(key, kStr);
          });
          hasAnyDocWritten = true;
        }
      }
    }
    for (const delKasId of state.deletedKasIds || []) {
      const delKey = `deleted_kas/${delKasId}`;
      if (!lastWrittenMap.has(delKey)) {
        tasks.push(async () => {
          await deleteDoc(doc(db, 'kas', delKasId)).catch(() => {});
          lastWrittenMap.set(delKey, '1');
        });
        hasAnyDocWritten = true;
      }
    }

    // 6. Sharded Member Transactions collection
    for (const tx of state.memberTransactions || []) {
      if (tx && tx.id) {
        const key = `transactions/${tx.id}`;
        const cleanTx = sanitizeForFirestore({ ...tx });
        const coreTx: any = { ...cleanTx };
        delete coreTx.saldoSetelah;
        delete coreTx.updatedAt;
        const txStr = JSON.stringify(coreTx);
        if (lastWrittenMap.get(key) !== txStr) {
          tasks.push(async () => {
            await setDoc(doc(db, 'transactions', tx.id), { ...cleanTx, updatedAt: now }, { merge: true }).catch((e) =>
              handleFirestoreError(e, OperationType.WRITE, key)
            );
            lastWrittenMap.set(key, txStr);
          });
          hasAnyDocWritten = true;
        }
      }
    }
    for (const delTxId of state.deletedTransactionIds || []) {
      const delKey = `deleted_tx/${delTxId}`;
      if (!lastWrittenMap.has(delKey)) {
        tasks.push(async () => {
          await deleteDoc(doc(db, 'transactions', delTxId)).catch(() => {});
          lastWrittenMap.set(delKey, '1');
        });
        hasAnyDocWritten = true;
      }
    }

    // 7. Sharded Chat Messages (Recent 100) + deletedChatIds cleanup
    const delChatSetFs = new Set<string>(state.deletedChatIds || []);
    const recentChats = (state.chatMessages || []).slice(-100);
    for (const c of recentChats) {
      if (c && c.id && !delChatSetFs.has(c.id)) {
        const key = `chats/${c.id}`;
        const cleanChat = sanitizeForFirestore({ ...c });
        const cStr = JSON.stringify(cleanChat);
        if (lastWrittenMap.get(key) !== cStr) {
          tasks.push(async () => {
            await setDoc(doc(db, 'chats', c.id), cleanChat, { merge: true }).catch((e) =>
              handleFirestoreError(e, OperationType.WRITE, key)
            );
            lastWrittenMap.set(key, cStr);
          });
          hasAnyDocWritten = true;
        }
      }
    }
    for (const delChatId of (state.deletedChatIds || []).slice(-200)) {
      const delKey = `deleted_chats/${delChatId}`;
      if (!lastWrittenMap.has(delKey)) {
        tasks.push(async () => {
          await deleteDoc(doc(db, 'chats', delChatId)).catch(() => {});
          lastWrittenMap.set(delKey, '1');
        });
        hasAnyDocWritten = true;
      }
    }

    // 8. Sharded Surat collection + deletedSuratIds cleanup
    const delSuratSetFs = new Set<string>(state.deletedSuratIds || []);
    for (const sr of state.suratList || []) {
      if (sr && sr.id && !delSuratSetFs.has(sr.id)) {
        const key = `surat/${sr.id}`;
        const cleanSurat = sanitizeForFirestore({ ...sr });
        const srStr = JSON.stringify(cleanSurat);
        if (lastWrittenMap.get(key) !== srStr) {
          tasks.push(async () => {
            await setDoc(doc(db, 'surat', sr.id), cleanSurat, { merge: true }).catch((e) =>
              handleFirestoreError(e, OperationType.WRITE, key)
            );
            lastWrittenMap.set(key, srStr);
          });
          hasAnyDocWritten = true;
        }
      }
    }
    for (const delSuratId of (state.deletedSuratIds || []).slice(-200)) {
      const delKey = `deleted_surat/${delSuratId}`;
      if (!lastWrittenMap.has(delKey)) {
        tasks.push(async () => {
          await deleteDoc(doc(db, 'surat', delSuratId)).catch(() => {});
          lastWrittenMap.set(delKey, '1');
        });
        hasAnyDocWritten = true;
      }
    }

    if (tasks.length > 0) {
      await runFirestoreTasksInChunks(tasks, 25);
    }

    // 9. Lightweight Metadata Pulse to koperasi_state/main_database ONLY when something actually changed
    if (hasAnyDocWritten) {
      const metadataDoc = sanitizeForFirestore({
        id: 'main_database',
        lastSynced: now,
        updatedBy: CLIENT_ID,
        isSharded: true,
        totalAdmins: (state.admins || []).length,
        totalMembers: cleanMembersForFs.length,
        totalKas: (state.kasList || []).length,
        totalSetoran: (state.setoranList || []).length,
        totalSedekah: (state.sedekahList || []).length,
        totalTransactions: (state.memberTransactions || []).length,
        totalChats: (state.chatMessages || []).length,
        totalSurat: (state.suratList || []).length,
        filesProtected: true,
      });
      await setDoc(
        doc(db, 'koperasi_state', 'main_database'),
        metadataDoc
      ).catch((e) => handleFirestoreError(e, OperationType.WRITE, 'koperasi_state/main_database'));
    }
  } catch (err) {
    console.warn('Notice syncShardedToFirestore:', err);
  } finally {
    isFirestoreSyncRunning = false;
    const nextQueued = queuedFirestoreSyncState;
    queuedFirestoreSyncState = null;
    if (nextQueued) {
      scheduleShardedFirestoreSync(nextQueued, 10);
    }
  }
}

export function scheduleShardedFirestoreSync(state: AppState, delay = 10) {
  clearTimeout(shardedTimer);
  shardedTimer = setTimeout(() => {
    syncShardedToFirestore(state);
  }, delay);
}

// Sync to backend & Firebase Firestore (parallelized for sub-100ms multi-device sync)
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
    lastServerStateDigest = '';

    scheduleLocalStoragePersist();
    notifyListeners();

    // 1. Post to Express realtime backend + Firestore in parallel when internet connection is active
    if (!getIsInternetConnected()) {
      setPendingOfflineSync(true);
      queuedFirestoreSyncState = globalState;
      return;
    }

    scheduleShardedFirestoreSync(globalState, 10);

    try {
      const postController = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const postTimeout = postController ? setTimeout(() => postController.abort(), 10000) : null;
      try {
        const res = await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(globalState),
          signal: postController?.signal,
        });
        if (res.ok) {
          setPendingOfflineSync(false);
          const d = await res.json().catch(() => null);
          if (d?.digest) {
            lastServerStateDigest = String(d.digest);
          }
        } else {
          setPendingOfflineSync(true);
        }
      } finally {
        if (postTimeout) clearTimeout(postTimeout);
      }
    } catch {
      setPendingOfflineSync(true);
    }
  } catch (err) {
    // State is safely cached in localStorage
  }
}

// Load from server on startup / realtime pulse (with digest short-circuit, timeout protection & single-flight dedupe)
export async function fetchStateFromServer(forceFull = false): Promise<AppState> {
  if (!getIsInternetConnected()) {
    return globalState;
  }
  if (!forceFull && inFlightServerFetch) {
    return inFlightServerFetch;
  }
  if (forceFull && activeFetchAbortController) {
    abortInFlightServerFetch();
  }

  const runFetch = async (): Promise<AppState> => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    activeFetchAbortController = controller;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
    try {
      const digestParam = !forceFull && lastServerStateDigest ? `&digest=${encodeURIComponent(lastServerStateDigest)}` : '';
      const res = await fetch(`/api/state?_t=${Date.now()}${digestParam}`, {
        cache: 'no-store',
        signal: controller?.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const text = await res.text();
          if (text && text.trim().startsWith('{')) {
            const data = JSON.parse(text);
            // Fast 100-byte unchanged response: zero parse/merge/re-render overhead
            if (data && data.unchanged === true && data.digest) {
              lastServerStateDigest = String(data.digest);
              hasHydratedRemoteState = true;
              return globalState;
            }
            if (data && typeof data === 'object' && (data.profile || data.members)) {
              const headerDigest = res.headers.get('x-state-digest') || res.headers.get('etag')?.replace(/"/g, '') || '';
              if (headerDigest) {
                lastServerStateDigest = headerDigest;
              }

              const wasAlreadyHydrated = hasHydratedRemoteState;

              // AI Studio & client devices strictly follow authoritative live app data on first hydration
              // unless there are genuine offline changes created on this device awaiting upload.
              if (!wasAlreadyHydrated && !hasPendingOfflineSync()) {
                hasHydratedRemoteState = true;
                seedFirestoreSyncedHashesFromServer(data, true);
                globalState = reconcileBalancesWithDeposits(data as AppState);
                scheduleLocalStoragePersist();
                notifyListeners();
                return globalState;
              }

              // Check if local device cache has any non-deleted records created offline missing from server
              const serverDelSet = new Set<string>([
                ...(data.deletedMemberIds || []),
                ...(globalState.deletedMemberIds || []),
              ]);
              const serverIds = new Set<string>((data.members || []).map((m: MemberUser) => m.id));
              const serverPlaceholderIds = new Set<string>(
                (data.members || [])
                  .filter((m: any) => m && m.isRestoredPlaceholder)
                  .map((m: MemberUser) => m.id)
              );
              const missingLocalMembers = (globalState.members || []).filter(
                (lm: MemberUser) =>
                  lm &&
                  lm.id &&
                  !String(lm.id).includes('-dup-') &&
                  !serverDelSet.has(lm.id) &&
                  (!serverIds.has(lm.id) || (serverPlaceholderIds.has(lm.id) && (lm.nik || lm.whatsapp)))
              );

              const delSetoran = new Set<string>([...(data.deletedSetoranIds || []), ...(globalState.deletedSetoranIds || [])]);
              const delKas = new Set<string>([...(data.deletedKasIds || []), ...(globalState.deletedKasIds || [])]);
              const delTx = new Set<string>([...(data.deletedTransactionIds || []), ...(globalState.deletedTransactionIds || [])]);
              const delAdmin = new Set<string>([...(data.deletedAdminIds || []), ...((globalState as any).deletedAdminIds || [])]);
              const delChat = new Set<string>([...(data.deletedChatIds || []), ...(globalState.deletedChatIds || [])]);
              const delSurat = new Set<string>([...(data.deletedSuratIds || []), ...(globalState.deletedSuratIds || [])]);
              const effChatClearedAt = maxIsoTsClient(data.chatClearedAt, globalState.chatClearedAt);
              const effSuratResetAt = maxIsoTsClient(data.suratResetAt, globalState.suratResetAt);
              const effChatClearedByMember: Record<string, string> = {
                ...(globalState.chatClearedBeforeByMember || {}),
                ...(data.chatClearedBeforeByMember || {}),
              };

              const serverSetoranIds = new Set((data.setoranList || []).map((s: any) => s?.id));
              const serverKasIds = new Set((data.kasList || []).map((k: any) => k?.id));
              const serverTxIds = new Set((data.memberTransactions || []).map((t: any) => t?.id));
              const serverSedekahIds = new Set((data.sedekahList || []).map((s: any) => s?.id));
              const serverChatIds = new Set((data.chatMessages || []).map((c: any) => c?.id));
              const serverSuratIds = new Set((data.suratList || []).map((sr: any) => sr?.id));
              const serverAdminIds = new Set((data.admins || []).map((a: any) => a?.id));

              const hasUnsyncedLocalSlices =
                hasPendingOfflineSync() &&
                ((globalState.setoranList || []).some((s) => s?.id && !delSetoran.has(s.id) && !serverSetoranIds.has(s.id)) ||
                  (globalState.kasList || []).some((k) => k?.id && !delKas.has(k.id) && !serverKasIds.has(k.id)) ||
                  (globalState.memberTransactions || []).some((t) => t?.id && !delTx.has(t.id) && !serverTxIds.has(t.id)) ||
                  (globalState.sedekahList || []).some((s) => s?.id && !delSetoran.has(s.id) && !serverSedekahIds.has(s.id)) ||
                  (globalState.chatMessages || []).some(
                    (c) =>
                      c?.id &&
                      !isChatMessageClearedClient(c, delChat, effChatClearedAt, effChatClearedByMember) &&
                      !serverChatIds.has(c.id)
                  ) ||
                  (globalState.suratList || []).some(
                    (sr) => sr?.id && !isSuratDeletedClient(sr, delSurat, effSuratResetAt) && !serverSuratIds.has(sr.id)
                  ) ||
                  (globalState.admins || []).some((a) => a?.id && !delAdmin.has(a.id) && !serverAdminIds.has(a.id)));

              hasHydratedRemoteState = true;
              seedFirestoreSyncedHashesFromServer(data, true);
              globalState = mergeStates(globalState, data);
              scheduleLocalStoragePersist();
              notifyListeners();

              // Non-blocking restore ONLY when offline local mutations exist
              if (hasPendingOfflineSync() && missingLocalMembers.length > 0) {
                fetch('/api/members/sync-restore', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ members: missingLocalMembers }),
                })
                  .then((r) => (r.ok ? r.json() : null))
                  .then((resData) => {
                    if (resData?.restoredCount > 0 && resData?.state) {
                      globalState = mergeStates(globalState, resData.state);
                      scheduleLocalStoragePersist();
                      notifyListeners();
                    }
                  })
                  .catch(() => {});
              }

              // Safely push offline-created non-deleted local records to server & Firestore
              if (hasUnsyncedLocalSlices) {
                fetch('/api/state', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(globalState),
                })
                  .then((r) => {
                    if (r.ok) setPendingOfflineSync(false);
                  })
                  .catch(() => {});
                scheduleShardedFirestoreSync(globalState, 100);
              } else {
                setPendingOfflineSync(false);
              }

              return globalState;
            }
          }
        }
      }
    } catch {
      // Graceful offline fallback to local cached state without console noise
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (activeFetchAbortController === controller) {
        activeFetchAbortController = null;
      }
    }

    // Full multi-collection direct Firestore fallback if backend /api/state is unreachable on mobile APK / standalone device
    try {
      const { db, ensureFirestoreOnline } = await import('./firebase-init');
      await ensureFirestoreOnline();
      const { collection, getDocs, doc, getDoc, query, orderBy, limit } = await import('firebase/firestore');
      const [
        memSnap,
        genSnap,
        adminsColSnap,
        adminsDocSnap,
        setoranSnap,
        sedekahSnap,
        kasSnap,
        txSnap,
        chatSnap,
        suratSnap,
        logsSnap,
      ] = await Promise.all([
        getDocs(collection(db, 'members')).catch(() => null),
        getDoc(doc(db, 'settings', 'general')).catch(() => null),
        getDocs(collection(db, 'admins')).catch(() => null),
        getDoc(doc(db, 'settings', 'admins')).catch(() => null),
        getDocs(collection(db, 'setoran')).catch(() => null),
        getDocs(collection(db, 'sedekah')).catch(() => null),
        getDocs(collection(db, 'kas')).catch(() => null),
        getDocs(collection(db, 'transactions')).catch(() => null),
        getDocs(collection(db, 'chats')).catch(() => null),
        getDocs(collection(db, 'surat')).catch(() => null),
        getDocs(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(200))).catch(() => null),
      ]);

      const patch: Partial<AppState> & { deletedAdminIds?: string[] } = {};
      if (genSnap && genSnap.exists()) {
        const data = genSnap.data();
        if (data) {
          if (data.profile) patch.profile = data.profile;
          if (data.categoriesKasKoperasi) patch.categoriesKasKoperasi = data.categoriesKasKoperasi;
          if (data.pengaturanBerbagi) patch.pengaturanBerbagi = data.pengaturanBerbagi;
          if (Array.isArray(data.sedekahList)) patch.sedekahList = data.sedekahList;
          if (Array.isArray(data.penyaluranList)) patch.penyaluranList = data.penyaluranList;
          if (Array.isArray(data.pendingMutasiRequests)) patch.pendingMutasiRequests = data.pendingMutasiRequests;
          if (data.maintenanceLock) patch.maintenanceLock = data.maintenanceLock;
          if (data.accountNumberSchemaVersion) patch.accountNumberSchemaVersion = data.accountNumberSchemaVersion;
          if (data.lastRunningNumber) patch.lastRunningNumber = data.lastRunningNumber;
          if (Array.isArray(data.deletedMemberIds)) patch.deletedMemberIds = data.deletedMemberIds;
          if (Array.isArray(data.deletedTransactionIds)) patch.deletedTransactionIds = data.deletedTransactionIds;
          if (Array.isArray(data.deletedKasIds)) patch.deletedKasIds = data.deletedKasIds;
          if (Array.isArray(data.deletedSetoranIds)) patch.deletedSetoranIds = data.deletedSetoranIds;
          if (Array.isArray(data.deletedSuratIds)) patch.deletedSuratIds = data.deletedSuratIds;
          if (Array.isArray(data.deletedChatIds)) patch.deletedChatIds = data.deletedChatIds;
          if (typeof data.suratResetAt === 'string') patch.suratResetAt = data.suratResetAt;
          if (typeof data.chatClearedAt === 'string') patch.chatClearedAt = data.chatClearedAt;
          if (data.chatClearedBeforeByMember && typeof data.chatClearedBeforeByMember === 'object') {
            patch.chatClearedBeforeByMember = data.chatClearedBeforeByMember;
          }
          if (Array.isArray(data.usedAccountNumbers)) patch.usedAccountNumbers = data.usedAccountNumbers;
          if (Array.isArray(data.usedMemberNumbers)) patch.usedMemberNumbers = data.usedMemberNumbers;
        }
      }

      const delMemSet = new Set([...(globalState.deletedMemberIds || []), ...(patch.deletedMemberIds || [])]);
      if (memSnap && !memSnap.empty) {
        const remoteMembers = memSnap.docs
          .map((d) => d.data() as MemberUser)
          .filter((m) => m && m.id && !String(m.id).includes('-dup-') && !delMemSet.has(m.id));
        if (remoteMembers.length > 0) patch.members = remoteMembers;
      }

      const remoteAdmins: AdminUser[] = [];
      const delAdmSet = new Set<string>((globalState as any).deletedAdminIds || []);
      if (adminsDocSnap && adminsDocSnap.exists()) {
        const adData = adminsDocSnap.data();
        if (Array.isArray(adData?.deletedAdminIds)) {
          adData.deletedAdminIds.forEach((id: string) => delAdmSet.add(id));
        }
        if (Array.isArray(adData?.admins)) {
          adData.admins.forEach((a: AdminUser) => {
            if (a && (a.id || a.username) && !delAdmSet.has(a.id)) remoteAdmins.push(a);
          });
        }
      }
      if (adminsColSnap && !adminsColSnap.empty) {
        adminsColSnap.docs.forEach((d) => {
          const a = d.data() as AdminUser;
          if (a && (a.id || a.username) && !delAdmSet.has(a.id)) remoteAdmins.push(a);
        });
      }
      if (remoteAdmins.length > 0) patch.admins = remoteAdmins;
      if (delAdmSet.size > 0) patch.deletedAdminIds = Array.from(delAdmSet);

      const delSetoranSet = new Set([...(globalState.deletedSetoranIds || []), ...(patch.deletedSetoranIds || [])]);
      if (setoranSnap && !setoranSnap.empty) {
        patch.setoranList = setoranSnap.docs
          .map((d) => d.data() as SetoranVerifikasi)
          .filter((s) => s && s.id && !delSetoranSet.has(s.id));
      }
      if (sedekahSnap && !sedekahSnap.empty) {
        const colSedekah = sedekahSnap.docs
          .map((d) => d.data() as any)
          .filter((s) => s && s.id && !delSetoranSet.has(s.id));
        const combined = new Map<string, any>();
        (patch.sedekahList || []).forEach((s: any) => s?.id && combined.set(s.id, s));
        colSedekah.forEach((s: any) => s?.id && combined.set(s.id, s));
        if (combined.size > 0) patch.sedekahList = Array.from(combined.values());
      }

      const delKasSet = new Set([...(globalState.deletedKasIds || []), ...(patch.deletedKasIds || [])]);
      if (kasSnap && !kasSnap.empty) {
        patch.kasList = kasSnap.docs
          .map((d) => d.data() as KasEntry)
          .filter((k) => k && k.id && !delKasSet.has(k.id));
      }

      const delTxSet = new Set([...(globalState.deletedTransactionIds || []), ...(patch.deletedTransactionIds || [])]);
      if (txSnap && !txSnap.empty) {
        patch.memberTransactions = txSnap.docs
          .map((d) => d.data() as MemberTransaction)
          .filter((t) => t && t.id && !delTxSet.has(t.id));
      }

      const delChatSet = new Set([...(globalState.deletedChatIds || []), ...(patch.deletedChatIds || [])]);
      const effChatCleared = maxIsoTsClient(globalState.chatClearedAt, patch.chatClearedAt);
      const effChatByMember = {
        ...(globalState.chatClearedBeforeByMember || {}),
        ...(patch.chatClearedBeforeByMember || {}),
      };
      if (chatSnap) {
        patch.chatMessages = chatSnap.empty
          ? []
          : chatSnap.docs
              .map((d) => d.data() as ChatMessage)
              .filter((c) => !isChatMessageClearedClient(c, delChatSet, effChatCleared, effChatByMember));
      }

      const delSuratSet = new Set([...(globalState.deletedSuratIds || []), ...(patch.deletedSuratIds || [])]);
      const effSuratReset = maxIsoTsClient(globalState.suratResetAt, patch.suratResetAt);
      if (suratSnap) {
        patch.suratList = suratSnap.empty
          ? []
          : suratSnap.docs
              .map((d) => d.data() as SuratResmi)
              .filter((sr) => !isSuratDeletedClient(sr, delSuratSet, effSuratReset));
      }

      if (logsSnap && !logsSnap.empty) {
        patch.auditLogs = logsSnap.docs.map((d) => {
          const ld = d.data();
          return {
            id: d.id,
            timestamp: ld.timestamp || new Date().toISOString(),
            adminId: ld.adminId || 'admin',
            adminNama: ld.adminNama || 'Admin',
            adminRole: ld.adminRole || 'admin_write',
            action: ld.action || 'Aktivitas Admin',
            detail: ld.detail || '',
            targetId: ld.targetId || undefined,
          };
        });
      }

      if (Object.keys(patch).length > 0) {
        const wasAlreadyHydratedFs = hasHydratedRemoteState;
        hasHydratedRemoteState = true;
        seedFirestoreSyncedHashesFromServer(patch, true);
        if (!wasAlreadyHydratedFs && !hasPendingOfflineSync() && Array.isArray(patch.members) && patch.members.length > 0) {
          globalState = reconcileBalancesWithDeposits({ ...globalState, ...patch } as AppState);
        } else {
          globalState = mergeStates(globalState, { ...globalState, ...patch });
        }
        scheduleLocalStoragePersist();
        notifyListeners();
      }
    } catch {}

    return globalState;
  };

  inFlightServerFetch = runFetch().finally(() => {
    inFlightServerFetch = null;
  });
  return inFlightServerFetch;
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

    // Initial fetch + live Firestore connection check & activation whenever app opens
    if (getIsInternetConnected()) {
      import('./firebase-init')
        .then(({ testFirestoreConnection }) => {
          testFirestoreConnection().catch(() => {});
        })
        .catch(() => {});
      fetchStateFromServer();
    }

    // Foregrounding & network re-sync handlers so Android, iOS, Web, PC & AI Studio stay instantly synced
    const handleDeviceResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        flushLocalStoragePersist();
        return;
      }
      if ((document.visibilityState === 'visible' || navigator.onLine) && getIsInternetConnected()) {
        import('./firebase-init').then(({ ensureFirestoreOnline }) => ensureFirestoreOnline()).catch(() => {});
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          try {
            wsClient.send(JSON.stringify({ type: 'REQUEST_SYNC' }));
          } catch {}
        } else {
          connectWebSocket();
        }
        fetchStateFromServer();
      }
    };
    const handlePageHide = () => {
      flushLocalStoragePersist();
    };
    const handleNetworkRestored = () => {
      lastServerStateDigest = '';
      abortInFlightServerFetch();
      import('./firebase-init').then(({ ensureFirestoreOnline }) => ensureFirestoreOnline()).catch(() => {});
      if (queuedFirestoreSyncState) {
        const pending = queuedFirestoreSyncState;
        queuedFirestoreSyncState = null;
        syncStateToServer(pending).catch(() => {});
      }
      fetchStateFromServer(true);
      connectWebSocket();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleDeviceResume);
      window.addEventListener('online', handleNetworkRestored);
      window.addEventListener('focus', handleDeviceResume);
      window.addEventListener('pageshow', handleDeviceResume);
      window.addEventListener('pagehide', handlePageHide);
      window.addEventListener('hws:network_restored', handleNetworkRestored);
      window.addEventListener('hws:firestore_stream_recovered', handleDeviceResume);
    }

    // Adaptive fast digest check: 2s when WebSocket disconnected (SSE/HTTP fallback), 10s safety net when WS open
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (getIsInternetConnected()) {
        const wsIsOpen = typeof WebSocket !== 'undefined' && wsClient && wsClient.readyState === WebSocket.OPEN;
        if (!wsIsOpen || Date.now() % 10000 < 2200) {
          fetchStateFromServer();
        }
      }
    }, 2000);
    const firestoreKeepAliveInterval = setInterval(() => {
      if (getIsInternetConnected()) {
        import('./firebase-init').then(({ ensureFirestoreOnline }) => ensureFirestoreOnline()).catch(() => {});
      }
    }, 30000);

    // Primary WebSocket (/api/ws) + Resilient SSE (/api/events) Fallback Realtime Engine
    let wsClient: WebSocket | null = null;
    let wsPingTimer: any = null;
    let wsReconnectTimer: any = null;
    let wsReconnectAttempts = 0;
    let eventSource: EventSource | null = null;
    let sseReconnectTimeout: any = null;
    const recentEventDedupe = new Map<string, number>();

    function handleRealtimePayload(data: any) {
      try {
        if (!data || typeof data !== 'object') return;
        const evType = String(data.type || '');
        if (evType === 'PONG' || evType === 'CONNECTED') {
          if (data.payload?.buildId && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hws:server_build_info', { detail: data.payload }));
          }
          const remoteDigest = data.payload?.digest;
          if (remoteDigest && remoteDigest !== lastServerStateDigest) {
            fetchStateFromServer();
          }
          return;
        }
        const dedupeKey = `${evType}:${data.timestamp || ''}:${data.payload?.deposit?.id || data.payload?.id || data.payload?.surat?.id || data.payload?.digest || ''}`;
        const nowTs = Date.now();
        if (recentEventDedupe.has(dedupeKey) && nowTs - (recentEventDedupe.get(dedupeKey) || 0) < 250) {
          return;
        }
        recentEventDedupe.set(dedupeKey, nowTs);
        if (recentEventDedupe.size > 100) {
          for (const [k, ts] of recentEventDedupe.entries()) {
            if (nowTs - ts > 5000) recentEventDedupe.delete(k);
          }
        }

        if (evType === 'STATE_SYNC_PULSE') {
          const incomingDigest = data.payload?.digest;
          if (data.payload?.reason === 'setoran_verified') {
            fetchStateFromServer(true);
          } else if (!incomingDigest || incomingDigest !== lastServerStateDigest) {
            fetchStateFromServer();
          }
        } else if (evType === 'STATE_UPDATED' || evType === 'STATE_RESET') {
          if (data.payload) {
            hasHydratedRemoteState = true;
            seedFirestoreSyncedHashesFromServer(data.payload, true);
            globalState = mergeStates(globalState, data.payload);
            scheduleLocalStoragePersist();
            notifyListeners();
          }
        } else if (evType === 'SETORAN_UPDATED') {
          const dep = data.payload?.deposit as SetoranVerifikasi | undefined;
          if (dep && dep.id) {
            const delSet = new Set(globalState.deletedSetoranIds || []);
            if (!delSet.has(dep.id)) {
              const existingIdx = (globalState.setoranList || []).findIndex((s) => s.id === dep.id);
              let nextSetoranList = [...(globalState.setoranList || [])];
              if (existingIdx >= 0) {
                const ex = nextSetoranList[existingIdx];
                const isExTerminal = ex.status === 'disetujui' || ex.status === 'ditolak';
                nextSetoranList[existingIdx] = {
                  ...ex,
                  ...dep,
                  status: isExTerminal ? ex.status : dep.status,
                  verifiedBy: ex.verifiedBy || dep.verifiedBy,
                  verifiedAt: ex.verifiedAt || dep.verifiedAt,
                  buktiTransferUrl: dep.buktiTransferUrl || ex.buktiTransferUrl,
                };
              } else {
                nextSetoranList = [dep, ...nextSetoranList];
              }
              const dedupedWs = deduplicateSetoranListPostCutoffClient(
                nextSetoranList,
                globalState.members || [],
                new Set(globalState.deletedMemberIds || [])
              );
              const nextDelSetIds = Array.from(
                new Set([...(globalState.deletedSetoranIds || []), ...dedupedWs.removedIds])
              );
              const remSet = new Set(dedupedWs.removedIds);
              const nextSedekahList = (
                dep.jenis === 'sedekah' && (dep.status === 'disetujui' || dep.status === 'ditolak')
                  ? (globalState.sedekahList || []).map((sdk) =>
                      sdk.id === dep.id
                        ? {
                            ...sdk,
                            status: (dep.status === 'disetujui' ? 'approved' : 'rejected') as any,
                            verifiedBy: dep.verifiedBy || sdk.verifiedBy,
                            verifiedAt: dep.verifiedAt || sdk.verifiedAt,
                          }
                        : sdk
                    )
                  : globalState.sedekahList || []
              ).filter((sdk) => sdk && !remSet.has(sdk.id));
              dedupedWs.removedIds.forEach((rid) => dismissBrowserNotification(`hws-setoran-${rid}`));
              globalState = {
                ...globalState,
                setoranList: dedupedWs.list,
                sedekahList: nextSedekahList,
                deletedSetoranIds: nextDelSetIds,
              };
              scheduleLocalStoragePersist();
              notifyListeners();
            }
            if (dep.status === 'disetujui' || dep.status === 'ditolak') {
              dismissBrowserNotification(`hws-setoran-${dep.id}`);
            }
          }
          window.dispatchEvent(new CustomEvent('hws:setoran_updated', { detail: data.payload }));
          fetchStateFromServer(true);
        } else if (evType === 'SETORAN_DELETED') {
          const delIds: string[] = Array.isArray(data.payload?.deletedIds) ? data.payload.deletedIds : [];
          if (delIds.length > 0) {
            const delSet = new Set(delIds);
            delIds.forEach((id) => dismissBrowserNotification(`hws-setoran-${id}`));
            globalState = {
              ...globalState,
              setoranList: (globalState.setoranList || []).filter((s) => s && !delSet.has(s.id)),
              sedekahList: (globalState.sedekahList || []).filter((sdk) => sdk && !delSet.has(sdk.id)),
              deletedSetoranIds: Array.from(new Set([...(globalState.deletedSetoranIds || []), ...delIds])),
            };
            scheduleLocalStoragePersist();
            notifyListeners();
          }
          fetchStateFromServer(true);
        } else if (
          evType === 'TRANSFER_COMPLETED' ||
          evType === 'SYSTEM_REPAIRED' ||
          evType === 'TRANSACTIONS_DELETED' ||
          evType === 'KAS_DELETED'
        ) {
          fetchStateFromServer();
        } else if (evType === 'MEMBER_REGISTERED') {
          const regMem = data.payload?.member as MemberUser | undefined;
          if (regMem && regMem.id) {
            const delSet = new Set(globalState.deletedMemberIds || []);
            if (!delSet.has(regMem.id)) {
              const cleanRegName = normalizeMemberName(regMem.nama);
              const cleanRegNik = normalizeNik(regMem.nik);
              const cleanRegHp = normalizePhoneIndonesia(regMem.whatsapp);
              const existing = globalState.members.find(
                (m) =>
                  m.id === regMem.id ||
                  (cleanRegName && normalizeMemberName(m.nama) === cleanRegName) ||
                  (cleanRegNik && normalizeNik(m.nik) === cleanRegNik) ||
                  (cleanRegHp && normalizePhoneIndonesia(m.whatsapp) === cleanRegHp)
              );
              if (!existing) {
                globalState = {
                  ...globalState,
                  members: deduplicateMembersClient(
                    [...globalState.members, regMem],
                    globalState.deletedMemberIds || []
                  ),
                  usedAccountNumbers: sanitizeUsedUnifiedNumbersClient(
                    [...(globalState.usedAccountNumbers || []), regMem.nomorRekening].filter(Boolean),
                    [...globalState.members, regMem]
                  ),
                  usedMemberNumbers: sanitizeUsedUnifiedNumbersClient(
                    [...(globalState.usedMemberNumbers || []), regMem.nomorRekening || regMem.nomorAnggota].filter(Boolean),
                    [...globalState.members, regMem]
                  ),
                };
                scheduleLocalStoragePersist();
                notifyListeners();
              }
            }
          }
          window.dispatchEvent(new CustomEvent('hws:member_registered', { detail: data.payload }));
          fetchStateFromServer();
        } else if (evType === 'NEW_CHAT_MESSAGE') {
          const msg = data.payload;
          const delChatSet = new Set<string>(globalState.deletedChatIds || []);
          if (
            msg &&
            !isChatMessageClearedClient(msg, delChatSet, globalState.chatClearedAt, globalState.chatClearedBeforeByMember) &&
            !globalState.chatMessages.find((m) => m.id === msg.id)
          ) {
            globalState = {
              ...globalState,
              chatMessages: [...globalState.chatMessages, msg],
            };
            scheduleLocalStoragePersist();
            notifyListeners();
          }
        } else if (evType === 'CHAT_DELETED') {
          const delId = data.payload?.messageId;
          if (delId) {
            const delChatSet = new Set<string>([...(globalState.deletedChatIds || []), delId]);
            globalState = {
              ...globalState,
              chatMessages: (globalState.chatMessages || []).filter((m) => m.id !== delId),
              deletedChatIds: Array.from(delChatSet),
            };
            scheduleLocalStoragePersist();
            notifyListeners();
          }
        } else if (evType === 'CHAT_CLEARED') {
          const p = data.payload || {};
          const clearedAt = p.clearedAt || new Date().toISOString();
          if (p.clearAll) {
            globalState = {
              ...globalState,
              chatMessages: [],
              chatClearedAt: maxIsoTsClient(globalState.chatClearedAt, clearedAt),
              chatClearedBeforeByMember: {},
            };
          } else if (p.memberId) {
            const prevByMember = globalState.chatClearedBeforeByMember || {};
            globalState = {
              ...globalState,
              chatMessages: (globalState.chatMessages || []).filter((m) => m.memberId !== p.memberId),
              chatClearedBeforeByMember: {
                ...prevByMember,
                [p.memberId]: maxIsoTsClient(prevByMember[p.memberId], clearedAt),
              },
            };
          }
          scheduleLocalStoragePersist();
          notifyListeners();
        } else if (evType === 'MEMBER_NOTIFICATION') {
          const notif = data.payload;
          if (notif) {
            let activeSession: { type?: 'member' | 'admin'; id?: string } | null = null;
            try {
              const rawSession = localStorage.getItem('koperasi_hws_active_session');
              if (rawSession) {
                activeSession = JSON.parse(rawSession);
              }
            } catch {}

            if (!activeSession || !activeSession.type || !activeSession.id) {
              return;
            }
            if (activeSession.type === 'admin') {
              const isTargetedToAdmin =
                notif.recipientId === activeSession.id || notif.recipientId === 'admin';
              if (!isTargetedToAdmin || notif.type === 'setoran_verified' || notif.data?.depositId) {
                return;
              }
            } else if (activeSession.type === 'member') {
              if (notif.recipientId !== activeSession.id && notif.recipientId !== 'all') {
                return;
              }
            }

            if (notif.type === 'setoran_verified' || notif.type === 'mutasi_baru') {
              playNotificationSound('deposit');
            } else {
              playNotificationSound('chat');
            }
            triggerBrowserNotification(notif.title || 'Notifikasi Koperasi HWS', notif.body || '');
            window.dispatchEvent(new CustomEvent('hws:realtime_notification', { detail: notif }));
          }
        } else if (evType === 'NEW_SURAT') {
          playNotificationSound('chat');
          const s = data.payload?.surat as SuratResmi | undefined;
          const delSuratSet = new Set<string>(globalState.deletedSuratIds || []);
          if (s && s.id && !isSuratDeletedClient(s, delSuratSet, globalState.suratResetAt)) {
            if (!globalState.suratList.some((ex) => ex.id === s.id)) {
              globalState = {
                ...globalState,
                suratList: [s, ...(globalState.suratList || [])],
              };
              scheduleLocalStoragePersist();
              notifyListeners();
            }
          }
          triggerBrowserNotification('📬 Surat Baru Koperasi HWS', s?.perihal || 'Ada surat masuk baru');
          window.dispatchEvent(new CustomEvent('hws:new_surat', { detail: data.payload }));
        } else if (evType === 'SURAT_READ') {
          const p = data.payload;
          if (p && p.readerId) {
            globalState = {
              ...globalState,
              suratList: (globalState.suratList || []).map((s) => {
                let shouldMark = false;
                if (p.markAll) {
                  shouldMark = p.readerType === 'member' ? s.tujuanTipe === 'semua' || s.targetMemberId === p.readerId : true;
                } else if (Array.isArray(p.suratIds) && p.suratIds.length > 0) {
                  shouldMark = p.suratIds.includes(s.id);
                } else if (p.suratId) {
                  shouldMark = s.id === p.suratId;
                }
                if (!shouldMark) return s;
                const memberSet = new Set(s.readByMemberIds || []);
                const adminSet = new Set(s.readByAdminIds || []);
                if (p.readerType === 'member') memberSet.add(p.readerId);
                else adminSet.add(p.readerId);
                return { ...s, readByMemberIds: Array.from(memberSet), readByAdminIds: Array.from(adminSet) };
              }),
            };
            scheduleLocalStoragePersist();
            notifyListeners();
          }
        } else if (evType === 'SURAT_DELETED') {
          const delId = data.payload?.suratId;
          if (delId) {
            const delSuratSet = new Set<string>([...(globalState.deletedSuratIds || []), delId]);
            globalState = {
              ...globalState,
              suratList: (globalState.suratList || []).filter((s) => s.id !== delId),
              deletedSuratIds: Array.from(delSuratSet),
            };
            scheduleLocalStoragePersist();
            notifyListeners();
          }
        } else if (evType === 'SURAT_RESET') {
          const resetAt = data.payload?.resetAt || new Date().toISOString();
          globalState = {
            ...globalState,
            suratList: [],
            suratResetAt: maxIsoTsClient(globalState.suratResetAt, resetAt),
          };
          scheduleLocalStoragePersist();
          notifyListeners();
        } else if (evType === 'CHAT_READ') {
          const p = data.payload;
          if (p) {
            globalState = {
              ...globalState,
              chatMessages: globalState.chatMessages.map((m) => {
                const matches = p.markAll ? true : p.memberId ? m.memberId === p.memberId : false;
                if (matches) {
                  return {
                    ...m,
                    isReadByAdmin: p.readBy === 'admin' ? true : m.isReadByAdmin,
                    isReadByMember: p.readBy === 'member' ? true : m.isReadByMember,
                  };
                }
                return m;
              }),
            };
            scheduleLocalStoragePersist();
            notifyListeners();
          }
        }
      } catch (e) {
        console.error('Error handling realtime event', e);
      }
    }

    function connectSSE() {
      if (!isMounted || !getIsInternetConnected()) return;
      if (wsClient && wsClient.readyState === WebSocket.OPEN) return;
      try {
        if (eventSource) {
          eventSource.close();
        }
        eventSource = new EventSource('/api/events');
        eventSource.onmessage = (event) => {
          try {
            handleRealtimePayload(JSON.parse(event.data));
          } catch {}
        };
        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (isMounted && getIsInternetConnected() && (!wsClient || wsClient.readyState !== WebSocket.OPEN)) {
            clearTimeout(sseReconnectTimeout);
            sseReconnectTimeout = setTimeout(connectSSE, 1500);
          }
        };
      } catch {
        if (isMounted && getIsInternetConnected() && (!wsClient || wsClient.readyState !== WebSocket.OPEN)) {
          clearTimeout(sseReconnectTimeout);
          sseReconnectTimeout = setTimeout(connectSSE, 1500);
        }
      }
    }

    function connectWebSocket() {
      if (!isMounted || !getIsInternetConnected() || typeof window === 'undefined' || typeof WebSocket === 'undefined') {
        connectSSE();
        return;
      }
      if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) {
        return;
      }
      try {
        clearTimeout(wsReconnectTimer);
        clearInterval(wsPingTimer);
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/api/ws`;
        const socket = new WebSocket(wsUrl);
        wsClient = socket;

        socket.onopen = () => {
          if (wsClient !== socket) return;
          wsReconnectAttempts = 0;
          // Close SSE fallback once bidirectional WebSocket is active to eliminate duplicate socket overhead
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          clearTimeout(sseReconnectTimeout);
          clearInterval(wsPingTimer);
          wsPingTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              try {
                socket.send(JSON.stringify({ type: 'PING' }));
              } catch {}
            }
          }, 15000);
        };

        socket.onmessage = (event) => {
          try {
            handleRealtimePayload(JSON.parse(String(event.data)));
          } catch {}
        };

        const scheduleWsReconnect = () => {
          if (wsClient === socket) wsClient = null;
          clearInterval(wsPingTimer);
          if (!isMounted || !getIsInternetConnected()) return;
          // Engage SSE immediately as zero-gap fallback while WebSocket reconnects
          connectSSE();
          wsReconnectAttempts = Math.min(wsReconnectAttempts + 1, 5);
          const delay = Math.min(500 * wsReconnectAttempts, 2500);
          clearTimeout(wsReconnectTimer);
          wsReconnectTimer = setTimeout(connectWebSocket, delay);
        };

        socket.onerror = () => {
          try { socket.close(); } catch {}
        };
        socket.onclose = scheduleWsReconnect;
      } catch {
        connectSSE();
      }
    }

    connectWebSocket();

    // 3. Sharded Realtime Cloud Firestore Listeners (with O(1) hash echo-skip & 16ms crisp notification)
    const firestoreUnsubscribers: (() => void)[] = [];
    const confirmedRemoteIds: Record<string, Set<string>> = {
      members: new Set(),
      setoran: new Set(),
      kas: new Set(),
      transactions: new Set(),
      sedekah: new Set(),
      chats: new Set(),
      surat: new Set(),
      admins: new Set(),
    };

    const getRemovedConfirmedIds = (colKey: string, snapshot: any): string[] => {
      const confirmed = confirmedRemoteIds[colKey];
      const removed: string[] = [];
      if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
        snapshot.docChanges().forEach((change: any) => {
          if (change.type === 'removed' && confirmed.has(change.doc.id)) {
            removed.push(change.doc.id);
          }
        });
        const currentIds = new Set<string>(snapshot.docs.map((d: any) => d.id));
        if (snapshot.empty) {
          confirmed.forEach((id) => {
            if (!currentIds.has(id)) removed.push(id);
          });
        }
        removed.forEach((id) => confirmed.delete(id));
      }
      snapshot.docs.forEach((d: any) => confirmed.add(d.id));
      return removed;
    };

    const hasRealSnapshotDelta = (colPrefix: string, snapshot: any, removedIds: string[]): boolean => {
      if (removedIds.length > 0 || !hasHydratedRemoteState) return true;
      const changes = typeof snapshot?.docChanges === 'function' ? snapshot.docChanges() : [];
      if (changes.length === 0) return false;
      for (const change of changes) {
        if (change.type === 'removed') return true;
        const docId = change.doc?.id;
        if (!docId) continue;
        const cleanDoc = sanitizeForFirestore({ ...(change.doc.data() || {}) });
        if (lastWrittenMap.get(`${colPrefix}/${docId}`) !== JSON.stringify(cleanDoc)) {
          return true;
        }
      }
      return false;
    };

    try {
      import('./firebase').then(({ db }) => {
        import('firebase/firestore').then(({ collection, doc, onSnapshot, query, orderBy, limit }) => {
          if (!isMounted) return;

          // 0. Master Metadata Pulse Listener (Cross-device instant signal across Web, Android, iOS, PC, AI Studio)
          let lastMainSyncedPulse = '';
          const unsubMainPulse = onSnapshot(
            doc(db, 'koperasi_state', 'main_database'),
            (snap) => {
              if (!snap.exists()) return;
              const d = snap.data() as any;
              if (d && d.updatedBy && d.updatedBy !== CLIENT_ID && d.lastSynced && d.lastSynced !== lastMainSyncedPulse) {
                lastMainSyncedPulse = String(d.lastSynced);
                fetchStateFromServer();
              }
            },
            (err) => handleFirestoreError(err, OperationType.GET, 'koperasi_state/main_database')
          );
          firestoreUnsubscribers.push(unsubMainPulse);

          // A. Members Collection
          const unsubMembers = onSnapshot(
            collection(db, 'members'),
            (snapshot) => {
              const removedIds = getRemovedConfirmedIds('members', snapshot);
              if (snapshot.empty && removedIds.length === 0) return;
              if (!hasRealSnapshotDelta('members', snapshot, removedIds)) return;
              hasHydratedRemoteState = true;
              const delSet = new Set([...(globalState.deletedMemberIds || []), ...removedIds]);
              const remoteMembers = snapshot.docs
                .map((d) => d.data() as MemberUser)
                .filter((m) => m && m.id && !String(m.id).includes('-dup-') && !delSet.has(m.id));
              seedFirestoreSyncedHashesFromServer({ members: remoteMembers }, true);
              globalState = mergeStates(
                {
                  ...globalState,
                  members: (globalState.members || []).filter((m) => !delSet.has(m.id)),
                  deletedMemberIds: Array.from(delSet),
                },
                { ...globalState, members: remoteMembers, deletedMemberIds: Array.from(delSet) }
              );
              scheduleDebouncedNotify(16, false);
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'members')
          );
          firestoreUnsubscribers.push(unsubMembers);

          // B. Setoran Collection
          const unsubSetoran = onSnapshot(
            collection(db, 'setoran'),
            (snapshot) => {
              const removedIds = getRemovedConfirmedIds('setoran', snapshot);
              if (snapshot.empty && removedIds.length === 0) return;
              if (!hasRealSnapshotDelta('setoran', snapshot, removedIds)) return;
              hasHydratedRemoteState = true;
              const delSet = new Set([...(globalState.deletedSetoranIds || []), ...removedIds]);
              const remoteSetoran = snapshot.docs
                .map((d) => d.data() as SetoranVerifikasi)
                .filter((s) => s && s.id && !delSet.has(s.id));
              seedFirestoreSyncedHashesFromServer({ setoranList: remoteSetoran }, true);
              globalState = mergeStates(
                {
                  ...globalState,
                  setoranList: (globalState.setoranList || []).filter((s) => !delSet.has(s.id)),
                  deletedSetoranIds: Array.from(delSet),
                },
                { ...globalState, setoranList: remoteSetoran, deletedSetoranIds: Array.from(delSet) }
              );
              scheduleDebouncedNotify(16, false);
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'setoran')
          );
          firestoreUnsubscribers.push(unsubSetoran);

          // C. Kas Collection
          const unsubKas = onSnapshot(
            collection(db, 'kas'),
            (snapshot) => {
              const removedIds = getRemovedConfirmedIds('kas', snapshot);
              if (snapshot.empty && removedIds.length === 0) return;
              if (!hasRealSnapshotDelta('kas', snapshot, removedIds)) return;
              hasHydratedRemoteState = true;
              const delSet = new Set([...(globalState.deletedKasIds || []), ...removedIds]);
              const remoteKas = snapshot.docs
                .map((d) => d.data() as KasEntry)
                .filter((k) => k && k.id && !delSet.has(k.id));
              seedFirestoreSyncedHashesFromServer({ kasList: remoteKas }, true);
              globalState = mergeStates(
                {
                  ...globalState,
                  kasList: (globalState.kasList || []).filter((k) => !delSet.has(k.id)),
                  deletedKasIds: Array.from(delSet),
                },
                { ...globalState, kasList: remoteKas, deletedKasIds: Array.from(delSet) }
              );
              scheduleDebouncedNotify(16, false);
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'kas')
          );
          firestoreUnsubscribers.push(unsubKas);

          // D. Transactions Collection
          const unsubTx = onSnapshot(
            collection(db, 'transactions'),
            (snapshot) => {
              const removedIds = getRemovedConfirmedIds('transactions', snapshot);
              if (snapshot.empty && removedIds.length === 0) return;
              if (!hasRealSnapshotDelta('transactions', snapshot, removedIds)) return;
              hasHydratedRemoteState = true;
              const delSet = new Set([...(globalState.deletedTransactionIds || []), ...removedIds]);
              const remoteTx = snapshot.docs
                .map((d) => d.data() as MemberTransaction)
                .filter((tx) => tx && tx.id && !delSet.has(tx.id));
              seedFirestoreSyncedHashesFromServer({ memberTransactions: remoteTx }, true);
              globalState = mergeStates(
                {
                  ...globalState,
                  memberTransactions: (globalState.memberTransactions || []).filter((tx) => !delSet.has(tx.id)),
                  deletedTransactionIds: Array.from(delSet),
                },
                { ...globalState, memberTransactions: remoteTx, deletedTransactionIds: Array.from(delSet) }
              );
              scheduleDebouncedNotify(16, false);
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
          );
          firestoreUnsubscribers.push(unsubTx);

          // E. Chats Collection
          const unsubChats = onSnapshot(
            collection(db, 'chats'),
            (snapshot) => {
              const removedIds = getRemovedConfirmedIds('chats', snapshot);
              if (snapshot.empty && snapshot.metadata.fromCache && removedIds.length === 0) return;
              if (!hasRealSnapshotDelta('chats', snapshot, removedIds)) return;
              hasHydratedRemoteState = true;
              const delChatSet = new Set<string>([...(globalState.deletedChatIds || []), ...removedIds]);
              const remoteChats = snapshot.docs
                .map((d) => d.data() as ChatMessage)
                .filter((c) => !isChatMessageClearedClient(c, delChatSet, globalState.chatClearedAt, globalState.chatClearedBeforeByMember));
              if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites && snapshot.empty) {
                if ((globalState.chatMessages || []).length > 0) {
                  globalState = { ...globalState, chatMessages: [] };
                  scheduleLocalStoragePersist();
                  notifyListeners();
                }
                return;
              }
              seedFirestoreSyncedHashesFromServer({ chatMessages: remoteChats }, true);
              globalState = mergeStates(
                {
                  ...globalState,
                  chatMessages: (globalState.chatMessages || []).filter((c) => !delChatSet.has(c.id)),
                  deletedChatIds: Array.from(delChatSet),
                },
                { ...globalState, chatMessages: remoteChats, deletedChatIds: Array.from(delChatSet) }
              );
              scheduleDebouncedNotify(16, false);
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'chats')
          );
          firestoreUnsubscribers.push(unsubChats);

          // F. Settings / General Document (includes pendingMutasiRequests)
          const unsubGeneral = onSnapshot(
            doc(db, 'settings', 'general'),
            (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                if (data) {
                  hasHydratedRemoteState = true;
                  const mergedChatByMember: Record<string, string> = {
                    ...(globalState.chatClearedBeforeByMember || {}),
                  };
                  if (data.chatClearedBeforeByMember && typeof data.chatClearedBeforeByMember === 'object') {
                    Object.entries(data.chatClearedBeforeByMember).forEach(([mid, ts]) => {
                      mergedChatByMember[mid] = maxIsoTsClient(mergedChatByMember[mid], String(ts || ''));
                    });
                  }
                  const generalSnapshotState: Partial<AppState> = {
                    profile: data.profile || globalState.profile,
                    categoriesKasKoperasi: data.categoriesKasKoperasi || globalState.categoriesKasKoperasi,
                    pengaturanBerbagi: data.pengaturanBerbagi || globalState.pengaturanBerbagi,
                    sedekahList: data.sedekahList || globalState.sedekahList,
                    penyaluranList: data.penyaluranList || globalState.penyaluranList,
                    pendingMutasiRequests: data.pendingMutasiRequests || globalState.pendingMutasiRequests,
                    maintenanceLock: data.maintenanceLock || globalState.maintenanceLock,
                    accountNumberSchemaVersion: data.accountNumberSchemaVersion || globalState.accountNumberSchemaVersion || 2,
                    lastRunningNumber: data.lastRunningNumber || globalState.lastRunningNumber,
                    deletedMemberIds: Array.from(new Set([...(globalState.deletedMemberIds || []), ...(data.deletedMemberIds || [])])),
                    deletedTransactionIds: Array.from(new Set([...(globalState.deletedTransactionIds || []), ...(data.deletedTransactionIds || [])])),
                    deletedKasIds: Array.from(new Set([...(globalState.deletedKasIds || []), ...(data.deletedKasIds || [])])),
                    deletedSetoranIds: Array.from(new Set([...(globalState.deletedSetoranIds || []), ...(data.deletedSetoranIds || [])])),
                    deletedSuratIds: Array.from(new Set([...(globalState.deletedSuratIds || []), ...(data.deletedSuratIds || [])])),
                    deletedChatIds: Array.from(new Set([...(globalState.deletedChatIds || []), ...(data.deletedChatIds || [])])),
                    suratResetAt: maxIsoTsClient(globalState.suratResetAt, data.suratResetAt),
                    chatClearedAt: maxIsoTsClient(globalState.chatClearedAt, data.chatClearedAt),
                    chatClearedBeforeByMember: mergedChatByMember,
                    usedAccountNumbers: sanitizeUsedUnifiedNumbersClient(
                      [...(globalState.usedAccountNumbers || []), ...(data.usedAccountNumbers || [])],
                      globalState.members || []
                    ),
                    usedMemberNumbers: sanitizeUsedUnifiedNumbersClient(
                      [...(globalState.usedMemberNumbers || []), ...(data.usedMemberNumbers || [])],
                      globalState.members || []
                    ),
                  };
                  if (data.updatedBy !== CLIENT_ID) {
                    seedFirestoreSyncedHashesFromServer(generalSnapshotState, true);
                    globalState = mergeStates(globalState, {
                      ...globalState,
                      ...generalSnapshotState,
                    });
                    scheduleDebouncedNotify(16, false);
                  }
                }
              }
            },
            (err) => handleFirestoreError(err, OperationType.GET, 'settings/general')
          );
          firestoreUnsubscribers.push(unsubGeneral);

          // G. Settings / Admins Document + Sharded Admins Collection
          const unsubAdmins = onSnapshot(
            doc(db, 'settings', 'admins'),
            (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                if (data && data.admins && data.updatedBy !== CLIENT_ID) {
                  hasHydratedRemoteState = true;
                  const admSlice = {
                    admins: data.admins,
                    deletedAdminIds: Array.from(
                      new Set([...((globalState as any).deletedAdminIds || []), ...(data.deletedAdminIds || [])])
                    ),
                  };
                  seedFirestoreSyncedHashesFromServer(admSlice as any, true);
                  globalState = mergeStates(globalState, {
                    ...globalState,
                    ...admSlice,
                  });
                  scheduleDebouncedNotify(16, false);
                }
              }
            },
            (err) => handleFirestoreError(err, OperationType.GET, 'settings/admins')
          );
          firestoreUnsubscribers.push(unsubAdmins);

          const unsubAdminsCol = onSnapshot(
            collection(db, 'admins'),
            (snapshot) => {
              const removedIds = getRemovedConfirmedIds('admins', snapshot);
              if (snapshot.empty && removedIds.length === 0) return;
              if (!hasRealSnapshotDelta('admins', snapshot, removedIds)) return;
              hasHydratedRemoteState = true;
              const delAdmSet = new Set([...((globalState as any).deletedAdminIds || []), ...removedIds]);
              const remoteAdmins = snapshot.docs
                .map((d) => d.data() as AdminUser)
                .filter((a) => a && (a.id || a.username) && !delAdmSet.has(a.id));
              if (remoteAdmins.length > 0 || removedIds.length > 0) {
                seedFirestoreSyncedHashesFromServer({ admins: remoteAdmins }, true);
                globalState = mergeStates(
                  {
                    ...globalState,
                    admins: (globalState.admins || []).filter((a) => !delAdmSet.has(a.id)),
                    deletedAdminIds: Array.from(delAdmSet),
                  } as any,
                  { ...globalState, admins: remoteAdmins, deletedAdminIds: Array.from(delAdmSet) } as any
                );
                scheduleDebouncedNotify(16, false);
              }
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'admins')
          );
          firestoreUnsubscribers.push(unsubAdminsCol);

          // H. Sharded Sedekah Collection
          const unsubSedekah = onSnapshot(
            collection(db, 'sedekah'),
            (snapshot) => {
              const removedIds = getRemovedConfirmedIds('sedekah', snapshot);
              if (snapshot.empty && removedIds.length === 0) return;
              if (!hasRealSnapshotDelta('sedekah', snapshot, removedIds)) return;
              hasHydratedRemoteState = true;
              const delSet = new Set([...(globalState.deletedSetoranIds || []), ...removedIds]);
              const remoteSedekah = snapshot.docs
                .map((d) => d.data() as any)
                .filter((s) => s && s.id && !delSet.has(s.id));
              seedFirestoreSyncedHashesFromServer({ sedekahList: remoteSedekah }, true);
              globalState = mergeStates(
                {
                  ...globalState,
                  sedekahList: (globalState.sedekahList || []).filter((s) => !delSet.has(s.id)),
                  deletedSetoranIds: Array.from(delSet),
                },
                { ...globalState, sedekahList: remoteSedekah, deletedSetoranIds: Array.from(delSet) }
              );
              scheduleDebouncedNotify(16, false);
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'sedekah')
          );
          firestoreUnsubscribers.push(unsubSedekah);

          // I. Realtime Admin Activity Logs Collection
          const unsubLogs = onSnapshot(
            query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(200)),
            (snapshot) => {
              if (snapshot.empty) return;
              hasHydratedRemoteState = true;
              const remoteLogs: AuditLog[] = snapshot.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  timestamp: data.timestamp || new Date().toISOString(),
                  adminId: data.adminId || 'admin',
                  adminNama: data.adminNama || 'Admin',
                  adminRole: data.adminRole || 'admin_write',
                  action: data.action || 'Aktivitas Admin',
                  detail: data.detail || '',
                  targetId: data.targetId || undefined,
                };
              });
              globalState = mergeStates(globalState, { ...globalState, auditLogs: remoteLogs });
              scheduleDebouncedNotify(16, false);
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'logs')
          );
          firestoreUnsubscribers.push(unsubLogs);

          // J. Realtime Surat Menyurat Collection
          const unsubSurat = onSnapshot(
            collection(db, 'surat'),
            (snapshot) => {
              const removedIds = getRemovedConfirmedIds('surat', snapshot);
              if (snapshot.empty && snapshot.metadata.fromCache && removedIds.length === 0) return;
              if (!hasRealSnapshotDelta('surat', snapshot, removedIds)) return;
              hasHydratedRemoteState = true;
              const delSuratSet = new Set<string>([...(globalState.deletedSuratIds || []), ...removedIds]);
              const remoteSurat = snapshot.docs
                .map((d) => d.data() as SuratResmi)
                .filter((sr) => !isSuratDeletedClient(sr, delSuratSet, globalState.suratResetAt));
              if (snapshot.empty && !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
                if ((globalState.suratList || []).length > 0) {
                  globalState = { ...globalState, suratList: [] };
                  scheduleLocalStoragePersist();
                  notifyListeners();
                }
                return;
              }
              seedFirestoreSyncedHashesFromServer({ suratList: remoteSurat }, true);
              globalState = mergeStates(
                {
                  ...globalState,
                  suratList: (globalState.suratList || []).filter((sr) => !delSuratSet.has(sr.id)),
                  deletedSuratIds: Array.from(delSuratSet),
                },
                { ...globalState, suratList: remoteSurat, deletedSuratIds: Array.from(delSuratSet) }
              );
              scheduleDebouncedNotify(16, false);
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'surat')
          );
          firestoreUnsubscribers.push(unsubSurat);
        });
      });
    } catch {}

    return () => {
      isMounted = false;
      listeners.delete(handler);
      clearInterval(pollInterval);
      clearInterval(firestoreKeepAliveInterval);
      clearInterval(wsPingTimer);
      clearTimeout(wsReconnectTimer);
      clearTimeout(sseReconnectTimeout);
      if (wsClient) {
        try { wsClient.close(); } catch {}
        wsClient = null;
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      firestoreUnsubscribers.forEach((unsub) => {
        try { unsub(); } catch {}
      });
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleDeviceResume);
        window.removeEventListener('online', handleNetworkRestored);
        window.removeEventListener('focus', handleDeviceResume);
        window.removeEventListener('pageshow', handleDeviceResume);
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('hws:network_restored', handleNetworkRestored);
        window.removeEventListener('hws:firestore_stream_recovered', handleDeviceResume);
      }
    };
  }, []);

  const updateState = useCallback(async (updater: (prev: AppState) => AppState) => {
    hasHydratedRemoteState = true;
    const nextState = updater(globalState);
    await syncStateToServer(nextState);
  }, []);

  return { state, updateState };
}

// ================= WAKTU INDONESIA (WIB - Asia/Jakarta) HELPERS =================
export function getWibDateStr(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value || String(date.getFullYear());
    const m = parts.find((p) => p.type === 'month')?.value || String(date.getMonth() + 1).padStart(2, '0');
    const d = parts.find((p) => p.type === 'day')?.value || String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return wib.toISOString().split('T')[0];
  }
}

export function getWibTimeStr(date: Date = new Date(), includeSeconds = false): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false,
    }).formatToParts(date);
    const hh = parts.find((p) => p.type === 'hour')?.value || '00';
    const mm = parts.find((p) => p.type === 'minute')?.value || '00';
    if (includeSeconds) {
      const ss = parts.find((p) => p.type === 'second')?.value || '00';
      return `${hh}:${mm}:${ss}`;
    }
    return `${hh}:${mm}`;
  } catch {
    const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return wib.toISOString().split('T')[1].slice(0, includeSeconds ? 8 : 5);
  }
}

export function formatWibDate(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
      ? new Date(`${dateInput}T00:00:00+07:00`)
      : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

export function formatWibDateShort(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
      ? new Date(`${dateInput}T00:00:00+07:00`)
      : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

export function formatWibDateTime(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const datePart = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
    const timePart = getWibTimeStr(d, false);
    return `${datePart}, ${timePart} WIB`;
  } catch {
    return String(dateInput);
  }
}

export function getLiveWibClockLabel(date: Date = new Date()): string {
  try {
    const dayDate = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
    const timePart = getWibTimeStr(date, true);
    return `${dayDate} • ${timePart} WIB`;
  } catch {
    return `${getWibDateStr(date)} • ${getWibTimeStr(date, true)} WIB`;
  }
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

// Helper: Generate Unified Account & Member Number (No. Rekening = No. Anggota)
// Ketentuan: Kode Wilayah (2 digit) + Tanggal Daftar (2 digit) + No Belakang HP (2 digit) + Tahun Daftar (2 digit) + Urutan (dimulai dari 770 dan seterusnya)
// Nomor yang sudah dipergunakan tidak dapat dipergunakan kembali (termasuk anggota yang telah dihapus)
export function generateNomorRekening(
  wilayah: WilayahKoperasi,
  noHp: string,
  lastRunningNumber?: number,
  usedAccountNumbers?: string[] | Set<string>,
  existingMembers?: MemberUser[],
  commitToGlobal = true,
  registerDateStr?: string
): { nomorRekening: string; nomorAnggota: string; nextRunningNumber: number; usedAccountNumbers: string[] } {
  const kodeWilayah = WILAYAH_CODE_MAP[wilayah] || '77';
  const { dd, yy } = getDatePartsDdYyClient(registerDateStr);
  const cleanHp = (noHp || '').replace(/\D/g, '');
  const hp2 = cleanHp.slice(-2).padStart(2, '0');

  const allMembers: MemberUser[] = [
    ...(globalState.members || []),
    ...(Array.isArray(existingMembers) ? existingMembers : []),
  ];

  const rawUsedInputs: string[] = [];
  if (Array.isArray(usedAccountNumbers)) {
    usedAccountNumbers.forEach((r) => r && rawUsedInputs.push(String(r).trim()));
  } else if (usedAccountNumbers instanceof Set) {
    usedAccountNumbers.forEach((r) => r && rawUsedInputs.push(String(r).trim()));
  }
  (globalState.usedAccountNumbers || []).forEach((r) => r && rawUsedInputs.push(String(r).trim()));
  (globalState.usedMemberNumbers || []).forEach((r) => r && rawUsedInputs.push(String(r).trim()));

  const cleanedUsed = sanitizeUsedUnifiedNumbersClient(rawUsedInputs, allMembers);
  const usedSet = new Set<string>(cleanedUsed);
  const usedSeqs = new Set<number>();

  cleanedUsed.forEach((n) => {
    const sq = extractUnifiedSeqClient(n);
    if (sq !== null) usedSeqs.add(sq);
  });
  allMembers.forEach((m) => {
    const r = String(m?.nomorRekening || '').trim();
    const a = String(m?.nomorAnggota || '').trim();
    if (isValidUnifiedAccountV2Client(r)) {
      usedSet.add(r);
      const sq = extractUnifiedSeqClient(r);
      if (sq !== null) usedSeqs.add(sq);
    }
    if (isValidUnifiedAccountV2Client(a)) {
      usedSet.add(a);
      const sq = extractUnifiedSeqClient(a);
      if (sq !== null) usedSeqs.add(sq);
    }
  });

  let maxSeq = 769;
  usedSeqs.forEach((s) => {
    if (s > maxSeq) maxSeq = s;
  });

  const requestedFloor =
    typeof lastRunningNumber === 'number' && lastRunningNumber >= 769 && lastRunningNumber < 50000
      ? lastRunningNumber
      : 769;
  const globalFloor =
    typeof globalState.lastRunningNumber === 'number' &&
    globalState.lastRunningNumber >= 769 &&
    globalState.lastRunningNumber < 50000
      ? globalState.lastRunningNumber
      : 769;

  let seq = Math.max(maxSeq, requestedFloor, globalFloor) + 1;
  if (seq < 770) seq = 770;
  let candidate = `${kodeWilayah}${dd}${hp2}${yy}${seq}`;

  while (usedSet.has(candidate) || usedSeqs.has(seq)) {
    seq++;
    candidate = `${kodeWilayah}${dd}${hp2}${yy}${seq}`;
  }

  usedSet.add(candidate);
  const updatedUsedList = sanitizeUsedUnifiedNumbersClient(Array.from(usedSet), allMembers);
  if (commitToGlobal) {
    globalState.usedAccountNumbers = updatedUsedList;
    globalState.usedMemberNumbers = updatedUsedList;
    globalState.lastRunningNumber = seq;
    globalState.accountNumberSchemaVersion = 2;
  }

  return {
    nomorRekening: candidate,
    nomorAnggota: candidate,
    nextRunningNumber: seq,
    usedAccountNumbers: updatedUsedList,
  };
}

// Unified alias: No. Anggota = No. Rekening
export function generateNomorAnggota(
  wilayah: WilayahKoperasi,
  _existingCount: number,
  usedMemberNumbers?: string[] | Set<string>,
  existingMembers?: MemberUser[],
  registerDateStr?: string,
  commitToGlobal = true,
  noHp = ''
): string {
  return generateNomorRekening(
    wilayah,
    noHp,
    globalState.lastRunningNumber,
    usedMemberNumbers,
    existingMembers,
    commitToGlobal,
    registerDateStr
  ).nomorRekening;
}

const inFlightRegistrations = new Set<string>();

// Unified Authoritative Online Registration across all platforms (Android, iOS, PC, Web, AI Studio)
// Mencegah pendaftaran berulang & data saling meniban pada device baru terinstall dan multi-device bersamaan
export async function registerMemberOnline(
  newMember: MemberUser,
  nextRunningNumber?: number,
  adminName?: string
): Promise<{ success: boolean; member?: MemberUser; error?: string }> {
  if (!getIsInternetConnected()) {
    return {
      success: false,
      error: 'Perangkat tidak terhubung ke internet. Hubungkan perangkat ke internet terlebih dahulu untuk melakukan pendaftaran.',
    };
  }

  const flightKey = [
    normalizeMemberName(newMember.nama),
    normalizeNik(newMember.nik),
    normalizePhoneIndonesia(newMember.whatsapp),
    String(newMember.email || '').trim().toLowerCase(),
  ].join('|');

  if (inFlightRegistrations.has(flightKey)) {
    return {
      success: false,
      error: 'Pendaftaran untuk data anggota ini sedang diproses. Mohon tunggu sebentar.',
    };
  }

  inFlightRegistrations.add(flightKey);
  try {
    // 1. Ambil state terbaru dari server terlebih dahulu (menghindari cache kosong pada device baru)
    await fetchStateFromServer();

    // 2. Validasi kelengkapan & keunikan 6 biodata wajib sebelum menyimpan ke database
    const biodataErr = validateMemberBiodata(newMember, globalState.members || []);
    if (biodataErr) {
      return { success: false, error: biodataErr };
    }

    // 3. Pastikan No. Rekening = No. Anggota tunggal mengikuti format KW+DD+HP2+YY+Seq (mulai 770+)
    let candidateToSave: MemberUser = {
      ...newMember,
      nik: normalizeNik(newMember.nik),
      createdAt: newMember.createdAt || new Date().toISOString(),
    };
    const usedUnifiedSet = new Set<string>(
      sanitizeUsedUnifiedNumbersClient(
        [...(globalState.usedAccountNumbers || []), ...(globalState.usedMemberNumbers || [])],
        globalState.members || []
      )
    );
    const usedSeqSet = new Set<number>();
    usedUnifiedSet.forEach((n) => {
      const sq = extractUnifiedSeqClient(n);
      if (sq !== null) usedSeqSet.add(sq);
    });

    const curRek = String(candidateToSave.nomorRekening || '').trim();
    const curSeq = extractUnifiedSeqClient(curRek);
    if (
      !isValidUnifiedAccountV2Client(curRek) ||
      curSeq === null ||
      usedUnifiedSet.has(curRek) ||
      usedSeqSet.has(curSeq)
    ) {
      const generatedRek = generateNomorRekening(
        candidateToSave.wilayah,
        candidateToSave.whatsapp,
        nextRunningNumber || globalState.lastRunningNumber,
        usedUnifiedSet,
        globalState.members,
        false,
        candidateToSave.terdaftarSejak
      );
      candidateToSave.nomorRekening = generatedRek.nomorRekening;
    }
    candidateToSave.nomorAnggota = candidateToSave.nomorRekening;

    // 4b. Pastikan ukuran ktpPhotoUrl / avatarUrl aman untuk batas 1MB dokumen Firestore
    if (candidateToSave.ktpPhotoUrl && candidateToSave.ktpPhotoUrl.length > 750000) {
      candidateToSave.ktpPhotoUrl = '';
    }
    if (candidateToSave.avatarUrl && candidateToSave.avatarUrl.length > 350000) {
      candidateToSave.avatarUrl = '';
    }

    // 5. Kirim ke backend endpoint pendaftaran otoritatif terlebih dahulu agar validasi 400 ditangani penuh
    let res: Response | null = null;
    let data: any = null;
    let serverTransportFailed = false;

    try {
      res = await fetch('/api/members/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member: candidateToSave,
          nextRunningNumber,
          adminName,
          isUpdate: false,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        serverTransportFailed = true;
      }
    } catch {
      serverTransportFailed = true;
    }

    if (res && !res.ok && !serverTransportFailed && res.status >= 400 && res.status < 500 && data?.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    let savedMember: MemberUser = candidateToSave;
    const isServerAuthorized = Boolean(res && res.ok && data && data.success && data.member);

    if (isServerAuthorized) {
      savedMember = data.member as MemberUser;
      if (data.state) {
        globalState = mergeStates(globalState, data.state);
      }
    } else {
      // Fallback otoritatif langsung ke Cloud Firestore jika endpoint /api/members/register tidak terjangkau (mis. PWA standalone, cache, atau container terpisah)
      const { db, ensureFirestoreOnline } = await import('./firebase-init');
      await ensureFirestoreOnline();
      const { collection, getDocs, doc, getDoc, setDoc } = await import('firebase/firestore');

      const [memSnap, genSnap] = await Promise.all([
        getDocs(collection(db, 'members')),
        getDoc(doc(db, 'settings', 'general')),
      ]);

      const genData = genSnap.exists() ? genSnap.data() || {} : {};
      const delIds = new Set<string>([
        ...(globalState.deletedMemberIds || []),
        ...(Array.isArray(genData.deletedMemberIds) ? genData.deletedMemberIds : []),
      ]);
      const remoteMembers = memSnap.docs
        .map((d) => d.data() as MemberUser)
        .filter((m) => m && m.id && !String(m.id).includes('-dup-') && !delIds.has(m.id));
      const authoritativeMembers = deduplicateMembersClient(
        [...(globalState.members || []), ...remoteMembers],
        Array.from(delIds)
      );

      const fsBiodataErr = validateMemberBiodata(candidateToSave, authoritativeMembers);
      if (fsBiodataErr) {
        return { success: false, error: fsBiodataErr };
      }

      const mergedUsedUnified = sanitizeUsedUnifiedNumbersClient(
        [
          ...(globalState.usedAccountNumbers || []),
          ...(globalState.usedMemberNumbers || []),
          ...(Array.isArray(genData.usedAccountNumbers) ? genData.usedAccountNumbers : []),
          ...(Array.isArray(genData.usedMemberNumbers) ? genData.usedMemberNumbers : []),
          ...authoritativeMembers.map((m) => m.nomorRekening).filter(Boolean),
        ],
        authoritativeMembers
      );

      const genRun =
        Number(genData.lastRunningNumber) >= 769 && Number(genData.lastRunningNumber) < 50000
          ? Number(genData.lastRunningNumber)
          : 769;
      const reqRun =
        Number(nextRunningNumber) >= 769 && Number(nextRunningNumber) < 50000
          ? Number(nextRunningNumber)
          : 769;
      const globRun =
        Number(globalState.lastRunningNumber) >= 769 && Number(globalState.lastRunningNumber) < 50000
          ? Number(globalState.lastRunningNumber)
          : 769;

      const fallbackRek = generateNomorRekening(
        candidateToSave.wilayah,
        candidateToSave.whatsapp,
        Math.max(genRun, reqRun, globRun),
        mergedUsedUnified,
        authoritativeMembers,
        false,
        candidateToSave.terdaftarSejak
      );

      savedMember = {
        ...candidateToSave,
        nomorRekening: fallbackRek.nomorRekening,
        nomorAnggota: fallbackRek.nomorRekening,
      };

      const cleanMem = sanitizeForFirestore({ ...savedMember, updatedAt: new Date().toISOString() });
      delete (cleanMem as any).biometricActive;
      await setDoc(doc(db, 'members', savedMember.id), cleanMem, { merge: true });

      const nextUsedUnified = sanitizeUsedUnifiedNumbersClient(
        [...mergedUsedUnified, savedMember.nomorRekening],
        [...authoritativeMembers, savedMember]
      );

      await setDoc(
        doc(db, 'settings', 'general'),
        {
          accountNumberSchemaVersion: 2,
          lastRunningNumber: Math.max(fallbackRek.nextRunningNumber, genRun),
          usedMemberNumbers: nextUsedUnified,
          usedAccountNumbers: nextUsedUnified,
          updatedAt: new Date().toISOString(),
          updatedBy: CLIENT_ID,
        },
        { merge: true }
      ).catch(() => {});

      const fallbackLogId = `log-reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(
        doc(db, 'logs', fallbackLogId),
        {
          id: fallbackLogId,
          timestamp: new Date().toISOString(),
          adminId: adminName ? 'admin' : savedMember.id,
          adminNama: adminName || savedMember.nama,
          adminRole: adminName ? 'admin_write' : 'member',
          action: adminName ? 'Tambah Anggota (Admin)' : 'Pendaftaran Anggota (Mandiri)',
          detail: `Anggota ${savedMember.nama} (No. Rekening / Anggota: ${savedMember.nomorRekening}) tersimpan langsung ke Cloud Firestore.`,
          targetId: savedMember.id,
        },
        { merge: true }
      ).catch(() => {});
    }

    // 6. Pastikan dokumen anggota & log tersinkron penuh ke Cloud Firestore doc 'members/{id}'
    try {
      const { db, ensureFirestoreOnline } = await import('./firebase-init');
      await ensureFirestoreOnline();
      const { doc, setDoc } = await import('firebase/firestore');
      const cleanMem = sanitizeForFirestore({ ...savedMember, updatedAt: new Date().toISOString() });
      delete (cleanMem as any).biometricActive;
      await setDoc(doc(db, 'members', savedMember.id), cleanMem, { merge: true });
      await setDoc(
        doc(db, 'koperasi_state', 'main_database'),
        {
          id: 'main_database',
          lastSynced: new Date().toISOString(),
          updatedBy: CLIENT_ID,
          totalMembers: Math.max((globalState.members || []).length, 1),
        },
        { merge: true }
      ).catch(() => {});
    } catch (e) {
      console.warn('Notice direct Firestore write in registration:', e);
    }

    // 7. Langsung sinkronkan state ke globalState lokal tanpa meniban data lain
    const nextUsedUnifiedLocal = sanitizeUsedUnifiedNumbersClient(
      [...(globalState.usedAccountNumbers || []), ...(globalState.usedMemberNumbers || []), savedMember.nomorRekening].filter(Boolean),
      [...globalState.members, savedMember]
    );
    let nextMaxSeq = 769;
    nextUsedUnifiedLocal.forEach((n) => {
      const sq = extractUnifiedSeqClient(n);
      if (sq !== null && sq > nextMaxSeq) nextMaxSeq = sq;
    });
    globalState = {
      ...globalState,
      members: deduplicateMembersClient(
        [...globalState.members.filter((m) => m.id !== savedMember.id), savedMember],
        globalState.deletedMemberIds || []
      ),
      accountNumberSchemaVersion: 2,
      lastRunningNumber: nextMaxSeq,
      usedAccountNumbers: nextUsedUnifiedLocal,
      usedMemberNumbers: nextUsedUnifiedLocal,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
    } catch {}

    notifyListeners();
    scheduleShardedFirestoreSync(globalState);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hws:member_registered', { detail: savedMember }));
      window.dispatchEvent(new CustomEvent('hws:members_updated', { detail: globalState.members }));
    }

    return { success: true, member: savedMember };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Koneksi ke server online terputus. Pastikan perangkat terhubung ke internet.' };
  } finally {
    inFlightRegistrations.delete(flightKey);
  }
}

// Helper: Add Audit Log with Firestore 'logs' collection synchronization
export function createAuditLog(
  admin: AdminUser,
  action: string,
  detail: string,
  targetId?: string
): AuditLog {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const platform = /android/i.test(ua)
    ? 'MOBILE_ANDROID'
    : /iphone|ipad|ipod/i.test(ua)
    ? 'MOBILE_IOS'
    : /windows|win32|macintosh|linux/i.test(ua) && !/mobile/i.test(ua)
    ? 'DESKTOP_PC'
    : 'WEB';
  const formattedDetail = detail.includes('[Platform:')
    ? detail
    : `[Platform: ${platform}] ${detail}`;
  const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const log: AuditLog = {
    id: logId,
    timestamp,
    adminId: admin.id,
    adminNama: admin.nama,
    adminRole: admin.role,
    action,
    detail: formattedDetail,
    targetId,
  };

  // Asynchronously record to Firestore 'logs' collection and server API with the exact same logId
  import('./activityLogger')
    .then(({ recordAdminActivity }) => {
      recordAdminActivity(admin, action, formattedDetail, targetId, logId, timestamp).catch(() => {});
    })
    .catch(() => {});

  return log;
}

// Helper: Sinkronisasi penuh antara Saldo Anggota Terverifikasi, Mutasi Anggota, dan Buku Kas Anggota
export function syncMemberBalancesWithBukuKasAnggota(prev: AppState): AppState {
  const deletedKasSet = new Set<string>(prev.deletedKasIds || []);
  const deletedTxSet = new Set<string>(prev.deletedTransactionIds || []);

  let kasList = (prev.kasList || []).filter((k) => k && !deletedKasSet.has(k.id));
  let txList = (prev.memberTransactions || []).filter((t) => t && !deletedTxSet.has(t.id));

  // 1. Pastikan setiap setoran anggota yang telah diverifikasi (disetujui) tercatat di Buku Kas Anggota
  // kecuali memang telah dihapus oleh Super Admin (tercatat di deletedKasIds / deletedTransactionIds)
  if (deletedKasSet.size === 0 && deletedTxSet.size === 0) {
    (prev.setoranList || []).forEach((dep) => {
      if (dep.status !== 'disetujui' || dep.jenis === 'sedekah') return;
      const member = (prev.members || []).find(
        (m) =>
          m.id === dep.memberId ||
          (dep.memberRekening && m.nomorRekening === dep.memberRekening) ||
          (dep.memberNama && m.nama.trim().toLowerCase() === dep.memberNama.trim().toLowerCase())
      );
      if (!member) return;

      const rawDate = dep.verifiedAt || dep.createdAt;
      const parsedDepDate = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : null;
      const tgl = dep.tanggal || (parsedDepDate ? getWibDateStr(parsedDepDate) : getWibDateStr());
      const hasKasForDep = kasList.some(
        (k) =>
          k.bukuKas === 'anggota' &&
          (k.referensiId === dep.id ||
            ((k.memberId === member.id ||
              (k.namaPenerima || '').trim().toLowerCase() === member.nama.trim().toLowerCase() ||
              (k.keterangan || '').toLowerCase().includes(member.nama.trim().toLowerCase())) &&
              k.tanggal === tgl))
      );

      if (!hasKasForDep) {
        const nowIso = dep.verifiedAt || dep.createdAt || new Date().toISOString();
        if (dep.jenis === 'kewajiban') {
          const jlhHari = dep.jumlahHari || Math.max(1, Math.round(dep.nominal / (prev.profile?.biayaWajibHarian || 2000)));
          const pNom = Math.floor(dep.nominal * 0.5);
          const qNom = Math.floor(dep.nominal * 0.25);
          const zNom = dep.nominal - pNom - qNom;
          kasList = [
            {
              id: `kas-sync-p-${dep.id}`,
              bukuKas: 'anggota',
              tanggal: tgl,
              kategori: 'Tabungan Pokok',
              keterangan: `Setoran Tabungan Pokok ${member.nama} (${jlhHari} Hari)${dep.periode ? ` - Periode: ${dep.periode}` : ''}`,
              namaPenerima: member.nama,
              memberId: member.id,
              referensiId: dep.id,
              periode: dep.periode,
              jumlahHari: jlhHari,
              tipe: 'masuk',
              nominal: pNom,
              saldoKasSetelah: 0,
              inputBy: dep.verifiedBy || 'Admin Koperasi',
              status: 'approved',
              createdAt: nowIso,
            },
            {
              id: `kas-sync-q-${dep.id}`,
              bukuKas: 'anggota',
              tanggal: tgl,
              kategori: 'Tabungan Qurban',
              keterangan: `Setoran Tabungan Qurban ${member.nama} (${jlhHari} Hari)`,
              namaPenerima: member.nama,
              memberId: member.id,
              referensiId: dep.id,
              tipe: 'masuk',
              nominal: qNom,
              saldoKasSetelah: 0,
              inputBy: dep.verifiedBy || 'Admin Koperasi',
              status: 'approved',
              createdAt: nowIso,
            },
            {
              id: `kas-sync-z-${dep.id}`,
              bukuKas: 'anggota',
              tanggal: tgl,
              kategori: 'Tabungan Zakat',
              keterangan: `Setoran Tabungan Zakat ${member.nama} (${jlhHari} Hari)`,
              namaPenerima: member.nama,
              memberId: member.id,
              referensiId: dep.id,
              tipe: 'masuk',
              nominal: zNom,
              saldoKasSetelah: 0,
              inputBy: dep.verifiedBy || 'Admin Koperasi',
              status: 'approved',
              createdAt: nowIso,
            },
            ...kasList,
          ];
        } else {
          kasList = [
            {
              id: `kas-sync-u-${dep.id}`,
              bukuKas: 'anggota',
              tanggal: tgl,
              kategori: 'Tabungan Bebas',
              keterangan: `Setoran Tunai ${member.nama}`,
              namaPenerima: member.nama,
              memberId: member.id,
              referensiId: dep.id,
              tipe: 'masuk',
              nominal: dep.nominal,
              saldoKasSetelah: 0,
              inputBy: dep.verifiedBy || 'Admin Koperasi',
              status: 'approved',
              createdAt: nowIso,
            },
            ...kasList,
          ];
        }
      }
    });
  }

  // 2. Hitung saldo setiap anggota mengikuti Buku Kas Anggota (status === 'approved') + transfer sesama anggota
  const approvedKasAnggota = kasList.filter((k) => k.bukuKas === 'anggota' && k.status === 'approved');
  const activeMembers = (prev.members || []).filter((m) => m.status !== 'dibekukan' && m.status !== 'nonaktif');

  const updatedMembers = (prev.members || []).map((m) => {
    if (isSriParawatiMember(m)) {
      const mTransactions = txList
        .filter((tx) => tx.memberId === m.id)
        .sort(compareMemberTransactionsChrono);
      let p = 0;
      let q = 0;
      let z = 0;
      let u = 0;
      let latestPeriode = m.periodeTabunganPokok;
      mTransactions.forEach((tx) => {
        if (tx.periode) latestPeriode = tx.periode;
        if (tx.kategori === 'sedekah') return;
        const nom = Number(tx.nominal) || 0;
        const isKewajibanSplit =
          tx.kategori === 'pokok' ||
          String(tx.id).startsWith('tx-wajib-') ||
          String(tx.keterangan || '').toUpperCase().includes('KEWAJIBAN') ||
          String(tx.keterangan || '').includes('50% Pokok');
        if (tx.tipe === 'masuk') {
          if (isKewajibanSplit) {
            const pPart = tx.splitOverride ? (Number(tx.splitOverride.pokok) || 0) : Math.floor(nom * 0.5);
            const qPart = tx.splitOverride ? (Number(tx.splitOverride.qurban) || 0) : Math.floor(nom * 0.25);
            const zPart = tx.splitOverride ? (Number(tx.splitOverride.zakat) || 0) : (nom - pPart - qPart);
            p += pPart;
            q += qPart;
            z += zPart;
          } else if (tx.kategori === 'qurban') {
            q += nom;
          } else if (tx.kategori === 'zakat') {
            z += nom;
          } else {
            u += nom;
          }
        } else {
          if (isKewajibanSplit) {
            const pPart = tx.splitOverride ? (Number(tx.splitOverride.pokok) || 0) : Math.floor(nom * 0.5);
            const qPart = tx.splitOverride ? (Number(tx.splitOverride.qurban) || 0) : Math.floor(nom * 0.25);
            const zPart = tx.splitOverride ? (Number(tx.splitOverride.zakat) || 0) : (nom - pPart - qPart);
            p = Math.max(0, p - pPart);
            q = Math.max(0, q - qPart);
            z = Math.max(0, z - zPart);
          } else if (tx.kategori === 'qurban') {
            q = Math.max(0, q - nom);
          } else if (tx.kategori === 'zakat') {
            z = Math.max(0, z - nom);
          } else {
            u = Math.max(0, u - nom);
          }
        }
      });
      const totalSimpanan = p + q + z + u;
      const jumlahHariPokok = Math.floor(p / (prev.profile?.pembagianPokokHarian || 1000));
      return {
        ...m,
        saldoPokok: p,
        saldoQurban: q,
        saldoZakatFitrah: z,
        saldoUmum: u,
        totalSimpanan,
        jumlahHariPokok,
        periodeTabunganPokok: latestPeriode,
      };
    }

    const mName = (m.nama || '').trim().toLowerCase();
    const memberKas = approvedKasAnggota.filter((k) => {
      if (k.memberId && k.memberId === m.id) return true;
      const pName = (k.namaPenerima || '').trim().toLowerCase();
      if (pName && pName === mName) return true;
      const ket = (k.keterangan || '').trim().toLowerCase();
      if (!k.memberId && mName && ket.includes(mName)) return true;
      return false;
    });

    // Cek juga entri koreksi massal yang mencakup semua anggota
    const massKas = approvedKasAnggota.filter((k) => {
      if (k.memberId) return false;
      const pName = (k.namaPenerima || '').trim().toLowerCase();
      return pName.includes('koreksi massal') || pName.includes('koreksi saldo massal');
    });

    let p = 0;
    let q = 0;
    let z = 0;
    let u = 0;
    let latestPeriode = m.periodeTabunganPokok;

    memberKas.forEach((k) => {
      const kat = (k.kategori || '').toLowerCase();
      const sign = k.tipe === 'masuk' ? 1 : -1;
      if (k.periode) latestPeriode = k.periode;
      if (kat.includes('pokok')) {
        p = Math.max(0, p + sign * k.nominal);
      } else if (kat.includes('qurban')) {
        q = Math.max(0, q + sign * k.nominal);
      } else if (kat.includes('zakat')) {
        z = Math.max(0, z + sign * k.nominal);
      } else if (!kat.includes('pinjaman kas') && !kat.includes('pengembalian')) {
        u = Math.max(0, u + sign * k.nominal);
      }
    });

    if (massKas.length > 0 && activeMembers.length > 0) {
      massKas.forEach((k) => {
        const perMem = Math.floor(k.nominal / activeMembers.length);
        const kat = (k.kategori || '').toLowerCase();
        const sign = k.tipe === 'masuk' ? 1 : -1;
        if (k.periode) latestPeriode = k.periode;
        if (kat.includes('pokok')) p = Math.max(0, p + sign * perMem);
        else if (kat.includes('qurban')) q = Math.max(0, q + sign * perMem);
        else if (kat.includes('zakat')) z = Math.max(0, z + sign * perMem);
        else u = Math.max(0, u + sign * perMem);
      });
    }

    // Tambahkan dampak transfer sesama anggota atau sedekah potong saldo umum dari memberTransactions
    const internalTxs = txList.filter(
      (tx) =>
        tx.memberId === m.id &&
        (tx.referensiId?.startsWith('TF-') ||
          tx.id.startsWith('tx-tf-') ||
          tx.id.startsWith('tx-sdk-') ||
          (tx.keterangan || '').toLowerCase().includes('transfer'))
    );
    internalTxs.forEach((tx) => {
      if (tx.tipe === 'masuk') u += tx.nominal;
      else u = Math.max(0, u - tx.nominal);
    });

    const totalSimpanan = p + q + z + u;
    const jumlahHariPokok = Math.floor(p / (prev.profile?.pembagianPokokHarian || 1000));

    return {
      ...m,
      saldoPokok: p,
      saldoQurban: q,
      saldoZakatFitrah: z,
      saldoUmum: u,
      totalSimpanan,
      jumlahHariPokok,
      periodeTabunganPokok: latestPeriode,
    };
  });

  // 3. Rekalkulasi running saldoKasSetelah pada Buku Kas Anggota & Koperasi
  const recomputeKas = (type: 'anggota' | 'koperasi') => {
    const items = kasList
      .filter((k) => k.bukuKas === type)
      .slice()
      .sort((a, b) => {
        const cmp = `${a.tanggal || ''} ${a.createdAt || ''}`.localeCompare(`${b.tanggal || ''} ${b.createdAt || ''}`);
        return cmp !== 0 ? cmp : String(a.id || '').localeCompare(String(b.id || ''));
      });
    let run = 0;
    const map = new Map<string, number>();
    items.forEach((it) => {
      if (it.status === 'approved') {
        run = it.tipe === 'masuk' ? run + it.nominal : Math.max(0, run - it.nominal);
      }
      map.set(it.id, run);
    });
    return map;
  };
  const mapAnggota = recomputeKas('anggota');
  const mapKoperasi = recomputeKas('koperasi');
  const syncedKasList = kasList.map((k) => ({
    ...k,
    saldoKasSetelah:
      k.bukuKas === 'anggota'
        ? (mapAnggota.get(k.id) ?? k.saldoKasSetelah)
        : (mapKoperasi.get(k.id) ?? k.saldoKasSetelah),
  }));

  return {
    ...prev,
    members: updatedMembers,
    kasList: syncedKasList,
    memberTransactions: txList,
  };
}

export const VALID_MUTASI_CBG_CODES = new Set([
  '53732',
  '53745',
  '53532',
  '93907',
  '93740',
  '114114',
  '114117',
  '114514',
  '114517',
]);

/**
 * Menentukan kode kolom CBG pada mutasi rekening koran anggota:
 * - 53732  : Setoran tabungan pokok oleh anggota dari device anggota
 * - 53745  : Setoran tabungan umum oleh anggota dari device anggota
 * - 53532  : Setoran sedekah oleh anggota dari device anggota (QRIS / TFTU)
 * - 93907  : Penyesuaian / koreksi saldo tabungan pokok (+/-) oleh admin
 * - 93740  : Penyesuaian / koreksi saldo tabungan umum (+/-) oleh admin
 * - 114114 : Pembagian hasil ke tabungan umum dari buku kas anggota
 * - 114117 : Pembagian hasil ke tabungan umum dari buku kas koperasi
 * - 114514 : Pembagian hasil ke tabungan pokok dari buku kas anggota
 * - 114517 : Pembagian hasil ke tabungan pokok dari buku kas koperasi
 * (Hanya mengembalikan kode CBG tanpa mengubah keterangan maupun data lainnya.)
 */
export function resolveMutasiCbgCode(
  tx: MemberTransaction,
  context?: {
    setoranList?: SetoranVerifikasi[];
    kasList?: KasEntry[];
    sedekahList?: SedekahBerbagiEntry[];
  }
): string {
  if (!tx) return '0001';
  const rawCbg = String(tx.cbg || '').trim();
  const id = String(tx.id || '');
  const refId = String(tx.referensiId || '');
  const ketLower = String(tx.keterangan || '').toLowerCase();

  const setoranList = context?.setoranList || globalState?.setoranList || [];
  const kasList = context?.kasList || globalState?.kasList || [];
  const sedekahList = context?.sedekahList || globalState?.sedekahList || [];

  const depFromSetoran = setoranList.find(
    (s) =>
      (refId && s.id === refId) ||
      id === `tx-dep-${s.id}` ||
      id === `tx-sdk-${s.id}`
  );

  const isMemberUmumDeposit =
    !refId.startsWith('KAS-') &&
    !id.startsWith('tx-sdk-') &&
    !refId.startsWith('sdk-') &&
    !id.startsWith('tx-shu-') &&
    !id.startsWith('tx-adj-') &&
    !id.startsWith('tx-tf-') &&
    !id.startsWith('tx-tarik-') &&
    !refId.startsWith('TF-') &&
    !refId.startsWith('ADJ-') &&
    !refId.startsWith('SHU-') &&
    (depFromSetoran?.jenis === 'umum' ||
      id.startsWith('tx-umum-') ||
      (tx.kategori === 'umum' && (id.startsWith('tx-dep-') || refId.startsWith('dep-'))));

  if (VALID_MUTASI_CBG_CODES.has(rawCbg)) {
    if (rawCbg === '53732' && isMemberUmumDeposit) {
      return '53745';
    }
    return rawCbg;
  }

  // 6-9: Penyesuaian saldo pembagian hasil (SHU)
  if (id.startsWith('tx-shu-') || refId.startsWith('SHU-') || ketLower.startsWith('bagi hasil')) {
    const kasShu = kasList.find(
      (k) =>
        (refId && k.referensiId === refId) ||
        (String(k.id || '').startsWith('kas-shu-') &&
          k.tanggal === tx.tanggal &&
          String(k.kategori || '').toLowerCase().includes('bagi hasil'))
    );
    const sumberKas = kasShu?.bukuKas === 'anggota' ? 'anggota' : 'koperasi';
    if (tx.kategori === 'umum') {
      return sumberKas === 'anggota' ? '114114' : '114117';
    }
    return sumberKas === 'anggota' ? '114514' : '114517';
  }

  // 4-5: Penyesuaian / koreksi saldo tabungan pokok (93907) / umum (93740) oleh admin
  if (
    id.startsWith('tx-adj-') ||
    refId.startsWith('ADJ-') ||
    ketLower.startsWith('koreksi ') ||
    ketLower.startsWith('penyesuaian ')
  ) {
    if (tx.kategori === 'pokok' || ketLower.includes('tabungan pokok')) {
      return '93907';
    }
    if (tx.kategori === 'umum' || ketLower.includes('saldo umum') || ketLower.includes('tabungan umum')) {
      return '93740';
    }
  }

  const sdkEntry = sedekahList.find(
    (s) => (refId && s.id === refId) || id === `tx-sdk-${s.id}`
  );

  // 3: Setoran sedekah oleh anggota dari device anggota
  const isFromMemberSedekah =
    (depFromSetoran && (depFromSetoran.jenis === 'sedekah' || String(depFromSetoran.id).startsWith('sdk-'))) ||
    (sdkEntry && (String(sdkEntry.inputBy || '').startsWith('Anggota') || sdkEntry.sumberDana === 'qris' || sdkEntry.sumberDana === 'tabungan_umum') && !refId.startsWith('KAS-')) ||
    ((id.startsWith('tx-sdk-') || tx.kategori === 'sedekah' || refId.startsWith('sdk-')) && !refId.startsWith('KAS-'));

  if (isFromMemberSedekah) {
    return '53532';
  }

  // 1-2: Setoran tabungan pokok (53732) / tabungan umum (53745) oleh anggota dari device anggota
  const isFromMemberSetoran =
    (depFromSetoran && (depFromSetoran.jenis === 'kewajiban' || depFromSetoran.jenis === 'umum')) ||
    id.startsWith('tx-dep-') ||
    refId.startsWith('dep-') ||
    ((id.startsWith('tx-wajib-') || id.startsWith('tx-umum-')) && !refId.startsWith('KAS-'));

  if (isFromMemberSetoran) {
    return isMemberUmumDeposit ? '53745' : '53732';
  }

  return rawCbg || '0001';
}


