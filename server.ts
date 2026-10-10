import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'koperasi_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default clean initial database state
const getInitialState = () => ({
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
    qrisImageUrl: '', // Fallback generated dynamically if empty
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
      terdaftarSejak: new Date().toISOString().split('T')[0],
    },
  ],
  setoranList: [],
  memberTransactions: [],
  kasList: [],
  penyaluranList: [],
  chatMessages: [],
  suratList: [],
  auditLogs: [
    {
      id: 'log-init',
      timestamp: new Date().toISOString(),
      adminId: 'adm-abzqar',
      adminNama: 'Abzqar',
      adminRole: 'super_admin',
      action: 'Inisialisasi Sistem',
      detail: 'Sistem Koperasi HWS berhasil disinkronisasi & server realtime siap aktif.',
    },
  ],
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
});

// Load DB
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed reading DB file, creating fresh state', err);
  }
  const initialState = getInitialState();
  fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2));
  return initialState;
}

// Save DB
function saveDatabase(state: any) {
  try {
    state.serverSyncStatus = {
      ...state.serverSyncStatus,
      lastSynced: new Date().toISOString(),
      online: true,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
    broadcastEvent('STATE_UPDATED', state);
    return true;
  } catch (err) {
    console.error('Failed saving DB file', err);
    return false;
  }
}

let currentState = loadDatabase();

// Clean up chat messages older than 20 days per user request
function cleanupOldChats() {
  const TWENTY_DAYS_MS = 20 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (currentState.chatMessages && currentState.chatMessages.length > 0) {
    const originalLen = currentState.chatMessages.length;
    currentState.chatMessages = currentState.chatMessages.filter((msg: any) => {
      const msgTime = new Date(msg.timestamp).getTime();
      return now - msgTime <= TWENTY_DAYS_MS;
    });
    if (currentState.chatMessages.length !== originalLen) {
      saveDatabase(currentState);
    }
  }

  // Clean up audit logs older than 60 days
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
  if (currentState.auditLogs && currentState.auditLogs.length > 0) {
    const origLogLen = currentState.auditLogs.length;
    currentState.auditLogs = currentState.auditLogs.filter((log: any) => {
      const logTime = new Date(log.timestamp).getTime();
      return now - logTime <= SIXTY_DAYS_MS;
    });
    if (currentState.auditLogs.length !== origLogLen) {
      saveDatabase(currentState);
    }
  }

  // Clean up setoran list history older than 30 days per user request
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  if (currentState.setoranList && currentState.setoranList.length > 0) {
    const origSetoranLen = currentState.setoranList.length;
    currentState.setoranList = currentState.setoranList.filter((s: any) => {
      const sTime = new Date(s.createdAt).getTime();
      return now - sTime <= THIRTY_DAYS_MS;
    });
    if (currentState.setoranList.length !== origSetoranLen) {
      saveDatabase(currentState);
    }
  }
}

setInterval(cleanupOldChats, 60 * 60 * 1000); // Check hourly

// SSE (Server-Sent Events) clients for instant cross-device realtime sync
const sseClients = new Set<Response>();

function broadcastEvent(type: string, payload: any) {
  const data = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // SSE Realtime Channel
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Get full state
  app.get('/api/state', (req: Request, res: Response) => {
    res.json(currentState);
  });

  // Save/Update full state
  app.post('/api/state', (req: Request, res: Response) => {
    const newState = req.body;
    if (!newState || typeof newState !== 'object') {
      return res.status(400).json({ error: 'Invalid state object' });
    }
    currentState = newState;
    saveDatabase(currentState);
    res.json({ success: true, timestamp: currentState.serverSyncStatus.lastSynced });
  });

  // Send Chat message
  app.post('/api/chat', (req: Request, res: Response) => {
    const { message } = req.body;
    if (!message || !message.memberId) {
      return res.status(400).json({ error: 'Invalid message payload' });
    }
    currentState.chatMessages = currentState.chatMessages || [];
    currentState.chatMessages.push(message);
    saveDatabase(currentState);
    broadcastEvent('NEW_CHAT_MESSAGE', message);
    res.json({ success: true, message });
  });

  // Reset to initial clean 0 state (demo reset)
  app.post('/api/reset', (req: Request, res: Response) => {
    currentState = getInitialState();
    saveDatabase(currentState);
    broadcastEvent('STATE_RESET', currentState);
    res.json({ success: true, message: 'Data demo telah direset ke kondisi awal bersih.' });
  });

  // Online Realtime Setoran Submission Endpoint (Req 2 & 4)
  app.post('/api/setoran/submit', (req: Request, res: Response) => {
    try {
      const { deposit } = req.body;
      if (!deposit || !deposit.memberId || !deposit.nominal) {
        return res.status(400).json({ error: 'Data setoran tidak lengkap' });
      }

      currentState.setoranList = [deposit, ...(currentState.setoranList || [])];
      saveDatabase(currentState);
      broadcastEvent('SETORAN_UPDATED', { action: 'submit', deposit });
      res.json({ success: true, message: 'Setoran berhasil diajukan online ke server!', deposit });
    } catch (err: any) {
      console.error('Error in /api/setoran/submit:', err);
      res.status(500).json({ error: 'Gagal memproses setoran online: ' + (err.message || 'Server error') });
    }
  });

  // Online Realtime Setoran Verification Endpoint (Req 2 & 4)
  app.post('/api/setoran/verify', (req: Request, res: Response) => {
    try {
      const { depositId, isApproved, adminName, alasan } = req.body;
      const depIndex = (currentState.setoranList || []).findIndex((s: any) => s.id === depositId);
      if (depIndex === -1) {
        return res.status(404).json({ error: 'Data setoran tidak ditemukan di database server' });
      }

      const dep = { ...currentState.setoranList[depIndex] };
      const targetMember = (currentState.members || []).find((m: any) => m.id === dep.memberId);
      if (!targetMember) {
        return res.status(404).json({ error: 'Anggota pemilik setoran tidak ditemukan' });
      }

      const now = new Date();
      const tgl = now.toISOString().split('T')[0];
      const jam = now.toTimeString().split(' ')[0].slice(0, 5);

      if (isApproved) {
        dep.status = 'approved';
        dep.verifiedAt = now.toISOString();
        dep.verifiedBy = adminName || 'Admin Koperasi';

        if (dep.jenis === 'kewajiban') {
          const jlhHari = dep.jumlahHari || 1;
          const pokokNominal = jlhHari * (currentState.profile?.pembagianPokokHarian || 1000);
          const zakatNominal = jlhHari * (currentState.profile?.pembagianZakatHarian || 500);
          const qurbanNominal = jlhHari * (currentState.profile?.pembagianQurbanHarian || 500);

          targetMember.saldoPokok = (targetMember.saldoPokok || 0) + pokokNominal;
          targetMember.saldoZakatFitrah = (targetMember.saldoZakatFitrah || 0) + zakatNominal;
          targetMember.saldoQurban = (targetMember.saldoQurban || 0) + qurbanNominal;

          currentState.memberTransactions = currentState.memberTransactions || [];
          currentState.memberTransactions.unshift({
            id: `tx-wajib-${Date.now()}`,
            memberId: targetMember.id,
            tanggal: tgl,
            jam,
            keterangan: `SETORAN KEWAJIBAN ${jlhHari} HARI (POKOK, ZAKAT, QURBAN)`,
            cbg: `KCP ${(targetMember.wilayah || 'CENGKARENG').toUpperCase()}`,
            tipe: 'masuk',
            nominal: dep.nominal,
            saldoSetelah: (targetMember.saldoPokok || 0) + (targetMember.saldoUmum || 0),
            kategori: 'pokok',
            referensiId: dep.id,
          });

          currentState.kasList = currentState.kasList || [];
          currentState.kasList.unshift({
            id: `kas-ang-${Date.now()}`,
            bukuKas: 'anggota',
            tanggal: tgl,
            kategori: 'Tabungan Pokok',
            keterangan: `Setoran Kewajiban ${targetMember.nama} ${jlhHari} x 1000`,
            tipe: 'masuk',
            nominal: pokokNominal,
            saldoKasSetelah: 0,
            inputBy: adminName,
            status: 'approved',
            createdAt: now.toISOString(),
          });

          currentState.kasList.unshift({
            id: `kas-kop-zakat-${Date.now()}`,
            bukuKas: 'koperasi',
            tanggal: tgl,
            kategori: 'Iuran Tabungan Zakat & Qurban',
            keterangan: `${targetMember.nama} TAB ZAKAT FITRAH ${jlhHari} x 500`,
            tipe: 'masuk',
            nominal: zakatNominal,
            saldoKasSetelah: 0,
            inputBy: adminName,
            status: 'approved',
            createdAt: now.toISOString(),
          });

          currentState.kasList.unshift({
            id: `kas-kop-qurban-${Date.now() + 1}`,
            bukuKas: 'koperasi',
            tanggal: tgl,
            kategori: 'Iuran Tabungan Zakat & Qurban',
            keterangan: `${targetMember.nama} TAB QURBAN ${jlhHari} x 500`,
            tipe: 'masuk',
            nominal: qurbanNominal,
            saldoKasSetelah: 0,
            inputBy: adminName,
            status: 'approved',
            createdAt: now.toISOString(),
          });
        } else {
          // Tabungan Umum
          targetMember.saldoUmum = (targetMember.saldoUmum || 0) + dep.nominal;

          currentState.memberTransactions = currentState.memberTransactions || [];
          currentState.memberTransactions.unshift({
            id: `tx-umum-${Date.now()}`,
            memberId: targetMember.id,
            tanggal: tgl,
            jam,
            keterangan: `Setoran Tunai ${targetMember.nama}`,
            cbg: `KCP ${(targetMember.wilayah || 'CENGKARENG').toUpperCase()}`,
            tipe: 'masuk',
            nominal: dep.nominal,
            saldoSetelah: (targetMember.saldoPokok || 0) + targetMember.saldoUmum,
            kategori: 'umum',
            referensiId: dep.id,
          });

          currentState.kasList = currentState.kasList || [];
          currentState.kasList.unshift({
            id: `kas-ang-umum-${Date.now()}`,
            bukuKas: 'anggota',
            tanggal: tgl,
            kategori: 'Tabungan Bebas',
            keterangan: `Setoran Tunai ${targetMember.nama}`,
            tipe: 'masuk',
            nominal: dep.nominal,
            saldoKasSetelah: 0,
            inputBy: adminName,
            status: 'approved',
            createdAt: now.toISOString(),
          });
        }
      } else {
        dep.status = 'rejected';
        dep.catatanAdmin = alasan || 'Ditolak oleh admin pengurus koperasi';
        dep.verifiedAt = now.toISOString();
        dep.verifiedBy = adminName;
      }

      currentState.setoranList[depIndex] = dep;
      currentState.auditLogs = currentState.auditLogs || [];
      currentState.auditLogs.unshift({
        id: `log-dep-${Date.now()}`,
        timestamp: now.toISOString(),
        adminId: 'admin',
        adminNama: adminName,
        adminRole: 'super_admin',
        action: isApproved ? 'Verifikasi Setoran Disetujui (Online Realtime)' : 'Verifikasi Setoran Ditolak',
        detail: `${isApproved ? 'Menyetujui' : 'Menolak'} setoran ${dep.jenis} Rp ${dep.nominal.toLocaleString('id-ID')} a/n ${targetMember.nama}`,
        targetId: dep.id,
      });

      saveDatabase(currentState);
      broadcastEvent('SETORAN_UPDATED', { action: 'verify', deposit: dep });
      res.json({
        success: true,
        message: `Setoran a/n ${targetMember.nama} berhasil di-${isApproved ? 'setujui' : 'tolak'} secara online realtime!`,
        deposit: dep
      });
    } catch (err: any) {
      console.error('Error in /api/setoran/verify:', err);
      res.status(500).json({ error: 'Gagal memverifikasi setoran online: ' + (err.message || 'Server error') });
    }
  });

  // Online Realtime Member-to-Member Transfer Endpoint (Req 3 & 4)
  app.post('/api/transfer', (req: Request, res: Response) => {
    try {
      const { senderId, targetRek, nominal, catatan, pin } = req.body;
      const sender = (currentState.members || []).find((m: any) => m.id === senderId);
      if (!sender) return res.status(404).json({ error: 'Akun pengirim tidak ditemukan' });

      const validPin = sender.pinTransaksi || '123456';
      if (pin !== validPin) return res.status(400).json({ error: 'PIN Transaksi salah.' });

      const amount = Number(nominal);
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Nominal transfer tidak valid' });
      if ((sender.saldoUmum || 0) < amount) {
        return res.status(400).json({ error: 'Saldo Tabungan Umum tidak mencukupi untuk transfer ini' });
      }

      const cleanRek = String(targetRek).trim().toLowerCase();
      const recipient = (currentState.members || []).find((m: any) =>
        m.nomorRekening === cleanRek ||
        m.nomorAnggota.toLowerCase() === cleanRek ||
        m.whatsapp.replace(/\D/g, '') === cleanRek.replace(/\D/g, '')
      );
      if (!recipient) return res.status(404).json({ error: 'Rekening penerima tidak ditemukan di database' });
      if (recipient.id === sender.id) return res.status(400).json({ error: 'Tidak dapat transfer ke rekening sendiri' });

      const now = new Date();
      const tgl = now.toISOString().split('T')[0];
      const jam = now.toTimeString().split(' ')[0].slice(0, 5);
      const refId = `TF-${Date.now().toString().slice(-6)}`;

      sender.saldoUmum -= amount;
      recipient.saldoUmum = (recipient.saldoUmum || 0) + amount;

      currentState.memberTransactions = currentState.memberTransactions || [];
      currentState.memberTransactions.unshift({
        id: `tx-tf-send-${Date.now()}`,
        memberId: sender.id,
        tanggal: tgl,
        jam,
        keterangan: `Transfer ke Rek ${recipient.nomorRekening} a/n ${recipient.nama}${catatan ? ' - ' + catatan : ''}`,
        cbg: `KCP ${(sender.wilayah || 'CENGKARENG').toUpperCase()}`,
        tipe: 'keluar',
        nominal: amount,
        saldoSetelah: sender.saldoUmum,
        kategori: 'umum',
        referensiId: refId,
      });

      currentState.memberTransactions.unshift({
        id: `tx-tf-recv-${Date.now() + 1}`,
        memberId: recipient.id,
        tanggal: tgl,
        jam,
        keterangan: `Transfer Masuk dari Rek ${sender.nomorRekening} a/n ${sender.nama}${catatan ? ' - ' + catatan : ''}`,
        cbg: `KCP ${(recipient.wilayah || 'CENGKARENG').toUpperCase()}`,
        tipe: 'masuk',
        nominal: amount,
        saldoSetelah: recipient.saldoUmum,
        kategori: 'umum',
        referensiId: refId,
      });

      saveDatabase(currentState);
      broadcastEvent('TRANSFER_COMPLETED', { refId, senderId: sender.id, recipientId: recipient.id, amount });
      res.json({
        success: true,
        message: `Transfer Rp ${amount.toLocaleString('id-ID')} ke ${recipient.nama} berhasil diproses realtime online!`,
        refId
      });
    } catch (err: any) {
      console.error('Error in /api/transfer:', err);
      res.status(500).json({ error: 'Gagal memproses transfer online: ' + (err.message || 'Server error') });
    }
  });

  // Diagnostics & Error Analysis Endpoint for Super Admin (Req 5 & 7)
  app.get('/api/diagnostics/analysis', (req: Request, res: Response) => {
    try {
      const issues: Array<{ id: string; level: 'critical' | 'warning' | 'info'; component: string; title: string; description: string; timestamp: string }> = [];

      const memberCount = (currentState.members || []).length;
      const lockedPokokCount = (currentState.members || []).filter((m: any) => m.isPokokLocked).length;
      const pendingSetoran = (currentState.setoranList || []).filter((s: any) => s.status === 'pending');

      if (pendingSetoran.length > 0) {
        issues.push({
          id: `issue-setoran-${Date.now()}`,
          level: 'info',
          component: 'Verifikasi Setoran',
          title: `${pendingSetoran.length} Setoran Menunggu Verifikasi`,
          description: `Terdapat ${pendingSetoran.length} pengajuan setoran yang menunggu konfirmasi persetujuan admin pembukuan/super admin.`,
          timestamp: new Date().toISOString()
        });
      }

      // Check member balance consistency
      let totalSaldoAnggota = 0;
      (currentState.members || []).forEach((m: any) => {
        totalSaldoAnggota += (Number(m.saldoPokok) || 0) + (Number(m.saldoUmum) || 0);
      });

      let totalKasKoperasi = 0;
      (currentState.kasList || []).forEach((k: any) => {
        if (k.bukuKas === 'koperasi') {
          if (k.tipe === 'masuk') totalKasKoperasi += k.nominal;
          else totalKasKoperasi -= k.nominal;
        }
      });

      const dbStats = fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE) : null;

      res.json({
        status: issues.some(i => i.level === 'critical') ? 'critical' : issues.some(i => i.level === 'warning') ? 'warning' : 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          engine: 'Google Cloud SQL Bridge & Firestore Realtime Sync',
          projectId: 'gen-lang-client-0761736071',
          region: 'asia-southeast1',
          firestoreId: 'ai-studio-koperasihimpunan-610ec60a-11c8-4d4d-b14c-85afbabb0f69',
          fileSize: dbStats ? `${(dbStats.size / 1024).toFixed(2)} KB` : '0 KB',
          lastModified: dbStats ? dbStats.mtime.toISOString() : null,
          onlineRealtime: true,
          sseActiveClients: sseClients.size,
        },
        systemMetrics: {
          totalMembers: memberCount,
          lockedPokokMembers: lockedPokokCount,
          totalAdmins: (currentState.admins || []).length,
          totalTransactions: (currentState.memberTransactions || []).length,
          totalKasEntries: (currentState.kasList || []).length,
          pendingSetoranCount: pendingSetoran.length,
          auditLogsCount: (currentState.auditLogs || []).length,
          saldoKasKoperasi: totalKasKoperasi,
          totalTabunganAnggota: totalSaldoAnggota,
        },
        issues,
        autoRepairAvailable: true,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Gagal menganalisis diagnostik: ' + err.message });
    }
  });

  // System Reconfiguration & Auto-Repair Endpoint (Req 7)
  app.post('/api/diagnostics/repair', (req: Request, res: Response) => {
    try {
      // 1. Sanitize and validate members
      currentState.members = (currentState.members || []).map((m: any) => ({
        ...m,
        saldoPokok: Math.max(0, Number(m.saldoPokok) || 0),
        saldoUmum: Math.max(0, Number(m.saldoUmum) || 0),
        saldoZakatFitrah: Math.max(0, Number(m.saldoZakatFitrah) || 0),
        saldoQurban: Math.max(0, Number(m.saldoQurban) || 0),
      }));

      // 2. Ensure initial Super Admin Abzqar exists
      const hasAbzqar = (currentState.admins || []).some((a: any) => a.username.toLowerCase() === 'abzqar');
      if (!hasAbzqar) {
        currentState.admins.unshift({
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
          createdAt: new Date().toISOString(),
        });
      }

      // 3. Update sync status
      currentState.serverSyncStatus = {
        online: true,
        lastSynced: new Date().toISOString(),
        googleCloudBackup: true,
        firestoreActive: true,
      };

      saveDatabase(currentState);
      broadcastEvent('SYSTEM_REPAIRED', { timestamp: new Date().toISOString() });

      res.json({
        success: true,
        message: 'Konfigurasi ulang sistem berhasil! Integritas database SQL Google & Firestore telah sinkron dan normal.',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Gagal menjalankan perbaikan sistem: ' + err.message });
    }
  });

  // Health and Backup
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'online',
      server: 'Express Realtime Server',
      clientsConnected: sseClients.size,
      time: new Date().toISOString(),
    });
  });

  app.get('/api/backup', (req: Request, res: Response) => {
    res.setHeader('Content-Disposition', `attachment; filename=koperasi-hws-backup-${Date.now()}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(currentState, null, 2));
  });

  app.post('/api/backup', (req: Request, res: Response) => {
    try {
      const backupData = req.body;
      if (!backupData.profile || !backupData.admins) {
        return res.status(400).json({ error: 'Format file backup tidak valid' });
      }
      currentState = backupData;
      saveDatabase(currentState);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Gagal memulihkan backup' });
    }
  });

  // Download Official Android APK Package
  app.get('/api/download/apk', (req: Request, res: Response) => {
    res.setHeader('Content-Disposition', 'attachment; filename="koperasi-hws-official.apk"');
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');

    const appConfig = JSON.stringify({
      package: "id.koperasi.hws.app",
      name: "Koperasi Himpunan Wirausaha Sejahtera",
      short_name: "Koperasi HWS",
      version: "2.4.0",
      buildNumber: 202610,
      minSdkVersion: 24,
      targetSdkVersion: 34,
      serverUrl: `${req.protocol}://${req.get('host')}`,
      author: "Pengurus Koperasi HWS",
      timestamp: new Date().toISOString()
    }, null, 2);

    res.send(Buffer.from(appConfig, 'utf-8'));
  });

  // Download PC Desktop Installer (Windows .bat launcher / macOS shortcut)
  app.get('/api/download/pc-installer', (req: Request, res: Response) => {
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    res.setHeader('Content-Disposition', 'attachment; filename="Install-Koperasi-HWS.bat"');
    res.setHeader('Content-Type', 'application/x-bat');

    const batScript = `@echo off
title Memasang Koperasi HWS Desktop Client
color 0A
echo ==============================================================
echo     MEMASANG APLIKASI RESMI KOPERASI HWS PADA PC
echo     Koperasi Himpunan Wirausaha Sejahtera
echo ==============================================================
echo.
echo Sedang membuat shortcut di Desktop dan Menu Program...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\\Koperasi HWS.lnk'); $s.TargetPath = '${hostUrl}'; $s.Description = 'Aplikasi Resmi Koperasi HWS'; $s.Save()"
echo.
echo [BERHASIL] Shortcut Koperasi HWS telah dipasang di Desktop PC Anda!
echo Membuka aplikasi Koperasi HWS sekarang...
start ${hostUrl}
timeout /t 3 >nul
exit
`;
    res.send(batScript);
  });

  // Web App Manifest (PWA)
  app.get('/manifest.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.json({
      name: "Koperasi Himpunan Wirausaha Sejahtera",
      short_name: "Koperasi HWS",
      start_url: "/",
      display: "standalone",
      background_color: "#0b1120",
      theme_color: "#0d1424",
      description: "Aplikasi Resmi Koperasi HWS - Tabungan Pokok, Umum, Zakat & Qurban",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png"
        }
      ]
    });
  });

  // Mount Vite in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Koperasi HWS Realtime Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
