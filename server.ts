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
    sekretaris: 'Robi Darwis',
    bendahara: 'Suryadi Pratama',
    pengawas: 'H. Ahmad Fauzi',
    daftarPengurus: [
      { id: 'peng-1', jabatan: 'Ketua Pengurus', nama: 'Abzqar', kontak: '0811-9882-233' },
      { id: 'peng-2', jabatan: 'Sekretaris', nama: 'Robi Darwis', kontak: '0857-1234-5678' },
      { id: 'peng-3', jabatan: 'Bendahara', nama: 'Suryadi Pratama', kontak: '0812-9988-7766' },
      { id: 'peng-4', jabatan: 'Ketua Dewan Pengawas', nama: 'H. Ahmad Fauzi', kontak: '0813-4455-6677' },
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
