import React, { useState, useEffect } from 'react';
import {
  AppState,
  AdminUser,
  KasEntry,
  MemberTransaction,
} from '../types';
import { formatRupiah, createAuditLog, getUnifiedSedekahList } from '../lib/storage';
import {
  downloadExcelCsv,
  printDocumentHtml,
  printTandaTerimaKas,
  exportBukuKasPdf,
  exportBukuKasExcel,
} from '../lib/exportPdf';
import {
  BookOpen,
  Building,
  Users,
  PlusCircle,
  FileDown,
  Printer,
  Calendar,
  CheckCircle,
  XCircle,
  Trash2,
  Edit,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldAlert,
  Receipt,
  FileText,
  X,
  Clock,
  ArrowLeftRight,
} from 'lucide-react';

interface BukuKasViewProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin: AdminUser;
}

export const BukuKasView: React.FC<BukuKasViewProps> = ({
  state,
  updateState,
  currentAdmin,
}) => {
  const [activeKasTab, setActiveKasTab] = useState<'koperasi' | 'anggota' | 'neraca'>('koperasi');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterKategori, setFilterKategori] = useState('semua');

  // Input Kas Koperasi Form State (Req 1: Tanggal, Jumlah, Keterangan, Nama Penerima)
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [formTipe, setFormTipe] = useState<'masuk' | 'keluar'>('keluar');
  const [formKategori, setFormKategori] = useState('');
  const [formNominal, setFormNominal] = useState('');
  const [formNamaPenerima, setFormNamaPenerima] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);

  // Modal Detail & Cetak Tanda Terima Kas
  const [selectedReceiptKas, setSelectedReceiptKas] = useState<KasEntry | null>(null);

  // Edit Buku Kas State (Req 6: Buku kas dapat di-edit dan di-hapus)
  const [editingKasEntry, setEditingKasEntry] = useState<KasEntry | null>(null);
  const [editTanggal, setEditTanggal] = useState('');
  const [editBukuKas, setEditBukuKas] = useState<'anggota' | 'koperasi'>('koperasi');
  const [editKategori, setEditKategori] = useState('');
  const [editTipe, setEditTipe] = useState<'masuk' | 'keluar'>('masuk');
  const [editNominal, setEditNominal] = useState('');
  const [editKeterangan, setEditKeterangan] = useState('');
  const [editNamaPenerima, setEditNamaPenerima] = useState('');

  // Tambah Kategori Baru State
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatTipe, setNewCatTipe] = useState<'pemasukan' | 'pengeluaran'>('pengeluaran');
  const [newCatName, setNewCatName] = useState('');

  // Transfer Antar Buku Kas State (Req 2: Kas Anggota ⇄ Kas Koperasi)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [tfDariKas, setTfDariKas] = useState<'anggota' | 'koperasi'>('anggota');
  const [tfKeKas, setTfKeKas] = useState<'anggota' | 'koperasi'>('koperasi');
  const [tfJenis, setTfJenis] = useState<'pinjaman_kas' | 'pengembalian_kas'>('pinjaman_kas');
  const [tfNominal, setTfNominal] = useState('');
  const [tfTanggal, setTfTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [tfKeterangan, setTfKeterangan] = useState('');
  const [tfNamaPetugas, setTfNamaPetugas] = useState('');

  // Device Back Button: Menutup menu / modal yang telah dibuka (Req 3)
  useEffect(() => {
    const handleDeviceBack = (e: Event) => {
      if (selectedReceiptKas) {
        e.preventDefault();
        setSelectedReceiptKas(null);
      } else if (editingKasEntry) {
        e.preventDefault();
        setEditingKasEntry(null);
      } else if (isInputModalOpen) {
        e.preventDefault();
        setIsInputModalOpen(false);
      } else if (isAddCatModalOpen) {
        e.preventDefault();
        setIsAddCatModalOpen(false);
      } else if (isTransferModalOpen) {
        e.preventDefault();
        setIsTransferModalOpen(false);
      }
    };
    window.addEventListener('app:back_press', handleDeviceBack);
    return () => window.removeEventListener('app:back_press', handleDeviceBack);
  }, [selectedReceiptKas, editingKasEntry, isInputModalOpen, isAddCatModalOpen, isTransferModalOpen]);

  // Check roles
  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const isPembukuan = currentAdmin.role === 'admin_pembukuan';
  const isWriter = currentAdmin.role === 'admin_write';
  const isApproval = currentAdmin.role === 'admin_approval' || currentAdmin.role === 'admin_kelola';
  const isLaporan = currentAdmin.role === 'admin_laporan';

  // Can approve / direct modify: Super Admin or Admin Approval / Admin Pembukuan
  const canDirectModify = isSuperAdmin || isApproval || isPembukuan;
  // Can input documents: Super Admin, Admin Write, Admin Approval
  const canInput = isSuperAdmin || isWriter || isApproval || isPembukuan;
  // Can edit: Super Admin, Admin Write (dengan approval), atau Admin Approval
  const canEdit = isSuperAdmin || isWriter || isApproval || isPembukuan;
  // Can delete: Super Admin, Admin Write (dengan approval), atau Admin Approval
  const canDelete = isSuperAdmin || isWriter || isApproval || isPembukuan;

  // Pending approval list for Buku Kas (Input, Edit, Hapus)
  const pendingKasApprovals = state.kasList.filter((k) => k.status === 'pending_approval');

  // Calculate Running Saldo Buku Kas Anggota & build running balance map per transaction
  const runningSaldoMap = new Map<string, number>();

  let saldoKasAnggota = 0;
  const kasAnggotaList = state.kasList
    .filter((k) => k.bukuKas === 'anggota' && k.status === 'approved')
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || a.tanggal).getTime() || 0;
      const timeB = new Date(b.createdAt || b.tanggal).getTime() || 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });

  kasAnggotaList.forEach((k) => {
    if (k.tipe === 'masuk') saldoKasAnggota += k.nominal;
    else saldoKasAnggota -= k.nominal;
    runningSaldoMap.set(k.id, saldoKasAnggota);
  });

  // Calculate Running Saldo Buku Kas Koperasi & build running balance map
  let saldoKasKoperasi = 0;
  const kasKoperasiList = state.kasList
    .filter((k) => k.bukuKas === 'koperasi' && k.status === 'approved')
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || a.tanggal).getTime() || 0;
      const timeB = new Date(b.createdAt || b.tanggal).getTime() || 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });

  kasKoperasiList.forEach((k) => {
    if (k.tipe === 'masuk') saldoKasKoperasi += k.nominal;
    else saldoKasKoperasi -= k.nominal;
    runningSaldoMap.set(k.id, saldoKasKoperasi);
  });

  // User Formula: Saldo kas berjalan = Total simpanan pokok + Total tabungan umum + Dana Zakat dan Qurban + Saldo Sedekah Koperasi
  const allSedekah = getUnifiedSedekahList(state);
  const totalSedekahMasuk = allSedekah
    .filter((e) => e.tipe === 'penerimaan' && e.status === 'approved')
    .reduce((acc, e) => acc + e.nominal, 0);
  const totalSedekahSalur = allSedekah
    .filter((e) => e.tipe === 'penyaluran' && e.status === 'approved')
    .reduce((acc, e) => acc + e.nominal, 0);
  const saldoSedekahKoperasi = Math.max(0, totalSedekahMasuk - totalSedekahSalur);

  const totalSimpananPokok = state.members.reduce((acc, m) => acc + (m.saldoPokok || 0), 0);
  const totalTabunganUmum = state.members.reduce((acc, m) => acc + (m.saldoUmum || 0), 0);
  const totalDanaZakatQurban = state.members.reduce(
    (acc, m) => acc + (m.saldoZakatFitrah || 0) + (m.saldoQurban || 0),
    0
  );
  const saldoKasBerjalan = totalSimpananPokok + totalTabunganUmum + totalDanaZakatQurban + saldoSedekahKoperasi;

  // Filter current displayed list with urutan kas yang terakhir masuk ada di atas sesuai penginputan
  const currentList = state.kasList
    .filter((k) => {
      if (activeKasTab !== 'neraca' && k.bukuKas !== activeKasTab) return false;
      if (filterStartDate && k.tanggal < filterStartDate) return false;
      if (filterEndDate && k.tanggal > filterEndDate) return false;
      if (filterKategori !== 'semua' && k.kategori !== filterKategori) return false;
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || a.tanggal).getTime() || 0;
      const timeB = new Date(b.createdAt || b.tanggal).getTime() || 0;
      if (timeA !== timeB) return timeB - timeA; // Terakhir masuk ada di atas
      return b.id.localeCompare(a.id);
    });

  // Handle Input Transaksi Kas Koperasi (Req 1: Admin write dapat menulis, admin approval yang menyetujui)
  const handleInputKasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInput) {
      alert('Admin Approval / Admin Laporan tidak dapat menginput transaksi kas koperasi. Admin Write yang menulis dokumen, Admin Approval yang menyetujui.');
      return;
    }

    const nominal = Number(formNominal);
    if (!nominal || nominal <= 0) {
      alert('Nominal harus lebih dari 0.');
      return;
    }

    // Check no-minus rule: requirement 47 "Kedua Buku kas tidak bisa minus"
    if (formTipe === 'keluar' && nominal > saldoKasKoperasi) {
      alert(`Transaksi ditolak: Saldo Kas Koperasi tidak mencukupi (Tersedia: ${formatRupiah(saldoKasKoperasi)})`);
      return;
    }

    const newKas: KasEntry = {
      id: `kas-kop-${Date.now()}`,
      bukuKas: 'koperasi',
      tanggal: formTanggal,
      kategori: formKategori || (formTipe === 'masuk' ? 'Pemasukan Lainnya' : 'Pengeluaran Overhead'),
      keterangan: formKeterangan,
      namaPenerima: formNamaPenerima.trim() || (formTipe === 'masuk' ? 'Kasir / Penyetor Koperasi' : 'Pihak Penerima Kas'),
      tipe: formTipe,
      nominal,
      saldoKasSetelah: formTipe === 'masuk' ? saldoKasKoperasi + nominal : saldoKasKoperasi - nominal,
      inputBy: currentAdmin.nama,
      status: (isSuperAdmin || isApproval) ? 'approved' : 'pending_approval',
      pendingAction: (isSuperAdmin || isApproval) ? undefined : 'create',
      approvedBy: (isSuperAdmin || isApproval) ? currentAdmin.nama : undefined,
      createdAt: new Date().toISOString(),
    };

    const audit = createAuditLog(
      currentAdmin,
      'Input Kas Koperasi',
      `${formTipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran'} ${formatRupiah(nominal)}: ${formKeterangan} (${newKas.namaPenerima}) - ${newKas.status === 'approved' ? 'Disetujui' : 'Menunggu Approval'}`,
      newKas.id
    );

    await updateState((prev) => ({
      ...prev,
      kasList: [newKas, ...prev.kasList],
      auditLogs: [audit, ...prev.auditLogs],
    }));

    setIsInputModalOpen(false);
    setFormNominal('');
    setFormNamaPenerima('');
    setFormKeterangan('');
    alert(
      (isSuperAdmin || isApproval)
        ? '✓ Transaksi kas berhasil dicatat dan disetujui!'
        : '✓ Transaksi berhasil ditulis oleh Admin Write! Dokumen masuk status MENUNGGU PERSETUJUAN (Approval) oleh Admin Approval / Super Admin.'
    );
  };

  // Handle Transfer Antar Buku Kas (Req 2: Kas Anggota ⇄ Kas Koperasi)
  // Pinjaman Kas (sesuai dari mana buku kas diterima) dan Pengembalian Kas (sesuai dari mana buku kas diambil)
  const handleTransferBukuKasSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInput) {
      alert('Akses Ditolak: Anda tidak memiliki wewenang untuk melakukan transfer kas.');
      return;
    }

    const nominal = Number(tfNominal);
    if (!nominal || nominal <= 0) {
      alert('Nominal transfer harus lebih dari Rp 0.');
      return;
    }

    if (tfDariKas === tfKeKas) {
      alert('Buku kas sumber dan buku kas tujuan tidak boleh sama.');
      return;
    }

    const labelSumber = tfDariKas === 'anggota' ? 'Buku Kas Anggota' : 'Buku Kas Koperasi';
    const labelTujuan = tfKeKas === 'anggota' ? 'Buku Kas Anggota' : 'Buku Kas Koperasi';

    const isPinjaman = tfJenis === 'pinjaman_kas';
    const now = new Date();
    const idKeluar = `tf-out-${Date.now()}`;
    const idMasuk = `tf-in-${Date.now() + 1}`;

    // Req 2: Pinjaman Kas (sesuai dari mana buku kas diterima) & Pengembalian Kas (sesuai dari mana buku kas diambil)
    const kategoriKeluar = isPinjaman ? 'Pinjaman Kas' : 'Pengembalian Kas';
    const kategoriMasuk = isPinjaman ? 'Pinjaman Kas' : 'Pengembalian Buku Kas';

    const ketKeluar = isPinjaman
      ? `Penyaluran Pinjaman Kas ke ${labelTujuan}${tfKeterangan.trim() ? ` - ${tfKeterangan.trim()}` : ''}`
      : `Pengembalian Kas ke ${labelTujuan}${tfKeterangan.trim() ? ` - ${tfKeterangan.trim()}` : ''}`;

    const ketMasuk = isPinjaman
      ? `Penerimaan Pinjaman Kas dari ${labelSumber}${tfKeterangan.trim() ? ` - ${tfKeterangan.trim()}` : ''}`
      : `Penerimaan Pengembalian Kas dari ${labelSumber}${tfKeterangan.trim() ? ` - ${tfKeterangan.trim()}` : ''}`;

    const statusTransaksi = (isSuperAdmin || isApproval) ? 'approved' : 'pending_approval';

    const entryKeluar: KasEntry = {
      id: idKeluar,
      bukuKas: tfDariKas,
      tanggal: tfTanggal,
      kategori: kategoriKeluar,
      keterangan: ketKeluar,
      namaPenerima: labelTujuan,
      tipe: 'keluar',
      nominal,
      saldoKasSetelah: 0,
      inputBy: tfNamaPetugas || currentAdmin.nama,
      status: statusTransaksi,
      createdAt: now.toISOString(),
    };

    const entryMasuk: KasEntry = {
      id: idMasuk,
      bukuKas: tfKeKas,
      tanggal: tfTanggal,
      kategori: kategoriMasuk,
      keterangan: ketMasuk,
      namaPenerima: labelTujuan,
      tipe: 'masuk',
      nominal,
      saldoKasSetelah: 0,
      inputBy: tfNamaPetugas || currentAdmin.nama,
      status: statusTransaksi,
      createdAt: now.toISOString(),
    };

    const audit = createAuditLog(
      currentAdmin,
      'Transfer Antar Buku Kas',
      `Transfer ${labelSumber} ➔ ${labelTujuan} sebesar ${formatRupiah(nominal)} (${isPinjaman ? 'Pinjaman Kas' : 'Pengembalian Kas'})${tfKeterangan ? ` - ${tfKeterangan}` : ''}`,
      idKeluar
    );

    await updateState((prev) => ({
      ...prev,
      kasList: [entryKeluar, entryMasuk, ...prev.kasList],
      auditLogs: [audit, ...prev.auditLogs],
    }));

    setIsTransferModalOpen(false);
    setTfNominal('');
    setTfKeterangan('');
    alert(
      statusTransaksi === 'approved'
        ? `✓ Transfer antar buku kas sebesar ${formatRupiah(nominal)} berhasil dibukukan (${labelSumber} ➔ ${labelTujuan})!`
        : `✓ Pengajuan transfer antar buku kas sebesar ${formatRupiah(nominal)} berhasil dibuat oleh Admin Write! Menunggu approval.`
    );
  };

  // Open Edit Kas Modal (Req 6 & Req 1) - HANYA Buku Kas Koperasi (Buku Kas Anggota TIDAK DAPAT diedit oleh admin)
  const handleOpenEditKas = (entry: KasEntry) => {
    if (entry.bukuKas === 'anggota') {
      alert('Buku Kas Anggota bersifat otomatis dari mutasi dan setoran anggota. Tidak dapat diinput atau diedit oleh admin.');
      return;
    }
    setEditingKasEntry(entry);
    setEditTanggal(entry.tanggal);
    setEditBukuKas(entry.bukuKas);
    setEditKategori(entry.kategori);
    setEditTipe(entry.tipe);
    setEditNominal(String(entry.nominal));
    setEditKeterangan(entry.keterangan);
    setEditNamaPenerima(entry.namaPenerima || '');
  };

  // Save Edit Kas (Req 1: Admin write dapat mengedit dengan approval, Admin Approval/Superadmin menyetujui)
  const handleSaveEditKas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKasEntry) return;

    if (editingKasEntry.bukuKas === 'anggota') {
      alert('Buku Kas Anggota dilindungi dan tidak dapat diedit oleh admin.');
      setEditingKasEntry(null);
      return;
    }

    const nominalNum = Number(editNominal);
    if (!nominalNum || nominalNum <= 0) {
      alert('Nominal harus lebih dari 0.');
      return;
    }

    const isDirect = isSuperAdmin || isApproval;
    const updatedEntry: KasEntry = {
      ...editingKasEntry,
      tanggal: editTanggal,
      bukuKas: 'koperasi', // Selalu koperasi jika diedit
      kategori: editKategori,
      tipe: editTipe,
      nominal: nominalNum,
      keterangan: editKeterangan.trim(),
      namaPenerima: editNamaPenerima.trim() || undefined,
      status: isDirect ? 'approved' : 'pending_approval',
      pendingAction: isDirect ? undefined : 'update',
      originalData: isDirect ? undefined : {
        tanggal: editingKasEntry.tanggal,
        bukuKas: editingKasEntry.bukuKas,
        kategori: editingKasEntry.kategori,
        tipe: editingKasEntry.tipe,
        nominal: editingKasEntry.nominal,
        keterangan: editingKasEntry.keterangan,
        namaPenerima: editingKasEntry.namaPenerima,
      },
      inputBy: isDirect ? (editingKasEntry.inputBy || currentAdmin.nama) : currentAdmin.nama,
      approvedBy: isDirect ? currentAdmin.nama : undefined,
    };

    // Kirim update ke server
    try {
      const res = await fetch('/api/kas/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry: updatedEntry, adminName: currentAdmin.nama }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Gagal mengedit transaksi kas');
        return;
      }
    } catch {}

    await updateState((prev) => {
      const updatedList = prev.kasList.map((k) =>
        k.id === editingKasEntry.id ? updatedEntry : k
      );
      const audit = createAuditLog(
        currentAdmin,
        isDirect ? 'Edit Transaksi Buku Kas' : 'Pengajuan Edit Buku Kas',
        `Mengubah transaksi kas [${updatedEntry.bukuKas}] ${updatedEntry.keterangan} senilai ${formatRupiah(updatedEntry.nominal)} (${isDirect ? 'Disetujui Langsung' : 'Menunggu Approval'})`,
        updatedEntry.id
      );
      return {
        ...prev,
        kasList: updatedList,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    setEditingKasEntry(null);
    alert(
      isDirect
        ? '✓ Transaksi buku kas berhasil diperbarui dan disetujui!'
        : '✓ Perubahan transaksi kas berhasil ditulis oleh Admin Write! Menunggu persetujuan (approval) oleh Admin Approval / Super Admin.'
    );
  };

  // Handle Delete Kas Entry (Req: Super Admin dapat menghapus buku kas anggota & kas koperasi)
  const handleDeleteKas = async (entry: KasEntry) => {
    if (entry.bukuKas === 'anggota' && !isSuperAdmin) {
      alert('Buku Kas Anggota bersifat otomatis dan dilindungi. Hanya Super Admin yang berhak menghapus catatan Buku Kas Anggota.');
      return;
    }

    if (isWriter) {
      const confirmReq = confirm(
        `Ajukan penghapusan transaksi Buku Kas Koperasi:\n"${entry.keterangan}" (${formatRupiah(entry.nominal)})\n\nPengajuan akan diteruskan ke Admin Approval atau Super Admin untuk disahkan. Lanjutkan?`
      );
      if (!confirmReq) return;

      try {
        await fetch('/api/kas/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: entry.id, adminName: currentAdmin.nama, isDirectDelete: false }),
        });
      } catch {}

      await updateState((prev) => ({
        ...prev,
        kasList: prev.kasList.map((k) =>
          k.id === entry.id
            ? { ...k, status: 'pending_approval', pendingAction: 'delete', inputBy: currentAdmin.nama }
            : k
        ),
        auditLogs: [
          createAuditLog(
            currentAdmin,
            'Pengajuan Hapus Buku Kas',
            `Admin Write ${currentAdmin.nama} mengajukan penghapusan transaksi [${entry.bukuKas}] ${entry.keterangan} senilai ${formatRupiah(entry.nominal)}`,
            entry.id
          ),
          ...prev.auditLogs,
        ],
      }));

      alert(`✓ Pengajuan hapus transaksi "${entry.keterangan}" berhasil dikirim! Menunggu persetujuan Admin Approval atau Super Admin.`);
      return;
    }

    // Helper: Sinkronisasi otomatis mutasi, saldo anggota & running saldo buku kas saat entri Buku Kas dihapus
    const applyKasDeletionWithMemberSync = (prev: AppState, deletedEntry: KasEntry) => {
      const remainingKas = prev.kasList.filter((k) => k.id !== deletedEntry.id);

      // Recompute running saldoKasSetelah per bukuKas
      const recomputeKasSaldo = (list: KasEntry[]) => {
        const byType = (type: 'anggota' | 'koperasi') => {
          const items = list
            .filter((k) => k.bukuKas === type)
            .slice()
            .sort((a, b) => (a.tanggal + (a.createdAt || '')).localeCompare(b.tanggal + (b.createdAt || '')));
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
        const mapAnggota = byType('anggota');
        const mapKoperasi = byType('koperasi');
        return list.map((k) => ({
          ...k,
          saldoKasSetelah:
            k.bukuKas === 'anggota'
              ? (mapAnggota.get(k.id) ?? k.saldoKasSetelah)
              : (mapKoperasi.get(k.id) ?? k.saldoKasSetelah),
        }));
      };

      const syncedKasList = recomputeKasSaldo(remainingKas);
      const nextDeletedKasIds = Array.from(new Set([...(prev.deletedKasIds || []), deletedEntry.id]));

      if (deletedEntry.bukuKas !== 'anggota') {
        return {
          ...prev,
          kasList: syncedKasList,
          deletedKasIds: nextDeletedKasIds,
        };
      }

      // Cari anggota yang bersangkutan berdasarkan namaPenerima atau keterangan
      const cleanPenerima = (deletedEntry.namaPenerima || '').trim().toLowerCase();
      const cleanKet = (deletedEntry.keterangan || '').trim().toLowerCase();

      const matchedMembers = prev.members.filter((m) => {
        const mName = (m.nama || '').trim().toLowerCase();
        if (!mName) return false;
        if (cleanPenerima && cleanPenerima === mName) return true;
        if (cleanKet && cleanKet.includes(mName)) return true;
        return false;
      });

      const matchedMemberIds = new Set(matchedMembers.map((m) => m.id));
      const newlyDeletedTxIds: string[] = [];

      // Hapus atau koreksi mutasi anggota yang terkait dengan kas yang dihapus
      let removedOrAdjustedTx = false;
      const updatedTransactions: MemberTransaction[] = [];

      for (const tx of prev.memberTransactions || []) {
        if (
          !removedOrAdjustedTx &&
          matchedMemberIds.has(tx.memberId) &&
          tx.tanggal === deletedEntry.tanggal &&
          tx.tipe === deletedEntry.tipe
        ) {
          if (tx.nominal === deletedEntry.nominal) {
            removedOrAdjustedTx = true;
            newlyDeletedTxIds.push(tx.id);
            continue;
          } else if (tx.nominal > deletedEntry.nominal) {
            removedOrAdjustedTx = true;
            updatedTransactions.push({
              ...tx,
              nominal: tx.nominal - deletedEntry.nominal,
            });
            continue;
          }
        }
        updatedTransactions.push(tx);
      }

      // Koreksi langsung saldo simpanan anggota sesuai kategori buku kas yang dihapus
      const katLower = (deletedEntry.kategori || '').toLowerCase();
      const updatedMembers = prev.members.map((m) => {
        if (!matchedMemberIds.has(m.id)) return m;

        const perMemberNominal =
          matchedMembers.length > 1
            ? Math.floor(deletedEntry.nominal / matchedMembers.length)
            : deletedEntry.nominal;

        let p = Number(m.saldoPokok) || 0;
        let u = Number(m.saldoUmum) || 0;
        let z = Number(m.saldoZakatFitrah) || 0;
        let q = Number(m.saldoQurban) || 0;

        if (deletedEntry.tipe === 'masuk') {
          if (katLower.includes('pokok')) p = Math.max(0, p - perMemberNominal);
          else if (katLower.includes('qurban')) q = Math.max(0, q - perMemberNominal);
          else if (katLower.includes('zakat')) z = Math.max(0, z - perMemberNominal);
          else u = Math.max(0, u - perMemberNominal);
        } else {
          if (katLower.includes('pokok')) p += perMemberNominal;
          else if (katLower.includes('qurban')) q += perMemberNominal;
          else if (katLower.includes('zakat')) z += perMemberNominal;
          else u += perMemberNominal;
        }

        // Rekalkulasi running saldoSetelah pada mutasi anggota tersebut
        const mTxs = updatedTransactions
          .filter((t) => t.memberId === m.id)
          .sort((a, b) => `${a.tanggal} ${a.jam || '00:00'}`.localeCompare(`${b.tanggal} ${b.jam || '00:00'}`));
        let runSaldo = 0;
        mTxs.forEach((t) => {
          runSaldo = t.tipe === 'masuk' ? runSaldo + t.nominal : Math.max(0, runSaldo - t.nominal);
          t.saldoSetelah = runSaldo;
        });

        return {
          ...m,
          saldoPokok: p,
          saldoUmum: u,
          saldoZakatFitrah: z,
          saldoQurban: q,
          totalSimpanan: p + u + z + q,
        };
      });

      return {
        ...prev,
        members: updatedMembers,
        memberTransactions: updatedTransactions,
        kasList: syncedKasList,
        deletedKasIds: nextDeletedKasIds,
        deletedTransactionIds: Array.from(new Set([...(prev.deletedTransactionIds || []), ...newlyDeletedTxIds])),
      };
    };

    // Super Admin & Admin Approval direct delete
    const confirmDelete = confirm(
      `Hapus transaksi Buku Kas ${entry.bukuKas === 'anggota' ? 'Anggota' : 'Koperasi'}:\n"${entry.keterangan}" (${formatRupiah(entry.nominal)})\n\nSebagai ${isSuperAdmin ? 'Super Admin' : 'Admin Approval'}, transaksi ini akan langsung dihapus, saldo Buku Kas dikoreksi otomatis${entry.bukuKas === 'anggota' ? ', serta mutasi & saldo simpanan anggota terkait langsung disesuaikan' : ''}. Lanjutkan?`
    );
    if (!confirmDelete) return;

    let serverStateApplied = false;
    try {
      const res = await fetch('/api/kas/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, adminName: currentAdmin.nama, isDirectDelete: true }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.state) {
          serverStateApplied = true;
          await updateState(() => data.state);
        }
      }
    } catch {}

    // Hapus dokumen dari Firestore secara langsung agar tidak kembali saat sinkronisasi
    try {
      const { db } = await import('../lib/firebase');
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'kas', entry.id)).catch(() => {});
    } catch {}

    if (!serverStateApplied) {
      await updateState((prev) => {
        const nextState = applyKasDeletionWithMemberSync(prev, entry);
        const audit = createAuditLog(
          currentAdmin,
          'Hapus Transaksi Kas & Koreksi Saldo',
          `${isSuperAdmin ? 'Super Admin' : 'Admin Approval'} ${currentAdmin.nama} menghapus transaksi [${entry.bukuKas}] ${entry.keterangan} senilai ${formatRupiah(entry.nominal)} beserta koreksi saldo otomatis`,
          entry.id
        );
        return {
          ...nextState,
          auditLogs: [audit, ...nextState.auditLogs],
        };
      });
    }

    alert(`✓ Transaksi "${entry.keterangan}" berhasil dihapus dan jumlah saldo Buku Kas${entry.bukuKas === 'anggota' ? ' serta mutasi & saldo anggota' : ''} telah dikoreksi otomatis.`);
  };

  // Handle Approval for pending kas changes (Input, Edit, Hapus)
  const handleApproveKasAction = async (entry: KasEntry, isApproved: boolean) => {
    if (!canDirectModify) return;

    let serverStateApplied = false;
    try {
      const res = await fetch('/api/kas/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, isApproved, adminName: currentAdmin.nama }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.state) {
          serverStateApplied = true;
          await updateState(() => data.state);
        }
      }
    } catch {}

    if (isApproved && entry.pendingAction === 'delete') {
      try {
        const { db } = await import('../lib/firebase');
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'kas', entry.id)).catch(() => {});
      } catch {}
    }

    if (!serverStateApplied) {
      await updateState((prev) => {
        let updatedList = [...prev.kasList];
        if (isApproved) {
          if (entry.pendingAction === 'delete') {
            updatedList = updatedList.filter((k) => k.id !== entry.id);
          } else {
            updatedList = updatedList.map((k) =>
              k.id === entry.id ? { ...k, status: 'approved', approvedBy: currentAdmin.nama, pendingAction: undefined } : k
            );
          }
        } else {
          if (entry.pendingAction === 'delete') {
            updatedList = updatedList.map((k) =>
              k.id === entry.id ? { ...k, status: 'approved', pendingAction: undefined } : k
            );
          } else if (entry.pendingAction === 'update' && entry.originalData) {
            updatedList = updatedList.map((k) =>
              k.id === entry.id ? { ...k, ...entry.originalData, status: 'approved', pendingAction: undefined, originalData: undefined } : k
            );
          } else {
            updatedList = updatedList.map((k) =>
              k.id === entry.id ? { ...k, status: 'rejected', approvedBy: currentAdmin.nama, pendingAction: undefined } : k
            );
          }
        }

        const audit = createAuditLog(
          currentAdmin,
          isApproved ? 'Pengesahan Transaksi Kas' : 'Penolakan Transaksi Kas',
          `${currentAdmin.nama} (${isSuperAdmin ? 'Super Admin' : 'Admin Approval'}) ${isApproved ? 'menyetujui' : 'menolak'} ${
            entry.pendingAction === 'delete' ? 'penghapusan' : entry.pendingAction === 'update' ? 'perubahan' : 'input'
          } transaksi kas ${entry.keterangan}`,
          entry.id
        );

        return {
          ...prev,
          kasList: updatedList,
          deletedKasIds:
            isApproved && entry.pendingAction === 'delete'
              ? Array.from(new Set([...(prev.deletedKasIds || []), entry.id]))
              : prev.deletedKasIds,
          auditLogs: [audit, ...prev.auditLogs],
        };
      });
    }

    alert(
      isApproved
        ? `✓ ${entry.pendingAction === 'delete' ? 'Penghapusan transaksi' : 'Perubahan transaksi'} berhasil disetujui!`
        : `Permohonan transaksi kas telah ditolak.`
    );
  };

  // Add Category Handler
  // Add Category Handler
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    await updateState((prev) => ({
      ...prev,
      categoriesKasKoperasi: {
        ...prev.categoriesKasKoperasi,
        [newCatTipe]: [...prev.categoriesKasKoperasi[newCatTipe], newCatName.trim()],
      },
    }));

    setNewCatName('');
  };

  // Delete Category Handler per User Req
  const handleDeleteCategory = async (tipe: 'pemasukan' | 'pengeluaran', catName: string) => {
    const confirmDel = confirm(`Hapus kategori "${catName}" dari daftar kategori kas koperasi?`);
    if (!confirmDel) return;

    await updateState((prev) => ({
      ...prev,
      categoriesKasKoperasi: {
        ...prev.categoriesKasKoperasi,
        [tipe]: prev.categoriesKasKoperasi[tipe].filter((c) => c !== catName),
      },
    }));
  };

  // Export Kas Report to Excel / PDF dengan Jurnal Halaman Depan & Perincian Kategori (Req 1)
  const handleExportKas = (format: 'pdf' | 'excel') => {
    const periodeLabel =
      filterStartDate && filterEndDate
        ? `${filterStartDate} s/d ${filterEndDate}`
        : filterStartDate
        ? `Sejak ${filterStartDate}`
        : filterEndDate
        ? `Sampai ${filterEndDate}`
        : 'Semua Periode';

    // Ambil transaksi yang sesuai dengan tab dan filter aktif
    const exportEntries =
      activeKasTab === 'neraca'
        ? state.kasList.filter((k) => k.status === 'approved')
        : currentList.filter((k) => k.status === 'approved');

    const payload = {
      bukuKasType: activeKasTab,
      kasEntries: exportEntries,
      periodeLabel,
      allMembers: state.members,
      categoriesKoperasi: state.categoriesKasKoperasi,
      saldoKasAnggota,
      saldoKasKoperasi,
      saldoSedekahKoperasi,
      saldoKasBerjalan,
    };

    if (format === 'excel') {
      exportBukuKasExcel(payload);
    } else {
      exportBukuKasPdf(payload);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Tabs */}
      <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              Buku Kas & Laporan Neraca Keuangan
            </h3>
            <p className="text-xs text-slate-400">
              Sistem pencatatan ganda Kas Anggota, Kas Koperasi, dan Neraca Laba Rugi
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canInput && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveKasTab('koperasi');
                    setIsInputModalOpen(true);
                  }}
                  className="py-2 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  + Input Kas Koperasi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveKasTab('koperasi');
                    setIsAddCatModalOpen(true);
                  }}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-sky-400 border border-sky-500/30 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Tambah atau hapus kategori kas koperasi"
                >
                  <Edit className="w-4 h-4 text-sky-400" />
                  Kelola Kategori
                </button>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Transfer dana antar Buku Kas Anggota dan Kas Koperasi"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Transfer Antar Kas
                </button>
              </>
            )}

            <button
              onClick={() => handleExportKas('pdf')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 border border-amber-500/30 rounded-xl font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Cetak PDF
            </button>
            <button
              onClick={() => handleExportKas('excel')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-emerald-400 border border-emerald-500/30 rounded-xl font-bold flex items-center gap-1.5"
            >
              <FileDown className="w-4 h-4" />
              Unduh Excel
            </button>
          </div>
        </div>

        {/* Tampilan Saldo Buku Kas Disusun ke Bawah (Req 4) */}
        <div className="flex flex-col gap-3 mt-4">
          {/* Card 1: Buku Kas Anggota */}
          <button
            type="button"
            onClick={() => setActiveKasTab('anggota')}
            className={`w-full p-4 rounded-2xl text-left border transition-all relative overflow-hidden ${
              activeKasTab === 'anggota'
                ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/10'
                : 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${activeKasTab === 'anggota' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-amber-400'}`}>
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-300">Buku Kas 1: Rekapitulasi Kas Anggota</div>
                  <div className="text-sm font-extrabold text-white">1. Saldo Buku Kas Anggota</div>
                </div>
              </div>
              {activeKasTab === 'anggota' && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2.5 py-1 rounded-full">
                  Aktif Ditampilkan
                </span>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 tracking-tight">
                {formatRupiah(saldoKasAnggota)}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                Akumulasi Simpanan Pokok, Qurban, Zakat & Tabungan Bebas Anggota
              </div>
            </div>
          </button>

          {/* Card 2: Buku Kas Koperasi */}
          <button
            type="button"
            onClick={() => setActiveKasTab('koperasi')}
            className={`w-full p-4 rounded-2xl text-left border transition-all relative overflow-hidden ${
              activeKasTab === 'koperasi'
                ? 'bg-sky-500/15 border-sky-500 ring-2 ring-sky-500/50 shadow-lg shadow-sky-500/10'
                : 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${activeKasTab === 'koperasi' ? 'bg-sky-500 text-slate-950 font-black' : 'bg-slate-800 text-sky-400'}`}>
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-300">Buku Kas 2: Operasional & Lembaga</div>
                  <div className="text-sm font-extrabold text-white">2. Saldo Buku Kas Koperasi</div>
                </div>
              </div>
              {activeKasTab === 'koperasi' && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-sky-500 text-slate-950 px-2.5 py-1 rounded-full">
                  Aktif Ditampilkan
                </span>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
              <div className="text-2xl sm:text-3xl font-black font-mono text-sky-400 tracking-tight">
                {formatRupiah(saldoKasKoperasi)}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                Penerimaan Jasa, Sumbangan / Donasi, Biaya Operasional & Tutup Akun
              </div>
            </div>
          </button>

          {/* Card 3: Neraca & Konsolidasi Keuangan */}
          <button
            type="button"
            onClick={() => setActiveKasTab('neraca')}
            className={`w-full p-4 rounded-2xl text-left border transition-all relative overflow-hidden ${
              activeKasTab === 'neraca'
                ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${activeKasTab === 'neraca' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-emerald-400'}`}>
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-300">Buku Kas 3: Neraca & Konsolidasi Kas</div>
                  <div className="text-sm font-extrabold text-white">3. Saldo Kas Berjalan</div>
                </div>
              </div>
              {activeKasTab === 'neraca' && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-full">
                  Aktif Ditampilkan
                </span>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tracking-tight">
                {formatRupiah(saldoKasBerjalan)}
              </div>
              <div className="text-[11px] text-slate-400 font-medium truncate" title={`Simpanan Pokok: ${formatRupiah(totalSimpananPokok)} + Tabungan Umum: ${formatRupiah(totalTabunganUmum)} + Zakat & Qurban: ${formatRupiah(totalDanaZakatQurban)} + Sedekah: ${formatRupiah(saldoSedekahKoperasi)}`}>
                Pokok + Umum + Zakat & Qurban + Sedekah
              </div>
            </div>
          </button>
        </div>

        {/* Filter Controls (Hidden for Admin Laporan category per req 46) */}
        {activeKasTab !== 'neraca' && (
          <div className="space-y-3 mt-4 pt-4 border-t border-slate-700/60">
            {/* Quick Period Buttons per User Req: Tahunan, Bulanan, Harian, dan Harian Rentang */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-bold mr-1">Filter Periode:</span>
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setFilterStartDate(today);
                  setFilterEndDate(today);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-bold border border-slate-700"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const y = now.getFullYear();
                  const m = String(now.getMonth() + 1).padStart(2, '0');
                  setFilterStartDate(`${y}-${m}-01`);
                  setFilterEndDate(now.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-bold border border-slate-700"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const y = now.getFullYear();
                  setFilterStartDate(`${y}-01-01`);
                  setFilterEndDate(now.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-bold border border-slate-700"
              >
                Tahun Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterStartDate('');
                  setFilterEndDate('');
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold border border-slate-700"
              >
                Semua Periode
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Kategori Transaksi</label>
              {isLaporan ? (
                <div className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-400">
                  Kategori Internal Terproteksi
                </div>
              ) : (
                <select
                  value={filterKategori}
                  onChange={(e) => setFilterKategori(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="semua">Semua Kategori</option>
                  {activeKasTab === 'koperasi' ? (
                    <>
                      {state.categoriesKasKoperasi.pemasukan.map((c) => (
                        <option key={c} value={c}>[+] {c}</option>
                      ))}
                      {state.categoriesKasKoperasi.pengeluaran.map((c) => (
                        <option key={c} value={c}>[-] {c}</option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value="Tabungan Pokok">Tabungan Pokok</option>
                      <option value="Tabungan Zakat">Tabungan Zakat</option>
                      <option value="Tabungan Qurban">Tabungan Qurban</option>
                      <option value="Tabungan Bebas">Tabungan Bebas</option>
                      <option value="Setoran Tabungan Umum">Setoran Tabungan Umum</option>
                      <option value="Penarikan Tabungan Umum">Penarikan Tabungan Umum</option>
                      <option value="Penyaluran Zakat Fitrah">Penyaluran Zakat Fitrah</option>
                      <option value="Penyaluran Tabungan Qurban">Penyaluran Tabungan Qurban</option>
                    </>
                  )}
                </select>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* ================= VIEW TABEL ATAU NERACA ================= */}
      {activeKasTab === 'neraca' ? (
        /* Neraca & Laba Rugi Report View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Laba Rugi Operasional */}
          <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4 pb-2 border-b border-slate-700">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Laporan Laba / Rugi Koperasi
            </h4>

            <div className="space-y-4 text-xs">
              {/* TAMPILKAN SEMUA KATEGORI PENDAPATAN & PENERIMAAN (Req 1) */}
              <div>
                <div className="font-bold text-emerald-400 mb-1 flex items-center justify-between">
                  <span>PENDAPATAN & PENERIMAAN:</span>
                  <span className="font-mono text-emerald-300">
                    {formatRupiah(
                      Array.from(
                        new Set([
                          ...state.categoriesKasKoperasi.pemasukan,
                          ...state.kasList.filter((k) => k.tipe === 'masuk').map((k) => k.kategori),
                        ])
                      ).reduce((sum, cat) => {
                        return (
                          sum +
                          state.kasList
                            .filter((k) => k.status === 'approved' && k.tipe === 'masuk' && k.kategori === cat)
                            .reduce((s, k) => s + k.nominal, 0)
                        );
                      }, 0)
                    )}
                  </span>
                </div>
                <div className="space-y-1.5 pl-2 max-h-56 overflow-y-auto pr-1">
                  {Array.from(
                    new Set([
                      ...state.categoriesKasKoperasi.pemasukan,
                      ...state.kasList.filter((k) => k.tipe === 'masuk').map((k) => k.kategori),
                    ])
                  ).map((cat) => {
                    const catTotal = state.kasList
                      .filter((k) => k.status === 'approved' && k.tipe === 'masuk' && k.kategori === cat)
                      .reduce((s, k) => s + k.nominal, 0);
                    const txCount = state.kasList.filter(
                      (k) => k.status === 'approved' && k.tipe === 'masuk' && k.kategori === cat
                    ).length;
                    return (
                      <div key={cat} className="flex justify-between items-center text-slate-300 py-0.5 border-b border-slate-800/60">
                        <span className="flex items-center gap-1.5">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{cat}</span>
                          {txCount > 0 && (
                            <span className="text-[10px] text-slate-400">({txCount}x)</span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-emerald-400">{formatRupiah(catTotal)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* TAMPILKAN SEMUA KATEGORI BEBAN & PENGELUARAN OVERHEAD (Req 1) */}
              <div>
                <div className="font-bold text-red-400 mb-1 flex items-center justify-between">
                  <span>BEBAN & PENGELUARAN OVERHEAD:</span>
                  <span className="font-mono text-rose-300">
                    {formatRupiah(
                      Array.from(
                        new Set([
                          ...state.categoriesKasKoperasi.pengeluaran,
                          ...state.kasList.filter((k) => k.tipe === 'keluar').map((k) => k.kategori),
                        ])
                      ).reduce((sum, cat) => {
                        return (
                          sum +
                          state.kasList
                            .filter((k) => k.status === 'approved' && k.tipe === 'keluar' && k.kategori === cat)
                            .reduce((s, k) => s + k.nominal, 0)
                        );
                      }, 0)
                    )}
                  </span>
                </div>
                <div className="space-y-1.5 pl-2 max-h-56 overflow-y-auto pr-1">
                  {Array.from(
                    new Set([
                      ...state.categoriesKasKoperasi.pengeluaran,
                      ...state.kasList.filter((k) => k.tipe === 'keluar').map((k) => k.kategori),
                    ])
                  ).map((cat) => {
                    const catTotal = state.kasList
                      .filter((k) => k.status === 'approved' && k.tipe === 'keluar' && k.kategori === cat)
                      .reduce((s, k) => s + k.nominal, 0);
                    const txCount = state.kasList.filter(
                      (k) => k.status === 'approved' && k.tipe === 'keluar' && k.kategori === cat
                    ).length;
                    return (
                      <div key={cat} className="flex justify-between items-center text-slate-300 py-0.5 border-b border-slate-800/60">
                        <span className="flex items-center gap-1.5">
                          <span className="text-red-400 font-bold">•</span>
                          <span>{cat}</span>
                          {txCount > 0 && (
                            <span className="text-[10px] text-slate-400">({txCount}x)</span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-rose-400">{formatRupiah(catTotal)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SURPLUS / HASIL USAHA BERJALAN = TOTAL PEMASUKAN - TOTAL PENGELUARAN */}
              {(() => {
                const totMasuk = Array.from(
                  new Set([
                    ...state.categoriesKasKoperasi.pemasukan,
                    ...state.kasList.filter((k) => k.tipe === 'masuk').map((k) => k.kategori),
                  ])
                ).reduce((sum, cat) => {
                  return (
                    sum +
                    state.kasList
                      .filter((k) => k.status === 'approved' && k.tipe === 'masuk' && k.kategori === cat)
                      .reduce((s, k) => s + k.nominal, 0)
                  );
                }, 0);

                const totKeluar = Array.from(
                  new Set([
                    ...state.categoriesKasKoperasi.pengeluaran,
                    ...state.kasList.filter((k) => k.tipe === 'keluar').map((k) => k.kategori),
                  ])
                ).reduce((sum, cat) => {
                  return (
                    sum +
                    state.kasList
                      .filter((k) => k.status === 'approved' && k.tipe === 'keluar' && k.kategori === cat)
                      .reduce((s, k) => s + k.nominal, 0)
                  );
                }, 0);

                const hasilUsaha = totMasuk - totKeluar;

                return (
                  <div className="pt-3 border-t border-slate-700 flex justify-between font-bold text-sm">
                    <span className="text-white">SURPLUS / HASIL USAHA BERJALAN:</span>
                    <span className={`font-mono font-black ${hasilUsaha >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatRupiah(hasilUsaha)}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Neraca Keuangan */}
          <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4 pb-2 border-b border-slate-700">
              <Scale className="w-4 h-4 text-amber-400" />
              Laporan Posisi Keuangan (Neraca)
            </h4>

            <div className="space-y-4 text-xs">
              <div>
                <div className="font-bold text-amber-400 mb-1">ASET LANCAR (KAS & BANK):</div>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Kas di Bank (Kas Anggota)</span>
                    <span className="font-mono">{formatRupiah(saldoKasAnggota)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Kas di Bank (Kas Koperasi)</span>
                    <span className="font-mono">{formatRupiah(saldoKasKoperasi)}</span>
                  </div>
                </div>
                <div className="pt-1 flex justify-between font-bold text-slate-200">
                  <span>Total Aset Lancar:</span>
                  <span className="font-mono text-amber-400">{formatRupiah(saldoKasAnggota + saldoKasKoperasi)}</span>
                </div>
              </div>

              <div>
                <div className="font-bold text-sky-400 mb-1">KOMPONEN SALDO KAS BERJALAN (KEWAJIBAN & EKUITAS):</div>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between text-slate-300">
                    <span>1. Total Simpanan Pokok</span>
                    <span className="font-mono">{formatRupiah(totalSimpananPokok)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>2. Total Tabungan Umum</span>
                    <span className="font-mono">{formatRupiah(totalTabunganUmum)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>3. Dana Zakat dan Qurban</span>
                    <span className="font-mono">{formatRupiah(totalDanaZakatQurban)}</span>
                  </div>
                  <div className="flex justify-between text-rose-300">
                    <span>4. Saldo Sedekah Koperasi</span>
                    <span className="font-mono font-bold">{formatRupiah(saldoSedekahKoperasi)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-700 flex justify-between font-bold text-sm">
                <span className="text-white">SALDO KAS BERJALAN:</span>
                <span className="text-emerald-400 font-mono font-black text-base">
                  {formatRupiah(saldoKasBerjalan)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Table of Cashbook Transactions */
        <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
          {/* PENDING KAS APPROVALS ALERT BOX FOR ADMIN APPROVAL & SUPER ADMIN (Req: Transaksi kas dapat dihapus oleh admin write dan disetujui admin approval / super admin) */}
          {(isSuperAdmin || isApproval) && pendingKasApprovals.length > 0 && (
            <div className="mb-5 bg-gradient-to-r from-amber-950/70 via-slate-900 to-indigo-950/70 border border-amber-500/50 rounded-3xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-amber-200">
                      Permintaan Transaksi Buku Kas Menunggu Persetujuan ({pendingKasApprovals.length} Transaksi)
                    </h4>
                    <p className="text-[11px] text-amber-300/80">
                      Diajukan oleh Admin Write (input, edit, atau hapus transaksi). Memerlukan pengesahan dari Admin Approval atau Super Admin.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-full animate-pulse">
                  Persetujuan Kas
                </span>
              </div>

              <div className="space-y-2.5 pt-1">
                {pendingKasApprovals.map((k) => (
                  <div
                    key={k.id}
                    className="p-3.5 bg-slate-900/90 rounded-2xl border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                          k.pendingAction === 'delete'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : k.pendingAction === 'update'
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {k.pendingAction === 'delete' ? '🗑️ Permintaan HAPUS' : k.pendingAction === 'update' ? '✏️ Permintaan EDIT' : '➕ Permintaan INPUT BARU'}
                        </span>
                        <span className="font-extrabold text-white text-xs">
                          {k.keterangan}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                          [{k.bukuKas.toUpperCase()}]
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        Nominal: <span className="font-mono font-bold text-amber-400">{formatRupiah(k.nominal)}</span> ({k.tipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}) • Kategori: {k.kategori} • Tanggal: {k.tanggal}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Diajukan oleh: <b className="text-slate-300">{k.inputBy}</b> pada {new Date(k.createdAt).toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => handleApproveKasAction(k, false)}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Tolak
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveKasAction(k, true)}
                        className={`px-4 py-1.5 font-black rounded-xl text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                          k.pendingAction === 'delete'
                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{k.pendingAction === 'delete' ? 'Setujui Hapus' : 'Setujui'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PENDING KAS INFO BOX FOR ADMIN WRITE */}
          {isWriter && pendingKasApprovals.length > 0 && (
            <div className="mb-5 bg-sky-950/30 border border-sky-500/30 rounded-3xl p-4 shadow-xl space-y-2">
              <div className="flex items-center gap-2 text-sky-300 text-xs font-bold">
                <Clock className="w-4 h-4 text-sky-400 animate-spin" />
                <span>Pengajuan Transaksi Buku Kas Anda ({pendingKasApprovals.length} Menunggu Persetujuan Admin Approval / Super Admin)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                {pendingKasApprovals.map((k) => (
                  <div key={k.id} className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 flex justify-between items-center gap-2">
                    <div className="truncate">
                      <div className="font-extrabold text-white text-xs truncate">{k.keterangan}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{formatRupiah(k.nominal)} • [{k.bukuKas}]</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                      k.pendingAction === 'delete' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }`}>
                      {k.pendingAction === 'delete' ? 'Hapus' : k.pendingAction === 'update' ? 'Edit' : 'Input'} (Pending)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
            <span>Klik baris mana saja pada riwayat untuk mencetak / melihat <b>Tanda Terima Pembayaran</b> resmi.</span>
            <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5" />
              Terintegrasi Tanda Terima
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/40 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Tanggal</th>
                  {!isLaporan && <th className="py-2.5 px-3">Kategori</th>}
                  <th className="py-2.5 px-3">Keterangan</th>
                  <th className="py-2.5 px-3">Penerima / Penyetor</th>
                  <th className="py-2.5 px-3 text-right">Mutasi Masuk (CR)</th>
                  <th className="py-2.5 px-3 text-right">Mutasi Keluar (DB)</th>
                  <th className="py-2.5 px-3 text-right text-amber-400">Saldo Berjalan</th>
                  <th className="py-2.5 px-3">Petugas</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {currentList.map((entry) => {
                  const isMasuk = entry.tipe === 'masuk';
                  const namaPihak = entry.namaPenerima || (isMasuk ? 'Kasir / Penyetor' : 'Pihak Penerima');
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedReceiptKas(entry)}
                      className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                      title="Klik untuk membuka & mencetak Tanda Terima Pembayaran"
                    >
                      <td className="py-3 px-3 font-mono text-slate-300">{entry.tanggal}</td>
                      {!isLaporan && (
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                            {entry.kategori}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-3">
                        <div className="font-bold text-white group-hover:text-amber-300 transition-colors">
                          {entry.keterangan}
                        </div>
                        {entry.status === 'pending_approval' && (
                          <span className="text-[10px] text-amber-400 font-semibold">
                            ⏳ Menunggu Persetujuan ({entry.pendingAction || 'create'})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-sky-300">
                        {namaPihak}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        {isMasuk ? formatRupiah(entry.nominal) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-red-400">
                        {!isMasuk ? formatRupiah(entry.nominal) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-amber-300">
                        {formatRupiah(runningSaldoMap.get(entry.id) ?? (entry.saldoKasSetelah || 0))}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{entry.inputBy}</td>
                      <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptKas(entry)}
                            className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 rounded-lg flex items-center gap-1 text-[11px] font-bold transition-all"
                            title="Buka & Cetak Tanda Terima Pembayaran"
                          >
                            <Receipt className="w-3.5 h-3.5 text-amber-400" />
                            Kuitansi
                          </button>

                          {entry.bukuKas === 'anggota' ? (
                            isSuperAdmin ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteKas(entry)}
                                className="px-2 py-1 bg-red-950/50 hover:bg-red-900/80 text-rose-300 border border-red-500/50 rounded-lg flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer"
                                title="Super Admin: Hapus Catatan Buku Kas Anggota"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                Hapus (Super Admin)
                              </button>
                            ) : (
                              <span
                                className="px-2 py-1 bg-slate-900 border border-slate-750 text-slate-400 rounded-lg text-[10px] font-bold"
                                title="Buku Kas Anggota tercatat otomatis dan dilindungi (hanya Super Admin yang dapat menghapus)"
                              >
                                🔒 Kas Anggota
                              </span>
                            )
                          ) : (
                            <>
                              {entry.status === 'pending_approval' ? (
                                <>
                                  {/* Jika status pending, Admin Approval & Super Admin melihat tombol persetujuan */}
                                  {canDirectModify && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleApproveKasAction(entry, true)}
                                        className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-[10px] flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
                                        title={`Setujui ${entry.pendingAction === 'delete' ? 'Penghapusan' : entry.pendingAction === 'update' ? 'Perubahan' : 'Pencatatan'} Kas`}
                                      >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        <span>Setujui</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApproveKasAction(entry, false)}
                                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
                                        title={`Tolak ${entry.pendingAction === 'delete' ? 'Penghapusan' : entry.pendingAction === 'update' ? 'Perubahan' : 'Pencatatan'} Kas`}
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span>Tolak</span>
                                      </button>
                                    </div>
                                  )}

                                  {/* Untuk Admin Write yang sedang menunggu persetujuan */}
                                  {isWriter && (
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1 ${
                                      entry.pendingAction === 'delete'
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                        : entry.pendingAction === 'update'
                                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    }`}>
                                      <Clock className="w-3 h-3 animate-spin" />
                                      <span>Menunggu {entry.pendingAction === 'delete' ? 'Hapus' : entry.pendingAction === 'update' ? 'Edit' : 'Input'}</span>
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  {/* Tombol Edit Buku Kas Koperasi (Admin Write mengajukan, Admin Approval / Super Admin menyetujui) */}
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditKas(entry)}
                                      className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border border-sky-500/40 rounded-lg flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer"
                                      title={isWriter ? 'Edit Transaksi Kas (Ajukan Persetujuan)' : 'Edit Transaksi Kas Koperasi'}
                                    >
                                      <Edit className="w-3.5 h-3.5 text-sky-400" />
                                      Edit
                                    </button>
                                  )}

                                  {/* Tombol Hapus Buku Kas Koperasi (Admin Write mengajukan, Admin Approval / Super Admin menyetujui) */}
                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteKas(entry)}
                                      className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/40 rounded-lg flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer"
                                      title={isWriter ? 'Ajukan Penghapusan Transaksi ke Approval / Super Admin' : 'Hapus Transaksi Buku Kas Koperasi'}
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                      Hapus
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {currentList.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">
                Belum ada transaksi pada buku kas ini.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL INPUT KAS KOPERASI ================= */}
      {isInputModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl">
            <h3 className="text-sm font-extrabold text-white mb-3 pb-2 border-b border-slate-700">
              Input Transaksi Buku Kas Koperasi
            </h3>

            <form onSubmit={handleInputKasSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Jenis Transaksi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormTipe('masuk')}
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      formTipe === 'masuk'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    + Pemasukan (CR)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTipe('keluar')}
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      formTipe === 'keluar'
                        ? 'bg-red-500/20 border-red-500 text-red-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    - Pengeluaran (DB)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-300">Kategori</label>
                  <button
                    type="button"
                    onClick={() => setIsAddCatModalOpen(true)}
                    className="text-[10px] text-amber-400 hover:underline"
                  >
                    + Tambah Kategori
                  </button>
                </div>
                <select
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">Pilih Kategori</option>
                  {(formTipe === 'masuk'
                    ? state.categoriesKasKoperasi.pemasukan
                    : state.categoriesKasKoperasi.pengeluaran
                  ).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Input Tanggal & Jumlah (Req 1) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tanggal Transaksi *</label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Jumlah / Nominal (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formNominal}
                    onChange={(e) => setFormNominal(e.target.value)}
                    placeholder="Nominal rupiah"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Input Nama Penerima / Penyetor (Req 1) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nama Penerima / Pihak Pembayar / Penyetor *
                </label>
                <input
                  type="text"
                  required
                  value={formNamaPenerima}
                  onChange={(e) => setFormNamaPenerima(e.target.value)}
                  placeholder={formTipe === 'masuk' ? 'Nama pihak yang menyetor' : 'Nama pihak yang menerima kas'}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Keterangan Lengkap *</label>
                <textarea
                  required
                  rows={2}
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder="Rincian peruntukan transaksi..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInputModalOpen(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT BUKU KAS (Req 6) ================= */}
      {editingKasEntry && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Edit className="w-4 h-4 text-sky-400" />
                  Edit Transaksi Buku Kas
                </h3>
                <p className="text-[11px] text-slate-400">
                  Ubah rincian tanggal, kategori, penerima, atau nominal kas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingKasEntry(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditKas} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={editTanggal}
                    onChange={(e) => setEditTanggal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Buku Kas</label>
                  <select
                    value={editBukuKas}
                    onChange={(e) => setEditBukuKas(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="koperasi">Kas Koperasi</option>
                    <option value="anggota">Kas Anggota</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tipe Mutasi</label>
                  <select
                    value={editTipe}
                    onChange={(e) => setEditTipe(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="masuk">Masuk (CR) - Pemasukan</option>
                    <option value="keluar">Keluar (DB) - Pengeluaran</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Kategori</label>
                  <input
                    type="text"
                    required
                    value={editKategori}
                    onChange={(e) => setEditKategori(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nominal (Rp) *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editNominal}
                    onChange={(e) => setEditNominal(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-mono text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nama Penerima / Penyetor (Kuitansi) *
                </label>
                <input
                  type="text"
                  required
                  value={editNamaPenerima}
                  onChange={(e) => setEditNamaPenerima(e.target.value)}
                  placeholder="Nama anggota / vendor / pihak penerima"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Keterangan Transaksi *</label>
                <textarea
                  required
                  rows={2}
                  value={editKeterangan}
                  onChange={(e) => setEditKeterangan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingKasEntry(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isAddCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <div>
                <h4 className="text-sm font-extrabold text-white">Kelola Kategori Kas Koperasi</h4>
                <p className="text-[11px] text-slate-400">Tambah atau kurangi daftar kategori buku kas</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCatModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List Kategori Pemasukan */}
            <div className="space-y-2 mb-4">
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Kategori Pemasukan ({state.categoriesKasKoperasi.pemasukan.length})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto p-1">
                {state.categoriesKasKoperasi.pemasukan.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs"
                  >
                    <span className="text-slate-200">{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory('pemasukan', cat)}
                      className="p-1 rounded-lg text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* List Kategori Pengeluaran */}
            <div className="space-y-2 mb-5">
              <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                Kategori Pengeluaran ({state.categoriesKasKoperasi.pengeluaran.length})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto p-1">
                {state.categoriesKasKoperasi.pengeluaran.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs"
                  >
                    <span className="text-slate-200">{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory('pengeluaran', cat)}
                      className="p-1 rounded-lg text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Tambah Kategori Baru */}
            <form onSubmit={handleAddCategory} className="p-3 bg-slate-900/90 rounded-2xl border border-slate-700/80 space-y-3">
              <div className="text-xs font-black text-amber-400">+ Tambah Kategori Baru</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Tipe Transaksi</label>
                  <select
                    value={newCatTipe}
                    onChange={(e) => setNewCatTipe(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="pemasukan">Pemasukan (+)</option>
                    <option value="pengeluaran">Pengeluaran (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Nama Kategori</label>
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all"
              >
                + Simpan Kategori Baru
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT TRANSAKSI BUKU KAS (REQ 6) ================= */}
      {editingKasEntry && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-lg rounded-3xl p-5 shadow-2xl my-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-extrabold text-white">Edit Transaksi Buku Kas</h3>
                  <p className="text-[11px] text-slate-400">ID: {editingKasEntry.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingKasEntry(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditKas} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={editTanggal}
                    onChange={(e) => setEditTanggal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Buku Kas Tujuan *</label>
                  <select
                    value={editBukuKas}
                    onChange={(e) => setEditBukuKas(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="koperasi">Buku Kas Koperasi</option>
                    <option value="anggota">Buku Kas Anggota</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Tipe Mutasi (Masuk / Keluar) *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditTipe('masuk')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-black border transition-all ${
                        editTipe === 'masuk'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      + Masuk (CR)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTipe('keluar')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-black border transition-all ${
                        editTipe === 'keluar'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      - Keluar (DB)
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Nominal (Rp) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editNominal}
                    onChange={(e) => setEditNominal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold"
                  />
                </div>
              </div>

              {/* Edit Kategori Transaksi (Pilih Kategori, Tambah / Kurang) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-slate-300">
                    Kategori Transaksi ({editTipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCatTipe(editTipe === 'masuk' ? 'pemasukan' : 'pengeluaran');
                      setIsAddCatModalOpen(true);
                    }}
                    className="text-[10px] text-amber-400 hover:underline font-bold flex items-center gap-1"
                  >
                    <span>+ Tambah / Kurang Kategori</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={
                      (editTipe === 'masuk'
                        ? state.categoriesKasKoperasi.pemasukan
                        : state.categoriesKasKoperasi.pengeluaran
                      ).includes(editKategori)
                        ? editKategori
                        : ''
                    }
                    onChange={(e) => {
                      if (e.target.value) setEditKategori(e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="">-- Pilih dari Daftar --</option>
                    {(editTipe === 'masuk'
                      ? state.categoriesKasKoperasi.pemasukan
                      : state.categoriesKasKoperasi.pengeluaran
                    ).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Nama Kategori..."
                    value={editKategori}
                    onChange={(e) => setEditKategori(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Keterangan Transaksi *</label>
                <input
                  type="text"
                  required
                  value={editKeterangan}
                  onChange={(e) => setEditKeterangan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Nama Pihak Penerima / Penyetor</label>
                <input
                  type="text"
                  value={editNamaPenerima}
                  onChange={(e) => setEditNamaPenerima(e.target.value)}
                  placeholder="Contoh: Budi Santoso / PT Mitra"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingKasEntry(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-sky-500 to-sky-400 hover:from-sky-400 hover:to-sky-300 text-slate-950 font-black rounded-xl shadow-lg transition-all"
                >
                  {isWriter ? 'Ajukan Perubahan (Menunggu Approval)' : 'Simpan & Setujui Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL TANDA TERIMA PEMBAYARAN KAS (REQ 1 & REQ 15) ================= */}
      {selectedReceiptKas && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-lg rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Tanda Terima Kas Koperasi Resmi
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Bukti transaksi sah terintegrasi otomatis dengan sistem pembukuan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReceiptKas(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Kuitansi dengan Watermark Visual */}
            <div className="relative bg-slate-900 border border-slate-700/80 rounded-2xl p-4 text-xs space-y-3 overflow-hidden">
              {/* Visual Watermark Stamp on Preview Modal */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 opacity-10">
                <div className="text-3xl font-black text-amber-400 rotate-[-25deg] uppercase tracking-widest text-center border-4 border-amber-400 p-4 rounded-2xl">
                  WATERMARK RESMI<br/>KOPERASI HWS
                </div>
              </div>

              <div className="relative z-10 flex justify-between items-start pb-2 border-b border-slate-800">
                <div>
                  <div className="font-extrabold text-white text-xs">
                    {state.profile.nama}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {state.profile.badanHukum}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      selectedReceiptKas.tipe === 'masuk'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {selectedReceiptKas.tipe === 'masuk' ? 'Kas Masuk (BKM)' : 'Kas Keluar (BKK)'}
                  </span>
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                    🛡️ Ber-Watermark Resmi
                  </span>
                </div>
              </div>

              <div className="relative z-10 space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Nomor Transaksi:</span>
                  <span className="font-mono font-bold text-white">{selectedReceiptKas.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tanggal:</span>
                  <span className="font-bold text-white">{selectedReceiptKas.tanggal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {selectedReceiptKas.tipe === 'masuk' ? 'Diterima Dari:' : 'Dibayarkan Kepada:'}
                  </span>
                  <span className="font-extrabold text-amber-400">
                    {selectedReceiptKas.namaPenerima || (selectedReceiptKas.tipe === 'masuk' ? 'Penyetor / Anggota' : 'Pihak Penerima Kas')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Kategori Kas:</span>
                  <span className="text-sky-300 font-semibold">{selectedReceiptKas.kategori}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-slate-400">Keterangan:</span>
                  <span className="font-semibold text-white text-right max-w-[65%]">
                    {selectedReceiptKas.keterangan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Petugas Input:</span>
                  <span className="text-slate-200">{selectedReceiptKas.inputBy}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex justify-between items-center">
                <span className="font-bold text-slate-300">Total Nominal:</span>
                <span className="text-base font-black font-mono text-emerald-400">
                  {formatRupiah(selectedReceiptKas.nominal)}
                </span>
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedReceiptKas(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-all"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  printTandaTerimaKas(selectedReceiptKas, state.profile);
                }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <Printer className="w-4 h-4" />
                Cetak / Unduh PDF Tanda Terima
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL TRANSFER ANTAR BUKU KAS (REQ 2: KAS ANGGOTA ⇄ KAS KOPERASI) ================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-lg rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <ArrowLeftRight className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Transfer Antar Buku Kas Koperasi
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Pencatatan Pinjaman Kas & Pengembalian Kas ganda otomatis
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransferBukuKasSubmit} className="space-y-3.5 text-xs">
              {/* Petunjuk Sistem */}
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-indigo-300">
                  <span>ℹ️</span> Ketentuan Pencatatan Transfer Kas:
                </div>
                <div>• <b>Pinjaman Kas:</b> Dicatat dalam kategori <i>Pinjaman Kas</i> pada kas penerima & pengeluaran kas sumber.</div>
                <div>• <b>Pengembalian Kas:</b> Dicatat dalam kategori <i>Pengembalian Kas</i> pada kas yang diambil dan <i>Pengembalian Buku Kas</i> pada kas yang menerima.</div>
              </div>

              {/* Tipe Transfer: Pinjaman Kas vs Pengembalian Kas */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                  Jenis Transaksi Antar Kas: *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTfJenis('pinjaman_kas')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      tfJenis === 'pinjaman_kas'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-extrabold shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    <div className="font-bold text-xs">1. Pinjaman Kas</div>
                    <div className="text-[10px] opacity-80 mt-0.5">Talangan likuiditas antar kas</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTfJenis('pengembalian_kas')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      tfJenis === 'pengembalian_kas'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-extrabold shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    <div className="font-bold text-xs">2. Pengembalian Kas</div>
                    <div className="text-[10px] opacity-80 mt-0.5">Pengembalian dana pinjaman kas</div>
                  </button>
                </div>
              </div>

              {/* Pemilihan Sumber dan Tujuan Kas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-900 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Dari Buku Kas (Sumber):
                  </label>
                  <select
                    value={tfDariKas}
                    onChange={(e) => {
                      const val = e.target.value as 'anggota' | 'koperasi';
                      setTfDariKas(val);
                      setTfKeKas(val === 'anggota' ? 'koperasi' : 'anggota');
                    }}
                    className="w-full py-2 px-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="anggota">Buku Kas Anggota (Saldo: {formatRupiah(saldoKasAnggota)})</option>
                    <option value="koperasi">Buku Kas Koperasi (Saldo: {formatRupiah(saldoKasKoperasi)})</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Ke Buku Kas (Tujuan Penerima):
                  </label>
                  <div className="w-full py-2 px-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-amber-400 font-bold text-xs flex items-center justify-between">
                    <span>{tfKeKas === 'anggota' ? 'Buku Kas Anggota' : 'Buku Kas Koperasi'}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Tujuan</span>
                  </div>
                </div>
              </div>

              {/* Nominal Transfer */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Nominal Transfer Kas (Rp): *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">Rp</span>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="1000"
                    placeholder="Contoh: 1000000"
                    value={tfNominal}
                    onChange={(e) => setTfNominal(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                {tfNominal && Number(tfNominal) > 0 && (
                  <div className="text-[11px] text-amber-400 font-bold mt-1">
                    Terbilang: {formatRupiah(Number(tfNominal))}
                  </div>
                )}
              </div>

              {/* Tanggal & Petugas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Tanggal Transaksi: *
                  </label>
                  <input
                    type="date"
                    required
                    value={tfTanggal}
                    onChange={(e) => setTfTanggal(e.target.value)}
                    className="w-full py-2 px-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Petugas Input:
                  </label>
                  <input
                    type="text"
                    value={tfNamaPetugas || currentAdmin.nama}
                    onChange={(e) => setTfNamaPetugas(e.target.value)}
                    className="w-full py-2 px-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Catatan / Keterangan */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Catatan / Berita Transfer Kas:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pinjaman kas sementara likuiditas pos operasional koperasi"
                  value={tfKeterangan}
                  onChange={(e) => setTfKeterangan(e.target.value)}
                  className="w-full py-2 px-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!tfNominal || Number(tfNominal) <= 0}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 disabled:opacity-50 text-white font-black rounded-xl text-xs shadow-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Eksekusi Transfer Antar Kas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
