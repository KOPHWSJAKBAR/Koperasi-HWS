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

export interface FreezeRequest {
  requestedByRole: 'admin_write' | 'admin_kelola' | 'super_admin' | string;
  requestedByName: string;
  reason: string;
  requestedAt: string;
  approvedByKelola?: boolean;
  approvedByKelolaName?: string;
  approvedBySuperAdmin?: boolean;
  approvedBySuperAdminName?: string;
}

export interface LockPokokRequest {
  action: 'lock' | 'unlock'; // lock = kunci penarikan pokok, unlock = buka penarikan pokok
  requestedByRole: 'admin_write' | 'admin_approval' | 'super_admin' | string;
  requestedByName: string;
  reason: string;
  requestedAt: string;
  approvedByApproval?: boolean;
  approvedByApprovalName?: string;
  approvedBySuperAdmin?: boolean;
  approvedBySuperAdminName?: string;
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
  wakilKetua?: string;
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
  | 'super_admin'       // 1. Super Admin: Akses penuh semuanya
  | 'admin_write'       // 2. Admin Write: Input dan unduh laporan, keluar kas, qurban, zakat dan edit anggota persetujuan admin approval, download laporan
  | 'admin_approval'    // 3. Admin Approval: Tidak dapat input kas; input anggota edit anggota bisa, laporan bisa, qurban zakat hanya approval
  | 'admin_laporan'     // 4. Admin Laporan: Hanya unduh laporan anggota, laporan zakat qurban, dan laporan kas
  | 'sekretaris'        // Kompatibilitas
  | 'admin_kelola'      // Kompatibilitas admin_approval
  | 'admin_pembukuan';  // Kompatibilitas admin_approval

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
  // Data diri lengkap sesuai pendaftaran anggota (Req 1)
  alamatLengkap?: string;
  rt?: string;
  rw?: string;
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  kodePos?: string;
  bankPribadi?: {
    namaBank: string;
    nomorRekening: string;
    atasNama: string;
  };
  status?: 'aktif' | 'nonaktif' | 'dibekukan' | 'pending_freeze';
  freezeRequest?: FreezeRequest;
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
  jenisKelamin?: string;
  tanggalLahir?: string;
  pekerjaan?: string;
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
  totalSimpanan?: number; // Total akumulasi seluruh simpanan
  
  status: 'aktif' | 'nonaktif' | 'pending' | 'pending_deletion' | 'dibekukan' | 'pending_freeze';
  freezeRequest?: FreezeRequest;
  lockPokokRequest?: LockPokokRequest;
  terdaftarSejak: string;
}

export type JenisSetoran = 'kewajiban' | 'umum';

export interface SetoranVerifikasi {
  id: string;
  nomorReferensi: string;
  memberId: string;
  memberNama: string;
  memberRekening: string;
  memberNomorAnggota?: string;
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
  namaPenerima?: string; // Nama pihak penerima / penyetor (Req 1)
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
  readByMemberIds?: string[];
  readByAdminIds?: string[];
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

export interface MaintenanceLock {
  isLocked: boolean;
  lockedAt?: string;
  lockedByName?: string;
  note?: string; // Catatan alasan pembekuan sistem
  unlockedAt?: string;
  unlockedByName?: string;
}

// Req 2: Menu Berbagi (Sedekah Subuh, Sedekah Jumat, Sedekah Umum)
export type JenisSedekahBerbagi = 'sedekah_subuh' | 'sedekah_jumat' | 'sedekah_umum';

export interface PengaturanBerbagi {
  namaSubuh: string;
  namaJumat: string;
  namaUmum: string;
  noRekening: string;
  bankName: string;
  namaPemilikRekening: string;
  qrisImageUrl?: string;
}

export interface SedekahBerbagiEntry {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jam: string;
  jenis: JenisSedekahBerbagi; // 'sedekah_subuh' | 'sedekah_jumat' | 'sedekah_umum'
  namaBerbagiKustom?: string;
  tipe: 'penerimaan' | 'penyaluran'; // penerimaan = dari anggota/donatur, penyaluran = oleh admin
  nominal: number;
  status?: 'pending' | 'approved' | 'rejected'; // konfirmasi admin
  donaturNama?: string;
  donaturWilayah?: string; // wilayah anggota / donatur
  donaturMemberId?: string;
  donaturRekening?: string;
  donaturNomorAnggota?: string;
  buktiTransferUrl?: string; // foto / bukti transfer jpg
  penerimaManfaat?: string; // pihak penerima manfaat saat disalurkan oleh admin
  keterangan: string;
  sumberDana?: 'tabungan_umum' | 'transfer_bank' | 'qris';
  kasKoperasiId?: string; // id transaksi pencatatan di Buku Kas Koperasi
  inputBy: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  catatanAdmin?: string;
  createdAt: string;
}

export interface AppState {
  profile: KoperasiProfile;
  admins: AdminUser[];
  members: MemberUser[];
  setoranList: SetoranVerifikasi[];
  memberTransactions: MemberTransaction[];
  kasList: KasEntry[];
  penyaluranList: PenyaluranZakatQurban[];
  sedekahList?: SedekahBerbagiEntry[]; // Daftar mutasi sedekah/berbagi
  pengaturanBerbagi?: PengaturanBerbagi; // Nama berbagi & rekening kas berbagi
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
    filesProtected?: boolean;
    permanentStorage?: boolean;
  };
  maintenanceLock?: MaintenanceLock;
}



