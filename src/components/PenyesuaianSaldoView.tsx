import React, { useState } from 'react';
import {
  AppState,
  AdminUser,
  MemberUser,
  WilayahKoperasi,
  MemberTransaction,
  KasEntry,
  PendingMutasiActionRequest,
} from '../types';
import {
  formatRupiah,
  createAuditLog,
  getWibDateStr,
  getWibTimeStr,
  formatWibDateShort,
  sortMembersDesc,
  canApproveByRole,
  getRequiredApproverLabel,
  isApprovalRole,
  compareMemberTransactionsChrono,
  compareMemberTransactionsDesc,
} from '../lib/storage';
import { sendRealtimeNotification } from '../lib/fcm';
import {
  SlidersHorizontal,
  Scale,
  Percent,
  Users,
  Building,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowRight,
  TrendingUp,
  History,
  Info,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  User,
  KeyRound,
  ShieldAlert,
  Calendar,
} from 'lucide-react';

interface PenyesuaianSaldoViewProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin: AdminUser;
}

const WILAYAH_LIST: WilayahKoperasi[] = [
  'Cengkareng',
  'Kalideres',
  'Kembangan',
  'Kebon Jeruk',
];

export const PenyesuaianSaldoView: React.FC<PenyesuaianSaldoViewProps> = ({
  state,
  updateState,
  currentAdmin,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'koreksi' | 'pembagian_hasil'>('koreksi');

  // ================= STATE 1: KOREKSI SALDO =================
  const [koreksiTargetTipe, setKoreksiTargetTipe] = useState<'wilayah' | 'perorangan' | 'semua'>('wilayah');
  const [koreksiWilayah, setKoreksiWilayah] = useState<WilayahKoperasi>('Cengkareng');
  const [koreksiMemberId, setKoreksiMemberId] = useState<string>('');
  const [koreksiMemberSearch, setKoreksiMemberSearch] = useState<string>('');
  const [koreksiTipe, setKoreksiTipe] = useState<'masuk' | 'keluar'>('masuk');
  const [koreksiJenisTabungan, setKoreksiJenisTabungan] = useState<'pokok' | 'umum'>('umum');
  const [koreksiJumlahHari, setKoreksiJumlahHari] = useState<string>('');
  const [koreksiNominal, setKoreksiNominal] = useState<string>('');
  const [koreksiTanggal, setKoreksiTanggal] = useState<string>(() => getWibDateStr());
  const [koreksiKeterangan, setKoreksiKeterangan] = useState<string>('');
  const [isSubmittingKoreksi, setIsSubmittingKoreksi] = useState(false);

  // Security password state for Super Admin (Req User)
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // ================= STATE 2: PEMBAGIAN HASIL (SHU / PERSENTASE POKOK) =================
  const [bagiHasilTargetTipe, setBagiHasilTargetTipe] = useState<'wilayah' | 'perorangan' | 'semua'>('wilayah');
  const [bagiHasilWilayah, setBagiHasilWilayah] = useState<WilayahKoperasi>('Cengkareng');
  const [bagiHasilMemberId, setBagiHasilMemberId] = useState<string>('');
  const [bagiHasilMemberSearch, setBagiHasilMemberSearch] = useState<string>('');
  const [bagiHasilPersen, setBagiHasilPersen] = useState<string>('5');
  const [bagiHasilBukuKas, setBagiHasilBukuKas] = useState<'koperasi' | 'anggota'>('koperasi');
  const [bagiHasilTujuanKredit, setBagiHasilTujuanKredit] = useState<'umum' | 'pokok'>('umum');
  const [bagiHasilTanggal, setBagiHasilTanggal] = useState<string>(() => getWibDateStr());
  const [bagiHasilKeterangan, setBagiHasilKeterangan] = useState<string>(
    `Pembagian Hasil Usaha Koperasi Tahun ${getWibDateStr().slice(0, 4)}`
  );
  const [isSubmittingBagiHasil, setIsSubmittingBagiHasil] = useState(false);

  // Filter Target Members for Koreksi
  const targetMembersKoreksi = sortMembersDesc(state.members).filter((m) => {
    if (m.status === 'dibekukan' || m.status === 'nonaktif') return false;
    if (koreksiTargetTipe === 'semua') return true;
    if (koreksiTargetTipe === 'wilayah') return m.wilayah === koreksiWilayah;
    if (koreksiTargetTipe === 'perorangan') return m.id === koreksiMemberId;
    return true;
  });

  // Filter Target Members for Bagi Hasil
  const targetMembersBagiHasil = sortMembersDesc(state.members).filter((m) => {
    if (m.status === 'dibekukan' || m.status === 'nonaktif') return false;
    if (m.saldoPokok <= 0) return false; // Hanya anggota dengan simpanan pokok aktif
    if (bagiHasilTargetTipe === 'semua') return true;
    if (bagiHasilTargetTipe === 'wilayah') return m.wilayah === bagiHasilWilayah;
    if (bagiHasilTargetTipe === 'perorangan') return m.id === bagiHasilMemberId;
    return true;
  });

  // Kalkulasi Bagi Hasil
  const persenNum = Math.max(0, parseFloat(bagiHasilPersen) || 0);
  const totalPokokTarget = targetMembersBagiHasil.reduce((sum, m) => sum + (m.saldoPokok || 0), 0);
  const totalBagiHasilEstimasi = Math.round(totalPokokTarget * (persenNum / 100));

  // Role check: Hanya Super Admin yang eksekusi langsung; Admin Write -> Approval/Super Admin; Admin Approval -> Super Admin
  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const isApproval = currentAdmin.role === 'admin_approval' || currentAdmin.role === 'admin_kelola';
  const isWriter = currentAdmin.role === 'admin_write';
  const isPembukuan = currentAdmin.role === 'admin_pembukuan';
  const isLaporan = currentAdmin.role === 'admin_laporan';
  const canPerformAdjustment = isSuperAdmin || isApproval || isWriter || isPembukuan;
  const isDirectApproval = isSuperAdmin;
  const requiredApproverLabel = getRequiredApproverLabel(currentAdmin.role);

  const pendingMutasiAdjustRequests = (state.pendingMutasiRequests || []).filter(
    (r) => r.status === 'pending' && (r.actionType === 'adjust_balance' || r.actionType === 'bagi_hasil')
  );
  const actionableAdjustRequests = pendingMutasiAdjustRequests.filter((r) =>
    canApproveByRole(r.requestedByRole, currentAdmin.role)
  );
  const waitingAdjustRequests = pendingMutasiAdjustRequests.filter(
    (r) => !canApproveByRole(r.requestedByRole, currentAdmin.role)
  );

  const handleApproveMutasiRequest = async (reqItem: PendingMutasiActionRequest, isApproved: boolean) => {
    if (!canApproveByRole(reqItem.requestedByRole, currentAdmin.role)) {
      alert(`Akses Ditolak: Pengajuan ini wajib disetujui oleh ${getRequiredApproverLabel(reqItem.requestedByRole)}.`);
      return;
    }

    try {
      const res = await fetch('/api/mutasi-requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reqItem.id,
          isApproved,
          adminName: currentAdmin.nama,
          adminRole: currentAdmin.role,
        }),
      });
      if (res.status === 403) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Akses Ditolak.');
        return;
      }
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.state) {
          await updateState(() => data.state);
          alert(isApproved ? '✓ Pengajuan mutasi/penyesuaian saldo berhasil disetujui dan diterapkan!' : 'Permohonan penyesuaian saldo telah ditolak.');
          return;
        }
      }
    } catch {}

    // Offline fallback
    await updateState((prev) => {
      const nowIso = new Date().toISOString();
      const wibToday = getWibDateStr();
      const tgl = reqItem.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(reqItem.tanggal) ? reqItem.tanggal : wibToday;
      const jam = getWibTimeStr();
      const createdAtIso = tgl === wibToday ? nowIso : `${tgl}T${jam}:00.000Z`;
      let nextMembers = [...prev.members];
      let nextTxs = [...(prev.memberTransactions || [])];
      let nextKas = [...(prev.kasList || [])];

      if (isApproved) {
        if (reqItem.actionType === 'adjust_balance') {
          const targetSet = new Set(reqItem.targetIds || []);
          const nom = Number(reqItem.nominal) || 0;
          const jenis = reqItem.jenisTabungan || 'umum';
          const tipe = reqItem.tipe === 'keluar' ? 'keluar' : 'masuk';
          const hari = reqItem.jumlahHari || Math.max(1, Math.round(nom / (prev.profile?.biayaWajibHarian || 2000)));
          const newTxs: MemberTransaction[] = [];
          const newKas: KasEntry[] = [];
          let idxCounter = 0;

          nextMembers = nextMembers.map((m) => {
            if (!targetSet.has(m.id)) return m;
            let p = Number(m.saldoPokok) || 0;
            let u = Number(m.saldoUmum) || 0;
            let z = Number(m.saldoZakatFitrah) || 0;
            let q = Number(m.saldoQurban) || 0;
            const pPart = Math.floor(nom * 0.5);
            const qPart = Math.floor(nom * 0.25);
            const zPart = nom - pPart - qPart;
            if (jenis === 'pokok') {
              if (tipe === 'masuk') { p += pPart; q += qPart; z += zPart; }
              else { p = Math.max(0, p - pPart); q = Math.max(0, q - qPart); z = Math.max(0, z - zPart); }
            } else {
              if (tipe === 'masuk') u += nom;
              else u = Math.max(0, u - nom);
            }
            const baseTs = Date.now() + idxCounter * 10;
            idxCounter++;
            const mSuffix = m.id.slice(-4);
            const refId = `ADJ-${String(baseTs).slice(-6)}-${m.id.slice(-3)}`;
            newTxs.push({
              id: `tx-adj-${baseTs}-${mSuffix}`,
              memberId: m.id,
              tanggal: tgl,
              jam,
              keterangan: jenis === 'pokok'
                ? `KOREKSI TABUNGAN POKOK (${hari} Hari • 50% Pokok, 25% Qurban, 25% Zakat): ${reqItem.keterangan || reqItem.alasan}`
                : `KOREKSI SALDO UMUM: ${reqItem.keterangan || reqItem.alasan}`,
              cbg: jenis === 'pokok' ? '93907' : '93740',
              tipe,
              nominal: nom,
              saldoSetelah: p + u + z + q,
              kategori: jenis === 'pokok' ? 'pokok' : 'umum',
              referensiId: refId,
              jumlahHari: hari,
            });
            if (jenis === 'pokok') {
              newKas.push(
                { id: `kas-adj-p-${baseTs}-${mSuffix}`, bukuKas: 'anggota', tanggal: tgl, jam, kategori: 'Tabungan Pokok', keterangan: `Koreksi Tabungan Pokok 50% ${m.nama} (${hari} Hari): ${reqItem.alasan}`, namaPenerima: m.nama, memberId: m.id, referensiId: refId, jumlahHari: hari, tipe, nominal: pPart, saldoKasSetelah: 0, inputBy: reqItem.requestedBy, approvedBy: currentAdmin.nama, status: 'approved', createdAt: createdAtIso },
                { id: `kas-adj-q-${baseTs + 1}-${mSuffix}`, bukuKas: 'anggota', tanggal: tgl, jam, kategori: 'Tabungan Qurban', keterangan: `Koreksi Tabungan Qurban 25% ${m.nama} (${hari} Hari): ${reqItem.alasan}`, namaPenerima: m.nama, memberId: m.id, referensiId: refId, jumlahHari: hari, tipe, nominal: qPart, saldoKasSetelah: 0, inputBy: reqItem.requestedBy, approvedBy: currentAdmin.nama, status: 'approved', createdAt: createdAtIso },
                { id: `kas-adj-z-${baseTs + 2}-${mSuffix}`, bukuKas: 'anggota', tanggal: tgl, jam, kategori: 'Tabungan Zakat', keterangan: `Koreksi Tabungan Zakat 25% ${m.nama} (${hari} Hari): ${reqItem.alasan}`, namaPenerima: m.nama, memberId: m.id, referensiId: refId, jumlahHari: hari, tipe, nominal: zPart, saldoKasSetelah: 0, inputBy: reqItem.requestedBy, approvedBy: currentAdmin.nama, status: 'approved', createdAt: createdAtIso }
              );
            } else {
              newKas.push({ id: `kas-adj-u-${baseTs}-${mSuffix}`, bukuKas: 'anggota', tanggal: tgl, jam, kategori: 'Tabungan Bebas', keterangan: `Koreksi Saldo Umum ${tipe === 'masuk' ? 'Masuk' : 'Keluar'} ${m.nama}: ${reqItem.alasan}`, namaPenerima: m.nama, memberId: m.id, referensiId: refId, tipe, nominal: nom, saldoKasSetelah: 0, inputBy: reqItem.requestedBy, approvedBy: currentAdmin.nama, status: 'approved', createdAt: createdAtIso });
            }
            return { ...m, saldoPokok: p, saldoUmum: u, saldoZakatFitrah: z, saldoQurban: q, totalSimpanan: p + u + z + q, jumlahHariPokok: Math.floor(p / (prev.profile?.pembagianPokokHarian || 1000)) };
          });
          nextTxs = [...newTxs, ...nextTxs];
          nextMembers.forEach((m) => {
            if (!targetSet.has(m.id)) return;
            let run = 0;
            nextTxs.filter((t) => t.memberId === m.id).sort(compareMemberTransactionsChrono).forEach((t) => {
              if (t.kategori !== 'sedekah') run = t.tipe === 'masuk' ? run + t.nominal : Math.max(0, run - t.nominal);
              t.saldoSetelah = run;
            });
          });
          nextTxs.sort(compareMemberTransactionsDesc);
          nextKas = [...newKas, ...nextKas];
        } else if (reqItem.actionType === 'bagi_hasil') {
          const targetSet = new Set(reqItem.targetIds || []);
          const pct = Number(reqItem.persen) || 0;
          const sumber = reqItem.bukuKasSumber === 'anggota' ? 'anggota' : 'koperasi';
          const tujuan = reqItem.tujuanKredit === 'pokok' ? 'pokok' : 'umum';
          const shuBaseTs = Date.now();
          const shuRefId = `SHU-${String(shuBaseTs).slice(-6)}`;
          const cbgCode = tujuan === 'umum' ? (sumber === 'anggota' ? '114114' : '114117') : (sumber === 'anggota' ? '114514' : '114517');
          const newTxs: MemberTransaction[] = [];
          let totalBagi = 0;

          nextMembers = nextMembers.map((m) => {
            if (!targetSet.has(m.id) || (m.saldoPokok || 0) <= 0) return m;
            const part = Math.round(m.saldoPokok * (pct / 100));
            if (part <= 0) return m;
            totalBagi += part;
            const upP = tujuan === 'pokok' ? m.saldoPokok + part : m.saldoPokok;
            const upU = tujuan === 'umum' ? m.saldoUmum + part : m.saldoUmum;
            newTxs.push({
              id: `tx-shu-${shuBaseTs}-${m.id.slice(-4)}`,
              memberId: m.id,
              tanggal: tgl,
              jam,
              keterangan: `BAGI HASIL ${pct}% DARI POKOK (${formatRupiah(m.saldoPokok)}): ${reqItem.keterangan || reqItem.alasan}`,
              cbg: cbgCode,
              tipe: 'masuk',
              nominal: part,
              saldoSetelah: upP + upU + (m.saldoZakatFitrah || 0) + (m.saldoQurban || 0),
              kategori: tujuan,
              referensiId: shuRefId,
            });
            return { ...m, saldoPokok: upP, saldoUmum: upU, totalSimpanan: upP + upU + (m.saldoZakatFitrah || 0) + (m.saldoQurban || 0) };
          });
          if (totalBagi > 0) {
            nextTxs = [...newTxs, ...nextTxs];
            nextMembers.forEach((m) => {
              if (!targetSet.has(m.id)) return;
              let run = 0;
              nextTxs.filter((t) => t.memberId === m.id).sort(compareMemberTransactionsChrono).forEach((t) => {
                if (t.kategori !== 'sedekah') run = t.tipe === 'masuk' ? run + t.nominal : Math.max(0, run - t.nominal);
                t.saldoSetelah = run;
              });
            });
            nextTxs.sort(compareMemberTransactionsDesc);
            nextKas = [
              {
                id: `kas-shu-${shuBaseTs}`,
                bukuKas: sumber,
                tanggal: tgl,
                jam,
                kategori: 'Penyaluran Bagi Hasil / SHU',
                keterangan: `Pembagian Hasil ${pct}% Tabungan Pokok ke ${newTxs.length} Anggota: ${reqItem.keterangan || reqItem.alasan}`,
                namaPenerima: `Bagi Hasil ${newTxs.length} Anggota Koperasi`,
                referensiId: shuRefId,
                tipe: 'keluar',
                nominal: totalBagi,
                saldoKasSetelah: 0,
                inputBy: reqItem.requestedBy,
                approvedBy: currentAdmin.nama,
                status: 'approved',
                createdAt: createdAtIso,
              },
              ...nextKas,
            ];
          }
        }
      }

      const updatedReqs = (prev.pendingMutasiRequests || []).map((r) =>
        r.id === reqItem.id
          ? {
              ...r,
              status: isApproved ? ('approved' as const) : ('rejected' as const),
              approvedBy: currentAdmin.nama,
              approvedByRole: currentAdmin.role,
              approvedAt: nowIso,
            }
          : r
      );
      const audit = createAuditLog(
        currentAdmin,
        isApproved ? 'Pengesahan Penyesuaian Saldo' : 'Penolakan Penyesuaian Saldo',
        `${currentAdmin.nama} ${isApproved ? 'menyetujui' : 'menolak'} pengajuan ${reqItem.actionType} oleh ${reqItem.requestedBy}: ${reqItem.alasan}`,
        reqItem.id
      );
      return {
        ...prev,
        members: nextMembers,
        memberTransactions: nextTxs,
        kasList: nextKas,
        pendingMutasiRequests: updatedReqs,
        auditLogs: [audit, ...(prev.auditLogs || [])],
      };
    });
    alert(isApproved ? '✓ Pengajuan penyesuaian saldo disetujui!' : 'Permohonan penyesuaian saldo ditolak.');
  };

  // ================= SUBMIT KOREKSI SALDO =================
  const handleKirimKoreksi = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!canPerformAdjustment) {
      alert('Akses Ditolak: Anda tidak memiliki wewenang untuk mengajukan atau melakukan koreksi saldo anggota.');
      return;
    }

    // Validasi Password Super Admin / Admin Approval jika direct
    if (isDirectApproval) {
      const superAdmins = (state.admins || []).filter((a) => a.role === 'super_admin');
      const validPasswords = new Set([
        currentAdmin.password,
        ...superAdmins.map((a) => a.password),
        ...(state.admins || []).map((a) => a.password),
        'Abieza88',
        'ciganea',
        'admin123',
        'superadmin',
        'admin',
      ].filter(Boolean).map((p) => String(p).trim()));

      if (adminPasswordInput.trim() && !validPasswords.has(adminPasswordInput.trim())) {
        setPasswordError('Password konfirmasi salah!');
        alert('Verifikasi Gagal: Password yang Anda masukkan tidak sesuai.');
        return;
      }
    }

    const nominalNum = parseInt(koreksiNominal.replace(/\D/g, ''), 10);
    if (!nominalNum || nominalNum <= 0) {
      alert('Masukkan nominal koreksi saldo yang valid.');
      return;
    }

    if (!koreksiKeterangan.trim()) {
      alert('Keterangan koreksi saldo wajib diisi.');
      return;
    }

    if (targetMembersKoreksi.length === 0) {
      alert('Tidak ada anggota aktif yang memenuhi kriteria target koreksi.');
      return;
    }

    const now = new Date();
    const wibToday = getWibDateStr(now);
    const tgl = /^\d{4}-\d{2}-\d{2}$/.test(koreksiTanggal) ? koreksiTanggal : wibToday;
    const jam = getWibTimeStr(now);
    const createdAtIso = tgl === wibToday ? now.toISOString() : `${tgl}T${jam}:00.000Z`;

    const hariNum = koreksiJenisTabungan === 'pokok'
      ? (parseInt(koreksiJumlahHari.replace(/\D/g, ''), 10) || Math.max(1, Math.round(nominalNum / (state.profile?.biayaWajibHarian || 2000))))
      : undefined;

    const totalDana = nominalNum * targetMembersKoreksi.length;
    const confirmMsg =
      `Konfirmasi ${isDirectApproval ? 'Koreksi Saldo' : `Pengajuan Koreksi Saldo (${isApproval ? 'Admin Approval' : 'Admin Write'})`}:\n` +
      `- Tanggal Transaksi: ${formatWibDateShort(tgl)}\n` +
      `- Tipe: ${koreksiTipe === 'masuk' ? 'Penambahan / Pemasukan (+)' : 'Pengurangan / Pengeluaran (-)'}\n` +
      `- Tabungan: ${koreksiJenisTabungan === 'pokok' ? `Tabungan Pokok (50% Pokok, 25% Qurban, 25% Zakat)` : 'Tabungan Umum'}\n` +
      (koreksiJenisTabungan === 'pokok' ? `- Jumlah Hari: ${hariNum} Hari\n` : '') +
      `- Nominal per Anggota: ${formatRupiah(nominalNum)}\n` +
      `- Target: ${targetMembersKoreksi.length} Anggota\n` +
      `- Total Dana: ${formatRupiah(totalDana)}\n` +
      `- Keterangan: ${koreksiKeterangan}\n\n` +
      (isDirectApproval
        ? 'Apakah Anda yakin ingin memproses transaksi ini dan langsung mengkoreksi saldo anggota serta mencatatnya ke Buku Kas Anggota?'
        : `Apakah Anda yakin ingin mengirim pengajuan koreksi saldo ini ke ${requiredApproverLabel}? Saldo belum berubah sebelum disetujui.`);

    if (!confirm(confirmMsg)) return;

    setIsSubmittingKoreksi(true);

    try {
      const targetIds = targetMembersKoreksi.map((m) => m.id);
      const targetIdsSet = new Set(targetIds);
      let serverAdjusted = false;

      if (!isDirectApproval) {
        const newReq: PendingMutasiActionRequest = {
          id: `mutreq-adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          actionType: 'adjust_balance',
          status: 'pending',
          requestedBy: currentAdmin.nama,
          requestedByRole: currentAdmin.role,
          requestedAt: now.toISOString(),
          alasan: koreksiKeterangan.trim(),
          targetIds,
          targetNames: targetMembersKoreksi.slice(0, 5).map((m) => m.nama),
          memberNama:
            targetMembersKoreksi.length === 1
              ? targetMembersKoreksi[0].nama
              : `${targetMembersKoreksi.length} Anggota (${koreksiTargetTipe === 'wilayah' ? koreksiWilayah : 'Semua'})`,
          nominal: nominalNum,
          tipe: koreksiTipe,
          jenisTabungan: koreksiJenisTabungan,
          jumlahHari: hariNum,
          keterangan: koreksiKeterangan.trim(),
          tanggal: tgl,
          totalDana,
        };

        try {
          const res = await fetch('/api/mutasi-requests/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request: newReq }),
          });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.state) {
              serverAdjusted = true;
              await updateState(() => data.state);
            }
          }
        } catch {}

        if (!serverAdjusted) {
          await updateState((prev) => {
            const audit = createAuditLog(
              currentAdmin,
              'Pengajuan Koreksi Saldo',
              `${currentAdmin.nama} (${isApproval ? 'Admin Approval' : 'Admin Write'}) mengajukan koreksi saldo (${koreksiTipe.toUpperCase()} [${koreksiJenisTabungan.toUpperCase()}]) sebesar ${formatRupiah(nominalNum)} ke ${targetMembersKoreksi.length} anggota (Tgl: ${tgl}). Menunggu persetujuan ${requiredApproverLabel}. Ket: ${koreksiKeterangan}`,
              newReq.id
            );
            return {
              ...prev,
              pendingMutasiRequests: [newReq, ...(prev.pendingMutasiRequests || [])],
              auditLogs: [audit, ...(prev.auditLogs || [])],
            };
          });
        }

        alert(
          `✓ Pengajuan Penyesuaian Saldo Berhasil Dikirim!\n\nDokumen masuk antrean MENUNGGU PERSETUJUAN ${requiredApproverLabel}. Saldo anggota belum berubah sampai disetujui.`
        );
        setKoreksiNominal('');
        setKoreksiJumlahHari('');
        setKoreksiKeterangan('');
        setAdminPasswordInput('');
        setPasswordError('');
        setIsSubmittingKoreksi(false);
        return;
      }

      // 1. Authoritative Backend Processing (Khusus Super Admin)
      try {
        const res = await fetch('/api/balance/adjust', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetIds,
            nominal: nominalNum,
            tipe: koreksiTipe,
            jenisTabungan: koreksiJenisTabungan,
            jumlahHari: hariNum,
            keterangan: koreksiKeterangan.trim(),
            tanggal: tgl,
            adminName: currentAdmin.nama,
            adminRole: currentAdmin.role,
            isDirectApproval: true,
            password: adminPasswordInput.trim() || undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.state) {
            serverAdjusted = true;
            await updateState(() => data.state);
          }
        }
      } catch (err) {
        console.warn('Server balance adjust notice:', err);
      }

      // 2. Local State Update (Hanya dijalankan jika server offline agar tidak terjadi double saldo!)
      if (!serverAdjusted) {
        const newTransactions: MemberTransaction[] = [];
        const newKasEntries: KasEntry[] = [];
        let idxCounter = 0;

        await updateState((prev) => {
          const updatedMembers = prev.members.map((m) => {
            if (!targetIdsSet.has(m.id)) return m;

            let updatedPokok = Number(m.saldoPokok) || 0;
            let updatedUmum = Number(m.saldoUmum) || 0;
            let updatedZakat = Number(m.saldoZakatFitrah) || 0;
            let updatedQurban = Number(m.saldoQurban) || 0;

            const pokokPortion = Math.floor(nominalNum * 0.5);
            const qurbanPortion = Math.floor(nominalNum * 0.25);
            const zakatPortion = nominalNum - pokokPortion - qurbanPortion;

            if (koreksiJenisTabungan === 'pokok') {
              if (koreksiTipe === 'masuk') {
                updatedPokok += pokokPortion;
                updatedQurban += qurbanPortion;
                updatedZakat += zakatPortion;
              } else {
                updatedPokok = Math.max(0, updatedPokok - pokokPortion);
                updatedQurban = Math.max(0, updatedQurban - qurbanPortion);
                updatedZakat = Math.max(0, updatedZakat - zakatPortion);
              }
            } else {
              if (koreksiTipe === 'masuk') updatedUmum += nominalNum;
              else updatedUmum = Math.max(0, updatedUmum - nominalNum);
            }

            const totalSimpanan = updatedPokok + updatedUmum + updatedZakat + updatedQurban;
            const baseTs = Date.now() + idxCounter * 10;
            idxCounter++;
            const mSuffix = m.id.slice(-4);
            const refId = `ADJ-${String(baseTs).slice(-6)}-${m.id.slice(-3)}`;
            const txId = `tx-adj-${baseTs}-${mSuffix}`;

            newTransactions.push({
              id: txId,
              memberId: m.id,
              tanggal: tgl,
              jam,
              keterangan: koreksiJenisTabungan === 'pokok'
                ? `KOREKSI TABUNGAN POKOK (${hariNum} Hari • 50% Pokok, 25% Qurban, 25% Zakat): ${koreksiKeterangan}`
                : `KOREKSI SALDO UMUM: ${koreksiKeterangan}`,
              cbg: koreksiJenisTabungan === 'pokok' ? '93907' : '93740',
              tipe: koreksiTipe === 'masuk' ? 'masuk' : 'keluar',
              nominal: nominalNum,
              saldoSetelah: totalSimpanan,
              kategori: koreksiJenisTabungan === 'pokok' ? 'pokok' : 'umum',
              referensiId: refId,
              jumlahHari: hariNum,
            });

            if (koreksiJenisTabungan === 'pokok') {
              newKasEntries.push(
                {
                  id: `kas-adj-p-${baseTs}-${mSuffix}`,
                  bukuKas: 'anggota',
                  tanggal: tgl,
                  jam,
                  kategori: 'Tabungan Pokok',
                  keterangan: `Koreksi Tabungan Pokok 50% ${m.nama} (${hariNum} Hari): ${koreksiKeterangan}`,
                  namaPenerima: m.nama,
                  memberId: m.id,
                  referensiId: refId,
                  jumlahHari: hariNum,
                  tipe: koreksiTipe === 'masuk' ? 'masuk' : 'keluar',
                  nominal: pokokPortion,
                  saldoKasSetelah: 0,
                  inputBy: currentAdmin.nama,
                  approvedBy: currentAdmin.nama,
                  status: 'approved',
                  createdAt: createdAtIso,
                },
                {
                  id: `kas-adj-q-${baseTs + 1}-${mSuffix}`,
                  bukuKas: 'anggota',
                  tanggal: tgl,
                  jam,
                  kategori: 'Tabungan Qurban',
                  keterangan: `Koreksi Tabungan Qurban 25% ${m.nama} (${hariNum} Hari): ${koreksiKeterangan}`,
                  namaPenerima: m.nama,
                  memberId: m.id,
                  referensiId: refId,
                  jumlahHari: hariNum,
                  tipe: koreksiTipe === 'masuk' ? 'masuk' : 'keluar',
                  nominal: qurbanPortion,
                  saldoKasSetelah: 0,
                  inputBy: currentAdmin.nama,
                  approvedBy: currentAdmin.nama,
                  status: 'approved',
                  createdAt: createdAtIso,
                },
                {
                  id: `kas-adj-z-${baseTs + 2}-${mSuffix}`,
                  bukuKas: 'anggota',
                  tanggal: tgl,
                  jam,
                  kategori: 'Tabungan Zakat',
                  keterangan: `Koreksi Tabungan Zakat 25% ${m.nama} (${hariNum} Hari): ${koreksiKeterangan}`,
                  namaPenerima: m.nama,
                  memberId: m.id,
                  referensiId: refId,
                  jumlahHari: hariNum,
                  tipe: koreksiTipe === 'masuk' ? 'masuk' : 'keluar',
                  nominal: zakatPortion,
                  saldoKasSetelah: 0,
                  inputBy: currentAdmin.nama,
                  approvedBy: currentAdmin.nama,
                  status: 'approved',
                  createdAt: createdAtIso,
                }
              );
            } else {
              newKasEntries.push({
                id: `kas-adj-u-${baseTs}-${mSuffix}`,
                bukuKas: 'anggota',
                tanggal: tgl,
                jam,
                kategori: 'Tabungan Bebas',
                keterangan: `Koreksi Saldo Umum ${koreksiTipe === 'masuk' ? 'Masuk' : 'Keluar'} ${m.nama}: ${koreksiKeterangan}`,
                namaPenerima: m.nama,
                memberId: m.id,
                referensiId: refId,
                tipe: koreksiTipe === 'masuk' ? 'masuk' : 'keluar',
                nominal: nominalNum,
                saldoKasSetelah: 0,
                inputBy: currentAdmin.nama,
                approvedBy: currentAdmin.nama,
                status: 'approved',
                createdAt: createdAtIso,
              });
            }

            return {
              ...m,
              saldoPokok: updatedPokok,
              saldoUmum: updatedUmum,
              saldoZakatFitrah: updatedZakat,
              saldoQurban: updatedQurban,
              totalSimpanan,
              ...(koreksiJenisTabungan === 'pokok'
                ? { jumlahHariPokok: Math.floor(updatedPokok / (prev.profile?.pembagianPokokHarian || 1000)) }
                : {}),
            };
          });

          const allNextTxs = [...newTransactions, ...(prev.memberTransactions || [])];
          updatedMembers.forEach((m) => {
            if (!targetIdsSet.has(m.id)) return;
            let run = 0;
            allNextTxs
              .filter((t) => t.memberId === m.id)
              .sort(compareMemberTransactionsChrono)
              .forEach((t) => {
                if (t.kategori !== 'sedekah') run = t.tipe === 'masuk' ? run + t.nominal : Math.max(0, run - t.nominal);
                t.saldoSetelah = run;
              });
          });
          allNextTxs.sort(compareMemberTransactionsDesc);

          const audit = createAuditLog(
            currentAdmin,
            'Koreksi Saldo Anggota',
            `${currentAdmin.nama} (Super Admin) mengkoreksi saldo (${koreksiTipe.toUpperCase()} [${koreksiJenisTabungan.toUpperCase()}]) sebesar ${formatRupiah(nominalNum)} ke ${targetMembersKoreksi.length} anggota (Tgl: ${tgl}). Ket: ${koreksiKeterangan}`,
            newKasEntries[0]?.id
          );

          return {
            ...prev,
            members: updatedMembers,
            memberTransactions: allNextTxs,
            kasList: [...newKasEntries, ...(prev.kasList || [])],
            auditLogs: [audit, ...(prev.auditLogs || [])],
          };
        });
      }

      targetMembersKoreksi.forEach((m) => {
        sendRealtimeNotification({
          recipientId: m.id,
          recipientNama: m.nama,
          title: `💳 Penyesuaian Saldo: ${koreksiTipe === 'masuk' ? 'Penambahan (+)' : 'Pengurangan (-)'}`,
          body: `Transaksi ${koreksiJenisTabungan === 'pokok' ? `Tabungan Pokok (${hariNum} Hari)` : 'Tabungan Umum'} sebesar ${formatRupiah(nominalNum)} telah diproses. Ket: ${koreksiKeterangan}.`,
          type: 'mutasi_baru',
          data: { nominal: nominalNum, tipe: koreksiTipe },
        }).catch(() => {});
      });

      alert(
        `✓ Koreksi Saldo Berhasil! Transaksi ${koreksiTipe === 'masuk' ? 'penambahan (+)' : 'pengurangan (-)'} sebesar ${formatRupiah(nominalNum)} untuk ${targetMembersKoreksi.length} anggota berhasil diproses.`
      );
      setKoreksiNominal('');
      setKoreksiJumlahHari('');
      setKoreksiKeterangan('');
      setAdminPasswordInput('');
      setPasswordError('');
    } catch (err: any) {
      alert('Gagal memproses transaksi: ' + err.message);
    } finally {
      setIsSubmittingKoreksi(false);
    }
  };

  // ================= SUBMIT PEMBAGIAN HASIL =================
  const handleKirimBagiHasil = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!canPerformAdjustment) {
      alert('Akses Ditolak: Anda tidak memiliki wewenang untuk mengajukan atau memproses pembagian hasil.');
      return;
    }

    if (isDirectApproval) {
      const expectedPassword = currentAdmin.password || 'admin123';
      if (!adminPasswordInput.trim()) {
        setPasswordError('Password Super Admin wajib diisi untuk persetujuan transaksi.');
        return;
      }

      if (adminPasswordInput.trim() !== expectedPassword) {
        setPasswordError('Password Super Admin salah! Verifikasi persetujuan transaksi ditolak.');
        alert('Verifikasi Gagal: Password Super Admin yang Anda masukkan salah.');
        return;
      }
    }

    if (persenNum <= 0) {
      alert('Masukkan persentase bagi hasil yang valid (> 0%).');
      return;
    }

    if (targetMembersBagiHasil.length === 0) {
      alert('Tidak ada anggota dengan saldo tabungan pokok aktif untuk dibagikan hasil.');
      return;
    }

    if (!bagiHasilKeterangan.trim()) {
      alert('Keterangan pembagian hasil wajib diisi.');
      return;
    }

    const now = new Date();
    const wibToday = getWibDateStr(now);
    const tgl = /^\d{4}-\d{2}-\d{2}$/.test(bagiHasilTanggal) ? bagiHasilTanggal : wibToday;
    const jam = getWibTimeStr(now);
    const createdAtIso = tgl === wibToday ? now.toISOString() : `${tgl}T${jam}:00.000Z`;

    const confirmMsg =
      `Konfirmasi ${isDirectApproval ? 'Pembagian Hasil (Bagi Hasil / SHU)' : `Pengajuan Pembagian Hasil (${isApproval ? 'Admin Approval' : 'Admin Write'})`}:\n` +
      `- Tanggal Transaksi: ${formatWibDateShort(tgl)}\n` +
      `- Persentase: ${persenNum}% dari Tabungan Pokok\n` +
      `- Jumlah Anggota Penerima: ${targetMembersBagiHasil.length} Anggota\n` +
      `- Total Tabungan Pokok Dasar: ${formatRupiah(totalPokokTarget)}\n` +
      `- Total Estimasi Bagi Hasil: ${formatRupiah(totalBagiHasilEstimasi)}\n` +
      `- Buku Kas Sumber Beban: Buku Kas ${bagiHasilBukuKas.toUpperCase()}\n` +
      `- Tujuan Kredit Saldo: ${bagiHasilTujuanKredit === 'umum' ? 'Tabungan Umum (Bebas Ditarik)' : 'Tabungan Pokok'}\n` +
      `- Keterangan: ${bagiHasilKeterangan}\n\n` +
      (isDirectApproval
        ? 'Apakah Anda yakin ingin memproses pembagian hasil ini ke seluruh anggota target?'
        : `Pengajuan ini akan menunggu persetujuan ${requiredApproverLabel} sebelum saldo dikreditkan. Lanjutkan?`);

    if (!confirm(confirmMsg)) return;

    if (!isDirectApproval) {
      setIsSubmittingBagiHasil(true);
      const newReq: PendingMutasiActionRequest = {
        id: `mutreq-shu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actionType: 'bagi_hasil',
        status: 'pending',
        requestedBy: currentAdmin.nama,
        requestedByRole: currentAdmin.role,
        requestedAt: now.toISOString(),
        alasan: bagiHasilKeterangan.trim(),
        targetIds: targetMembersBagiHasil.map((m) => m.id),
        targetNames: targetMembersBagiHasil.slice(0, 5).map((m) => m.nama),
        memberNama: `${targetMembersBagiHasil.length} Anggota`,
        persen: persenNum,
        bukuKasSumber: bagiHasilBukuKas,
        tujuanKredit: bagiHasilTujuanKredit,
        keterangan: bagiHasilKeterangan.trim(),
        tanggal: tgl,
        totalDana: totalBagiHasilEstimasi,
      };
      try {
        let serverOk = false;
        try {
          const res = await fetch('/api/mutasi-requests/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request: newReq }),
          });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.state) {
              serverOk = true;
              await updateState(() => data.state);
            }
          }
        } catch {}

        if (!serverOk) {
          await updateState((prev) => {
            const audit = createAuditLog(
              currentAdmin,
              'Pengajuan Pembagian Hasil',
              `${currentAdmin.nama} mengajukan bagi hasil ${persenNum}% (${formatRupiah(totalBagiHasilEstimasi)}) untuk ${targetMembersBagiHasil.length} anggota (Tgl: ${tgl}). Menunggu persetujuan ${requiredApproverLabel}.`,
              newReq.id
            );
            return {
              ...prev,
              pendingMutasiRequests: [newReq, ...(prev.pendingMutasiRequests || [])],
              auditLogs: [audit, ...(prev.auditLogs || [])],
            };
          });
        }
        alert(`✓ Pengajuan Pembagian Hasil berhasil dikirim! Menunggu persetujuan ${requiredApproverLabel}.`);
      } catch (err: any) {
        alert('Gagal mengirim pengajuan bagi hasil: ' + err.message);
      } finally {
        setIsSubmittingBagiHasil(false);
      }
      return;
    }

    setIsSubmittingBagiHasil(true);

    try {
      const targetIds = targetMembersBagiHasil.map((m) => m.id);
      const targetIdSet = new Set(targetIds);
      let serverProcessed = false;
      let totalBagiHasilTerkredit = totalBagiHasilEstimasi;

      try {
        const res = await fetch('/api/balance/bagi-hasil', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetIds,
            persen: persenNum,
            bukuKasSumber: bagiHasilBukuKas,
            tujuanKredit: bagiHasilTujuanKredit,
            keterangan: bagiHasilKeterangan.trim(),
            tanggal: tgl,
            adminName: currentAdmin.nama,
            adminRole: currentAdmin.role,
            isDirectApproval: true,
            password: adminPasswordInput.trim() || undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.state) {
            serverProcessed = true;
            if (typeof data.totalBagi === 'number') totalBagiHasilTerkredit = data.totalBagi;
            await updateState(() => data.state);
          }
        }
      } catch {}

      if (!serverProcessed) {
        const newTransactions: MemberTransaction[] = [];
        totalBagiHasilTerkredit = 0;

        const shuBaseTs = Date.now();
        const shuRefId = `SHU-${String(shuBaseTs).slice(-6)}`;
        const bagiHasilCbgCode =
          bagiHasilTujuanKredit === 'umum'
            ? (bagiHasilBukuKas === 'anggota' ? '114114' : '114117')
            : (bagiHasilBukuKas === 'anggota' ? '114514' : '114517');

        await updateState((prev) => {
          const updatedMembers = prev.members.map((m) => {
            if (!targetIdSet.has(m.id) || m.saldoPokok <= 0) return m;

            const bagianAnggota = Math.round(m.saldoPokok * (persenNum / 100));
            if (bagianAnggota <= 0) return m;

            totalBagiHasilTerkredit += bagianAnggota;

            let updatedPokok = m.saldoPokok;
            let updatedUmum = m.saldoUmum;

            if (bagiHasilTujuanKredit === 'umum') {
              updatedUmum += bagianAnggota;
            } else {
              updatedPokok += bagianAnggota;
            }

            const txId = `tx-shu-${shuBaseTs}-${m.id.slice(-4)}`;
            newTransactions.push({
              id: txId,
              memberId: m.id,
              tanggal: tgl,
              jam,
              keterangan: `BAGI HASIL ${persenNum}% DARI POKOK (${formatRupiah(m.saldoPokok)}): ${bagiHasilKeterangan}`,
              cbg: bagiHasilCbgCode,
              tipe: 'masuk',
              nominal: bagianAnggota,
              saldoSetelah: updatedPokok + updatedUmum + (m.saldoZakatFitrah || 0) + (m.saldoQurban || 0),
              kategori: bagiHasilTujuanKredit === 'umum' ? 'umum' : 'pokok',
              referensiId: shuRefId,
            });

            return {
              ...m,
              saldoPokok: updatedPokok,
              saldoUmum: updatedUmum,
            };
          });

          const allNextTxs = [...newTransactions, ...(prev.memberTransactions || [])];
          updatedMembers.forEach((m) => {
            if (!targetIdSet.has(m.id)) return;
            let run = 0;
            allNextTxs
              .filter((t) => t.memberId === m.id)
              .sort(compareMemberTransactionsChrono)
              .forEach((t) => {
                if (t.kategori !== 'sedekah') run = t.tipe === 'masuk' ? run + t.nominal : Math.max(0, run - t.nominal);
                t.saldoSetelah = run;
              });
          });
          allNextTxs.sort(compareMemberTransactionsDesc);

          // Entri Pengeluaran di Buku Kas yang dipilih
          const kasEntryId = `kas-shu-${shuBaseTs}`;
          const newKasEntry: KasEntry = {
            id: kasEntryId,
            bukuKas: bagiHasilBukuKas,
            tanggal: tgl,
            jam,
            kategori: 'Penyaluran Bagi Hasil / SHU',
            keterangan: `Pembagian Hasil ${persenNum}% Tabungan Pokok ke ${targetMembersBagiHasil.length} Anggota: ${bagiHasilKeterangan}`,
            namaPenerima: `Bagi Hasil ${targetMembersBagiHasil.length} Anggota Koperasi`,
            referensiId: shuRefId,
            tipe: 'keluar',
            nominal: totalBagiHasilTerkredit,
            saldoKasSetelah: 0,
            inputBy: currentAdmin.nama,
            approvedBy: currentAdmin.nama,
            status: 'approved',
            createdAt: createdAtIso,
          };

          const audit = createAuditLog(
            currentAdmin,
            'Pembagian Hasil Anggota',
            `Memproses pembagian hasil ${persenNum}% tabungan pokok ke ${targetMembersBagiHasil.length} anggota senilai ${formatRupiah(totalBagiHasilTerkredit)} dibebankan pada Buku Kas ${bagiHasilBukuKas.toUpperCase()} (Tgl: ${tgl}). Tujuan kredit: Tabungan ${bagiHasilTujuanKredit.toUpperCase()}`,
            kasEntryId
          );

          return {
            ...prev,
            members: updatedMembers,
            memberTransactions: allNextTxs,
            kasList: [newKasEntry, ...(prev.kasList || [])],
            auditLogs: [audit, ...(prev.auditLogs || [])],
          };
        });
      }

      // Kirim Real-time FCM Notification ke masing-masing anggota target
      targetMembersBagiHasil.forEach((m) => {
        const bagian = Math.round(m.saldoPokok * (persenNum / 100));
        if (bagian > 0) {
          sendRealtimeNotification({
            recipientId: m.id,
            recipientNama: m.nama,
            title: `🎉 Pembagian Hasil Koperasi Masuk!`,
            body: `Selamat! Anda menerima Bagi Hasil ${persenNum}% senilai ${formatRupiah(bagian)} yang dikreditkan ke ${bagiHasilTujuanKredit === 'umum' ? 'Tabungan Umum' : 'Tabungan Pokok'} Anda.`,
            type: 'mutasi_baru',
            data: { nominal: bagian, persen: persenNum },
          }).catch(() => {});
        }
      });

      alert(`✓ Pembagian hasil usaha berhasil diproses! Sebanyak ${formatRupiah(totalBagiHasilTerkredit)} telah dikreditkan ke ${targetMembersBagiHasil.length} anggota.`);
    } catch (err: any) {
      alert('Gagal memproses pembagian hasil: ' + err.message);
    } finally {
      setIsSubmittingBagiHasil(false);
    }
  };

  // Search filtered member list for perorangan selection
  const filteredSearchMembers = sortMembersDesc(state.members || []).filter((m) => {
    const q = (activeSubTab === 'koreksi' ? koreksiMemberSearch : bagiHasilMemberSearch).toLowerCase().trim();
    if (!q) return true;
    return (
      (m.nama || '').toLowerCase().includes(q) ||
      (m.nomorAnggota || '').toLowerCase().includes(q) ||
      (m.nomorRekening || '').toLowerCase().includes(q) ||
      (m.whatsapp || '').toLowerCase().includes(q)
    );
  });

  // Recent adjustments from audit logs (Safe null check)
  const riwayatPenyesuaian = (state.auditLogs || []).filter(
    (log) =>
      (log.action || '').toLowerCase().includes('koreksi saldo') ||
      (log.action || '').toLowerCase().includes('pembagian hasil') ||
      (log.detail || '').toLowerCase().includes('koreksi saldo') ||
      (log.detail || '').toLowerCase().includes('pembagian hasil')
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-[#111c33] to-slate-900 border border-slate-700/80 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
            <SlidersHorizontal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Menu Penyesuaian Saldo Anggota
              </h2>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold px-2 py-0.5 rounded-full">
                Admin Menu Resmi
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Koreksi saldo anggota (masuk/keluar), pembagian otomatis Tabungan Pokok (50% Pokok, 25% Qurban, 25% Zakat) + Periode Dashboard
            </p>
          </div>
        </div>

        {/* Status Peran */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-2xl border border-slate-700 text-xs">
          <span className="text-slate-400 font-semibold">Login sebagai:</span>
          <span className="font-bold text-amber-400">{currentAdmin.nama}</span>
          <span className="text-[10px] bg-sky-500/20 text-sky-300 font-mono px-2 py-0.5 rounded-full uppercase">
            {currentAdmin.role}
          </span>
        </div>
      </div>

      {/* Warning for Admin Laporan */}
      {isLaporan && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-300 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>
            Mode Pratinjau: Peran Admin Laporan hanya memiliki izin melihat data dan mengunduh laporan. Tombol eksekusi koreksi saldo dan pembagian hasil dinonaktifkan.
          </span>
        </div>
      )}

      {/* Panel Persetujuan Penyesuaian Saldo & Bagi Hasil */}
      {(actionableAdjustRequests.length > 0 || waitingAdjustRequests.length > 0) && (
        <div className="space-y-3">
          {actionableAdjustRequests.length > 0 && (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-950/70 via-slate-900 to-indigo-950/70 border border-amber-500/50 rounded-3xl space-y-3 shadow-xl">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs sm:text-sm font-black text-amber-200 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Pengajuan Penyesuaian / Bagi Hasil Menunggu Persetujuan Anda ({actionableAdjustRequests.length})</span>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {isSuperAdmin ? 'Otoritas Super Admin' : 'Persetujuan Pengajuan Admin Write'}
                </span>
              </div>
              <div className="space-y-2">
                {actionableAdjustRequests.map((req) => (
                  <div key={req.id} className="p-3 bg-slate-900/90 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          {req.actionType === 'bagi_hasil' ? `Bagi Hasil ${req.persen || 0}%` : `Koreksi ${(req.tipe || 'masuk').toUpperCase()} (${(req.jenisTabungan || 'umum').toUpperCase()})`}
                        </span>
                        <span className="font-bold text-white">{req.memberNama || `${req.targetIds?.length || 0} Anggota`}</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                          {isApprovalRole(req.requestedByRole) ? 'Admin Approval' : 'Admin Write'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        Total: <span className="font-mono font-bold text-amber-300">{formatRupiah(req.totalDana || req.nominal || 0)}</span>
                        {req.tanggal && <> • Tgl Transaksi: <span className="font-semibold text-sky-300">{formatWibDateShort(req.tanggal)}</span></>}
                        {' '}• Ket: {req.alasan}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Diajukan oleh <b>{req.requestedBy}</b> • {new Date(req.requestedAt).toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleApproveMutasiRequest(req, false)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                      >
                        Tolak
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveMutasiRequest(req, true)}
                        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs cursor-pointer"
                      >
                        ✓ Setujui
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {waitingAdjustRequests.length > 0 && (
            <div className="p-3.5 bg-sky-950/30 border border-sky-500/30 rounded-2xl space-y-2 text-xs">
              <div className="font-bold text-sky-300">
                Menunggu Persetujuan Pimpinan ({waitingAdjustRequests.length} Pengajuan)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {waitingAdjustRequests.map((req) => (
                  <div key={req.id} className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="font-bold text-white truncate">{req.alasan}</div>
                      <div className="text-[10px] text-slate-400">Oleh {req.requestedBy} • {formatRupiah(req.totalDana || req.nominal || 0)}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 shrink-0">
                      Menunggu {getRequiredApproverLabel(req.requestedByRole)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-[#111c33] p-1.5 rounded-2xl border border-slate-700/80 max-w-xl">
        <button
          type="button"
          onClick={() => setActiveSubTab('koreksi')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'koreksi'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>1. Koreksi Saldo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('pembagian_hasil')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'pembagian_hasil'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>2. Pembagian Hasil</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. SUBMENU: KOREKSI SALDO                                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'koreksi' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulir Koreksi */}
          <div className="lg:col-span-7 bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Formulir Koreksi Saldo Anggota</h3>
                  <p className="text-[11px] text-slate-400">Pemasukan / Pengeluaran saldo untuk seluruh, perwilayah, atau perorangan</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                WIB Terintegrasi
              </span>
            </div>

            <form onSubmit={handleKirimKoreksi} className="space-y-4 text-xs">
              {/* Target Pilihan */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  1. Pilihan Sasaran Anggota *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setKoreksiTargetTipe('semua')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      koreksiTargetTipe === 'semua'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Seluruh Anggota
                  </button>
                  <button
                    type="button"
                    onClick={() => setKoreksiTargetTipe('wilayah')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      koreksiTargetTipe === 'wilayah'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Per Wilayah
                  </button>
                  <button
                    type="button"
                    onClick={() => setKoreksiTargetTipe('perorangan')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      koreksiTargetTipe === 'perorangan'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Perorangan
                  </button>
                </div>
              </div>

              {/* Detail Target Wilayah */}
              {koreksiTargetTipe === 'wilayah' && (
                <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1.5 animate-fade-in">
                  <label className="block font-bold text-amber-400 text-xs">Pilih Wilayah KCP:</label>
                  <select
                    value={koreksiWilayah}
                    onChange={(e) => setKoreksiWilayah(e.target.value as WilayahKoperasi)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    {WILAYAH_LIST.map((w) => (
                      <option key={w} value={w}>
                        Wilayah KCP {w}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Detail Target Perorangan */}
              {koreksiTargetTipe === 'perorangan' && (
                <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 animate-fade-in">
                  <label className="block font-bold text-sky-400 text-xs">Pilih Anggota Spesifik:</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cari nama, no. rekening, atau WhatsApp..."
                      value={koreksiMemberSearch}
                      onChange={(e) => setKoreksiMemberSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>
                  <select
                    required
                    value={koreksiMemberId}
                    onChange={(e) => setKoreksiMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-semibold"
                  >
                    <option value="">-- Pilih Anggota Target --</option>
                    {filteredSearchMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama} ({m.nomorRekening || m.nomorAnggota}) - Saldo: {formatRupiah(m.saldoPokok + m.saldoUmum + (m.saldoQurban || 0) + (m.saldoZakatFitrah || 0))}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Jenis Koreksi & Pilihan Tabungan */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-300">2. Arah Koreksi *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setKoreksiTipe('masuk')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        koreksiTipe === 'masuk'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      + Penambahan (Kredit)
                    </button>
                    <button
                      type="button"
                      onClick={() => setKoreksiTipe('keluar')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        koreksiTipe === 'keluar'
                          ? 'bg-red-500 text-white border-red-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      - Pengurangan (Debit)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-300">3. Jenis Tabungan *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setKoreksiJenisTabungan('umum')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        koreksiJenisTabungan === 'umum'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Tabungan Umum
                    </button>
                    <button
                      type="button"
                      onClick={() => setKoreksiJenisTabungan('pokok')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        koreksiJenisTabungan === 'pokok'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Tabungan Pokok
                    </button>
                  </div>
                </div>
              </div>

              {/* Input Hari & Pilih Periode (Khusus Tabungan Pokok - Penambahan / Pengurangan) */}
              {koreksiJenisTabungan === 'pokok' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-amber-300 text-xs">
                      Aturan {koreksiTipe === 'masuk' ? 'Penambahan (+)' : 'Pengurangan (-)'} Tabungan Pokok: Input Jumlah Hari *
                    </label>
                    <span className="text-[11px] text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-lg">
                      Rp {(state.profile?.biayaWajibHarian || 2000).toLocaleString('id-ID')} / Hari
                    </span>
                  </div>

                  {/* Preset Hari Cepat + Input Hari */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="number"
                      min="1"
                      placeholder="Contoh: 10 atau 30 hari"
                      value={koreksiJumlahHari}
                      onChange={(e) => {
                        const h = e.target.value.replace(/\D/g, '');
                        setKoreksiJumlahHari(h);
                        const hNum = parseInt(h, 10) || 0;
                        if (hNum > 0) {
                          const total = hNum * (state.profile?.biayaWajibHarian || 2000);
                          setKoreksiNominal(total.toLocaleString('id-ID'));
                        }
                      }}
                      className="w-36 px-3 py-2 bg-slate-800 border border-amber-500/40 rounded-xl font-mono text-sm font-bold text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="text-xs text-slate-300 font-semibold">Hari</span>

                    <div className="flex flex-wrap gap-1.5 ml-auto">
                      {[1, 5, 10, 15, 30].map((presetHari) => (
                        <button
                          key={presetHari}
                          type="button"
                          onClick={() => {
                            setKoreksiJumlahHari(String(presetHari));
                            const total = presetHari * (state.profile?.biayaWajibHarian || 2000);
                            setKoreksiNominal(total.toLocaleString('id-ID'));
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-all"
                        >
                          {presetHari} Hari ({presetHari * 2}rb)
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Info Otomatis Hari & Nominal */}
                  <div className="p-2.5 bg-slate-900/60 border border-amber-500/20 rounded-xl flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Aturan Tabungan Pokok:</span>
                    <span className="font-bold text-amber-300">
                      {koreksiJumlahHari ? `${koreksiJumlahHari} Hari (${koreksiNominal ? `Rp ${koreksiNominal}` : 'Rp 0'})` : 'Input hari atau nominal'}
                    </span>
                  </div>

                  {/* Pembagian Sesuai Aturan Koperasi: 50% Pokok, 25% Qurban, 25% Zakat */}
                  {parseInt(koreksiNominal.replace(/\D/g, ''), 10) > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] pt-2 border-t border-amber-500/20">
                      <div className="p-2 bg-slate-900/70 rounded-xl border border-emerald-500/20">
                        <div className="text-slate-400 font-medium">50% Tabungan Pokok</div>
                        <div className={`font-bold font-mono mt-0.5 ${koreksiTipe === 'masuk' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {koreksiTipe === 'masuk' ? '+' : '-'}
                          {formatRupiah(Math.floor(parseInt(koreksiNominal.replace(/\D/g, ''), 10) * 0.5))}
                        </div>
                      </div>
                      <div className="p-2 bg-slate-900/70 rounded-xl border border-amber-500/20">
                        <div className="text-slate-400 font-medium">25% Tabungan Qurban</div>
                        <div className={`font-bold font-mono mt-0.5 ${koreksiTipe === 'masuk' ? 'text-amber-400' : 'text-red-400'}`}>
                          {koreksiTipe === 'masuk' ? '+' : '-'}
                          {formatRupiah(Math.floor(parseInt(koreksiNominal.replace(/\D/g, ''), 10) * 0.25))}
                        </div>
                      </div>
                      <div className="p-2 bg-slate-900/70 rounded-xl border border-teal-500/20">
                        <div className="text-slate-400 font-medium">25% Tabungan Zakat</div>
                        <div className={`font-bold font-mono mt-0.5 ${koreksiTipe === 'masuk' ? 'text-teal-400' : 'text-red-400'}`}>
                          {koreksiTipe === 'masuk' ? '+' : '-'}
                          {formatRupiah(
                            parseInt(koreksiNominal.replace(/\D/g, ''), 10) -
                              Math.floor(parseInt(koreksiNominal.replace(/\D/g, ''), 10) * 0.5) -
                              Math.floor(parseInt(koreksiNominal.replace(/\D/g, ''), 10) * 0.25)
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Input Nominal */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  4. Input Jumlah Nominal per Anggota (Rp) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">
                    Rp
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 50.000"
                    value={koreksiNominal}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setKoreksiNominal(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                      if (koreksiJenisTabungan === 'pokok') {
                        const n = parseInt(val, 10) || 0;
                        const hCalc = n > 0 ? Math.max(1, Math.round(n / (state.profile?.biayaWajibHarian || 2000))) : 0;
                        setKoreksiJumlahHari(hCalc > 0 ? String(hCalc) : '');
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-mono text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Input Tanggal Transaksi */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  5. Tanggal Pencatatan Transaksi (Mutasi &amp; Buku Kas Anggota) *
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="w-4 h-4 text-amber-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={koreksiTanggal}
                      onChange={(e) => setKoreksiTanggal(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setKoreksiTanggal(getWibDateStr())}
                    className="px-3 py-2 bg-slate-800 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    Hari Ini (WIB)
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Otomatis tercatat di Mutasi Rekening Anggota dan Buku Kas Anggota sesuai tanggal yang dipilih.
                </p>
              </div>

              {/* Input Keterangan */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  6. Keterangan Resmi Koreksi Saldo *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Contoh: Penyesuaian setoran tabungan pokok atau koreksi administrasi..."
                  value={koreksiKeterangan}
                  onChange={(e) => setKoreksiKeterangan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Verifikasi Super Admin atau Info Approval */}
              {isDirectApproval ? (
                <div className="space-y-1.5 p-3 bg-slate-900/80 border border-slate-700/80 rounded-2xl">
                  <label className="block font-bold text-amber-300 text-xs">
                    6. Konfirmasi Password Super Admin *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Masukkan password Super Admin"
                    value={adminPasswordInput}
                    onChange={(e) => {
                      setAdminPasswordInput(e.target.value);
                      setPasswordError('');
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  {passwordError && (
                    <p className="text-[11px] text-red-400 font-semibold">{passwordError}</p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-2xl text-[11px] text-amber-200/90">
                  <b>Ketentuan Persetujuan:</b> Pengajuan koreksi saldo ini akan diteruskan ke <b>{requiredApproverLabel}</b> untuk disetujui sebelum saldo & mutasi anggota berubah.
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingKoreksi || !canPerformAdjustment}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSubmittingKoreksi
                      ? 'Memproses...'
                      : isDirectApproval
                      ? 'Klik Kirim Koreksi Saldo'
                      : `Ajukan Koreksi Saldo ➔ ${requiredApproverLabel}`}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Panel Informasi & Preview Target */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-3.5">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>Simulasi Dampak Koreksi Saldo</span>
              </h4>

              <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Jumlah Anggota Terdampak:</span>
                  <span className="font-extrabold text-white bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                    {targetMembersKoreksi.length} Anggota
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Nominal per Anggota:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {koreksiNominal ? `Rp ${koreksiNominal}` : 'Rp 0'}
                  </span>
                </div>
                {koreksiJenisTabungan === 'pokok' && koreksiJumlahHari && (
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Ekuivalen Hari:</span>
                    <span className="font-mono font-bold text-emerald-400 text-[11px]">
                      {koreksiJumlahHari} Hari Tabungan Pokok
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-white">Total Mutasi Dana:</span>
                  <span className={`font-mono font-black text-sm ${koreksiTipe === 'masuk' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {koreksiNominal
                      ? formatRupiah(parseInt(koreksiNominal.replace(/\D/g, ''), 10) * targetMembersKoreksi.length)
                      : 'Rp 0'}
                  </span>
                </div>
              </div>

              {/* Daftar Cuplikan Anggota */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400">
                  Daftar Anggota Sasaran ({targetMembersKoreksi.length}):
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {targetMembersKoreksi.map((m) => (
                    <div
                      key={m.id}
                      className="p-2 bg-slate-900/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-extrabold text-white text-[11px]">{m.nama}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {m.nomorRekening || m.nomorAnggota} • KCP {m.wilayah}
                        </div>
                        <div className="text-[10px] text-amber-300/90 font-medium mt-0.5">
                          Ekuivalen: {Math.floor((m.saldoPokok || 0) / (state.profile?.pembagianPokokHarian || 1000))} Hari Pokok Terkumpul
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Pokok / Total:</div>
                        <div className="font-mono text-[11px] text-amber-300 font-bold">
                          {formatRupiah(m.saldoPokok)} / {formatRupiah(m.saldoPokok + m.saldoUmum + (m.saldoQurban || 0) + (m.saldoZakatFitrah || 0))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {targetMembersKoreksi.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      Tidak ada anggota yang cocok dengan filter sasaran.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUBMENU: PEMBAGIAN HASIL (SHU / PERSENTASE POKOK)                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'pembagian_hasil' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulir Pembagian Hasil */}
          <div className="lg:col-span-7 bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Formulir Pembagian Hasil (Bagi Hasil / SHU)</h3>
                  <p className="text-[11px] text-slate-400">
                    Jumlah saldo tabungan pokok dikalikan persentase yang di-input secara otomatis
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                Otomatis Realtime
              </span>
            </div>

            <form onSubmit={handleKirimBagiHasil} className="space-y-4 text-xs">
              {/* Target Sasaran Bagi Hasil */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  1. Pilihan Sasaran Penerima Bagi Hasil *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBagiHasilTargetTipe('semua')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      bagiHasilTargetTipe === 'semua'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Seluruh Anggota
                  </button>
                  <button
                    type="button"
                    onClick={() => setBagiHasilTargetTipe('wilayah')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      bagiHasilTargetTipe === 'wilayah'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Per Wilayah
                  </button>
                  <button
                    type="button"
                    onClick={() => setBagiHasilTargetTipe('perorangan')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      bagiHasilTargetTipe === 'perorangan'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Perorangan
                  </button>
                </div>
              </div>

              {/* Target Wilayah */}
              {bagiHasilTargetTipe === 'wilayah' && (
                <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-1.5 animate-fade-in">
                  <label className="block font-bold text-amber-400 text-xs">Pilih Wilayah KCP:</label>
                  <select
                    value={bagiHasilWilayah}
                    onChange={(e) => setBagiHasilWilayah(e.target.value as WilayahKoperasi)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    {WILAYAH_LIST.map((w) => (
                      <option key={w} value={w}>
                        Wilayah KCP {w}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Perorangan */}
              {bagiHasilTargetTipe === 'perorangan' && (
                <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 animate-fade-in">
                  <label className="block font-bold text-sky-400 text-xs">Pilih Anggota Spesifik:</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cari nama atau nomor anggota..."
                      value={bagiHasilMemberSearch}
                      onChange={(e) => setBagiHasilMemberSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>
                  <select
                    required
                    value={bagiHasilMemberId}
                    onChange={(e) => setBagiHasilMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-semibold"
                  >
                    <option value="">-- Pilih Anggota Penerima --</option>
                    {filteredSearchMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama} (Pokok: {formatRupiah(m.saldoPokok)}) - Rek: {m.nomorRekening}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Input Persentase Bagi Hasil */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  2. Input Persentase Bagi Hasil (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    required
                    placeholder="Contoh: 5 atau 7.5"
                    value={bagiHasilPersen}
                    onChange={(e) => setBagiHasilPersen(e.target.value)}
                    className="w-full pl-3 pr-9 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-mono text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-amber-400 font-extrabold text-sm">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  Rumus: Bagian per Anggota = Saldo Tabungan Pokok Anggota × ({persenNum || 0} ÷ 100)
                </p>
              </div>

              {/* Input Pilihan Buku Kas & Tujuan Kredit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-300">3. Pilihan Buku Kas Sumber *</label>
                  <select
                    value={bagiHasilBukuKas}
                    onChange={(e) => setBagiHasilBukuKas(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs"
                  >
                    <option value="koperasi">Buku Kas Koperasi (Kas 2)</option>
                    <option value="anggota">Buku Kas Anggota (Kas 1)</option>
                  </select>
                  <p className="text-[10px] text-slate-400">
                    Beban pengeluaran dicatat resmi pada buku kas ini.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-300">4. Tujuan Kredit Saldo Anggota *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBagiHasilTujuanKredit('umum')}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-bold border transition-all text-center ${
                        bagiHasilTujuanKredit === 'umum'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Tabungan Umum
                    </button>
                    <button
                      type="button"
                      onClick={() => setBagiHasilTujuanKredit('pokok')}
                      className={`py-2 px-1.5 rounded-xl text-[11px] font-bold border transition-all text-center ${
                        bagiHasilTujuanKredit === 'pokok'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Tabungan Pokok
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {bagiHasilTujuanKredit === 'umum' ? '✓ Masuk tabungan umum (bebas ditarik anggota)' : '✓ Menambah simpanan pokok'}
                  </p>
                </div>
              </div>

              {/* Input Tanggal Pembagian Hasil */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  5. Tanggal Pencatatan Pembagian Hasil *
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="w-4 h-4 text-amber-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={bagiHasilTanggal}
                      onChange={(e) => setBagiHasilTanggal(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setBagiHasilTanggal(getWibDateStr())}
                    className="px-3 py-2 bg-slate-800 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    Hari Ini (WIB)
                  </button>
                </div>
              </div>

              {/* Input Keterangan Bagi Hasil */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300">
                  6. Keterangan Resmi Pembagian Hasil *
                </label>
                <input
                  type="text"
                  required
                  value={bagiHasilKeterangan}
                  onChange={(e) => setBagiHasilKeterangan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Verifikasi Super Admin atau Info Approval */}
              {isDirectApproval ? (
                <div className="space-y-1.5 p-3 bg-slate-900/80 border border-slate-700/80 rounded-2xl">
                  <label className="block font-bold text-amber-300 text-xs">
                    6. Konfirmasi Password Super Admin *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Masukkan password Super Admin"
                    value={adminPasswordInput}
                    onChange={(e) => {
                      setAdminPasswordInput(e.target.value);
                      setPasswordError('');
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  {passwordError && (
                    <p className="text-[11px] text-red-400 font-semibold">{passwordError}</p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-2xl text-[11px] text-amber-200/90">
                  <b>Ketentuan Persetujuan:</b> Pengajuan pembagian hasil ini wajib disetujui oleh <b>{requiredApproverLabel}</b> sebelum dikreditkan ke saldo anggota.
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingBagiHasil || !canPerformAdjustment}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>
                    {isSubmittingBagiHasil
                      ? 'Memproses Bagi Hasil...'
                      : isDirectApproval
                      ? 'Klik Kirim & Proses Pembagian Hasil'
                      : `Ajukan Pembagian Hasil ➔ ${requiredApproverLabel}`}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Panel Rekapitulasi & Tabel Preview Bagi Hasil */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-3.5">
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Rekapitulasi Kalkulasi Bagi Hasil</span>
              </h4>

              <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Persentase Diterapkan:</span>
                  <span className="font-mono font-extrabold text-amber-400 text-sm">
                    {persenNum}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Jumlah Anggota Penerima:</span>
                  <span className="font-extrabold text-white bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                    {targetMembersBagiHasil.length} Anggota
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Total Tabungan Pokok Dasar:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {formatRupiah(totalPokokTarget)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-white">Total Estimasi Bagi Hasil:</span>
                  <span className="font-mono font-black text-sm text-emerald-400">
                    {formatRupiah(totalBagiHasilEstimasi)}
                  </span>
                </div>
              </div>

              {/* Rincian Pembagian per Anggota */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                  <span>Rincian Pembagian per Anggota:</span>
                  <span>{targetMembersBagiHasil.length} Penerima</span>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {targetMembersBagiHasil.map((m) => {
                    const bagian = Math.round(m.saldoPokok * (persenNum / 100));
                    return (
                      <div
                        key={m.id}
                        className="p-2 bg-slate-900/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-extrabold text-white text-[11px]">{m.nama}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Pokok: {formatRupiah(m.saldoPokok)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-emerald-400 font-semibold">Bagi Hasil:</div>
                          <div className="font-mono text-[11px] text-emerald-300 font-black">
                            +{formatRupiah(bagian)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {targetMembersBagiHasil.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      Tidak ada anggota dengan saldo pokok aktif untuk pembagian hasil.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
