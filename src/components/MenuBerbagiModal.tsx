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
import { formatRupiah, createAuditLog, sortMembersDesc, canApproveByRole, getRequiredApproverLabel, applyAuthoritativeServerState, dismissBrowserNotification, findBlockingDoubleDepositClient, fetchStateFromServer } from '../lib/storage';
import { uploadToCloudStorage } from '../lib/cloudStorage';
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
  Clock,
  ShieldCheck,
  Send,
  Check,
  QrCode,
  Upload,
  Eye,
  MapPin,
  Users,
  CheckSquare,
  XCircle,
  Download,
  History,
  Wallet,
  Lock,
} from 'lucide-react';

interface MenuBerbagiModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentMember?: MemberUser;
  currentAdmin?: AdminUser;
  initialTab?: 'berbagi' | 'konfirmasi' | 'salurkan' | 'laporan';
  onBackToDashboard?: () => void;
}

export const MenuBerbagiModal: React.FC<MenuBerbagiModalProps> = ({
  isOpen,
  onClose,
  state,
  updateState,
  currentMember,
  currentAdmin,
  initialTab,
  onBackToDashboard,
}) => {
  const isAdmin = !!currentAdmin;

  // Nama berbagi dari setting admin (dapat diubah oleh admin write, approval, super admin)
  const namaSubuh = state.pengaturanBerbagi?.namaSubuh || 'Sedekah Subuh';
  const namaJumat = state.pengaturanBerbagi?.namaJumat || 'Sedekah Jumat';
  const rawUmumName = state.pengaturanBerbagi?.namaUmum || 'Sedekah Umum';
  const namaUmum = rawUmumName === 'Sedekah' ? 'Sedekah Umum' : rawUmumName;
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

  // Active Tab - Khusus Admin: Laporan, Salurkan, Konfirmasi (Kirim Berbagi DITIADAKAN pada Admin)
  // Khusus Anggota: HANYA Donasi dan Riwayat Donasi Saya (Laporan & Penyaluran DITIADAKAN pada Anggota)
  const [activeTab, setActiveTab] = useState<'berbagi' | 'riwayat_saya' | 'konfirmasi' | 'salurkan' | 'laporan'>(() => {
    if (isAdmin) {
      if (initialTab && initialTab !== 'berbagi' && (initialTab as any) !== 'riwayat_saya') return initialTab;
      return pendingSedekahList.length > 0 ? 'konfirmasi' : 'laporan';
    }
    return 'berbagi';
  });

  // Guard ketat: Admin TIDAK BISA mengakses donasi / riwayat donasi anggota, dan Anggota TIDAK BISA mengakses laporan & penyaluran
  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'berbagi' || activeTab === 'riwayat_saya') {
        setActiveTab(pendingSedekahList.length > 0 ? 'konfirmasi' : 'laporan');
      }
    } else {
      if (activeTab !== 'berbagi' && activeTab !== 'riwayat_saya') {
        setActiveTab('berbagi');
      }
    }
  }, [isAdmin, activeTab, pendingSedekahList.length]);

  // Riwayat Donasi Khusus Anggota yang Sedang Login
  const memberDonasiList = currentMember
    ? allSedekahList.filter(
        (e) =>
          e.donaturMemberId === currentMember.id ||
          (e.donaturNama && currentMember.nama && e.donaturNama.trim().toLowerCase() === currentMember.nama.trim().toLowerCase()) ||
          (currentMember.nomorAnggota && e.donaturNomorAnggota === currentMember.nomorAnggota)
      )
    : [];
  const myPendingSedekahCount = memberDonasiList.filter((e) => e.status === 'pending').length;
  const myApprovedSedekahTotal = memberDonasiList
    .filter((e) => e.status === 'approved')
    .reduce((s, e) => s + e.nominal, 0);

  const [riwayatFilterStatus, setRiwayatFilterStatus] = useState<'semua' | 'pending' | 'approved' | 'rejected'>('semua');
  const filteredMemberDonasi = memberDonasiList.filter((e) => {
    if (riwayatFilterStatus === 'semua') return true;
    return e.status === riwayatFilterStatus;
  });

  // ================= STATE ANGGOTA / DONASI =================
  const [selectedJenis, setSelectedJenis] = useState<JenisSedekahBerbagi>('sedekah_subuh');
  // User Req: hapuskan nominal angka berbagi hanya input nominal manual
  const [customNominal, setCustomNominal] = useState<string>('');
  const [sumberDana, setSumberDana] = useState<'qris' | 'tabungan_umum'>('qris');
  const [pinTftu, setPinTftu] = useState<string>('');
  const [tftuError, setTftuError] = useState<string>('');
  const [doaPesan, setDoaPesan] = useState<string>('');
  const [buktiTransferUrl, setBuktiTransferUrl] = useState<string>('');
  const [isSubmittingDonasi, setIsSubmittingDonasi] = useState(false);
  const [donasiSuccessEntry, setDonasiSuccessEntry] = useState<SedekahBerbagiEntry | null>(null);
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

  // Upload Bukti Pembayaran QRIS JPG/PNG (Kompresi otomatis agar ringan & sinkron realtime)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.72);
        setBuktiTransferUrl(compressedDataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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

  // Submit Donasi Berbagi (Metode 1: QRIS wajib bukti transfer; Metode 2: Dari Tabungan Umum Anggota / TFTU)
  const handleKirimDonasi = async (e: React.FormEvent) => {
    e.preventDefault();
    setTftuError('');
    const nominal = Number(customNominal);
    if (!nominal || nominal < 1000) {
      alert('Silakan ketik nominal sedekah minimal Rp 1.000.');
      return;
    }

    const jenisLabel = getJenisLabel(selectedJenis);
    const memberNama = currentMember ? currentMember.nama : 'Donatur Hamba Allah';

    if (sumberDana === 'tabungan_umum') {
      if (!currentMember) {
        alert('Silakan masuk sebagai Anggota untuk menggunakan metode Dari Tabungan Umum Anggota.');
        return;
      }
      const saldoUmumTersedia = Number(currentMember.saldoUmum) || 0;
      if (nominal > saldoUmumTersedia) {
        setTftuError(`Saldo Tabungan Umum tidak mencukupi (Tersedia: ${formatRupiah(saldoUmumTersedia)}).`);
        return;
      }
      const validPin = String(currentMember.pinTransaksi || '123456').trim();
      if (!pinTftu || pinTftu.trim().length < 6) {
        setTftuError('Masukkan PIN Transaksi 6-digit untuk memproses pemindahan saldo Tabungan Umum.');
        return;
      }
      if (pinTftu.trim() !== validPin) {
        setTftuError('PIN Transaksi 6-digit tidak sesuai (Default: 123456 jika belum diubah).');
        return;
      }

      const confirmTftu = confirm(
        `Konfirmasi Sedekah Dari Tabungan Umum (TFTU):\n\nProgram: ${jenisLabel}\nNominal: ${formatRupiah(nominal)}\nSumber: Tabungan Umum Anggota (Buku Kas Anggota)\nTujuan: Buku Kas Koperasi (${jenisLabel})\nKeterangan Kas: TFTU Sedekah dari ${currentMember.nama}\n\nSaldo Tabungan Umum Anda di Buku Kas Anggota akan berpindah ke Buku Kas Koperasi & tercatat di Mutasi Anggota. Lanjutkan?`
      );
      if (!confirmTftu) return;

      setIsSubmittingDonasi(true);
      try {
        const entryId = `sdk-${Date.now()}`;
        let serverHandled = false;
        let successEntry: SedekahBerbagiEntry | null = null;

        try {
          const res = await fetch('/api/sedekah/tftu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: currentMember.id,
              jenis: selectedJenis,
              namaBerbagiKustom: jenisLabel,
              nominal,
              pinTransaksi: pinTftu.trim(),
              doaPesan: doaPesan.trim(),
              entryId,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (res.status >= 400 && res.status < 500) {
              setTftuError(data.error || 'Gagal memproses TFTU Sedekah.');
              setIsSubmittingDonasi(false);
              return;
            }
          } else {
            serverHandled = true;
            successEntry = data.entry;
            if (data.state) {
              await updateState(() => data.state);
            }
          }
        } catch (err) {
          console.warn('TFTU offline fallback:', err);
        }

        if (!serverHandled) {
          const now = new Date();
          const tanggal = now.toISOString().slice(0, 10);
          const jam = now.toTimeString().slice(0, 5);
          const cleanNote = doaPesan.trim();
          const kasKopId = `kas-sedekah-${entryId}`;
          const kasAngId = `kas-ang-tftu-${entryId}`;
          const txId = `tx-sdk-${entryId}`;

          const localEntry: SedekahBerbagiEntry = {
            id: entryId,
            tanggal,
            jam,
            jenis: selectedJenis,
            namaBerbagiKustom: jenisLabel,
            tipe: 'penerimaan',
            nominal,
            status: 'approved',
            donaturNama: currentMember.nama,
            donaturWilayah: currentMember.wilayah,
            donaturMemberId: currentMember.id,
            donaturRekening: currentMember.nomorRekening,
            donaturNomorAnggota: currentMember.nomorAnggota,
            keterangan: `TFTU Sedekah dari ${currentMember.nama}${cleanNote ? ` - ${cleanNote}` : ''}`,
            sumberDana: 'tabungan_umum',
            kasKoperasiId: kasKopId,
            kasAnggotaId: kasAngId,
            inputBy: `Anggota (${currentMember.nama})`,
            verifiedBy: 'Sistem TFTU Otomatis',
            verifiedAt: now.toISOString(),
            createdAt: now.toISOString(),
          };
          successEntry = localEntry;

          const localSetoran = {
            id: entryId,
            nomorReferensi: `SDK-${String(entryId).slice(-6).toUpperCase()}`,
            memberId: currentMember.id,
            memberNama: currentMember.nama,
            memberRekening: currentMember.nomorRekening,
            memberNomorAnggota: currentMember.nomorAnggota,
            memberWilayah: currentMember.wilayah,
            jenis: 'sedekah' as const,
            nominal,
            rekeningTujuan: 'Tabungan Umum Anggota (TFTU)',
            metode: 'tabungan_umum' as const,
            catatanAnggota: `TFTU Sedekah ${jenisLabel} dari ${currentMember.nama}${cleanNote ? ` - ${cleanNote}` : ''}`,
            status: 'disetujui' as const,
            verifiedBy: 'Sistem TFTU Otomatis',
            verifiedAt: now.toISOString(),
            createdAt: now.toISOString(),
          };

          await updateState((prev) => {
            const target = prev.members.find((m) => m.id === currentMember.id);
            const newUmum = Math.max(0, (Number(target?.saldoUmum) || 0) - nominal);
            const newPokok = Number(target?.saldoPokok) || 0;
            const newZakat = Number(target?.saldoZakatFitrah) || 0;
            const newQurban = Number(target?.saldoQurban) || 0;

            const updatedMembers = prev.members.map((m) =>
              m.id === currentMember.id
                ? {
                    ...m,
                    saldoUmum: newUmum,
                    totalSimpanan: newPokok + newUmum + newZakat + newQurban,
                  }
                : m
            );

            const kasAnggotaKeluar: KasEntry = {
              id: kasAngId,
              bukuKas: 'anggota',
              tanggal,
              jam,
              kategori: 'Tabungan Bebas',
              keterangan: `TFTU Sedekah ${jenisLabel} dari ${currentMember.nama}${cleanNote ? ` - ${cleanNote}` : ''}`,
              namaPenerima: currentMember.nama,
              memberId: currentMember.id,
              referensiId: entryId,
              tipe: 'keluar',
              nominal,
              saldoKasSetelah: 0,
              inputBy: currentMember.nama,
              status: 'approved',
              createdAt: now.toISOString(),
            };

            const kasKoperasiMasuk: KasEntry = {
              id: kasKopId,
              bukuKas: 'koperasi',
              tanggal,
              jam,
              kategori: jenisLabel,
              keterangan: `TFTU Sedekah dari ${currentMember.nama}${cleanNote ? ` - ${cleanNote}` : ''}`,
              namaPenerima: currentMember.nama,
              memberId: currentMember.id,
              referensiId: entryId,
              tipe: 'masuk',
              nominal,
              saldoKasSetelah: 0,
              inputBy: currentMember.nama,
              status: 'approved',
              createdAt: now.toISOString(),
            };

            const memberTx: MemberTransaction = {
              id: txId,
              memberId: currentMember.id,
              tanggal,
              jam,
              keterangan: `TFTU Sedekah ${jenisLabel} dari ${currentMember.nama}${cleanNote ? ` - ${cleanNote}` : ''}`,
              cbg: '53532',
              tipe: 'keluar',
              nominal,
              saldoSetelah: newPokok + newUmum,
              kategori: 'umum',
              referensiId: entryId,
            };

            const audit = createAuditLog(
              currentMember as any,
              'Setoran Sedekah TFTU Tabungan Umum',
              `${currentMember.nama} menyetor ${jenisLabel} senilai ${formatRupiah(nominal)} dari Tabungan Umum (Buku Kas Anggota -> Buku Kas Koperasi).`
            );

            return {
              ...prev,
              members: updatedMembers,
              memberTransactions: [memberTx, ...(prev.memberTransactions || [])],
              kasList: [kasKoperasiMasuk, kasAnggotaKeluar, ...(prev.kasList || [])],
              sedekahList: [localEntry, ...(prev.sedekahList || [])],
              setoranList: [localSetoran, ...(prev.setoranList || [])],
              auditLogs: [audit, ...(prev.auditLogs || [])],
            };
          });
        }

        if (successEntry) {
          setDonasiSuccessEntry(successEntry);
        }
        setCustomNominal('');
        setDoaPesan('');
        setPinTftu('');
      } finally {
        setIsSubmittingDonasi(false);
      }
      return;
    }

    // Metode 1: QRIS (Wajib upload bukti transfer)
    if (!buktiTransferUrl || !buktiTransferUrl.trim()) {
      alert('Foto bukti transfer / resi pembayaran QRIS wajib di-upload.');
      return;
    }

    const blockingSedekahDup = findBlockingDoubleDepositClient(
      {
        memberId: currentMember ? currentMember.id : 'donatur-umum',
        memberNama,
        memberRekening: currentMember ? currentMember.nomorRekening : '-',
        jenis: 'sedekah',
        metode: 'qris',
        nominal,
        namaBerbagiKustom: jenisLabel,
        catatanAnggota: doaPesan.trim() ? `[${jenisLabel}] ${doaPesan.trim()}` : `[${jenisLabel}] Sedekah dari ${memberNama}`,
        createdAt: new Date().toISOString(),
      },
      state.setoranList || [],
      state.members || [],
      state.deletedSetoranIds || [],
      state.deletedMemberIds || []
    );
    if (blockingSedekahDup) {
      alert(
        `Setoran ganda terdeteksi: pengajuan ${jenisLabel} sebesar ${formatRupiah(nominal)} pada tanggal hari ini sudah tercatat (${blockingSedekahDup.status === 'disetujui' ? 'Terverifikasi' : 'Menunggu Verifikasi'}). Data double tidak dimasukkan.`
      );
      return;
    }

    const confirmMsg = confirm(
      `Konfirmasi ${jenisLabel}:\nNominal: ${formatRupiah(nominal)}\nMetode: QRIS Resmi Kas Berbagi\n\nPengajuan sedekah ini akan diverifikasi Admin. Setelah disetujui, dana tercatat resmi di Buku Kas Koperasi (${jenisLabel}: Sedekah dari ${memberNama}) dan tercatat pada Mutasi Anggota. Lanjutkan?`
    );
    if (!confirmMsg) return;

    setIsSubmittingDonasi(true);
    try {
      const now = new Date();
      const tanggal = now.toISOString().slice(0, 10);
      const jam = now.toTimeString().slice(0, 5);
      const entryId = `sdk-${Date.now()}`;
      const cleanNote = doaPesan.trim();

      let finalBukti = buktiTransferUrl;
      if (finalBukti && finalBukti.startsWith('data:image')) {
        try {
          const cloudUrl = await uploadToCloudStorage(finalBukti, {
            folder: 'bukti_transfer',
            customFileName: `sdk_${currentMember?.id || 'donatur'}_${Date.now()}.jpg`,
          });
          if (cloudUrl && cloudUrl.startsWith('http')) {
            finalBukti = cloudUrl;
          }
        } catch {}
      }

      const newSedekahEntry: SedekahBerbagiEntry = {
        id: entryId,
        tanggal,
        jam,
        jenis: selectedJenis,
        namaBerbagiKustom: jenisLabel,
        tipe: 'penerimaan',
        nominal,
        status: 'pending',
        donaturNama: memberNama,
        donaturWilayah: currentMember ? currentMember.wilayah : 'Cengkareng',
        donaturMemberId: currentMember?.id,
        donaturRekening: currentMember?.nomorRekening,
        donaturNomorAnggota: currentMember?.nomorAnggota,
        ...(finalBukti ? { buktiTransferUrl: finalBukti } : {}),
        keterangan: cleanNote ? `Sedekah dari ${memberNama} - ${cleanNote}` : `Sedekah dari ${memberNama}`,
        sumberDana: 'qris',
        inputBy: currentMember ? `Anggota (${currentMember.nama})` : 'Sistem Donasi',
        createdAt: now.toISOString(),
      };

      const newSetoranEntry = {
        id: entryId,
        memberId: currentMember ? currentMember.id : 'donatur-umum',
        memberNama,
        memberRekening: currentMember ? currentMember.nomorRekening : '-',
        memberNomorAnggota: currentMember?.nomorAnggota,
        memberWilayah: currentMember?.wilayah,
        jenis: 'sedekah' as const,
        nominal,
        rekeningTujuan: 'QRIS Resmi Kas Berbagi',
        metode: 'qris' as const,
        ...(finalBukti ? { buktiTransferUrl: finalBukti } : {}),
        catatanAnggota: cleanNote ? `[${jenisLabel}] ${cleanNote}` : `[${jenisLabel}] Sedekah dari ${memberNama}`,
        status: 'pending' as const,
        createdAt: now.toISOString(),
        nomorReferensi: `SDK-${Date.now().toString().slice(-6)}`,
      };

      try {
        const submitRes = await fetch('/api/setoran/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deposit: newSetoranEntry,
            sedekahEntry: newSedekahEntry,
          }),
        });
        if (!submitRes.ok) {
          const errData = await submitRes.json().catch(() => null);
          alert(errData?.error || 'Setoran gagal diajukan karena terdeteksi data double.');
          await fetchStateFromServer(true);
          return;
        }
      } catch (err) {
        console.warn('Setoran sedekah submit notice:', err);
      }

      await updateState((prev) => {
        const dupInPrev = findBlockingDoubleDepositClient(
          { ...newSetoranEntry, namaBerbagiKustom: jenisLabel },
          prev.setoranList || [],
          prev.members || [],
          prev.deletedSetoranIds || [],
          prev.deletedMemberIds || []
        );
        if (dupInPrev) return prev;
        const audit = createAuditLog(
          currentMember || ({ nama: 'Donatur', role: 'member' } as any),
          'Pengajuan Donasi Berbagi (QRIS)',
          `${memberNama} mengajukan ${jenisLabel} senilai ${formatRupiah(nominal)} via QRIS Resmi. Status: PENDING VERIFIKASI.`
        );

        return {
          ...prev,
          sedekahList: [newSedekahEntry, ...(prev.sedekahList || []).filter((sdk) => sdk.id !== newSedekahEntry.id)],
          setoranList: [newSetoranEntry, ...(prev.setoranList || []).filter((s) => s.id !== newSetoranEntry.id)],
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

  // Konfirmasi / Setujui Donasi Berbagi (Admin Only)
  const handleApproveDonasi = async (entry: SedekahBerbagiEntry) => {
    if (!isAdmin) return;

    const rawKustom = entry.namaBerbagiKustom === 'Sedekah' ? 'Sedekah Umum' : entry.namaBerbagiKustom;
    const jenisLabel = rawKustom || getJenisLabel(entry.jenis);
    const memberNama = entry.donaturNama || 'Anggota Koperasi';
    const isTftu = entry.sumberDana === 'tabungan_umum';

    const confirmApprove = confirm(
      `Setujui & Konfirmasi Sedekah:\n\nNama: ${memberNama}\nWilayah: ${entry.donaturWilayah || '-'}\nKategori: ${jenisLabel}\nMetode: ${isTftu ? 'Tabungan Umum Anggota (TFTU)' : 'QRIS Resmi'}\nNominal: ${formatRupiah(entry.nominal)}\n\nSetelah disetujui, dana tercatat resmi di Buku Kas Koperasi (${jenisLabel}) serta tercatat di Mutasi Anggota. Lanjutkan?`
    );
    if (!confirmApprove) return;

    try {
      let verifyHandled = false;
      try {
        const res = await fetch('/api/setoran/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            depositId: entry.id,
            isApproved: true,
            adminName: currentAdmin?.nama || 'Admin',
          }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          verifyHandled = true;
          if (data?.state) {
            applyAuthoritativeServerState(data.state, true);
          }
          dismissBrowserNotification(`hws-setoran-${entry.id}`);
          window.dispatchEvent(new CustomEvent('hws:setoran_processed', { detail: { depositId: entry.id } }));
          if (data?.alreadyProcessed) {
            alert(`Donasi sedekah dari ${memberNama} sudah diproses (${data.status || 'selesai'}) sebelumnya oleh Admin ${data.verifiedBy || 'lain'}.`);
            onClose();
            onBackToDashboard?.();
            return;
          }
        }
      } catch {}

      if (!verifyHandled) {
        const now = new Date();
        const tanggal = now.toISOString().slice(0, 10);
        const jam = now.toTimeString().slice(0, 5);
        const kasKopId = entry.kasKoperasiId || `kas-sedekah-${entry.id}`;
        const kasAngId = `kas-ang-tftu-${entry.id}`;
        const txId = `tx-sdk-${entry.id}`;

        await updateState((prev) => {
          const mem = entry.donaturMemberId
            ? prev.members.find((m) => m.id === entry.donaturMemberId)
            : undefined;
          let updatedMembers = prev.members;
          const newKasEntries: KasEntry[] = [];
          const newTxEntries: MemberTransaction[] = [];

          if (isTftu && mem) {
            const newUmum = Math.max(0, (Number(mem.saldoUmum) || 0) - entry.nominal);
            const newPokok = Number(mem.saldoPokok) || 0;
            updatedMembers = prev.members.map((m) =>
              m.id === mem.id
                ? {
                    ...m,
                    saldoUmum: newUmum,
                    totalSimpanan: newPokok + newUmum + (Number(m.saldoZakatFitrah) || 0) + (Number(m.saldoQurban) || 0),
                  }
                : m
            );

            newKasEntries.push({
              id: kasAngId,
              bukuKas: 'anggota',
              tanggal,
              jam,
              kategori: 'Tabungan Bebas',
              keterangan: `TFTU Sedekah ${jenisLabel} dari ${memberNama}`,
              namaPenerima: memberNama,
              memberId: mem.id,
              referensiId: entry.id,
              tipe: 'keluar',
              nominal: entry.nominal,
              saldoKasSetelah: 0,
              inputBy: currentAdmin?.nama || 'Admin Berbagi',
              status: 'approved',
              createdAt: now.toISOString(),
            });

            const cbgSdk =
              entry.sumberDana === 'qris' ||
              entry.sumberDana === 'tabungan_umum' ||
              String(entry.inputBy || '').startsWith('Anggota') ||
              String(entry.id || '').startsWith('sdk-')
                ? '53532'
                : `KCP ${(mem.wilayah || 'CENGKARENG').toUpperCase()}`;

            newTxEntries.push({
              id: txId,
              memberId: mem.id,
              tanggal,
              jam,
              keterangan: `TFTU Sedekah ${jenisLabel} dari ${memberNama}`,
              cbg: cbgSdk,
              tipe: 'keluar',
              nominal: entry.nominal,
              saldoSetelah: newPokok + newUmum,
              kategori: 'umum',
              referensiId: entry.id,
            });
          } else if (mem) {
            const cbgSdk =
              entry.sumberDana === 'qris' ||
              entry.sumberDana === 'tabungan_umum' ||
              String(entry.inputBy || '').startsWith('Anggota') ||
              String(entry.id || '').startsWith('sdk-')
                ? '53532'
                : `KCP ${(mem.wilayah || 'CENGKARENG').toUpperCase()}`;

            newTxEntries.push({
              id: txId,
              memberId: mem.id,
              tanggal,
              jam,
              keterangan: `Sedekah ${jenisLabel} dari ${memberNama} (QRIS)`,
              cbg: cbgSdk,
              tipe: 'masuk',
              nominal: entry.nominal,
              saldoSetelah: (Number(mem.saldoPokok) || 0) + (Number(mem.saldoUmum) || 0),
              kategori: 'sedekah',
              referensiId: entry.id,
            });
          }

          newKasEntries.push({
            id: kasKopId,
            bukuKas: 'koperasi',
            tanggal,
            jam,
            kategori: jenisLabel,
            keterangan: isTftu ? `TFTU Sedekah dari ${memberNama}` : `Sedekah dari ${memberNama}`,
            namaPenerima: memberNama,
            memberId: mem?.id || entry.donaturMemberId,
            referensiId: entry.id,
            tipe: 'masuk',
            nominal: entry.nominal,
            saldoKasSetelah: 0,
            inputBy: currentAdmin?.nama || 'Admin Berbagi',
            status: 'approved',
            createdAt: now.toISOString(),
          });

          const updatedSedekahList = (prev.sedekahList || []).map((s) =>
            s.id === entry.id
              ? {
                  ...s,
                  status: 'approved' as const,
                  kasKoperasiId: kasKopId,
                  ...(isTftu ? { kasAnggotaId: kasAngId } : {}),
                  verifiedBy: currentAdmin?.nama || 'Admin',
                  verifiedAt: now.toISOString(),
                }
              : s
          );

          const updatedSetoranList = (prev.setoranList || []).map((st) =>
            st.id === entry.id
              ? {
                  ...st,
                  status: 'disetujui' as const,
                  verifiedBy: currentAdmin?.nama || 'Admin',
                  verifiedAt: now.toISOString(),
                }
              : st
          );

          const audit = createAuditLog(
            currentAdmin!,
            'Konfirmasi Donasi Berbagi',
            `Admin ${currentAdmin?.nama || 'Admin'} menyetujui ${jenisLabel} senilai ${formatRupiah(entry.nominal)} dari ${memberNama}. Tercatat di Buku Kas Koperasi & Mutasi Anggota.`
          );

          return {
            ...prev,
            members: updatedMembers,
            memberTransactions: [...newTxEntries, ...(prev.memberTransactions || [])],
            kasList: [...newKasEntries, ...(prev.kasList || [])],
            sedekahList: updatedSedekahList,
            setoranList: updatedSetoranList,
            auditLogs: [audit, ...(prev.auditLogs || [])],
          };
        });
      }

      alert(`✓ Sedekah ${jenisLabel} senilai ${formatRupiah(entry.nominal)} berhasil dikonfirmasi dan dicatat pada Buku Kas Koperasi & Mutasi Anggota!`);
      onClose();
      onBackToDashboard?.();
    } catch (err: any) {
      alert('Gagal mengonfirmasi donasi: ' + err.message);
    }
  };

  // Tolak Donasi Berbagi (Admin Only)
  const handleRejectDonasi = async (entry: SedekahBerbagiEntry) => {
    if (!isAdmin) return;
    const reason = prompt(`Masukkan alasan penolakan donasi dari ${entry.donaturNama || 'Donatur'}:`, 'Bukti pembayaran QRIS tidak valid / dana belum masuk');
    if (reason === null) return;

    let serverUpdated = false;
    try {
      const res = await fetch('/api/setoran/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depositId: entry.id,
          isApproved: false,
          adminName: currentAdmin?.nama || 'Admin',
          alasan: reason,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.state) {
          applyAuthoritativeServerState(data.state, true);
          serverUpdated = true;
        }
        dismissBrowserNotification(`hws-setoran-${entry.id}`);
        window.dispatchEvent(new CustomEvent('hws:setoran_processed', { detail: { depositId: entry.id } }));
        if (data?.alreadyProcessed) {
          alert(`Donasi sedekah dari ${entry.donaturNama || 'Donatur'} sudah diproses (${data.status || 'selesai'}) sebelumnya oleh Admin ${data.verifiedBy || 'lain'}.`);
          return;
        }
      }
    } catch {}

    if (!serverUpdated) {
      await updateState((prev) => {
        const nowIso = new Date().toISOString();
        const updatedSedekahList = (prev.sedekahList || []).map((s) =>
          s.id === entry.id
            ? {
                ...s,
                status: 'rejected' as const,
                rejectionReason: reason,
                verifiedBy: currentAdmin?.nama || 'Admin',
                verifiedAt: nowIso,
              }
            : s
        );

        const updatedSetoranList = (prev.setoranList || []).map((st) =>
          st.id === entry.id
            ? {
                ...st,
                status: 'ditolak' as const,
                catatanAdmin: reason,
                verifiedBy: currentAdmin?.nama || 'Admin',
                verifiedAt: nowIso,
              }
            : st
        );

        const audit = createAuditLog(
          currentAdmin!,
          'Tolak Donasi Berbagi',
          `Admin ${currentAdmin?.nama || 'Admin'} menolak donasi senilai ${formatRupiah(entry.nominal)} dari ${entry.donaturNama || 'Donatur'}. Alasan: ${reason}`
        );

        return {
          ...prev,
          sedekahList: updatedSedekahList,
          setoranList: updatedSetoranList,
          auditLogs: [audit, ...(prev.auditLogs || [])],
        };
      });
    }

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
    const isDirectApprove = isSuperAdmin;
    const requiredApprover = getRequiredApproverLabel(currentAdmin?.role);

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
        requestedByRole: currentAdmin?.role,
        verifiedBy: isDirectApprove ? (currentAdmin?.nama || 'Super Admin') : undefined,
        verifiedAt: isDirectApprove ? now.toISOString() : undefined,
        createdAt: now.toISOString(),
      };

      // Jika langsung disetujui oleh Super Admin: catat ke Buku Kas Koperasi
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
            requestedBy: currentAdmin?.nama,
            requestedByRole: currentAdmin?.role,
            approvedBy: currentAdmin?.nama,
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
            ? `${currentAdmin?.nama || 'Super Admin'} menyetujui langsung penyaluran ${jenisLabel} senilai ${formatRupiah(nominal)} kepada "${salurPenerima.trim()}". Tercatat di Buku Kas Koperasi.`
            : `${currentAdmin?.nama || 'Admin'} (${currentAdmin?.role}) mengajukan penyaluran ${jenisLabel} senilai ${formatRupiah(nominal)} kepada "${salurPenerima.trim()}". Menunggu persetujuan ${requiredApprover}.`
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
        alert(`✓ Pengajuan penyaluran ${jenisLabel} senilai ${formatRupiah(nominal)} berhasil diajukan! Menunggu persetujuan dari ${requiredApprover}.`);
      }

      setSalurNominal('');
      setSalurPenerima('');
      setSalurKeterangan('');
      setActiveTab('salurkan');
    } finally {
      setIsSubmittingSalur(false);
    }
  };

  // Otorisasi / Approval Penyaluran Sedekah Berjenjang
  const handleApprovePenyaluran = async (entry: SedekahBerbagiEntry) => {
    const reqRole = entry.requestedByRole || 'admin_write';
    if (!canApproveByRole(reqRole, currentAdmin?.role)) {
      alert(`Akses Ditolak: Pengajuan penyaluran ini wajib disetujui oleh ${getRequiredApproverLabel(reqRole)}.`);
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
        inputBy: entry.inputBy || currentAdmin?.nama || 'Admin',
        requestedBy: entry.inputBy,
        requestedByRole: entry.requestedByRole,
        approvedBy: currentAdmin?.nama,
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
          `${currentAdmin?.nama} (${currentAdmin?.role}) menyetujui pengajuan penyaluran ${jenisLabel} senilai ${formatRupiah(
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

  // Tolak Penyaluran Sedekah Berjenjang
  const handleRejectPenyaluran = async (entry: SedekahBerbagiEntry) => {
    const reqRole = entry.requestedByRole || 'admin_write';
    if (!canApproveByRole(reqRole, currentAdmin?.role)) {
      alert(`Akses Ditolak: Pengajuan penyaluran ini hanya dapat ditolak/disetujui oleh ${getRequiredApproverLabel(reqRole)}.`);
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
        `${currentAdmin?.nama} (${currentAdmin?.role}) menolak pengajuan penyaluran senilai ${formatRupiah(entry.nominal)} kepada "${entry.penerimaManfaat}". Alasan: ${reason}`
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
          /* Tab Navigation Khusus Anggota: HANYA Donasi dan Riwayat Saya (Laporan & Penyaluran Ditiadakan) */
          <div className="flex bg-[#162035] p-1 rounded-2xl border border-rose-500/30 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('berbagi');
                setDonasiSuccessEntry(null);
              }}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'berbagi'
                  ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5 fill-current" />
              <span>Kirim Donasi / Berbagi</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('riwayat_saya')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
                activeTab === 'riwayat_saya'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat Donasi Saya</span>
              {myPendingSedekahCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse">
                  {myPendingSedekahCount}
                </span>
              )}
            </button>
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
                  • Tercatat di Buku Kas Koperasi & Mutasi Anggota • Berkurang saat penyaluran resmi disahkan pengurus
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

              {/* Metode Pembayaran Sedekah: 1. QRIS (Wajib Bukti) atau 2. Dari Tabungan Umum Anggota (TFTU) */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-300">
                  3. Pilih Metode Setoran Sedekah:
                </label>

                <div className={`grid grid-cols-1 ${currentMember ? 'sm:grid-cols-2' : ''} gap-2.5`}>
                  {/* Metode 1: QRIS */}
                  <button
                    type="button"
                    onClick={() => {
                      setSumberDana('qris');
                      setTftuError('');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      sumberDana === 'qris'
                        ? 'bg-rose-950/50 border-rose-500 ring-2 ring-rose-500/40 shadow'
                        : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                          <QrCode className="w-4 h-4" />
                        </div>
                        <div className="text-xs font-extrabold text-white">1. QRIS Resmi</div>
                      </div>
                      {sumberDana === 'qris' && (
                        <span className="text-[10px] text-rose-300 font-black">✓ Dipilih</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1.5 leading-snug">
                      Wajib upload bukti transfer • Tercatat di Buku Kas Koperasi & Mutasi Anggota
                    </div>
                  </button>

                  {/* Metode 2: Dari Tabungan Umum Anggota (TFTU) */}
                  {currentMember && (
                    <button
                      type="button"
                      onClick={() => {
                        setSumberDana('tabungan_umum');
                        setTftuError('');
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        sumberDana === 'tabungan_umum'
                          ? 'bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/40 shadow'
                          : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <Wallet className="w-4 h-4" />
                          </div>
                          <div className="text-xs font-extrabold text-white">2. Tabungan Umum (TFTU)</div>
                        </div>
                        {sumberDana === 'tabungan_umum' && (
                          <span className="text-[10px] text-emerald-300 font-black">✓ Dipilih</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-1.5 leading-snug">
                        Saldo Tabungan Umum: <b className="text-emerald-400 font-mono">{formatRupiah(currentMember.saldoUmum)}</b> • Pindah dari Buku Kas Anggota ke Buku Kas Koperasi
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {sumberDana === 'qris' ? (
                <>
                  {/* TAMPILKAN QRIS KAS BERBAGI RESMI */}
                  <div className="p-3.5 bg-gradient-to-br from-slate-900 via-[#131d35] to-slate-900 border border-rose-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white px-2 py-0.5 rounded-lg border border-slate-300 shadow-sm">
                          <span className="text-red-600 font-black tracking-tighter text-xs">QRIS</span>
                          <span className="text-[8px] text-slate-700 font-bold ml-1 border-l border-slate-300 pl-1">NASIONAL</span>
                        </div>
                        <span className="text-xs font-extrabold text-white">
                          QRIS Resmi Kas Berbagi Koperasi
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-rose-500/25 text-rose-300 font-extrabold rounded-full border border-rose-500/40">
                        Wajib Bukti Transfer
                      </span>
                    </div>

                    {/* QRIS Code Preview Box */}
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
                  </div>

                  {/* Upload Foto Bukti Resi QRIS (Wajib) */}
                  <div className="bg-slate-850 p-3 rounded-2xl border border-dashed border-slate-700 space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span>Foto Bukti Transfer / Resi QRIS:</span>
                        <span className="text-[10px] text-rose-400 font-extrabold">* Wajib Di-upload</span>
                      </span>
                      {buktiTransferUrl ? (
                        <span className="text-emerald-400 text-[10px] font-bold">✓ Foto terlampir</span>
                      ) : (
                        <span className="text-amber-400 text-[10px]">Format JPG / PNG</span>
                      )}
                    </label>
                    <div className="flex items-center gap-3">
                      <label className={`flex-1 p-2.5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                        buktiTransferUrl
                          ? 'bg-slate-800 border border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300'
                      }`}>
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>{buktiTransferUrl ? 'Ganti Foto Bukti Transfer QRIS' : 'Pilih File Foto Bukti Transfer QRIS *'}</span>
                        <input
                          type="file"
                          required
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
                </>
              ) : (
                /* Metode 2: Dari Tabungan Umum Anggota (TFTU) */
                <div className="p-3.5 bg-gradient-to-br from-emerald-950/50 via-[#131d35] to-slate-900 border border-emerald-500/40 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-extrabold text-white">
                        Mekanisme TFTU Dari Tabungan Umum Anggota
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded-full border border-emerald-500/40">
                      Tanpa Upload Bukti
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-700">
                      <span className="text-[10px] text-slate-400 block">Saldo Tabungan Umum Anda (Buku Kas Anggota):</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">
                        {formatRupiah(currentMember?.saldoUmum || 0)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-700">
                      <span className="text-[10px] text-slate-400 block">Tujuan Pemindahan Kas:</span>
                      <span className="font-bold text-amber-300 text-xs">
                        Buku Kas Koperasi • {getJenisLabel(selectedJenis)}
                      </span>
                      <div className="text-[10px] text-slate-400 truncate">
                        Ket: TFTU Sedekah dari {currentMember?.nama}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Masukkan PIN Transaksi 6-Digit Anggota *</span>
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={pinTftu}
                      onChange={(e) => {
                        setPinTftu(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setTftuError('');
                      }}
                      placeholder="•••••• (Default: 123456 jika belum diubah)"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl text-sm font-mono font-bold text-white tracking-widest focus:outline-none"
                    />
                  </div>

                  {tftuError && (
                    <div className="p-2.5 bg-red-950/70 border border-red-500/40 rounded-xl text-xs text-red-300 font-semibold">
                      {tftuError}
                    </div>
                  )}
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

              {/* Tombol Kirim */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={
                    isSubmittingDonasi ||
                    !customNominal ||
                    Number(customNominal) < 1000 ||
                    (sumberDana === 'qris' && !buktiTransferUrl) ||
                    (sumberDana === 'tabungan_umum' &&
                      (!currentMember ||
                        Number(customNominal) > (currentMember?.saldoUmum || 0) ||
                        pinTftu.trim().length < 6))
                  }
                  className="w-full py-3 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 hover:from-rose-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-white" />
                  <span>
                    {isSubmittingDonasi
                      ? 'Memproses Setoran Sedekah...'
                      : sumberDana === 'qris' && !buktiTransferUrl
                      ? '⚠️ Upload Bukti Transfer QRIS Dahulu'
                      : sumberDana === 'tabungan_umum' && currentMember && Number(customNominal) > (currentMember.saldoUmum || 0)
                      ? '⚠️ Saldo Tabungan Umum Tidak Mencukupi'
                      : sumberDana === 'tabungan_umum'
                      ? `Bismillah, TFTU Sedekah ${formatRupiah(Number(customNominal) || 0)} Dari Tabungan Umum`
                      : `Bismillah, Kirim Sedekah QRIS ${formatRupiah(Number(customNominal) || 0)}`}
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
                <h4 className="text-base font-extrabold text-white">
                  {donasiSuccessEntry.status === 'approved'
                    ? 'Alhamdulillah, Sedekah TFTU Berhasil Diproses!'
                    : 'Alhamdulillah, Pengajuan Sedekah QRIS Terkirim!'}
                </h4>
                <p className="text-xs text-emerald-300 mt-1">
                  {donasiSuccessEntry.status === 'approved'
                    ? 'Saldo Tabungan Umum dari Buku Kas Anggota telah berpindah ke Buku Kas Koperasi dan tercatat pada Mutasi Anggota Anda.'
                    : 'Sedekah QRIS Anda menunggu konfirmasi Admin. Setelah disetujui, tercatat di Buku Kas Koperasi & Mutasi Anggota.'}
                </p>
              </div>

              <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-700 text-left text-xs space-y-1.5 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-400">Kategori:</span>
                  <span className="font-bold text-white">
                    {donasiSuccessEntry.namaBerbagiKustom || getJenisLabel(donasiSuccessEntry.jenis)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Metode:</span>
                  <span className="font-bold text-sky-300">
                    {donasiSuccessEntry.sumberDana === 'tabungan_umum' ? 'Tabungan Umum (TFTU)' : 'QRIS Resmi'}
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
                  {donasiSuccessEntry.status === 'approved' ? (
                    <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 text-[10px]">
                      Berhasil (Tercatat di Kas & Mutasi)
                    </span>
                  ) : (
                    <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[10px]">
                      Pending Konfirmasi Admin
                    </span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tanggal:</span>
                  <span className="font-mono text-slate-300">{donasiSuccessEntry.tanggal} {donasiSuccessEntry.jam}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setDonasiSuccessEntry(null)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl cursor-pointer transition-colors"
                >
                  Kembali / Donasi Lagi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDonasiSuccessEntry(null);
                    setActiveTab('riwayat_saya');
                  }}
                  className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Lihat Riwayat Donasi Saya</span>
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

          {/* ================= TAB KHUSUS ANGGOTA: RIWAYAT DONASI SAYA ================= */}
          {!isAdmin && activeTab === 'riwayat_saya' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Header Box Riwayat */}
              <div className="p-3.5 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 rounded-2xl border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">
                      Riwayat Donasi Berbagi Saya
                    </h4>
                    <p className="text-[11px] text-amber-300/90">
                      Total {memberDonasiList.length} transaksi donasi tercatat untuk akun Anda ({currentMember?.nama || 'Anggota'})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('berbagi')}
                    className="py-1.5 px-3 bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-[11px] rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span>+ Donasi Baru</span>
                  </button>
                </div>
              </div>

              {/* Ringkasan Akumulasi Donasi Anggota */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold block">Total Donasi Terverifikasi</span>
                  <div className="text-sm font-black text-emerald-400 mt-0.5 font-mono">
                    {formatRupiah(myApprovedSedekahTotal)}
                  </div>
                  <span className="text-[9px] text-emerald-400/80">Resmi masuk ke Kas Koperasi</span>
                </div>

                <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold block">Menunggu Konfirmasi</span>
                  <div className="text-sm font-black text-amber-400 mt-0.5 font-mono">
                    {myPendingSedekahCount} Transaksi
                  </div>
                  <span className="text-[9px] text-amber-300/80">Sedang ditinjau oleh Admin</span>
                </div>

                <div className="p-3 bg-slate-900/90 rounded-2xl border border-rose-500/30 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-rose-300 font-semibold block">Saldo Siap Disalurkan</span>
                  <div className="text-sm font-black text-white mt-0.5 font-mono">
                    {formatRupiah(memberSaldoSedekah)}
                  </div>
                  <span className="text-[9px] text-rose-300/80">Alokasi berkah sosial Anda</span>
                </div>
              </div>

              {/* Filter Status Donasi */}
              <div className="flex items-center gap-1.5 bg-[#162035] p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setRiwayatFilterStatus('semua')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                    riwayatFilterStatus === 'semua'
                      ? 'bg-slate-700 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Semua ({memberDonasiList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRiwayatFilterStatus('pending')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                    riwayatFilterStatus === 'pending'
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : 'text-amber-400/80 hover:text-amber-300'
                  }`}
                >
                  Pending ({myPendingSedekahCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRiwayatFilterStatus('approved')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                    riwayatFilterStatus === 'approved'
                      ? 'bg-emerald-500 text-slate-950 font-black shadow'
                      : 'text-emerald-400/80 hover:text-emerald-300'
                  }`}
                >
                  Terverifikasi ({memberDonasiList.filter((e) => e.status === 'approved').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRiwayatFilterStatus('rejected')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                    riwayatFilterStatus === 'rejected'
                      ? 'bg-red-500 text-white font-black shadow'
                      : 'text-red-400/80 hover:text-red-300'
                  }`}
                >
                  Ditolak ({memberDonasiList.filter((e) => e.status === 'rejected').length})
                </button>
              </div>

              {/* Daftar Riwayat Donasi */}
              {filteredMemberDonasi.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs space-y-2">
                  <div className="text-2xl">🤲</div>
                  <div className="font-bold text-white">
                    {riwayatFilterStatus === 'semua'
                      ? 'Belum ada riwayat donasi berbagi yang diajukan.'
                      : `Tidak ada riwayat donasi dengan status "${riwayatFilterStatus}".`}
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Kirimkan donasi sedekah subuh, jumat berkah, atau sedekah umum secara mudah melalui scan QRIS resmi koperasi.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('berbagi')}
                      className="py-2 px-4 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all"
                    >
                      Mulai Donasi Sekarang
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMemberDonasi.map((entry, idx) => (
                    <div
                      key={entry.id || idx}
                      className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-extrabold text-[10px] border border-rose-500/30">
                            {entry.namaBerbagiKustom || getJenisLabel(entry.jenis)}
                          </span>
                          {entry.status === 'approved' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Terverifikasi (Masuk Kas)
                            </span>
                          ) : entry.status === 'rejected' ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold text-[10px] border border-red-500/30 flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              Ditolak
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Pending Konfirmasi Admin
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span className="font-mono text-slate-300">{entry.tanggal} {entry.jam}</span>
                          <span>•</span>
                          <span>Metode: <b className="text-slate-200">{entry.sumberDana === 'tabungan_umum' ? 'Tabungan Umum (TFTU)' : 'QRIS Resmi'}</b></span>
                        </div>

                        {entry.keterangan && (
                          <div className="text-[11px] text-slate-300 italic bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50">
                            "{entry.keterangan}"
                          </div>
                        )}

                        {entry.catatanAdmin && (
                          <div className="text-[11px] text-amber-300 bg-amber-950/40 p-1.5 rounded-lg border border-amber-500/30">
                            Catatan Pengurus: {entry.catatanAdmin}
                          </div>
                        )}
                      </div>

                      <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                        <div className="font-mono font-black text-emerald-400 text-sm sm:text-base">
                          {formatRupiah(entry.nominal)}
                        </div>
                        {entry.buktiTransferUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewBukti(entry.buktiTransferUrl!)}
                            className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 rounded-lg text-[10px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Lihat Bukti</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Tanpa lampiran foto</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                      Periksa bukti scan QRIS anggota, konfirmasi donasi untuk dicatat resmi pada Buku Kas Koperasi.
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
                          {entry.tanggal} {entry.jam} • Metode: <b className="text-slate-200">{entry.sumberDana === 'tabungan_umum' ? 'Tabungan Umum (TFTU)' : 'QRIS Resmi'}</b>
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
                            <span>Lihat Foto Bukti Resi QRIS</span>
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
            <div className="space-y-4">
              {pendingSalurList.length > 0 && (
                <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-2xl space-y-2.5">
                  <div className="text-xs font-black text-amber-300 flex items-center justify-between">
                    <span>Antrean Persetujuan Penyaluran Sedekah ({pendingSalurList.length})</span>
                    <span className="text-[10px] font-bold text-amber-200/80">Hierarki Approval</span>
                  </div>
                  <div className="space-y-2">
                    {pendingSalurList.map((entry) => {
                      const canAct = canApproveByRole(entry.requestedByRole || 'admin_write', currentAdmin?.role);
                      return (
                        <div key={entry.id} className="p-3 bg-slate-900/90 rounded-xl border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="space-y-0.5">
                            <div className="font-bold text-white">
                              {entry.namaBerbagiKustom || getJenisLabel(entry.jenis)} • {formatRupiah(entry.nominal)}
                            </div>
                            <div className="text-[11px] text-slate-300">
                              Penerima: <b>{entry.penerimaManfaat || '-'}</b> • {entry.tanggal}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Diajukan oleh: <b className="text-amber-300">{entry.inputBy || 'Admin'}</b> ({entry.requestedByRole || 'admin_write'})
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {canAct ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRejectPenyaluran(entry)}
                                  className="px-2.5 py-1.5 bg-red-950/70 hover:bg-red-900 text-red-300 font-bold rounded-lg text-[11px] cursor-pointer"
                                >
                                  Tolak
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApprovePenyaluran(entry)}
                                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-[11px] cursor-pointer"
                                >
                                  Setujui & Catat Kas
                                </button>
                              </>
                            ) : (
                              <span className="px-2.5 py-1 bg-slate-800 text-amber-300 rounded-lg text-[10px] font-bold border border-amber-500/30">
                                Menunggu {getRequiredApproverLabel(entry.requestedByRole)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <form onSubmit={handleKirimPenyaluran} className="space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-amber-300">
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>
                    {currentAdmin?.role === 'super_admin'
                      ? 'Otorisasi Super Admin: Penyaluran dana sedekah langsung disahkan dan dicatat pada Buku Kas Koperasi.'
                      : `Otorisasi Berjenjang: Pengajuan penyaluran Anda akan diteruskan untuk persetujuan ${getRequiredApproverLabel(currentAdmin?.role)}.`}
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
                      {isSubmittingSalur
                        ? 'Memproses Penyaluran...'
                        : currentAdmin?.role === 'super_admin'
                        ? 'Sahkan & Catat Penyaluran ke Kas Koperasi'
                        : `Ajukan Penyaluran (Persetujuan ${getRequiredApproverLabel(currentAdmin?.role)})`}
                    </span>
                  </button>
                </div>
              </form>
            </div>
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
                      {sortMembersDesc(state.members)
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

        {/* Modal Pratinjau Foto Bukti Resi QRIS */}
        {previewBukti && (
          <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0f172a] border border-slate-700 max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-3 bg-[#162035] border-b border-slate-700 flex justify-between items-center">
                <span className="text-xs font-bold text-white">Foto Bukti Resi QRIS Sedekah</span>
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
                  alt="Bukti Resi QRIS Sedekah"
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
