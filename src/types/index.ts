export type WilayahKoperasi = 'Cengkareng' | 'Kalideres' | 'Kembangan' | 'Kebon Jeruk';

export const WILAYAH_CODE_MAP: Record<WilayahKoperasi, string> = {
  Kalideres: '76',
  Cengkareng: '77',
  Kembangan: '78',
  'Kebon Jeruk': '79',
};

export const WILAYAH_ABBR_MAP: Record<WilayahKoperasi, string> = {
  Cengkareng: 'CKR',
  Kalideres: 'KLD',
  Kembangan: 'KMB',
  'Kebon Jeruk': 'KBJ',
};

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isPrimary?: boolean;
}

export interface PengurusItem {
  id: string;
  jabatan: string;
  nama: string;
  kontak?: string;
  nik?: string;
}

export interface KoperasiProfile {
  nama: string;
  badanHukum: string;
  npwpKoperasi?: string;
  nikKoperasi?: string;
  tanggalPendirian?: string;
  visi?: string;
  misi?: string;
  ketuaPengurus?: string;
  sekretaris?: string;
  bendahara?: string;
  pengawas?: string;
  alamat: string;
  telepon: string;
  email: string;
  website: string;
  daftarPengurus?: PengurusItem[];
  rekeningPenampungan: BankAccount[];
  qrisImageUrl: string;
  biayaWajibHarian: number; // Rp 2.000
  pembagianPokokHarian: number; // Rp 1.000
  pembagianZakatHarian: number; // Rp 500
  pembagianQurbanHarian: number; // Rp 500
}

export type AdminRole = 
  | 'super_admin'       // Akses penuh, kelola admin, hapus anggota, approval kas, lihat audit log
  | 'admin_kelola'      // Admin kelola: tidak bisa masuk ke server, tidak bisa tambah admin, bisa approval
  | 'admin_pembukuan'   // Alias kompatibilitas untuk admin_kelola
  | 'admin_write'       // Admin write: input dan download laporan, semua inputan perlu approval super admin dan admin kelola. Verifikasi setoran.
  | 'admin_laporan';    // Admin laporan: hanya bisa unduh data qurban dan zakat, data anggota, laporan keuangan, serta buku kas.

export interface AdminUser {
  id: string;
  username: string;
  nama: string;
  email: string;
  whatsapp: string;
  nik: string;
  wilayahKantor: WilayahKoperasi;
  role: AdminRole;
  password?: string;
  avatarUrl?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  createdAt: string;
}

export interface MemberUser {
  id: string;
  nomorAnggota: string; // e.g. HWS-CKR-2026-001
  nomorRekening: string; // 10 digit, e.g. 7729666666
  nama: string;
  nik: string;
  whatsapp: string;
  email: string;
  wilayah: WilayahKoperasi;
  alamatLengkap: string;
  provinsi: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
  rt: string;
  rw: string;
  kodePos: string;
  ktpPhotoUrl?: string;
  avatarUrl?: string;
  bankPribadi: {
    namaBank: string;
    nomorRekening: string;
    atasNama: string;
  };
  password?: string;
  pinTransaksi?: string; // 6 digit PIN untuk transfer sesama anggota
  securityQuestion?: string;
  securityAnswer?: string;
  
  // Saldo-saldo terpisah
  saldoPokok: number; // Rp 1.000/hari, terkunci sistem
  isPokokLocked: boolean; // default true
  saldoZakatFitrah: number; // Rp 500/hari, dikelola pengurus
  saldoQurban: number; // Rp 500/hari, dikelola pengurus
  saldoUmum: number; // Bebas setor & tarik kapan saja
  
  status: 'aktif' | 'nonaktif' | 'pending' | 'pending_deletion';
  terdaftarSejak: string;
}

export type JenisSetoran = 'kewajiban' | 'umum';

export interface SetoranVerifikasi {
  id: string;
  nomorReferensi: string;
  memberId: string;
  memberNama: string;
  memberRekening: string;
  memberWilayah: WilayahKoperasi;
  jenis: JenisSetoran;
  jumlahHari?: number; // untuk setoran kewajiban
  nominal: number;
  rekeningTujuan: string;
  metode: 'transfer_bank' | 'qris';
  buktiTransferUrl: string;
  catatanAnggota?: string;
  status: 'pending' | 'disetujui' | 'ditolak';
  verifiedBy?: string;
  verifiedAt?: string;
  alasanTolak?: string;
  createdAt: string;
}

export type TipeMutasi = 'masuk' | 'keluar'; // Kredit = masuk, Debit = keluar
export type KategoriTabunganMutasi = 'pokok' | 'umum' | 'zakat' | 'qurban' | 'semua';

export interface MemberTransaction {
  id: string;
  memberId: string;
  tanggal: string; // YYYY-MM-DD
  jam: string;
  keterangan: string;
  cbg: string; // e.g. KCP Cengkareng
  tipe: TipeMutasi; // masuk (CR) atau keluar (DB)
  nominal: number;
  saldoSetelah: number;
  kategori: KategoriTabunganMutasi;
  referensiId?: string;
}

export interface KasEntry {
  id: string;
  bukuKas: 'anggota' | 'koperasi';
  tanggal: string;
  kategori: string;
  keterangan: string;
  tipe: 'masuk' | 'keluar';
  nominal: number;
  saldoKasSetelah: number;
  inputBy: string;
  approvedBy?: string;
  status: 'approved' | 'pending_approval' | 'rejected';
  pendingAction?: 'create' | 'update' | 'delete';
  originalData?: Partial<KasEntry>;
  createdAt: string;
}

export interface PenyaluranZakatQurban {
  id: string;
  tanggal: string;
  jenis: 'zakat_fitrah' | 'qurban';
  wilayah?: WilayahKoperasi | 'Semua Wilayah';
  totalPenyaluran: number;
  nominalPerAnggota: number;
  jumlahPenerima: number;
  penerimaIds: string[];
  keterangan: string;
  diajukanOleh: string;
  disetujuiOleh?: string;
  status: 'pending_approval' | 'disetujui' | 'ditolak';
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  memberId: string;
  senderType: 'member' | 'admin';
  senderNama: string;
  pesan: string;
  lampiranUrl?: string;
  timestamp: string;
  isReadByAdmin: boolean;
  isReadByMember: boolean;
}

export interface SuratResmi {
  id: string;
  nomorSurat: string;
  perihal: string;
  tanggal: string;
  tujuanTipe: 'perorangan' | 'semua';
  targetMemberId?: string;
  targetMemberNama?: string;
  isiSurat: string;
  lampiranTeks?: string;
  diterbitkanOleh: string;
  statusTerkirimWa: boolean;
  statusTerkirimEmail: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  adminId: string;
  adminNama: string;
  adminRole: AdminRole;
  action: string;
  detail: string;
  ipAddress?: string;
  targetId?: string;
}

export interface AppState {
  profile: KoperasiProfile;
  admins: AdminUser[];
  members: MemberUser[];
  setoranList: SetoranVerifikasi[];
  memberTransactions: MemberTransaction[];
  kasList: KasEntry[];
  penyaluranList: PenyaluranZakatQurban[];
  chatMessages: ChatMessage[];
  suratList: SuratResmi[];
  auditLogs: AuditLog[];
  categoriesKasKoperasi: {
    pemasukan: string[];
    pengeluaran: string[];
  };
  lastRunningNumber: number; // untuk 5 digit rek (dimulai dari 66666)
  serverSyncStatus: {
    online: boolean;
    lastSynced: string;
    googleCloudBackup: boolean;
    firestoreActive: boolean;
  };
}
