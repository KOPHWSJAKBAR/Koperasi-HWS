import React, { useState } from 'react';
import {
  AppState,
  MemberUser,
  AdminUser,
  SetoranVerifikasi,
  MemberTransaction,
  KasEntry,
} from '../types';
import { formatRupiah, createAuditLog } from '../lib/storage';
import { LogoHws } from '../lib/logo';
import { downloadExcelCsv, printDocumentHtml } from '../lib/exportPdf';
import {
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  Building2,
  Calendar,
  Eye,
  FileDown,
  X,
  CreditCard,
  Send,
  AlertTriangle,
} from 'lucide-react';

interface MemberVerificationViewProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentMember?: MemberUser;
  currentAdmin?: AdminUser;
}

export const MemberVerificationView: React.FC<MemberVerificationViewProps> = ({
  state,
  updateState,
  currentMember,
  currentAdmin,
}) => {
  const isMember = !!currentMember;

  // Member deposit form state
  const [jenisSetoran, setJenisSetoran] = useState<'kewajiban' | 'umum'>('kewajiban');
  const [jumlahHari, setJumlahHari] = useState<number>(1);
  const [nominalUmum, setNominalUmum] = useState<string>('50000');
  const [rekeningTujuan, setRekeningTujuan] = useState<string>(
    state.profile.rekeningPenampungan[0]?.bankName + ' - ' + state.profile.rekeningPenampungan[0]?.accountNumber || 'BCA 5490706161'
  );
  const [metode, setMetode] = useState<'transfer_bank' | 'qris'>('transfer_bank');
  const [buktiUrl, setBuktiUrl] = useState<string>('');
  const [catatan, setCatatan] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Penarikan Tabungan Umum State
  const [isTarikModalOpen, setIsTarikModalOpen] = useState(false);
  const [tipeTarik, setTipeTarik] = useState<'umum' | 'pokok'>('umum');
  const [nominalTarik, setNominalTarik] = useState<string>('');
  const [bankTujuanTarik, setBankTujuanTarik] = useState<string>(
    currentMember ? `${currentMember.bankPribadi.namaBank} - ${currentMember.bankPribadi.nomorRekening}` : ''
  );

  // Admin Verification State
  const [filterStatus, setFilterStatus] = useState<'semua' | 'pending' | 'disetujui' | 'ditolak'>('pending');
  const [previewBukti, setPreviewBukti] = useState<string | null>(null);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Calculations for setoran kewajiban
  const nominalKewajiban = (jumlahHari || 1) * state.profile.biayaWajibHarian; // 2.000 / hari
  const porsiPokok = (jumlahHari || 1) * state.profile.pembagianPokokHarian; // 1.000 / hari
  const porsiZakat = (jumlahHari || 1) * state.profile.pembagianZakatHarian; // 500 / hari
  const porsiQurban = (jumlahHari || 1) * state.profile.pembagianQurbanHarian; // 500 / hari

  const nominalFinal = jenisSetoran === 'kewajiban' ? nominalKewajiban : Number(nominalUmum) || 0;

  // Handle image upload for proof
  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBuktiUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit deposit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember) return;
    if (nominalFinal <= 0) {
      setMsg({ type: 'error', text: 'Nominal setoran harus lebih dari Rp 0.' });
      return;
    }
    if (!buktiUrl) {
      setMsg({ type: 'error', text: 'Harap lampirkan bukti transfer bank atau scan QRIS.' });
      return;
    }

    setIsSubmitting(true);
    const newDeposit: SetoranVerifikasi = {
      id: `dep-${Date.now()}`,
      nomorReferensi: `REF-HWS-${Date.now().toString().slice(-6)}`,
      memberId: currentMember.id,
      memberNama: currentMember.nama,
      memberRekening: currentMember.nomorRekening,
      memberWilayah: currentMember.wilayah,
      jenis: jenisSetoran,
      jumlahHari: jenisSetoran === 'kewajiban' ? jumlahHari : undefined,
      nominal: nominalFinal,
      rekeningTujuan,
      metode,
      buktiTransferUrl: buktiUrl,
      catatanAnggota: catatan,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await updateState((prev) => ({
      ...prev,
      setoranList: [newDeposit, ...prev.setoranList],
    }));

    setIsSubmitting(false);
    setMsg({
      type: 'success',
      text: 'Setoran berhasil diajukan! Menunggu verifikasi admin koperasi.',
    });
    setBuktiUrl('');
    setCatatan('');
  };

  // Submit Penarikan
  const handleTarikSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember) return;
    const amount = Number(nominalTarik);
    if (!amount || amount <= 0) {
      alert('Masukkan nominal penarikan yang valid.');
      return;
    }

    if (tipeTarik === 'umum') {
      if (amount > currentMember.saldoUmum) {
        alert(`Saldo Tabungan Umum tidak mencukupi (Tersedia: ${formatRupiah(currentMember.saldoUmum)})`);
        return;
      }
    } else {
      if (currentMember.isPokokLocked) {
        alert('Tabungan Pokok masih terkunci oleh sistem/admin.');
        return;
      }
      if (amount > currentMember.saldoPokok) {
        alert(`Saldo Tabungan Pokok tidak mencukupi (Tersedia: ${formatRupiah(currentMember.saldoPokok)})`);
        return;
      }
    }

    const now = new Date();
    const tgl = now.toISOString().split('T')[0];
    const jam = now.toTimeString().split(' ')[0].slice(0, 5);

    // Keterangan penarikan tabungan umum per req 42: "Tarikan Tunai [nama anggota]"
    const ket = tipeTarik === 'umum' ? `Tarikan Tunai ${currentMember.nama}` : `Tarikan Tabungan Pokok ${currentMember.nama}`;

    // New member transaction
    const newTx: MemberTransaction = {
      id: `tx-tarik-${Date.now()}`,
      memberId: currentMember.id,
      tanggal: tgl,
      jam,
      keterangan: ket,
      cbg: `KCP ${currentMember.wilayah.toUpperCase()}`,
      tipe: 'keluar',
      nominal: amount,
      saldoSetelah: tipeTarik === 'umum' ? currentMember.saldoUmum - amount : currentMember.saldoPokok - amount,
      kategori: tipeTarik === 'umum' ? 'umum' : 'pokok',
    };

    // Entry in Buku Kas Anggota (Keluar)
    const newKas: KasEntry = {
      id: `kas-${Date.now()}`,
      bukuKas: 'anggota',
      tanggal: tgl,
      kategori: tipeTarik === 'umum' ? 'Penarikan Tabungan Umum' : 'Penarikan Tabungan Pokok',
      keterangan: ket,
      tipe: 'keluar',
      nominal: amount,
      saldoKasSetelah: 0,
      inputBy: currentMember.nama,
      status: 'approved',
      createdAt: now.toISOString(),
    };

    await updateState((prev) => {
      const updatedMembers = prev.members.map((m) => {
        if (m.id === currentMember.id) {
          return {
            ...m,
            saldoUmum: tipeTarik === 'umum' ? m.saldoUmum - amount : m.saldoUmum,
            saldoPokok: tipeTarik === 'pokok' ? m.saldoPokok - amount : m.saldoPokok,
          };
        }
        return m;
      });

      return {
        ...prev,
        members: updatedMembers,
        memberTransactions: [...prev.memberTransactions, newTx],
        kasList: [newKas, ...prev.kasList],
      };
    });

    setIsTarikModalOpen(false);
    setNominalTarik('');
    alert(`Penarikan ${formatRupiah(amount)} berhasil diproses ke ${bankTujuanTarik}!`);
  };

  // ADMIN: Approve Deposit
  const handleApproveDeposit = async (dep: SetoranVerifikasi) => {
    if (!currentAdmin) return;
    const now = new Date();
    const tgl = now.toISOString().split('T')[0];
    const jam = now.toTimeString().split(' ')[0].slice(0, 5);

    await updateState((prev) => {
      const targetMember = prev.members.find((m) => m.id === dep.memberId);
      if (!targetMember) return prev;

      const newTxs: MemberTransaction[] = [];
      const newKasList: KasEntry[] = [];

      let updatedSaldoPokok = targetMember.saldoPokok;
      let updatedSaldoZakat = targetMember.saldoZakatFitrah;
      let updatedSaldoQurban = targetMember.saldoQurban;
      let updatedSaldoUmum = targetMember.saldoUmum;

      if (dep.jenis === 'kewajiban') {
        const jlhHari = dep.jumlahHari || 1;
        const pokokNominal = jlhHari * prev.profile.pembagianPokokHarian; // 1000/hari
        const zakatNominal = jlhHari * prev.profile.pembagianZakatHarian; // 500/hari
        const qurbanNominal = jlhHari * prev.profile.pembagianQurbanHarian; // 500/hari

        updatedSaldoPokok += pokokNominal;
        updatedSaldoZakat += zakatNominal;
        updatedSaldoQurban += qurbanNominal;

        // Transaction for Member Statement:
        // Per req 5: "di mutasi anggota tertulis 4000 rupiah" (total nominal)
        newTxs.push({
          id: `tx-wajib-${Date.now()}`,
          memberId: targetMember.id,
          tanggal: tgl,
          jam,
          keterangan: `SETORAN KEWAJIBAN ${jlhHari} HARI (POKOK, ZAKAT, QURBAN)`,
          cbg: `KCP ${targetMember.wilayah.toUpperCase()}`,
          tipe: 'masuk',
          nominal: dep.nominal,
          saldoSetelah: updatedSaldoPokok + updatedSaldoUmum,
          kategori: 'pokok',
          referensiId: dep.id,
        });

        // Buku Kas Anggota gets: Rp 1.000 / hari per req 54:
        // "Setoran Kewajiban [nama anggota] [jumlah hari] x 1000"
        newKasList.push({
          id: `kas-ang-${Date.now()}`,
          bukuKas: 'anggota',
          tanggal: tgl,
          kategori: 'Tabungan Pokok',
          keterangan: `Setoran Kewajiban ${targetMember.nama} ${jlhHari} x 1000`,
          tipe: 'masuk',
          nominal: pokokNominal,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        });

        // Buku Kas Koperasi gets Zakat & Qurban per req 5:
        // "nama anggota TAB ZAKAT FITRAH Jumlah hari di kali kewajiban perhari"
        newKasList.push({
          id: `kas-kop-zakat-${Date.now()}`,
          bukuKas: 'koperasi',
          tanggal: tgl,
          kategori: 'Iuran Tabungan Zakat & Qurban',
          keterangan: `${targetMember.nama} TAB ZAKAT FITRAH ${jlhHari} x 500`,
          tipe: 'masuk',
          nominal: zakatNominal,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        });

        newKasList.push({
          id: `kas-kop-qurban-${Date.now() + 1}`,
          bukuKas: 'koperasi',
          tanggal: tgl,
          kategori: 'Iuran Tabungan Zakat & Qurban',
          keterangan: `${targetMember.nama} TAB QURBAN ${jlhHari} x 500`,
          tipe: 'masuk',
          nominal: qurbanNominal,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        });
      } else {
        // Setoran Tabungan Umum Bebas
        updatedSaldoUmum += dep.nominal;

        // Mutasi anggota per req 41: "Setoran Tunai dengan nama anggota"
        newTxs.push({
          id: `tx-umum-${Date.now()}`,
          memberId: targetMember.id,
          tanggal: tgl,
          jam,
          keterangan: `Setoran Tunai ${targetMember.nama}`,
          cbg: `KCP ${targetMember.wilayah.toUpperCase()}`,
          tipe: 'masuk',
          nominal: dep.nominal,
          saldoSetelah: updatedSaldoUmum,
          kategori: 'umum',
          referensiId: dep.id,
        });

        // Buku Kas Anggota gets full nominal
        newKasList.push({
          id: `kas-ang-umum-${Date.now()}`,
          bukuKas: 'anggota',
          tanggal: tgl,
          kategori: 'Setoran Tabungan Umum',
          keterangan: `Setoran Tunai ${targetMember.nama}`,
          tipe: 'masuk',
          nominal: dep.nominal,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        });
      }

      const updatedMembers = prev.members.map((m) =>
        m.id === targetMember.id
          ? {
              ...m,
              saldoPokok: updatedSaldoPokok,
              saldoZakatFitrah: updatedSaldoZakat,
              saldoQurban: updatedSaldoQurban,
              saldoUmum: updatedSaldoUmum,
            }
          : m
      );

      const updatedSetoran = prev.setoranList.map((s) =>
        s.id === dep.id
          ? {
              ...s,
              status: 'disetujui' as const,
              verifiedBy: currentAdmin.nama,
              verifiedAt: now.toISOString(),
            }
          : s
      );

      const audit = createAuditLog(
        currentAdmin,
        'Verifikasi Setoran Berhasil',
        `Menyetujui setoran ${dep.jenis} sebesar ${formatRupiah(dep.nominal)} dari ${dep.memberNama}`,
        dep.id
      );

      return {
        ...prev,
        members: updatedMembers,
        setoranList: updatedSetoran,
        memberTransactions: [...prev.memberTransactions, ...newTxs],
        kasList: [...newKasList, ...prev.kasList],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // ADMIN: Reject Deposit
  const handleRejectDeposit = async (dep: SetoranVerifikasi) => {
    if (!currentAdmin) return;
    const reason = prompt('Masukkan alasan penolakan setoran:') || 'Bukti transfer tidak valid/dana belum masuk';

    await updateState((prev) => {
      const updatedSetoran = prev.setoranList.map((s) =>
        s.id === dep.id
          ? {
              ...s,
              status: 'ditolak' as const,
              alasanTolak: reason,
              verifiedBy: currentAdmin.nama,
              verifiedAt: new Date().toISOString(),
            }
          : s
      );

      const audit = createAuditLog(
        currentAdmin,
        'Tolak Setoran',
        `Menolak setoran ${formatRupiah(dep.nominal)} dari ${dep.memberNama}. Alasan: ${reason}`,
        dep.id
      );

      return {
        ...prev,
        setoranList: updatedSetoran,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Export deposits table to CSV or printable PDF
  const handleExportDeposits = (format: 'pdf' | 'excel') => {
    const listToExport = state.setoranList.filter((s) => {
      if (filterStatus !== 'semua' && s.status !== filterStatus) return false;
      if (filterStartDate && s.createdAt.split('T')[0] < filterStartDate) return false;
      if (filterEndDate && s.createdAt.split('T')[0] > filterEndDate) return false;
      return true;
    });

    if (format === 'excel') {
      const rows = listToExport.map((s) => ({
        'No Referensi': s.nomorReferensi,
        Tanggal: s.createdAt.split('T')[0],
        'Nama Anggota': s.memberNama,
        'No Rekening': s.memberRekening,
        Wilayah: s.memberWilayah,
        'Jenis Setoran': s.jenis === 'kewajiban' ? `Kewajiban (${s.jumlahHari} hari)` : 'Tabungan Umum',
        Nominal: s.nominal,
        Metode: s.metode,
        Status: s.status,
        'Diverifikasi Oleh': s.verifiedBy || '-',
      }));
      downloadExcelCsv(rows, `Rekap_Verifikasi_Setoran_${Date.now()}`);
    } else {
      const tableRows = listToExport
        .map(
          (s) => `
        <tr style="border-bottom: 1px solid #ddd; font-size: 11px;">
          <td style="padding: 6px;">${s.createdAt.split('T')[0]}</td>
          <td style="padding: 6px;">${s.nomorReferensi}</td>
          <td style="padding: 6px; font-weight: 700;">${s.memberNama}</td>
          <td style="padding: 6px;">${s.memberRekening}</td>
          <td style="padding: 6px;">${s.jenis === 'kewajiban' ? `Kewajiban (${s.jumlahHari} hari)` : 'Umum'}</td>
          <td style="padding: 6px; text-align: right; font-weight: 700;">${formatRupiah(s.nominal)}</td>
          <td style="padding: 6px; text-transform: uppercase;">${s.status}</td>
        </tr>
      `
        )
        .join('');

      const html = `
        <div style="padding: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px;">
            <div>
              <h2 style="font-size: 16px; font-weight: 900;">KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA</h2>
              <div style="font-size: 11px;">Laporan Rekapitulasi Verifikasi Setoran Anggota</div>
            </div>
            <div style="font-size: 10px; text-align: right;">Dicetak: ${new Date().toLocaleDateString('id-ID')}</div>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 14px;">
            <thead>
              <tr style="background: #f3f4f6; font-size: 11px; text-align: left;">
                <th style="padding: 6px;">Tanggal</th>
                <th style="padding: 6px;">No Ref</th>
                <th style="padding: 6px;">Nama</th>
                <th style="padding: 6px;">Rekening</th>
                <th style="padding: 6px;">Jenis</th>
                <th style="padding: 6px; text-align: right;">Nominal</th>
                <th style="padding: 6px;">Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      `;
      printDocumentHtml(html, 'Laporan_Verifikasi_Setoran');
    }
  };

  return (
    <div className="space-y-6">
      {/* ================= MEMBER SIDE ================= */}
      {isMember && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Setoran */}
          <div className="lg:col-span-7 bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/60 mb-5">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  Formulir Setoran Simpanan
                </h3>
                <p className="text-xs text-slate-400">
                  Setor tabungan pokok harian atau tabungan umum bebas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTarikModalOpen(true)}
                className="py-2 px-3.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <CreditCard className="w-4 h-4" />
                Tarik Saldo
              </button>
            </div>

            {msg && (
              <div
                className={`p-3 rounded-xl mb-4 text-xs flex items-center gap-2 ${
                  msg.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/80 border border-red-500/40 text-red-200'
                }`}
              >
                {msg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{msg.text}</span>
              </div>
            )}

            <form onSubmit={handleDepositSubmit} className="space-y-4">
              {/* Pilihan Jenis Setoran */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Pilih Jenis Setoran
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setJenisSetoran('kewajiban')}
                    className={`py-3 px-3 rounded-2xl text-left border transition-all ${
                      jenisSetoran === 'kewajiban'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <span>1. Tabungan Kewajiban</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Rp 2.000 / hari (Pokok + Zakat + Qurban)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setJenisSetoran('umum')}
                    className={`py-3 px-3 rounded-2xl text-left border transition-all ${
                      jenisSetoran === 'umum'
                        ? 'bg-sky-500/10 border-sky-500 text-sky-300 ring-1 ring-sky-500'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <span>2. Tabungan Umum Bebas</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Bebas setor & ditarik kapan saja
                    </div>
                  </button>
                </div>
              </div>

              {/* Rincian Input Nominal */}
              {jenisSetoran === 'kewajiban' ? (
                <div className="bg-[#162544] p-4 rounded-2xl border border-amber-500/30 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-1">
                      Jumlah Hari Disetor
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        required
                        value={jumlahHari}
                        onChange={(e) => setJumlahHari(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-center text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <span className="text-xs text-slate-300">Hari (x Rp 2.000 / hari)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-700/60 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="bg-slate-900/60 p-2 rounded-xl">
                      <div className="text-slate-400">Tab. Pokok (Rp1rb)</div>
                      <div className="font-bold text-amber-400 text-xs mt-0.5">
                        {formatRupiah(porsiPokok)}
                      </div>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl">
                      <div className="text-slate-400">Zakat Fitrah (Rp500)</div>
                      <div className="font-bold text-emerald-400 text-xs mt-0.5">
                        {formatRupiah(porsiZakat)}
                      </div>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl">
                      <div className="text-slate-400">Qurban (Rp500)</div>
                      <div className="font-bold text-emerald-400 text-xs mt-0.5">
                        {formatRupiah(porsiQurban)}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 font-bold">
                    <span className="text-xs text-slate-300">Total Yang Harus Ditransfer:</span>
                    <span className="text-base text-amber-400 font-extrabold">
                      {formatRupiah(nominalKewajiban)}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nominal Setoran Tabungan Umum
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={10000}
                      step={1000}
                      required
                      value={nominalUmum}
                      onChange={(e) => setNominalUmum(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[50000, 100000, 200000, 500000].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => setNominalUmum(String(quick))}
                        className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded-lg font-semibold"
                      >
                        {formatRupiah(quick).replace(',00', '')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rekening Tujuan Transfer */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Pilih Rekening Penampungan Koperasi HWS
                </label>
                <select
                  value={rekeningTujuan}
                  onChange={(e) => setRekeningTujuan(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  {state.profile.rekeningPenampungan.map((rek) => (
                    <option key={rek.id} value={`${rek.bankName} - ${rek.accountNumber}`}>
                      {rek.bankName} ({rek.accountNumber}) a/n {rek.accountHolder}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload Bukti Transfer */}
              <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-dashed border-slate-600">
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Upload Bukti Transfer Bank / Bukti QRIS *
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={handleProofUpload}
                    className="text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                  />
                  {buktiUrl && (
                    <div className="relative w-24 h-16 rounded-xl overflow-hidden border border-slate-600">
                      <img src={buktiUrl} alt="Preview Bukti" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-center text-emerald-400 py-0.5">
                        ✓ Terlampir
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#f59e0b] hover:bg-[#d97706] active:scale-[0.99] text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Mengirim...' : `Kirim Setoran (${formatRupiah(nominalFinal)})`}
              </button>
            </form>
          </div>

          {/* Right Column: QRIS Bank & Rekening Koperasi Preview */}
          <div className="lg:col-span-5 space-y-4">
            {/* Dynamic QRIS Card */}
            <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 shadow-xl text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <QrCode className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-extrabold text-white">
                  QRIS Resmi Koperasi HWS
                </h4>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Scan menggunakan BCA Mobile, Livin, BRImo, Dana, OVO, Gopay
              </p>

              {/* QR Code Container with Logo Center */}
              <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl shadow-inner flex flex-col items-center justify-center relative border-4 border-amber-500/30">
                {state.profile.qrisImageUrl ? (
                  <img
                    src={state.profile.qrisImageUrl}
                    alt="QRIS Koperasi"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  /* SVG QR Mockup with HWS Logo Center */
                  <div className="relative w-full h-full flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
                      <rect x="5" y="5" width="25" height="25" fill="#000" />
                      <rect x="8" y="8" width="19" height="19" fill="#fff" />
                      <rect x="12" y="12" width="11" height="11" fill="#000" />

                      <rect x="70" y="5" width="25" height="25" fill="#000" />
                      <rect x="73" y="8" width="19" height="19" fill="#fff" />
                      <rect x="77" y="12" width="11" height="11" fill="#000" />

                      <rect x="5" y="70" width="25" height="25" fill="#000" />
                      <rect x="8" y="73" width="19" height="19" fill="#fff" />
                      <rect x="12" y="77" width="11" height="11" fill="#000" />

                      {/* Pattern dots */}
                      <rect x="35" y="10" width="8" height="8" fill="#000" />
                      <rect x="50" y="15" width="10" height="6" fill="#000" />
                      <rect x="40" y="30" width="20" height="8" fill="#000" />
                      <rect x="65" y="40" width="10" height="10" fill="#000" />
                      <rect x="35" y="55" width="12" height="12" fill="#000" />
                      <rect x="55" y="60" width="10" height="8" fill="#000" />
                      <rect x="75" y="75" width="15" height="15" fill="#000" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 bg-white rounded-full p-1 shadow">
                        <LogoHws className="w-full h-full" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 py-1.5 px-3 bg-amber-500/10 border border-amber-500/30 rounded-xl inline-block">
                <span className="text-xs font-mono font-black text-amber-400">
                  Nominal: {formatRupiah(nominalFinal)}
                </span>
              </div>
            </div>

            {/* Rekening Penampungan Card */}
            <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 shadow-xl">
              <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-3">
                Daftar Rekening Bank Penampungan Koperasi
              </h4>
              <div className="space-y-2">
                {state.profile.rekeningPenampungan.map((rek) => (
                  <div
                    key={rek.id}
                    className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{rek.bankName}</div>
                      <div className="text-xs font-mono text-amber-400 font-extrabold">
                        {rek.accountNumber}
                      </div>
                      <div className="text-[10px] text-slate-400">a/n {rek.accountHolder}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(rek.accountNumber);
                        alert(`Nomor rekening ${rek.bankName} disalin: ${rek.accountNumber}`);
                      }}
                      className="py-1 px-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold rounded-lg"
                    >
                      Salin Rek
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PENARIKAN ANGGOTA ================= */}
      {isTarikModalOpen && currentMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700">
              <h3 className="text-sm font-extrabold text-white">Formulir Penarikan Saldo Simpanan</h3>
              <button onClick={() => setIsTarikModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTarikSubmit} className="pt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Pilih Tabungan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipeTarik('umum')}
                    className={`p-2.5 rounded-xl text-left border text-xs font-bold ${
                      tipeTarik === 'umum'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <div>Tabungan Umum</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                      Tersedia: {formatRupiah(currentMember.saldoUmum)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipeTarik('pokok')}
                    className={`p-2.5 rounded-xl text-left border text-xs font-bold ${
                      tipeTarik === 'pokok'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <div>Tabungan Pokok</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                      {currentMember.isPokokLocked ? '🔒 Terkunci Admin' : `Tersedia: ${formatRupiah(currentMember.saldoPokok)}`}
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nominal Penarikan</label>
                <input
                  type="number"
                  required
                  min={10000}
                  step={1000}
                  value={nominalTarik}
                  onChange={(e) => setNominalTarik(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Rekening Tujuan Penarikan</label>
                <input
                  type="text"
                  required
                  value={bankTujuanTarik}
                  onChange={(e) => setBankTujuanTarik(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  * Otomatis ditransfer ke rekening bank pribadi Anda ({currentMember.bankPribadi.namaBank})
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg"
              >
                Proses Penarikan Dana
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADMIN / HISTORY TABLE ================= */}
      <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/60">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white">
              {isMember ? 'Riwayat Pengajuan Setoran Saya' : 'Antrean Verifikasi Setoran Anggota'}
            </h3>
            <p className="text-xs text-slate-400">
              {isMember
                ? 'Status verifikasi transfer simpanan oleh pengurus koperasi'
                : 'Periksa foto bukti transfer dan konfirmasi penambahan saldo anggota'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200"
            >
              <option value="pending">Menunggu Verifikasi (Pending)</option>
              <option value="disetujui">Telah Disetujui</option>
              <option value="ditolak">Ditolak</option>
              <option value="semua">Semua Status</option>
            </select>

            <button
              onClick={() => handleExportDeposits('pdf')}
              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-bold rounded-xl flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5 text-amber-400" />
              Unduh PDF
            </button>
            <button
              onClick={() => handleExportDeposits('excel')}
              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-bold rounded-xl flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-400" />
              Excel
            </button>
          </div>
        </div>

        {/* List / Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/40 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Tanggal & Ref</th>
                <th className="py-2.5 px-3">Anggota</th>
                <th className="py-2.5 px-3">Jenis Setoran</th>
                <th className="py-2.5 px-3">Nominal</th>
                <th className="py-2.5 px-3">Bukti Transfer</th>
                <th className="py-2.5 px-3">Status</th>
                {!isMember && <th className="py-2.5 px-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {state.setoranList
                .filter((s) => {
                  if (isMember) return s.memberId === currentMember.id;
                  if (filterStatus !== 'semua' && s.status !== filterStatus) return false;
                  return true;
                })
                .map((dep) => (
                  <tr key={dep.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-mono text-slate-200">{dep.createdAt.split('T')[0]}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{dep.nomorReferensi}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{dep.memberNama}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {dep.memberRekening} • {dep.memberWilayah}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-200">
                        {dep.jenis === 'kewajiban'
                          ? `Tabungan Kewajiban (${dep.jumlahHari} hari)`
                          : 'Tabungan Umum'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">
                      {formatRupiah(dep.nominal)}
                    </td>
                    <td className="py-3 px-3">
                      {dep.buktiTransferUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewBukti(dep.buktiTransferUrl)}
                          className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-sky-500/20"
                        >
                          <Eye className="w-3 h-3" />
                          Lihat Bukti
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {dep.status === 'pending' && (
                        <span className="py-0.5 px-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Menunggu
                        </span>
                      )}
                      {dep.status === 'disetujui' && (
                        <span className="py-0.5 px-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Disetujui
                        </span>
                      )}
                      {dep.status === 'ditolak' && (
                        <span className="py-0.5 px-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Ditolak
                        </span>
                      )}
                    </td>
                    {!isMember && (
                      <td className="py-3 px-3 text-right">
                        {dep.status === 'pending' && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleApproveDeposit(dep)}
                              className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shadow transition-all"
                            >
                              ✓ Setujui
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectDeposit(dep)}
                              className="py-1 px-2 bg-red-900/60 hover:bg-red-800 text-red-300 rounded-lg text-[11px] font-bold"
                            >
                              ✕ Tolak
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>

          {state.setoranList.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs">
              Belum ada riwayat setoran simpanan yang diajukan.
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL PREVIEW BUKTI TRANSFER ================= */}
      {previewBukti && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-3 bg-[#162035] border-b border-slate-700 flex justify-between items-center">
              <span className="text-xs font-bold text-white">Foto Bukti Transfer Bank</span>
              <button onClick={() => setPreviewBukti(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img src={previewBukti} alt="Bukti Transfer" className="max-w-full rounded-lg object-contain shadow-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
