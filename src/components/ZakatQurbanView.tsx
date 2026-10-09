import React, { useState } from 'react';
import {
  AppState,
  AdminUser,
  MemberUser,
  WilayahKoperasi,
  PenyaluranZakatQurban,
  MemberTransaction,
  KasEntry,
} from '../types';
import { formatRupiah, createAuditLog } from '../lib/storage';
import { downloadExcelCsv, printDocumentHtml } from '../lib/exportPdf';
import { LogoHws } from '../lib/logo';
import {
  HeartHandshake,
  CheckCircle,
  FileDown,
  Printer,
  Calendar,
  Users,
  ShieldCheck,
  Send,
  AlertCircle,
} from 'lucide-react';

interface ZakatQurbanViewProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin?: AdminUser;
  currentMember?: MemberUser;
}

export const ZakatQurbanView: React.FC<ZakatQurbanViewProps> = ({
  state,
  updateState,
  currentAdmin,
  currentMember,
}) => {
  const isMember = !!currentMember;
  const isSuperAdmin = currentAdmin?.role === 'super_admin';

  // Form Penyaluran Zakat / Qurban
  const [jenisPenyaluran, setJenisPenyaluran] = useState<'zakat_fitrah' | 'qurban'>('zakat_fitrah');
  const [wilayahTarget, setWilayahTarget] = useState<WilayahKoperasi | 'Semua Wilayah'>('Semua Wilayah');
  const [nominalPerAnggota, setNominalPerAnggota] = useState<string>('');
  const [keterangan, setKeterangan] = useState('');
  const [showPenyaluranModal, setShowPenyaluranModal] = useState(false);

  // Period Filter for Reports per User Req
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Totals in Cooperative
  const totalZakatFitrah = state.members.reduce((acc, m) => acc + m.saldoZakatFitrah, 0);
  const totalQurban = state.members.reduce((acc, m) => acc + m.saldoQurban, 0);

  // Target Members for current distribution selection
  const eligibleMembers = state.members.filter((m) => {
    if (wilayahTarget !== 'Semua Wilayah' && m.wilayah !== wilayahTarget) return false;
    const balance = jenisPenyaluran === 'zakat_fitrah' ? m.saldoZakatFitrah : m.saldoQurban;
    return balance > 0;
  });

  const handleProposePenyaluran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdmin) return;
    const amountPerMember = Number(nominalPerAnggota);
    if (!amountPerMember || amountPerMember <= 0) {
      alert('Masukkan nominal penyaluran per anggota yang valid.');
      return;
    }

    if (eligibleMembers.length === 0) {
      alert('Tidak ada anggota di wilayah ini yang memiliki saldo untuk disalurkan.');
      return;
    }

    // Check if any member has less balance than requested
    const insufficientMember = eligibleMembers.find((m) => {
      const bal = jenisPenyaluran === 'zakat_fitrah' ? m.saldoZakatFitrah : m.saldoQurban;
      return bal < amountPerMember;
    });

    if (insufficientMember) {
      const bal = jenisPenyaluran === 'zakat_fitrah' ? insufficientMember.saldoZakatFitrah : insufficientMember.saldoQurban;
      alert(`Anggota ${insufficientMember.nama} hanya memiliki saldo ${formatRupiah(bal)}, kurang dari ${formatRupiah(amountPerMember)}.`);
      return;
    }

    const totalDistributed = amountPerMember * eligibleMembers.length;

    const newPenyaluran: PenyaluranZakatQurban = {
      id: `zkt-${Date.now()}`,
      tanggal: new Date().toISOString().split('T')[0],
      jenis: jenisPenyaluran,
      wilayah: wilayahTarget,
      totalPenyaluran: totalDistributed,
      nominalPerAnggota: amountPerMember,
      jumlahPenerima: eligibleMembers.length,
      penerimaIds: eligibleMembers.map((m) => m.id),
      keterangan: keterangan || `Penyaluran ${jenisPenyaluran === 'zakat_fitrah' ? 'Zakat Fitrah' : 'Tabungan Qurban'} ${wilayahTarget}`,
      diajukanOleh: currentAdmin.nama,
      status: isSuperAdmin ? 'disetujui' : 'pending_approval',
      disetujuiOleh: isSuperAdmin ? currentAdmin.nama : undefined,
      createdAt: new Date().toISOString(),
    };

    if (isSuperAdmin) {
      // Execute distribution directly
      await executeDistribution(newPenyaluran);
    } else {
      await updateState((prev) => ({
        ...prev,
        penyaluranList: [newPenyaluran, ...prev.penyaluranList],
      }));
      alert('Pengajuan penyaluran dikirim ke Super Admin untuk persetujuan.');
    }

    setShowPenyaluranModal(false);
    setNominalPerAnggota('');
    setKeterangan('');
  };

  const executeDistribution = async (p: PenyaluranZakatQurban) => {
    const now = new Date();
    const tgl = p.tanggal;
    const jam = now.toTimeString().split(' ')[0].slice(0, 5);

    await updateState((prev) => {
      const memberTxs: MemberTransaction[] = [];
      const updatedMembers = prev.members.map((m) => {
        if (p.penerimaIds.includes(m.id)) {
          const newZakat = p.jenis === 'zakat_fitrah' ? m.saldoZakatFitrah - p.nominalPerAnggota : m.saldoZakatFitrah;
          const newQurban = p.jenis === 'qurban' ? m.saldoQurban - p.nominalPerAnggota : m.saldoQurban;

          // Transaction for Member Statement per req 40: "Disalurkan Oleh Koperasi"
          memberTxs.push({
            id: `tx-dist-${Date.now()}-${m.id}`,
            memberId: m.id,
            tanggal: tgl,
            jam,
            keterangan: 'Disalurkan Oleh Koperasi',
            cbg: `KCP ${m.wilayah.toUpperCase()}`,
            tipe: 'keluar',
            nominal: p.nominalPerAnggota,
            saldoSetelah: p.jenis === 'zakat_fitrah' ? newZakat : newQurban,
            kategori: p.jenis === 'zakat_fitrah' ? 'zakat' : 'qurban',
            referensiId: p.id,
          });

          return {
            ...m,
            saldoZakatFitrah: newZakat,
            saldoQurban: newQurban,
          };
        }
        return m;
      });

      // Keluar dari Buku Kas Koperasi per req 48
      const kasEntry: KasEntry = {
        id: `kas-zkt-${Date.now()}`,
        bukuKas: 'koperasi',
        tanggal: tgl,
        kategori: p.jenis === 'zakat_fitrah' ? 'Penyaluran Zakat Fitrah' : 'Penyaluran Tabungan Qurban',
        keterangan: `Penyaluran ${p.jenis === 'zakat_fitrah' ? 'Zakat Fitrah' : 'Qurban'} (${p.jumlahPenerima} anggota @ ${formatRupiah(p.nominalPerAnggota)})`,
        tipe: 'keluar',
        nominal: p.totalPenyaluran,
        saldoKasSetelah: 0,
        inputBy: currentAdmin?.nama || 'Admin',
        status: 'approved',
        createdAt: now.toISOString(),
      };

      const audit = createAuditLog(
        currentAdmin || { id: 'admin', nama: 'Admin', role: 'super_admin' } as any,
        'Penyaluran Syariah',
        `Menyalurkan ${p.jenis} total ${formatRupiah(p.totalPenyaluran)} kepada ${p.jumlahPenerima} anggota`,
        p.id
      );

      return {
        ...prev,
        members: updatedMembers,
        memberTransactions: [...prev.memberTransactions, ...memberTxs],
        kasList: [kasEntry, ...prev.kasList],
        penyaluranList: [
          { ...p, status: 'disetujui' as const, disetujuiOleh: currentAdmin?.nama },
          ...prev.penyaluranList.filter((item) => item.id !== p.id),
        ],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    alert('Penyaluran berhasil diproses dan dicatat di mutasi anggota & kas koperasi!');
  };

  // Filtered Penyaluran by Period per User Req
  const filteredPenyaluranList = state.penyaluranList.filter((p) => {
    if (filterStartDate && p.tanggal < filterStartDate) return false;
    if (filterEndDate && p.tanggal > filterEndDate) return false;
    return true;
  });

  // Export Zakat & Qurban Report (with multiple small watermarks per req D1)
  const handleExportSyariah = (format: 'pdf' | 'excel') => {
    if (format === 'excel') {
      const rows = filteredPenyaluranList.map((p) => ({
        'Koperasi': 'Koperasi Himpunan Wirausaha Sejahtera',
        Tanggal: p.tanggal,
        Jenis: p.jenis === 'zakat_fitrah' ? 'Zakat Fitrah' : 'Tabungan Qurban',
        Wilayah: p.wilayah || 'Semua Wilayah',
        'Jumlah Penerima': p.jumlahPenerima,
        'Nominal Per Anggota': p.nominalPerAnggota,
        'Total Penyaluran': p.totalPenyaluran,
        Keterangan: p.keterangan,
        Status: p.status,
      }));
      downloadExcelCsv(rows, `Laporan_Zakat_Qurban_${Date.now()}`);
    } else {
      const tableRows = filteredPenyaluranList
        .map(
          (p) => `
        <tr style="border-bottom: 1px solid #ddd; font-size: 11px;">
          <td style="padding: 6px;">${p.tanggal}</td>
          <td style="padding: 6px; font-weight: 700;">${p.jenis === 'zakat_fitrah' ? 'Zakat Fitrah' : 'Tabungan Qurban'}</td>
          <td style="padding: 6px;">${p.wilayah}</td>
          <td style="padding: 6px; text-align: center;">${p.jumlahPenerima} orang</td>
          <td style="padding: 6px; text-align: right; font-weight: 700;">${formatRupiah(p.totalPenyaluran)}</td>
          <td style="padding: 6px;">${p.status.toUpperCase()}</td>
        </tr>
      `
        )
        .join('');

      const html = `
        <div style="position: relative; padding: 20px;">
          <!-- Multiple Repeated Small Watermark per req D1 -->
          <div style="position: absolute; inset: 0; pointer-events: none; opacity: 0.04; display: grid; grid-template-columns: repeat(4, 1fr); gap: 40px; align-items: center; justify-items: center; z-index: 0;">
            ${Array.from({ length: 16 })
              .map(
                () => `
              <svg width="80" height="80" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="100" r="98" fill="#FEE024" stroke="#000" stroke-width="2" />
                <rect x="42" y="58" width="18" height="30" fill="#2E9E44" />
                <path d="M30 96 L100 28 L170 96 L154 96 L100 44 L46 96 Z" fill="#D62828" />
              </svg>
            `
              )
              .join('')}
          </div>

          <div style="position: relative; z-index: 10;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <svg width="45" height="45" viewBox="0 0 200 200" fill="none">
                  <circle cx="100" cy="100" r="98" fill="#FEE024" stroke="#000" stroke-width="2" />
                  <path d="M30 96 L100 28 L170 96 L154 96 L100 44 L46 96 Z" fill="#D62828" />
                </svg>
                <div>
                  <h2 style="font-size: 15px; font-weight: 900; margin: 0;">KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA</h2>
                  <div style="font-size: 11px; font-weight: 700; color: #b45309;">Laporan Resmi Penyaluran Zakat Fitrah & Tabungan Qurban</div>
                  ${filterStartDate || filterEndDate ? `<div style="font-size: 10px; color: #555;">Periode: ${filterStartDate || 'Awal'} s/d ${filterEndDate || 'Sekarang'}</div>` : ''}
                </div>
              </div>
              <div style="font-size: 10px; text-align: right;">Dicetak: ${new Date().toLocaleDateString('id-ID')}</div>
            </div>

            <div style="display: flex; gap: 20px; margin: 14px 0; font-size: 12px;">
              <div style="flex: 1; background: #fef3c7; padding: 10px; border-radius: 6px;">
                <b>Total Saldo Zakat Terkumpul:</b> ${formatRupiah(totalZakatFitrah)}
              </div>
              <div style="flex: 1; background: #d1fae5; padding: 10px; border-radius: 6px;">
                <b>Total Saldo Qurban Terkumpul:</b> ${formatRupiah(totalQurban)}
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #ddd;">
              <thead>
                <tr style="background: #f9fafb; font-size: 11px; text-align: left; border-bottom: 1px solid #ddd;">
                  <th style="padding: 6px;">Tanggal</th>
                  <th style="padding: 6px;">Jenis</th>
                  <th style="padding: 6px;">Wilayah</th>
                  <th style="padding: 6px; text-align: center;">Penerima</th>
                  <th style="padding: 6px; text-align: right;">Total Disalurkan</th>
                  <th style="padding: 6px;">Status</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </div>
      `;
      printDocumentHtml(html, 'Laporan_Resmi_Zakat_Qurban_HWS');
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Zakat Fitrah Card */}
        <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400">
              {isMember ? 'Saldo Zakat Fitrah Saya' : 'Total Saldo Zakat Fitrah (Seluruh Anggota)'}
            </span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {formatRupiah(isMember ? currentMember.saldoZakatFitrah : totalZakatFitrah)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Iuran Rp 500 / hari • Dikelola & disalurkan oleh Pengurus Koperasi HWS
            </div>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400">
            <HeartHandshake className="w-6 h-6" />
          </div>
        </div>

        {/* Tabungan Qurban Card */}
        <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400">
              {isMember ? 'Saldo Tabungan Qurban Saya' : 'Total Saldo Tabungan Qurban (Seluruh Anggota)'}
            </span>
            <div className="text-2xl font-black text-sky-400 mt-1">
              {formatRupiah(isMember ? currentMember.saldoQurban : totalQurban)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Iuran Rp 500 / hari • Untuk pembelian hewan qurban bersama
            </div>
          </div>
          <div className="w-12 h-12 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center justify-center text-sky-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Admin Action Bar */}
      {!isMember && (
        <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-white">
              Penyaluran & Penarikan Zakat Fitrah / Qurban
            </h3>
            <p className="text-xs text-slate-400">
              Pencairan disalurkan serentak atau per wilayah dengan persetujuan Super Admin
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPenyaluranModal(true)}
              className="py-2 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              Salurkan Zakat / Qurban
            </button>
            <button
              onClick={() => handleExportSyariah('pdf')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 border border-amber-500/30 rounded-xl font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Cetak PDF
            </button>
            <button
              onClick={() => handleExportSyariah('excel')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-emerald-400 border border-emerald-500/30 rounded-xl font-bold flex items-center gap-1.5"
            >
              <FileDown className="w-4 h-4" />
              Excel
            </button>
          </div>
        </div>
      )}

      {/* History Table of Distributions */}
      <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-700">
          <h4 className="text-sm font-extrabold text-white">
            Riwayat Penyaluran Zakat Fitrah & Tabungan Qurban
          </h4>

          {/* Quick Period Buttons per User Req */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-bold mr-1">Filter Periode:</span>
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setFilterStartDate(today);
                setFilterEndDate(today);
              }}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-bold border border-slate-700 text-[11px]"
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
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-bold border border-slate-700 text-[11px]"
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
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-bold border border-slate-700 text-[11px]"
            >
              Tahun Ini
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStartDate('');
                setFilterEndDate('');
              }}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold border border-slate-700 text-[11px]"
            >
              Semua
            </button>
          </div>
        </div>

        {/* Date Range Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1">Dari Tanggal:</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold mb-1">Sampai Tanggal:</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/40 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Jenis Dana</th>
                <th className="py-2.5 px-3">Wilayah Penerima</th>
                <th className="py-2.5 px-3">Keterangan</th>
                <th className="py-2.5 px-3 text-right">Nominal Total</th>
                <th className="py-2.5 px-3">Status</th>
                {!isMember && isSuperAdmin && <th className="py-2.5 px-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredPenyaluranList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 font-mono text-slate-300">{item.tanggal}</td>
                  <td className="py-3 px-3 font-bold text-white">
                    {item.jenis === 'zakat_fitrah' ? 'Zakat Fitrah' : 'Tabungan Qurban'}
                  </td>
                  <td className="py-3 px-3 text-slate-300">{item.wilayah || 'Semua'}</td>
                  <td className="py-3 px-3 text-slate-300">
                    <div>{item.keterangan}</div>
                    <div className="text-[10px] text-slate-500">
                      {item.jumlahPenerima} anggota @ {formatRupiah(item.nominalPerAnggota)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                    {formatRupiah(item.totalPenyaluran)}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`py-0.5 px-2 rounded-full text-[10px] font-bold border ${
                        item.status === 'disetujui'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  {!isMember && isSuperAdmin && (
                    <td className="py-3 px-3 text-right">
                      {item.status === 'pending_approval' && (
                        <button
                          onClick={() => executeDistribution(item)}
                          className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold"
                        >
                          Setujui Penyaluran
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {filteredPenyaluranList.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs">
              Belum ada riwayat penyaluran zakat atau qurban pada periode yang dipilih.
            </div>
          )}
        </div>
      </div>

      {/* Modal Penyaluran */}
      {showPenyaluranModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl">
            <h3 className="text-sm font-extrabold text-white mb-3 pb-2 border-b border-slate-700">
              Formulir Penyaluran Zakat & Qurban
            </h3>

            <form onSubmit={handleProposePenyaluran} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Jenis Dana Syariah</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setJenisPenyaluran('zakat_fitrah')}
                    className={`py-2 rounded-xl font-bold border ${
                      jenisPenyaluran === 'zakat_fitrah'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Zakat Fitrah
                  </button>
                  <button
                    type="button"
                    onClick={() => setJenisPenyaluran('qurban')}
                    className={`py-2 rounded-xl font-bold border ${
                      jenisPenyaluran === 'qurban'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Tabungan Qurban
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Pilih Target Wilayah</label>
                <select
                  value={wilayahTarget}
                  onChange={(e) => setWilayahTarget(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="Semua Wilayah">Semua Wilayah</option>
                  <option value="Cengkareng">Wilayah Cengkareng</option>
                  <option value="Kalideres">Wilayah Kalideres</option>
                  <option value="Kembangan">Wilayah Kembangan</option>
                  <option value="Kebon Jeruk">Wilayah Kebon Jeruk</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Anggota eligible di wilayah ini: <b>{eligibleMembers.length} orang</b>
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Nominal Penarikan Saldo per Anggota (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={500}
                  value={nominalPerAnggota}
                  onChange={(e) => setNominalPerAnggota(e.target.value)}
                  placeholder="Contoh: 10000"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Keterangan Penyaluran</label>
                <input
                  type="text"
                  required
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Contoh: Penyaluran Paket Zakat Beras Idul Fitri 1447H"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPenyaluranModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow"
                >
                  {isSuperAdmin ? 'Proses Penyaluran Sekarang' : 'Ajukan Penyaluran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
