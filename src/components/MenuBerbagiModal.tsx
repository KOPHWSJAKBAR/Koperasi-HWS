import React, { useState, useEffect } from 'react';
import {
  AppState,
  MemberUser,
  AdminUser,
  SedekahBerbagiEntry,
  JenisSedekahBerbagi,
  MemberTransaction,
  KasEntry,
  WilayahKoperasi,
} from '../types';
import { formatRupiah, createAuditLog } from '../lib/storage';
import { exportLaporanBerbagiPdf, exportLaporanBerbagiExcel } from '../lib/exportPdf';
import { LogoHws } from '../lib/logo';
import {
  Heart,
  Sun,
  Calendar,
  Sparkles,
  X,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  Filter,
  AlertCircle,
  Clock,
  ShieldCheck,
  Send,
  Copy,
  Check,
  QrCode,
  Upload,
  Eye,
  MapPin,
  Users,
  CheckSquare,
  XCircle,
  Download,
} from 'lucide-react';

interface MenuBerbagiModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentMember?: MemberUser;
  currentAdmin?: AdminUser;
  initialTab?: 'berbagi' | 'konfirmasi' | 'salurkan' | 'laporan';
}

export const MenuBerbagiModal: React.FC<MenuBerbagiModalProps> = ({
  isOpen,
  onClose,
  state,
  updateState,
  currentMember,
  currentAdmin,
  initialTab,
}) => {
  const isAdmin = !!currentAdmin;

  // Nama berbagi dari setting admin (dapat diubah oleh admin write, approval, super admin)
  const namaSubuh = state.pengaturanBerbagi?.namaSubuh || 'Sedekah Subuh';
  const namaJumat = state.pengaturanBerbagi?.namaJumat || 'Sedekah Jumat';
  const namaUmum = state.pengaturanBerbagi?.namaUmum || 'Sedekah Umum';
  const bankName = state.pengaturanBerbagi?.bankName || 'Bank Syariah Indonesia (BSI)';
  const noRekening = state.pengaturanBerbagi?.noRekening || '7123-4567-8901';
  const namaPemilikRekening = state.pengaturanBerbagi?.namaPemilikRekening || 'Koperasi Berbagi Mandiri HWS';
  // Gambar QRIS khusus sedekah dari pengaturan berbagi atau fallback profil koperasi
  const sedekahQrisUrl = state.pengaturanBerbagi?.qrisImageUrl || state.profile.qrisImageUrl;

  const handleDownloadQrisJpg = () => {
    if (!sedekahQrisUrl) return;
    const link = document.createElement('a');
    link.href = sedekahQrisUrl;
    link.download = `QRIS_Sedekah_Koperasi_HWS_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getJenisLabel = (jenis: JenisSedekahBerbagi) => {
    if (jenis === 'sedekah_subuh') return namaSubuh;
    if (jenis === 'sedekah_jumat') return namaJumat;
    return namaUmum;
  };

  const allSedekahList: SedekahBerbagiEntry[] = state.sedekahList || [];
  const pendingSedekahList = allSedekahList.filter((e) => e.status === 'pending');
  const pendingSalurList = allSedekahList.filter(
    (e) => e.tipe === 'penyaluran' && e.status === 'pending'
  );

  // Perhitungan Saldo Sedekah Anggota
  const totalSedekahPenerimaan = allSedekahList
    .filter((e) => e.tipe === 'penerimaan' && e.status === 'approved')
    .reduce((s, e) => s + e.nominal, 0);
  const totalSedekahPenyaluran = allSedekahList
    .filter((e) => e.tipe === 'penyaluran' && e.status === 'approved')
    .reduce((s, e) => s + e.nominal, 0);
  const memberApprovedSedekah = currentMember
    ? allSedekahList
        .filter(
          (e) =>
            (e.donaturMemberId === currentMember.id ||
              (e.donaturNama && e.donaturNama.toLowerCase() === currentMember.nama.toLowerCase())) &&
            e.tipe === 'penerimaan' &&
            e.status === 'approved'
        )
        .reduce((s, e) => s + e.nominal, 0)
    : 0;
  const memberDisbursedAllocation = totalSedekahPenerimaan > 0
    ? Math.round(memberApprovedSedekah * Math.min(1, totalSedekahPenyaluran / totalSedekahPenerimaan))
    : 0;
  const memberSaldoSedekah = Math.max(0, memberApprovedSedekah - memberDisbursedAllocation);

  // Active Tab - Khusus Admin hanya laporan, salurkan, konfirmasi (Hilangkan kirim berbagi pada admin)
  const [activeTab, setActiveTab] = useState<'berbagi' | 'konfirmasi' | 'salurkan' | 'laporan'>(() => {
    if (isAdmin) {
      if (initialTab && initialTab !== 'berbagi') return initialTab;
      return pendingSedekahList.length > 0 ? 'konfirmasi' : 'laporan';
    }
    return 'berbagi';
  });

  // Guard ketat: Admin TIDAK BISA mengakses tab kirim berbagi, dan Anggota TIDAK BISA mengakses tab laporan & penyaluran
  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'berbagi') {
        setActiveTab(pendingSedekahList.length > 0 ? 'konfirmasi' : 'laporan');
      }
    } else {
      if (activeTab !== 'berbagi') {
        setActiveTab('berbagi');
      }
    }
  }, [isAdmin, activeTab, pendingSedekahList.length]);

  // ================= STATE ANGGOTA / DONASI =================
  const [selectedJenis, setSelectedJenis] = useState<JenisSedekahBerbagi>('sedekah_subuh');
  // User Req: hapuskan nominal angka berbagi hanya input nominal manual
  const [customNominal, setCustomNominal] = useState<string>('');
  const [sumberDana, setSumberDana] = useState<'tabungan_umum' | 'transfer_bank' | 'qris'>('transfer_bank');
  const [doaPesan, setDoaPesan] = useState<string>('');
  const [buktiTransferUrl, setBuktiTransferUrl] = useState<string>('');
  const [isSubmittingDonasi, setIsSubmittingDonasi] = useState(false);
  const [donasiSuccessEntry, setDonasiSuccessEntry] = useState<SedekahBerbagiEntry | null>(null);
  const [copiedRekening, setCopiedRekening] = useState(false);
  // Default tampilkan preview QRIS agar anggota langsung dapat melihat barcode ketika membuka sedekah
  const [showQrisPreview, setShowQrisPreview] = useState(true);
  const [previewBukti, setPreviewBukti] = useState<string | null>(null);

  // ================= STATE ADMIN PENYALURAN =================
  const [salurJenis, setSalurJenis] = useState<JenisSedekahBerbagi>('sedekah_subuh');
  const [salurNominal, setSalurNominal] = useState<string>('');
  const [salurPenerima, setSalurPenerima] = useState<string>('');
  const [salurKeterangan, setSalurKeterangan] = useState<string>('');
  const [salurTanggal, setSalurTanggal] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isSubmittingSalur, setIsSubmittingSalur] = useState(false);

  // ================= STATE LAPORAN =================
  const [laporanWilayah, setLaporanWilayah] = useState<WilayahKoperasi | 'semua'>('semua');
  const [laporanMemberId, setLaporanMemberId] = useState<string>('semua');
  const [laporanPeriodeTipe, setLaporanPeriodeTipe] = useState<'harian' | 'bulanan' | 'tahunan' | 'semua'>('bulanan');
  const [laporanHarianDate, setLaporanHarianDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [laporanBulan, setLaporanBulan] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [laporanTahun, setLaporanTahun] = useState<string>(new Date().getFullYear().toString());
  const [laporanKategori, setLaporanKategori] = useState<string>('semua');

  if (!isOpen) return null;

  // Filtered Sedekah List for Laporan (Wilayah, Per Anggota, Periode)
  const filteredSedekah = allSedekahList.filter((entry) => {
    if (laporanKategori !== 'semua' && entry.jenis !== laporanKategori) return false;

    // Filter Wilayah
    if (laporanWilayah !== 'semua') {
      if (entry.tipe === 'penerimaan') {
        if (entry.donaturWilayah !== laporanWilayah) return false;
      }
    }

    // Filter Per Anggota
    if (laporanMemberId !== 'semua') {
      if (entry.donaturMemberId !== laporanMemberId) return false;
    }

    // Filter Periode
    if (laporanPeriodeTipe === 'harian') {
      if (entry.tanggal !== laporanHarianDate) return false;
    } else if (laporanPeriodeTipe === 'bulanan') {
      if (!entry.tanggal.startsWith(laporanBulan)) return false;
    } else if (laporanPeriodeTipe === 'tahunan') {
      if (!entry.tanggal.startsWith(laporanTahun)) return false;
    }
    return true;
  });

  // Calculate totals (only approved ones contribute to real balance)
  const approvedSedekahList = allSedekahList.filter((e) => e.status !== 'rejected');
  const totalPenerimaan = approvedSedekahList
    .filter((e) => e.tipe === 'penerimaan' && e.status === 'approved')
    .reduce((sum, e) => sum + e.nominal, 0);

  const totalPenyaluran = approvedSedekahList
    .filter((e) => e.tipe === 'penyaluran')
    .reduce((sum, e) => sum + e.nominal, 0);

  const saldoTersedia = Math.max(0, totalPenerimaan - totalPenyaluran);

  // Breakdown per jenis (Approved)
  const subuhMasuk = approvedSedekahList
    .filter((e) => e.tipe === 'penerimaan' && e.jenis === 'sedekah_subuh' && e.status === 'approved')
    .reduce((sum, e) => sum + e.nominal, 0);
  const subuhKeluar = approvedSedekahList
    .filter((e) => e.tipe === 'penyaluran' && e.jenis === 'sedekah_subuh')
    .reduce((sum, e) => sum + e.nominal, 0);
  const subuhSaldo = Math.max(0, subuhMasuk - subuhKeluar);

  const jumatMasuk = approvedSedekahList
    .filter((e) => e.tipe === 'penerimaan' && e.jenis === 'sedekah_jumat' && e.status === 'approved')
    .reduce((sum, e) => sum + e.nominal, 0);
  const jumatKeluar = approvedSedekahList
    .filter((e) => e.tipe === 'penyaluran' && e.jenis === 'sedekah_jumat')
    .reduce((sum, e) => sum + e.nominal, 0);
  const jumatSaldo = Math.max(0, jumatMasuk - jumatKeluar);

  const umumMasuk = approvedSedekahList
    .filter((e) => e.tipe === 'penerimaan' && e.jenis === 'sedekah_umum' && e.status === 'approved')
    .reduce((sum, e) => sum + e.nominal, 0);
  const umumKeluar = approvedSedekahList
    .filter((e) => e.tipe === 'penyaluran' && e.jenis === 'sedekah_umum')
    .reduce((sum, e) => sum + e.nominal, 0);
  const umumSaldo = Math.max(0, umumMasuk - umumKeluar);

  // Salin No Rekening
  const handleCopyNoRek = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(noRekening.replace(/\D/g, ''));
      setCopiedRekening(true);
      setTimeout(() => setCopiedRekening(false), 2500);
    }
  };

  // Upload Bukti Transfer JPG/PNG
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file maksimal 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setBuktiTransferUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Label Periode Laporan
  const getPeriodeLabel = () => {
    if (laporanPeriodeTipe === 'harian') {
      const d = new Date(laporanHarianDate);
      return `Hari ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    if (laporanPeriodeTipe === 'bulanan') {
      const [y, m] = laporanBulan.split('-');
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
      ];
      return `Bulan ${monthNames[parseInt(m, 10) - 1]} ${y}`;
    }
    if (laporanPeriodeTipe === 'tahunan') {
      return `Tahun ${laporanTahun}`;
    }
    return 'Semua Periode';
  };

  // Label Wilayah
  const getWilayahLabel = () => {
    if (laporanWilayah === 'semua') return 'Keseluruhan Wilayah';
    return `Wilayah ${laporanWilayah}`;
  };

  // Label Anggota
  const getMemberLabel = () => {
    if (laporanMemberId === 'semua') return 'Seluruh Anggota & Donatur';
    const m = state.members.find((mem) => mem.id === laporanMemberId);
    return m ? `${m.nama} (${m.nomorAnggota})` : 'Per Anggota';
  };

  // Submit Donasi Berbagi (Anggota / Donatur) - Req: berbagi akan dikonfirmasi admin
  const handleKirimDonasi = async (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = Number(customNominal);
    if (!nominal || nominal <= 0) {
      alert('Silakan ketik nominal berbagi yang ingin disalurkan (minimal Rp 1.000).');
      return;
    }

    if (sumberDana === 'tabungan_umum' && currentMember) {
      if (currentMember.saldoUmum < nominal) {
        alert(
          `Saldo Tabungan Umum Anda (${formatRupiah(currentMember.saldoUmum)}) tidak mencukupi untuk nominal ${formatRupiah(nominal)}. Silakan pilih metode Transfer Bank / QRIS atau sesuaikan nominal.`
        );
        return;
      }
    }

    const jenisLabel = getJenisLabel(selectedJenis);

    const confirmMsg = confirm(
      `Konfirmasi ${jenisLabel}:\nNominal: ${formatRupiah(nominal)}\nMetode: ${
        sumberDana === 'tabungan_umum' ? 'Tabungan Umum Bebas' : `Transfer Bank / QRIS (${bankName})`
      }\n\nPengajuan berbagi ini akan dikirim dan diverifikasi / dikonfirmasi oleh Admin. Setelah disetujui, dana akan resmi tercatat pada Buku Kas Koperasi dan tidak dapat ditarik kembali oleh anggota. Lanjutkan?`
    );
    if (!confirmMsg) return;

    setIsSubmittingDonasi(true);
    try {
      const now = new Date();
      const tanggal = now.toISOString().slice(0, 10);
      const jam = now.toTimeString().slice(0, 5);
      const entryId = `sdk-${Date.now()}`;

      const newSedekahEntry: SedekahBerbagiEntry = {
        id: entryId,
        tanggal,
        jam,
        jenis: selectedJenis,
        namaBerbagiKustom: jenisLabel,
        tipe: 'penerimaan',
        nominal,
        status: 'pending', // Req: Berbagi akan di-konfirmasi admin!
        donaturNama: currentMember ? currentMember.nama : 'Donatur Hamba Allah',
        donaturWilayah: currentMember ? currentMember.wilayah : 'Cengkareng',
        donaturMemberId: currentMember?.id,
        donaturRekening: currentMember?.nomorRekening,
        buktiTransferUrl: buktiTransferUrl || undefined,
        keterangan: doaPesan.trim() ? `[${jenisLabel}] ${doaPesan.trim()}` : `Penerimaan ${jenisLabel} Berbagi Koperasi`,
        sumberDana,
        inputBy: currentMember ? `Anggota (${currentMember.nama})` : 'Sistem Donasi',
        createdAt: now.toISOString(),
      };

      await updateState((prev) => {
        const audit = createAuditLog(
          currentMember || ({ nama: 'Donatur', role: 'member' } as any),
          'Pengajuan Donasi Berbagi',
          `${currentMember?.nama || 'Donatur'} mengajukan ${jenisLabel} senilai ${formatRupiah(nominal)} via ${sumberDana}. Status: PENDING VERIFIKASI (Menunggu Konfirmasi Admin).`
        );

        return {
          ...prev,
          sedekahList: [newSedekahEntry, ...(prev.sedekahList || [])],
          auditLogs: [audit, ...(prev.auditLogs || [])],
        };
      });

      setDonasiSuccessEntry(newSedekahEntry);
      setCustomNominal('');
      setDoaPesan('');
      setBuktiTransferUrl('');
    } finally {
      setIsSubmittingDonasi(false);
    }
  };

  // Konfirmasi / Setujui Donasi Berbagi (Admin Only - Req: berbagi akan di konfirmasi admin)
  const handleApproveDonasi = async (entry: SedekahBerbagiEntry) => {
    if (!isAdmin) return;

    const jenisLabel = entry.namaBerbagiKustom || getJenisLabel(entry.jenis);
    const confirmApprove = confirm(
      `Setujui & Konfirmasi Donasi:\n\nDonatur: ${entry.donaturNama || 'Hamba Allah'}\nWilayah: ${entry.donaturWilayah || '-'}\nProgram: ${jenisLabel}\nNominal: ${formatRupiah(entry.nominal)}\n\nSetelah disetujui, dana akan resmi tercatat pada Buku Kas Koperasi sebagai pemasukan sedekah. Lanjutkan?`
    );
    if (!confirmApprove) return;

    try {
      const now = new Date();
      const tanggal = now.toISOString().slice(0, 10);
      const kasId = `kas-kop-${Date.now()}`;

      // Buat entri pencatatan di Buku Kas Koperasi
      const kasKoperasiEntry: KasEntry = {
        id: kasId,
        bukuKas: 'koperasi',
        tanggal,
        kategori: jenisLabel,
        keterangan: `Penerimaan ${jenisLabel} dari ${entry.donaturNama || 'Donatur'}${entry.keterangan ? ` - ${entry.keterangan}` : ''}`,
        namaPenerima: currentAdmin?.nama || 'Kasir Koperasi',
        tipe: 'masuk',
        nominal: entry.nominal,
        saldoKasSetelah: 0,
        inputBy: currentAdmin?.nama || 'Admin Berbagi',
        status: 'approved',
        createdAt: now.toISOString(),
      };

      // Jika potong tabungan umum anggota
      let updatedMemberTx: MemberTransaction | null = null;
      if (entry.sumberDana === 'tabungan_umum' && entry.donaturMemberId) {
        const mem = state.members.find((m) => m.id === entry.donaturMemberId);
        if (mem) {
          updatedMemberTx = {
            id: `tx-sdk-${Date.now()}`,
            memberId: mem.id,
            tanggal,
            jam: now.toTimeString().slice(0, 5),
            keterangan: `[${jenisLabel}] Program Berbagi Koperasi (Telah Dikonfirmasi Admin)`,
            cbg: `KCP ${mem.wilayah}`,
            tipe: 'keluar',
            nominal: entry.nominal,
            saldoSetelah: Math.max(0, mem.saldoUmum - entry.nominal),
            kategori: 'umum',
          };
        }
      }

      await updateState((prev) => {
        let updatedMembers = prev.members;
        let updatedMemberTransactions = prev.memberTransactions || [];

        if (entry.sumberDana === 'tabungan_umum' && entry.donaturMemberId && updatedMemberTx) {
          updatedMembers = prev.members.map((m) =>
            m.id === entry.donaturMemberId
              ? {
                  ...m,
                  saldoUmum: Math.max(0, m.saldoUmum - entry.nominal),
                  totalSimpanan: Math.max(
                    0,
                    (m.totalSimpanan ?? (m.saldoPokok + m.saldoUmum + m.saldoZakatFitrah + m.saldoQurban)) - entry.nominal
                  ),
                }
              : m
          );
          updatedMemberTransactions = [updatedMemberTx, ...updatedMemberTransactions];
        }

        const updatedSedekahList = (prev.sedekahList || []).map((s) =>
          s.id === entry.id
            ? {
                ...s,
                status: 'approved' as const,
                kasKoperasiId: kasId,
                verifiedBy: currentAdmin?.nama || 'Admin',
                verifiedAt: now.toISOString(),
              }
            : s
        );

        const audit = createAuditLog(
          currentAdmin!,
          'Konfirmasi Donasi Berbagi',
          `Admin ${currentAdmin?.nama || 'Admin'} menyetujui donasi ${jenisLabel} senilai ${formatRupiah(entry.nominal)} dari ${entry.donaturNama || 'Donatur'}. Tercatat di Buku Kas Koperasi.`
        );

        return {
          ...prev,
          members: updatedMembers,
          memberTransactions: updatedMemberTransactions,
          kasList: [kasKoperasiEntry, ...(prev.kasList || [])],
          sedekahList: updatedSedekahList,
          auditLogs: [audit, ...(prev.auditLogs || [])],
        };
      });

      alert(`✓ Donasi ${jenisLabel} senilai ${formatRupiah(entry.nominal)} berhasil dikonfirmasi dan dicatat pada Buku Kas Koperasi!`);
    } catch (err: any) {
      alert('Gagal mengonfirmasi donasi: ' + err.message);
    }
  };

  // Tolak Donasi Berbagi (Admin Only)
  const handleRejectDonasi = async (entry: SedekahBerbagiEntry) => {
    if (!isAdmin) return;
    const reason = prompt(`Masukkan alasan penolakan donasi dari ${entry.donaturNama || 'Donatur'}:`, 'Data transfer tidak valid / tidak masuk');
    if (reason === null) return;

    await updateState((prev) => {
      const updatedSedekahList = (prev.sedekahList || []).map((s) =>
        s.id === entry.id
          ? {
              ...s,
              status: 'rejected' as const,
              rejectionReason: reason,
              verifiedBy: currentAdmin?.nama || 'Admin',
              verifiedAt: new Date().toISOString(),
            }
          : s
      );

      const audit = createAuditLog(
        currentAdmin!,
        'Tolak Donasi Berbagi',
        `Admin ${currentAdmin?.nama || 'Admin'} menolak donasi senilai ${formatRupiah(entry.nominal)} dari ${entry.donaturNama || 'Donatur'}. Alasan: ${reason}`
      );

      return {
        ...prev,
        sedekahList: updatedSedekahList,
        auditLogs: [audit, ...(prev.auditLogs || [])],
      };
    });

    alert('Donasi telah ditolak.');
  };

  // Submit Penyaluran Sedekah (Admin Write / Approval / Super Admin)
  // Req E: Penyaluran sedekah = input admin write di aproval adminaproval / superadmin
  const handleKirimPenyaluran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Akses Ditolak: Penyaluran dana berbagi hanya dapat diakses oleh Admin.');
      return;
    }

    const nominal = Number(salurNominal);
    if (!nominal || nominal <= 0) {
      alert('Nominal penyaluran harus lebih dari Rp 0.');
      return;
    }

    const availableForType =
      salurJenis === 'sedekah_subuh' ? subuhSaldo : salurJenis === 'sedekah_jumat' ? jumatSaldo : umumSaldo;

    if (nominal > availableForType) {
      const confirmExceed = confirm(
        `Perhatian: Saldo ${getJenisLabel(salurJenis)} saat ini sebesar ${formatRupiah(
          availableForType
        )}. Nominal penyaluran (${formatRupiah(nominal)}) melebihi saldo kategori tersebut. Lanjutkan pengajuan penyaluran?`
      );
      if (!confirmExceed) return;
    }

    if (!salurPenerima.trim()) {
      alert('Nama penerima manfaat / lembaga wajib diisi.');
      return;
    }

    const isSuperAdmin = currentAdmin?.role === 'super_admin';
    const isApproval = currentAdmin?.role === 'admin_approval';
    const isDirectApprove = isSuperAdmin || isApproval;

    const jenisLabel = getJenisLabel(salurJenis);
    const kategoriPengeluaran = `Penyaluran ${jenisLabel}`;

    setIsSubmittingSalur(true);
    try {
      const now = new Date();
      const jam = now.toTimeString().slice(0, 5);
      const entryId = `salur-${Date.now()}`;
      const kasId = `kas-kop-${Date.now()}`;

      const newSalurEntry: SedekahBerbagiEntry = {
        id: entryId,
        tanggal: salurTanggal,
        jam,
        jenis: salurJenis,
        namaBerbagiKustom: jenisLabel,
        tipe: 'penyaluran',
        nominal,
        status: isDirectApprove ? 'approved' : 'pending',
        penerimaManfaat: salurPenerima.trim(),
        keterangan: `Penyaluran ${jenisLabel} kepada ${salurPenerima.trim()}${
          salurKeterangan.trim() ? ` - Ket: ${salurKeterangan.trim()}` : ''
        }`,
        kasKoperasiId: isDirectApprove ? kasId : undefined,
        inputBy: currentAdmin?.nama || 'Admin Pengurus',
        verifiedBy: isDirectApprove ? (currentAdmin?.nama || 'Super Admin') : undefined,
        verifiedAt: isDirectApprove ? now.toISOString() : undefined,
        createdAt: now.toISOString(),
      };

      // Jika langsung disetujui oleh Super Admin atau Admin Approval: catat ke Buku Kas Koperasi
      let newKasListEntries: KasEntry[] = [];
      if (isDirectApprove) {
        newKasListEntries = [
          {
            id: kasId,
            bukuKas: 'koperasi',
            tanggal: salurTanggal,
            kategori: kategoriPengeluaran,
            keterangan: `Penyaluran ${jenisLabel} kepada ${salurPenerima.trim()}${
              salurKeterangan.trim() ? ` - ${salurKeterangan.trim()}` : ''
            }`,
            namaPenerima: salurPenerima.trim(),
            tipe: 'keluar',
            nominal,
            saldoKasSetelah: 0,
            inputBy: currentAdmin?.nama || 'Admin Pengurus',
            status: 'approved',
            createdAt: now.toISOString(),
          },
        ];
      }

      await updateState((prev) => {
        const audit = createAuditLog(
          currentAdmin || ({ nama: 'Admin', role: 'admin_write' } as any),
          isDirectApprove ? 'Penyaluran Dana Berbagi Disahkan' : 'Pengajuan Penyaluran Sedekah',
          isDirectApprove
            ? `${currentAdmin?.nama || 'Admin'} menyetujui langsung penyaluran ${jenisLabel} senilai ${formatRupiah(nominal)} kepada "${salurPenerima.trim()}". Tercatat di Buku Kas Koperasi.`
            : `Admin Write (${currentAdmin?.nama || 'Admin'}) mengajukan penyaluran ${jenisLabel} senilai ${formatRupiah(nominal)} kepada "${salurPenerima.trim()}". Menunggu persetujuan Admin Approval / Super Admin.`
        );

        return {
          ...prev,
          kasList: [...newKasListEntries, ...(prev.kasList || [])],
          sedekahList: [newSalurEntry, ...(prev.sedekahList || [])],
          auditLogs: [audit, ...(prev.auditLogs || [])],
        };
      });

      if (isDirectApprove) {
        alert(`✓ Penyaluran ${jenisLabel} senilai ${formatRupiah(nominal)} berhasil disahkan dan resmi dicatat di Buku Kas Koperasi!`);
      } else {
        alert(`✓ Pengajuan penyaluran ${jenisLabel} senilai ${formatRupiah(nominal)} berhasil diajukan oleh Admin Write! Menunggu persetujuan (approval) dari Admin Approval atau Super Admin.`);
      }

      setSalurNominal('');
      setSalurPenerima('');
      setSalurKeterangan('');
      setActiveTab('salurkan');
    } finally {
      setIsSubmittingSalur(false);
    }
  };

  // Otorisasi / Approval Penyaluran Sedekah oleh Admin Approval atau Super Admin (Req E)
  const handleApprovePenyaluran = async (entry: SedekahBerbagiEntry) => {
    const isSuperAdmin = currentAdmin?.role === 'super_admin';
    const isApproval = currentAdmin?.role === 'admin_approval';
    if (!isSuperAdmin && !isApproval) {
      alert('Akses Ditolak: Hanya Admin Approval atau Super Admin yang berwenang menyetujui penyaluran sedekah.');
      return;
    }

    try {
      const now = new Date();
      const kasId = entry.kasKoperasiId || `kas-salur-${Date.now()}`;
      const jenisLabel = entry.namaBerbagiKustom || getJenisLabel(entry.jenis);
      const kategoriPengeluaran = `Penyaluran ${jenisLabel}`;

      const kasKeluarEntry: KasEntry = {
        id: kasId,
        bukuKas: 'koperasi',
        tanggal: entry.tanggal,
        kategori: kategoriPengeluaran,
        keterangan: `Penyaluran ${jenisLabel} kepada ${entry.penerimaManfaat || 'Penerima'}${
          entry.keterangan ? ` - ${entry.keterangan}` : ''
        }`,
        namaPenerima: entry.penerimaManfaat || 'Penerima Manfaat',
        tipe: 'keluar',
        nominal: entry.nominal,
        saldoKasSetelah: 0,
        inputBy: currentAdmin?.nama || 'Admin Approval',
        status: 'approved',
        createdAt: now.toISOString(),
      };

      await updateState((prev) => {
        const updatedSedekahList = (prev.sedekahList || []).map((s) =>
          s.id === entry.id
            ? {
                ...s,
                status: 'approved' as const,
                kasKoperasiId: kasId,
                verifiedBy: currentAdmin?.nama || 'Admin Approval',
                verifiedAt: now.toISOString(),
              }
            : s
        );

        const audit = createAuditLog(
          currentAdmin!,
          'Persetujuan Penyaluran Sedekah',
          `${currentAdmin?.nama} (Approval) menyetujui pengajuan penyaluran ${jenisLabel} senilai ${formatRupiah(
            entry.nominal
          )} kepada "${entry.penerimaManfaat}". Resmi dibukukan ke Buku Kas Koperasi.`
        );

        return {
          ...prev,
          sedekahList: updatedSedekahList,
          kasList: [kasKeluarEntry, ...(prev.kasList || [])],
          auditLogs: [audit, ...(prev.auditLogs || [])],
        };
      });

      alert(`✓ Penyaluran ${jenisLabel} senilai ${formatRupiah(entry.nominal)} berhasil DISETUJUI dan resmi dicatat pada Buku Kas Koperasi!`);
    } catch (err: any) {
      alert('Gagal menyetujui penyaluran: ' + err.message);
    }
  };

  // Tolak Penyaluran Sedekah oleh Admin Approval atau Super Admin (Req E)
  const handleRejectPenyaluran = async (entry: SedekahBerbagiEntry) => {
    const isSuperAdmin = currentAdmin?.role === 'super_admin';
    const isApproval = currentAdmin?.role === 'admin_approval';
    if (!isSuperAdmin && !isApproval) {
      alert('Akses Ditolak: Hanya Admin Approval atau Super Admin yang berwenang menolak penyaluran sedekah.');
      return;
    }

    const reason = prompt(`Masukkan alasan penolakan pengajuan penyaluran kepada ${entry.penerimaManfaat || 'Penerima'}:`, 'Anggaran kas belum mencukupi / perlu verifikasi ulang');
    if (reason === null) return;

    await updateState((prev) => {
      const updatedSedekahList = (prev.sedekahList || []).map((s) =>
        s.id === entry.id
          ? {
              ...s,
              status: 'rejected' as const,
              rejectionReason: reason,
              verifiedBy: currentAdmin?.nama || 'Admin Approval',
              verifiedAt: new Date().toISOString(),
            }
          : s
      );

      const audit = createAuditLog(
        currentAdmin!,
        'Tolak Pengajuan Penyaluran Sedekah',
        `${currentAdmin?.nama} menolak pengajuan penyaluran senilai ${formatRupiah(entry.nominal)} kepada "${entry.penerimaManfaat}". Alasan: ${reason}`
      );

      return {
        ...prev,
        sedekahList: updatedSedekahList,
        auditLogs: [audit, ...(prev.auditLogs || [])],
      };
    });

    alert('Pengajuan penyaluran sedekah telah ditolak.');
  };

  // Unduh Laporan PDF (Req 3: Pilihan wilayah / keseluruhan / peranggota, harian / bulanan / tahunan)
  const handleExportPdf = () => {
    const payload = {
      entries: filteredSedekah,
      periodeTipe: laporanPeriodeTipe,
      periodeLabel: getPeriodeLabel(),
      wilayahLabel: getWilayahLabel(),
      memberLabel: getMemberLabel(),
      kategoriFilter: laporanKategori,
      totalPenerimaan: filteredSedekah.filter((e) => e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0),
      totalPenyaluran: filteredSedekah.filter((e) => e.tipe === 'penyaluran').reduce((s, e) => s + e.nominal, 0),
      saldoTersedia,
      subuhTotal: filteredSedekah.filter((e) => e.jenis === 'sedekah_subuh' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0),
      jumatTotal: filteredSedekah.filter((e) => e.jenis === 'sedekah_jumat' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0),
      umumTotal: filteredSedekah.filter((e) => e.jenis === 'sedekah_umum' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0),
      namaBerbagiMap: {
        sedekah_subuh: namaSubuh,
        sedekah_jumat: namaJumat,
        sedekah_umum: namaUmum,
      },
    };
    exportLaporanBerbagiPdf(payload);
  };

  // Unduh Laporan Excel (Req 3: Pilihan wilayah / keseluruhan / peranggota, harian / bulanan / tahunan)
  const handleExportExcel = () => {
    const payload = {
      entries: filteredSedekah,
      periodeTipe: laporanPeriodeTipe,
      periodeLabel: getPeriodeLabel(),
      wilayahLabel: getWilayahLabel(),
      memberLabel: getMemberLabel(),
      kategoriFilter: laporanKategori,
      totalPenerimaan: filteredSedekah.filter((e) => e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0),
      totalPenyaluran: filteredSedekah.filter((e) => e.tipe === 'penyaluran').reduce((s, e) => s + e.nominal, 0),
      saldoTersedia,
      subuhTotal: filteredSedekah.filter((e) => e.jenis === 'sedekah_subuh' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0),
      jumatTotal: filteredSedekah.filter((e) => e.jenis === 'sedekah_jumat' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0),
      umumTotal: filteredSedekah.filter((e) => e.jenis === 'sedekah_umum' && e.tipe === 'penerimaan' && e.status === 'approved').reduce((s, e) => s + e.nominal, 0),
      namaBerbagiMap: {
        sedekah_subuh: namaSubuh,
        sedekah_jumat: namaJumat,
        sedekah_umum: namaUmum,
      },
    };
    exportLaporanBerbagiExcel(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0f172a] text-slate-100 border border-rose-500/40 w-full max-w-3xl rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 my-auto relative animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header - Fixed on Top */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0 shadow">
              <Heart className="w-6 h-6 text-rose-400 fill-rose-400/30" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Menu Berbagi & Sedekah Koperasi HWS
                </h3>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full border border-rose-500/30">
                  Sosial & Berkah
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {namaSubuh}, {namaJumat}, dan {namaUmum} • Dikelola Transparan di Buku Kas Koperasi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation - Khusus Admin (Anggota murni setor sedekah tanpa tab laporan / penyaluran) */}
        {isAdmin ? (
          <div className="flex bg-[#162035] p-1 rounded-2xl border border-slate-700 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('laporan')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'laporan'
                  ? 'bg-sky-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Laporan Sedekah</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('salurkan')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
                activeTab === 'salurkan'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Penyaluran Sedekah</span>
              {pendingSalurList.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse" title={`${pendingSalurList.length} Pengajuan Penyaluran Menunggu Otorisasi`}>
                  {pendingSalurList.length} Butuh Approval
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('konfirmasi')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
                activeTab === 'konfirmasi'
                  ? 'bg-purple-600 text-white font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Konfirmasi Masuk</span>
              {pendingSedekahList.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse">
                  {pendingSedekahList.length}
                </span>
              )}
            </button>
          </div>
        ) : (
          /* Header Banner Khusus Anggota */
          <div className="p-3 bg-gradient-to-r from-rose-950/60 via-slate-900 to-amber-950/60 rounded-2xl border border-rose-500/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                <Heart className="w-4 h-4 fill-rose-400" />
              </span>
              <div>
                <div className="text-xs font-black text-white">Form Setor Sedekah Anggota</div>
                <div className="text-[10px] text-rose-300">Metode QRIS & Transfer Bank Penampungan Koperasi</div>
              </div>
            </div>
            <span className="text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded-xl">
              Sosial Syariah
            </span>
          </div>
        )}

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
          {/* Summary Card Khusus Admin */}
          {isAdmin ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700">
                <span className="text-[10px] text-slate-400 font-semibold block">Total Diterima (Disetujui)</span>
                <div className="text-sm font-black text-emerald-400 mt-0.5">{formatRupiah(totalPenerimaan)}</div>
                <span className="text-[9px] text-slate-400">Tercatat di Kas Koperasi</span>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700">
                <span className="text-[10px] text-slate-400 font-semibold block">Total Disalurkan</span>
                <div className="text-sm font-black text-rose-400 mt-0.5">{formatRupiah(totalPenyaluran)}</div>
                <span className="text-[9px] text-slate-400">Resmi oleh pengurus</span>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-amber-500/30">
                <span className="text-[10px] text-amber-300 font-semibold block">Saldo Siap Salur</span>
                <div className="text-sm font-black text-amber-400 mt-0.5">{formatRupiah(saldoTersedia)}</div>
                <span className="text-[9px] text-emerald-400">Kas Berbagi</span>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700">
                <span className="text-[10px] text-slate-400 font-semibold block">Saldo Per Program</span>
                <div className="text-[10px] text-slate-300 font-mono mt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <span className="truncate pr-1">{namaSubuh}:</span>
                    <span className="text-amber-400 font-bold">{formatRupiah(subuhSaldo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="truncate pr-1">{namaJumat}:</span>
                    <span className="text-emerald-400 font-bold">{formatRupiah(jumatSaldo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="truncate pr-1">{namaUmum}:</span>
                    <span className="text-sky-400 font-bold">{formatRupiah(umumSaldo)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : currentMember ? (
            /* Saldo Sedekah Khusus Anggota (Req 1C & 2) */
            <div className="p-4 bg-gradient-to-r from-rose-950/70 via-slate-900 to-[#1e1528] rounded-2xl border border-rose-500/50 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-400 fill-rose-400/40" />
                  <span>Saldo Sedekah Saya:</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono">
                  {formatRupiah(memberSaldoSedekah)}
                </div>
                <div className="text-[10px] text-rose-300/80">
                  • Berkurang saat penyaluran resmi disahkan pengurus • Tidak tercatat di mutasi tabungan anggota
                </div>
              </div>
              <div className="sm:text-right">
                <span className="inline-block px-3 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-extrabold uppercase">
                  Siap Disalurkan
                </span>
              </div>
            </div>
          ) : null}

          {/* ================= TAB 1: FORM DONASI SEDEKAH (ANGGOTA / UMUM) ================= */}
          {!isAdmin && activeTab === 'berbagi' && !donasiSuccessEntry && (
            <form onSubmit={handleKirimDonasi} className="space-y-4">
              {/* Pilihan 3 Program Berbagi */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  1. Pilih Program Berbagi Koperasi:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* 1. Sedekah Subuh */}
                  <button
                    type="button"
                    onClick={() => setSelectedJenis('sedekah_subuh')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                      selectedJenis === 'sedekah_subuh'
                        ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/50 shadow'
                        : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
                        <Sun className="w-4 h-4" />
                      </div>
                      <div className="font-extrabold text-xs text-white truncate">{namaSubuh}</div>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1.5">
                      Membuka pintu rezeki di awal hari & doa malaikat subuh.
                    </div>
                    {selectedJenis === 'sedekah_subuh' && (
                      <div className="mt-2 text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                        ✓ Dipilih
                      </div>
                    )}
                  </button>

                  {/* 2. Sedekah Jumat */}
                  <button
                    type="button"
                    onClick={() => setSelectedJenis('sedekah_jumat')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                      selectedJenis === 'sedekah_jumat'
                        ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/50 shadow'
                        : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="font-extrabold text-xs text-white truncate">{namaJumat}</div>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1.5">
                      Pahala berlipat ganda di hari Sayyidul Ayyam penuh berkah.
                    </div>
                    {selectedJenis === 'sedekah_jumat' && (
                      <div className="mt-2 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                        ✓ Dipilih
                      </div>
                    )}
                  </button>

                  {/* 3. Sedekah Umum */}
                  <button
                    type="button"
                    onClick={() => setSelectedJenis('sedekah_umum')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                      selectedJenis === 'sedekah_umum'
                        ? 'bg-sky-500/20 border-sky-500 ring-2 ring-sky-500/50 shadow'
                        : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-sky-500/20 text-sky-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="font-extrabold text-xs text-white truncate">{namaUmum}</div>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1.5">
                      Kapan saja untuk kemaslahatan anggota, dhuafa & anak yatim.
                    </div>
                    {selectedJenis === 'sedekah_umum' && (
                      <div className="mt-2 text-[9px] font-bold text-sky-400 uppercase tracking-wider">
                        ✓ Dipilih
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Input Nominal Saja (User Req: hapuskan nominal angka berbagi hanya input nominal) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>2. Masukkan Nominal Berbagi (Ketik Bebas Sesuai Keikhlasan): *</span>
                  {customNominal && (
                    <span className="text-amber-400 font-mono font-bold">
                      {formatRupiah(Number(customNominal) || 0)}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm text-amber-400 font-bold font-mono">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={customNominal}
                    onChange={(e) => setCustomNominal(e.target.value)}
                    placeholder="Contoh: 25000, 50000, 100000..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-800/90 border-2 border-slate-700 hover:border-rose-500 focus:border-rose-500 rounded-2xl text-base font-black text-white focus:outline-none font-mono tracking-wide placeholder-slate-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  * Bebas menentukan nominal berapa pun mulai dari Rp 1.000 tanpa batasan angka preset.
                </p>
              </div>

              {/* TAMPILKAN LOGO QRIS DAN NO REKENING BERBAGI (User Req) */}
              <div className="p-3.5 bg-gradient-to-br from-slate-900 via-[#131d35] to-slate-900 border border-rose-500/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {/* Logo QRIS Badge */}
                    <div className="flex items-center bg-white px-2 py-0.5 rounded-lg border border-slate-300 shadow-sm">
                      <span className="text-red-600 font-black tracking-tighter text-xs">QRIS</span>
                      <span className="text-[8px] text-slate-700 font-bold ml-1 border-l border-slate-300 pl-1">NASIONAL</span>
                    </div>
                    <span className="text-xs font-extrabold text-white">
                      Rekening Resmi & QRIS Kas Berbagi Koperasi
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQrisPreview(!showQrisPreview)}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>{showQrisPreview ? 'Tutup Kode QR' : 'Tampilkan QRIS Barcode'}</span>
                  </button>
                </div>

                {/* Info Rekening Kas Berbagi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-2.5 bg-slate-800/90 rounded-xl border border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400">{bankName}</div>
                      <div className="text-sm font-mono font-black text-amber-400 tracking-wider">
                        {noRekening}
                      </div>
                      <div className="text-[10px] text-slate-300 font-semibold truncate">
                        a.n {namaPemilikRekening}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyNoRek}
                      className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer shrink-0"
                      title="Salin Nomor Rekening Kas Berbagi"
                    >
                      {copiedRekening ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="p-2.5 bg-slate-800/90 rounded-xl border border-slate-700 flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                      <ShieldCheck className="w-5 h-5 text-rose-400" />
                    </div>
                    <div className="text-[11px] text-slate-300 leading-tight">
                      <div className="font-bold text-white">Kas Berbagi Khusus</div>
                      <div>Rekening khusus sosial, terpisah dari kas simpanan operasional.</div>
                    </div>
                  </div>
                </div>

                {/* QRIS Code Preview Box */}
                {(showQrisPreview || sumberDana === 'qris') && (
                  <div className="p-4 bg-white rounded-2xl text-slate-900 text-center space-y-2.5 border-2 border-rose-500 shadow-xl max-w-xs mx-auto animate-in zoom-in-95">
                    <div className="flex items-center justify-between border-b pb-1.5 border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="text-red-600 font-black text-base tracking-tighter">QRIS</span>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                          Resmi Kas Berbagi
                        </span>
                      </div>
                      <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded">
                        Koperasi HWS
                      </span>
                    </div>

                    <div className="font-extrabold text-xs text-slate-800">
                      {namaPemilikRekening}
                    </div>

                    {/* QR Code Container */}
                    <div className="w-48 h-48 mx-auto bg-slate-50 rounded-xl p-2 border-2 border-slate-800 flex items-center justify-center relative overflow-hidden">
                      {sedekahQrisUrl ? (
                        <img
                          src={sedekahQrisUrl}
                          alt="QRIS Resmi Sedekah Koperasi"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-white p-1 grid grid-cols-7 grid-rows-7 gap-0.5">
                          {Array.from({ length: 49 }).map((_, i) => {
                            const isCorner =
                              (i < 3 || (i >= 4 && i < 7) || (i >= 42 && i < 45)) ||
                              (i % 7 < 3 && i < 21) ||
                              (i % 7 >= 4 && i < 21) ||
                              (i % 7 < 3 && i >= 28);
                            const isDark = (i * 17 + 3) % 2 === 0 || isCorner;
                            return (
                              <div
                                key={i}
                                className={`${isDark ? 'bg-slate-950' : 'bg-white'} rounded-[1px]`}
                              />
                            );
                          })}
                        </div>
                      )}
                      {!sedekahQrisUrl && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-white p-1 rounded-md border border-slate-400 shadow">
                            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-600 font-semibold leading-tight">
                      Scan via BCA Mobile, Livin Mandiri, BRImo, BNI, GoPay, OVO, DANA, ShopeePay
                    </div>

                    {sedekahQrisUrl && (
                      <button
                        type="button"
                        onClick={handleDownloadQrisJpg}
                        className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                        title="Unduh Berkas Gambar QRIS"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh QRIS (JPG)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Pilihan Sumber Dana */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  3. Pilih Metode Pembayaran Sedekah:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSumberDana('qris');
                      setShowQrisPreview(true);
                    }}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      sumberDana === 'qris'
                        ? 'bg-rose-500/20 border-rose-500 text-white font-bold ring-1 ring-rose-500 shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-rose-400" />
                        <span className="font-extrabold text-white">QRIS Kas Berbagi</span>
                      </div>
                      <div className="text-[10px] text-rose-300">Scan via Semua E-Wallet & M-Banking</div>
                    </div>
                    {sumberDana === 'qris' && <span className="text-rose-400 text-xs font-black">✓</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSumberDana('transfer_bank')}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      sumberDana === 'transfer_bank'
                        ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold ring-1 ring-emerald-500 shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-extrabold text-white">Transfer Bank Kas Berbagi</div>
                      <div className="text-[10px] text-emerald-400">{bankName} - {noRekening}</div>
                    </div>
                    {sumberDana === 'transfer_bank' && <span className="text-emerald-400 text-xs font-black">✓</span>}
                  </button>

                  {currentMember && (
                    <button
                      type="button"
                      onClick={() => setSumberDana('tabungan_umum')}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer sm:col-span-2 ${
                        sumberDana === 'tabungan_umum'
                          ? 'bg-sky-500/20 border-sky-500 text-white font-bold ring-1 ring-sky-500 shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-extrabold text-white">Tabungan Umum Bebas Anggota</div>
                        <div className="text-[10px] text-sky-400 font-mono">
                          Saldo Tersedia: {formatRupiah(currentMember.saldoUmum)}
                        </div>
                      </div>
                      {sumberDana === 'tabungan_umum' && <span className="text-sky-400 text-xs font-black">✓</span>}
                    </button>
                  )}
                </div>
              </div>

              {/* Upload Foto Bukti Transfer (Opsional jika transfer / QRIS) */}
              {sumberDana !== 'tabungan_umum' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Foto Bukti Transfer / Resi QRIS (Format JPG / PNG):</span>
                    {buktiTransferUrl && <span className="text-emerald-400 text-[10px]">✓ Foto terlampir</span>}
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 flex items-center justify-center gap-2 cursor-pointer hover:border-slate-500">
                      <Upload className="w-4 h-4 text-amber-400" />
                      <span>{buktiTransferUrl ? 'Ganti Foto Bukti Transfer' : 'Pilih File Bukti Resi Transfer'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/jpg"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {buktiTransferUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewBukti(buktiTransferUrl)}
                        className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-bold border border-sky-500/30 flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Pratinjau</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Doa / Pesan Kebaikan */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Doa / Niat / Catatan Sedekah (Opsional):
                </label>
                <textarea
                  rows={2}
                  value={doaPesan}
                  onChange={(e) => setDoaPesan(e.target.value)}
                  placeholder="Contoh: Niat sedekah untuk kelancaran usaha, kesehatan orang tua, dan berkah keluarga..."
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder-slate-500"
                />
              </div>

              {/* Ketentuan Syariah & Alur Konfirmasi */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-[11px] text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Ketentuan Donasi & Konfirmasi Admin:</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-slate-300">
                  <li>Setiap pengajuan donasi berbagi akan <b>dikonfirmasi dan diverifikasi oleh Admin Koperasi</b>.</li>
                  <li>Setelah disetujui, dana tercatat resmi pada <b>Buku Kas Koperasi</b> sebagai penerimaan sosial.</li>
                  <li className="text-amber-300 font-semibold">
                    Sesuai ketentuan, dana sedekah <b>tidak dapat ditarik kembali oleh anggota</b> dan murni untuk kemaslahatan umat.
                  </li>
                </ul>
              </div>

              {/* Tombol Kirim */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingDonasi || !customNominal || Number(customNominal) <= 0}
                  className="w-full py-3 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 hover:from-rose-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-white" />
                  <span>
                    {isSubmittingDonasi
                      ? 'Mengirim Pengajuan Sedekah...'
                      : `Bismillah, Kirim Donasi ${formatRupiah(Number(customNominal) || 0)} (Konfirmasi Admin)`}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* Notifikasi Bukti Pengajuan Berhasil */}
          {!isAdmin && donasiSuccessEntry && (
            <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-3xl p-5 text-center space-y-3 animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-2xl border border-emerald-500/40">
                ✓
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">Alhamdulillah, Pengajuan Donasi Terkirim!</h4>
                <p className="text-xs text-emerald-300 mt-1">
                  Donasi Anda masuk dalam status <b>Menunggu Konfirmasi Admin</b>. Setelah diverifikasi, dana akan tercatat di Buku Kas Koperasi.
                </p>
              </div>

              <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-700 text-left text-xs space-y-1.5 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-400">Program:</span>
                  <span className="font-bold text-white">
                    {donasiSuccessEntry.namaBerbagiKustom || getJenisLabel(donasiSuccessEntry.jenis)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nominal:</span>
                  <span className="font-mono font-black text-emerald-400">
                    {formatRupiah(donasiSuccessEntry.nominal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[10px]">
                    Pending Konfirmasi Admin
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tanggal:</span>
                  <span className="font-mono text-slate-300">{donasiSuccessEntry.tanggal} {donasiSuccessEntry.jam}</span>
                </div>
              </div>

              <div className="flex gap-2 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setDonasiSuccessEntry(null)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl cursor-pointer transition-colors"
                >
                  Kembali / Donasi Lagi
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer transition-all"
                >
                  Selesai & Tutup
                </button>
              </div>
            </div>
          )}

          {/* ================= TAB 2: KONFIRMASI BERBAGI (ADMIN ONLY) ================= */}
          {activeTab === 'konfirmasi' && isAdmin && (
            <div className="space-y-3">
              <div className="p-3 bg-purple-950/40 rounded-2xl border border-purple-500/40 text-purple-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-purple-400 shrink-0" />
                  <div>
                    <div className="font-black text-white text-xs">
                      Antrean Konfirmasi Donasi Berbagi ({pendingSedekahList.length})
                    </div>
                    <div className="text-[10px] text-purple-300">
                      Periksa transfer anggota, konfirmasi donasi untuk dicatat resmi pada Buku Kas Koperasi.
                    </div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40">
                  Otoritas Admin
                </span>
              </div>

              {pendingSedekahList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs">
                  Tidak ada antrean donasi berbagi yang menunggu konfirmasi saat ini.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingSedekahList.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-white text-sm">
                            {entry.donaturNama || 'Hamba Allah'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
                            Wilayah {entry.donaturWilayah || '-'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-extrabold text-[10px] border border-rose-500/30">
                            {entry.namaBerbagiKustom || getJenisLabel(entry.jenis)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {entry.tanggal} {entry.jam} • Metode: <b className="text-slate-200">{entry.sumberDana === 'tabungan_umum' ? 'Tabungan Umum' : 'Transfer Bank / QRIS'}</b>
                        </div>
                        {entry.keterangan && (
                          <div className="text-[11px] text-slate-300 italic bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50">
                            "{entry.keterangan}"
                          </div>
                        )}
                        {entry.buktiTransferUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewBukti(entry.buktiTransferUrl!)}
                            className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 font-bold pt-0.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat Foto Bukti Resi Transfer</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 sm:self-center shrink-0">
                        <div className="text-right sm:mr-2">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Nominal</div>
                          <div className="text-sm font-mono font-black text-emerald-400">
                            {formatRupiah(entry.nominal)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApproveDonasi(entry)}
                          className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center gap-1 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Setujui</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectDonasi(entry)}
                          className="py-2 px-2.5 bg-red-900/60 hover:bg-red-800 text-red-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          ✕ Tolak
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: SALURKAN DANA BERBAGI (ADMIN ONLY) ================= */}
          {activeTab === 'salurkan' && isAdmin && (
            <form onSubmit={handleKirimPenyaluran} className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-amber-300">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  Otorisasi Penyaluran: Pengurus menyalurkan dana sedekah yang terkumpul pada Buku Kas Koperasi kepada mustahiq, anak yatim, atau lembaga sosial.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Pilih Program Sedekah yang Disalurkan:
                  </label>
                  <select
                    value={salurJenis}
                    onChange={(e) => setSalurJenis(e.target.value as JenisSedekahBerbagi)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="sedekah_subuh">{namaSubuh} (Tersedia: {formatRupiah(subuhSaldo)})</option>
                    <option value="sedekah_jumat">{namaJumat} (Tersedia: {formatRupiah(jumatSaldo)})</option>
                    <option value="sedekah_umum">{namaUmum} (Tersedia: {formatRupiah(umumSaldo)})</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Tanggal Penyaluran:
                  </label>
                  <input
                    type="date"
                    required
                    value={salurTanggal}
                    onChange={(e) => setSalurTanggal(e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nominal Dana yang Disalurkan:
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs text-slate-400 font-bold">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={salurNominal}
                    onChange={(e) => setSalurNominal(e.target.value)}
                    placeholder="Masukkan nominal penyaluran..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nama Penerima Manfaat / Lembaga / Sasaran *:
                </label>
                <input
                  type="text"
                  required
                  value={salurPenerima}
                  onChange={(e) => setSalurPenerima(e.target.value)}
                  placeholder="Contoh: Panti Asuhan Yatim Piatu Al-Barokah / 25 Kaum Dhuafa Kembangan"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Keterangan Penyaluran / Dokumentasi:
                </label>
                <textarea
                  rows={2}
                  value={salurKeterangan}
                  onChange={(e) => setSalurKeterangan(e.target.value)}
                  placeholder="Rincian paket sembako, santunan tunai, atau kebutuhan yang dibagikan..."
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingSalur}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSubmittingSalur ? 'Mengesahkan Penyaluran...' : 'Sahkan & Catat Penyaluran ke Kas Koperasi'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* ================= TAB 4: RIWAYAT & UNDUH LAPORAN BERBAGI (ADMIN ONLY) ================= */}
          {activeTab === 'laporan' && isAdmin && (
            <div className="space-y-4">
              {/* Filter Wilayah / Per Anggota / Periode (Harian, Bulanan, Tahunan) */}
              <div className="p-3.5 bg-slate-800/90 rounded-2xl border border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                    <Filter className="w-4 h-4 text-sky-400" />
                    <span>Filter Laporan Berbagi (Wilayah, Anggota, Periode):</span>
                  </div>

                  {/* Periode Selector Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLaporanPeriodeTipe('harian')}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        laporanPeriodeTipe === 'harian'
                          ? 'bg-sky-500 text-slate-950 font-black'
                          : 'bg-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      Harian
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaporanPeriodeTipe('bulanan')}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        laporanPeriodeTipe === 'bulanan'
                          ? 'bg-sky-500 text-slate-950 font-black'
                          : 'bg-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      Bulanan
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaporanPeriodeTipe('tahunan')}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        laporanPeriodeTipe === 'tahunan'
                          ? 'bg-sky-500 text-slate-950 font-black'
                          : 'bg-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      Tahunan
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaporanPeriodeTipe('semua')}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        laporanPeriodeTipe === 'semua'
                          ? 'bg-sky-500 text-slate-950 font-black'
                          : 'bg-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      Semua
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Filter Wilayah */}
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-400" />
                      <span>Wilayah:</span>
                    </label>
                    <select
                      value={laporanWilayah}
                      onChange={(e) => setLaporanWilayah(e.target.value as any)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold cursor-pointer"
                    >
                      <option value="semua">Keseluruhan Wilayah</option>
                      <option value="Cengkareng">Cengkareng</option>
                      <option value="Kalideres">Kalideres</option>
                      <option value="Kembangan">Kembangan</option>
                      <option value="Kebon Jeruk">Kebon Jeruk</option>
                    </select>
                  </div>

                  {/* Filter Per Anggota */}
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3 text-sky-400" />
                      <span>Per Anggota:</span>
                    </label>
                    <select
                      value={laporanMemberId}
                      onChange={(e) => setLaporanMemberId(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold cursor-pointer"
                    >
                      <option value="semua">Keseluruhan Anggota</option>
                      {state.members
                        .filter((m) => (laporanWilayah === 'semua' ? true : m.wilayah === laporanWilayah))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nama} ({m.wilayah})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Filter Kategori Program Berbagi */}
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                      <Heart className="w-3 h-3 text-rose-400" />
                      <span>Kategori Berbagi:</span>
                    </label>
                    <select
                      value={laporanKategori}
                      onChange={(e) => setLaporanKategori(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold cursor-pointer"
                    >
                      <option value="semua">Semua Program Berbagi</option>
                      <option value="sedekah_subuh">{namaSubuh}</option>
                      <option value="sedekah_jumat">{namaJumat}</option>
                      <option value="sedekah_umum">{namaUmum}</option>
                    </select>
                  </div>
                </div>

                {/* Date Inputs based on selected period */}
                <div className="pt-1">
                  {laporanPeriodeTipe === 'harian' && (
                    <div className="max-w-xs">
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Pilih Tanggal:</label>
                      <input
                        type="date"
                        value={laporanHarianDate}
                        onChange={(e) => setLaporanHarianDate(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  )}

                  {laporanPeriodeTipe === 'bulanan' && (
                    <div className="max-w-xs">
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Pilih Bulan & Tahun:</label>
                      <input
                        type="month"
                        value={laporanBulan}
                        onChange={(e) => setLaporanBulan(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  )}

                  {laporanPeriodeTipe === 'tahunan' && (
                    <div className="max-w-xs">
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Pilih Tahun:</label>
                      <select
                        value={laporanTahun}
                        onChange={(e) => setLaporanTahun(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold cursor-pointer"
                      >
                        {[2024, 2025, 2026, 2027, 2028].map((y) => (
                          <option key={y} value={y.toString()}>
                            Tahun {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Action Buttons: Cetak PDF & Unduh Excel */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/60">
                  <span className="text-[11px] text-slate-400">
                    Ditemukan: <b>{filteredSedekah.length} Transaksi</b> ({getPeriodeLabel()} • {getWilayahLabel()})
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportPdf}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-400" />
                      <span>Unduh PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Unduh Excel</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabel Mutasi Sedekah / Berbagi */}
              <div className="border border-slate-700/80 rounded-2xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-slate-300 font-extrabold text-[10px] uppercase border-b border-slate-700">
                      <th className="py-2.5 px-3">NO</th>
                      <th className="py-2.5 px-3">TGL & JAM</th>
                      <th className="py-2.5 px-3">NAMA</th>
                      <th className="py-2.5 px-3">WILAYAH</th>
                      <th className="py-2.5 px-3">NAMA BERBAGI</th>
                      <th className="py-2.5 px-3">STATUS</th>
                      <th className="py-2.5 px-3 text-right">JUMLAH (RP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredSedekah.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 italic text-xs">
                          Belum ada riwayat mutasi sedekah pada kriteria filter ini.
                        </td>
                      </tr>
                    ) : (
                      filteredSedekah.map((e, idx) => (
                        <tr key={e.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-center">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-300 text-[11px] whitespace-nowrap">
                            {e.tanggal} <span className="text-[10px] text-slate-500">{e.jam}</span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {e.tipe === 'penerimaan' ? (
                              <span className="text-emerald-400">{e.donaturNama || 'Hamba Allah'}</span>
                            ) : (
                              <span className="text-rose-400">{e.penerimaManfaat || 'Penerima'}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                            {e.tipe === 'penerimaan' ? e.donaturWilayah || '-' : 'Penyaluran'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-800 text-slate-200 border border-slate-700">
                              {e.namaBerbagiKustom || getJenisLabel(e.jenis)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {e.tipe === 'penerimaan' ? (
                              e.status === 'approved' ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Terverifikasi
                                </span>
                              ) : e.status === 'rejected' ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                  Ditolak
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Pending
                                </span>
                              )
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                Tersalurkan
                              </span>
                            )}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold text-xs whitespace-nowrap ${
                              e.tipe === 'penerimaan' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {e.tipe === 'penerimaan' ? '+' : '-'} {formatRupiah(e.nominal)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredSedekah.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-900 border-t border-slate-700 text-xs font-bold">
                        <td colSpan={6} className="py-2.5 px-3 text-right uppercase text-slate-300">
                          Jumlah Keseluruhan (Penerimaan):
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                          {formatRupiah(
                            filteredSedekah
                              .filter((e) => e.tipe === 'penerimaan' && e.status === 'approved')
                              .reduce((s, e) => s + e.nominal, 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Pratinjau Foto Bukti Transfer */}
        {previewBukti && (
          <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0f172a] border border-slate-700 max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-3 bg-[#162035] border-b border-slate-700 flex justify-between items-center">
                <span className="text-xs font-bold text-white">Foto Bukti Transfer Sedekah</span>
                <button
                  type="button"
                  onClick={() => setPreviewBukti(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex items-center justify-center max-h-[75vh] overflow-auto">
                <img
                  src={previewBukti}
                  alt="Bukti Transfer"
                  className="max-w-full rounded-lg object-contain shadow-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5 shrink-0">
          <Heart className="w-3.5 h-3.5 text-rose-400" />
          <span>
            Setiap donasi berbagi dicatat transparan di Buku Kas Koperasi & dapat diunduh per wilayah, anggota, dan periode.
          </span>
        </div>
      </div>
    </div>
  );
};
