import React, { useMemo, useState } from 'react';
import { AppState, AdminUser, MemberUser, WILAYAH_CODE_MAP, WilayahKoperasi } from '../types';
import {
  formatRupiah,
  formatWibDateShort,
  filterAndDeduplicateMemberTransactions,
  sortMembersDesc,
} from '../lib/storage';
import { downloadExcelCsv, printDocumentHtml } from '../lib/exportPdf';
import { MutasiRekeningView } from './MutasiRekeningView';
import {
  Wallet,
  Search,
  Users,
  Printer,
  FileDown,
  Eye,
  X,
  ArrowUpDown,
  MapPin,
  Filter,
} from 'lucide-react';

interface TabunganUmumViewProps {
  state: AppState;
  currentAdmin: AdminUser;
}

type SortMode = 'saldo_desc' | 'saldo_asc' | 'nama_asc' | 'terbaru';

export const TabunganUmumView: React.FC<TabunganUmumViewProps> = ({ state, currentAdmin }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [wilayahFilter, setWilayahFilter] = useState<'semua' | WilayahKoperasi>('semua');
  const [onlyPositive, setOnlyPositive] = useState<boolean>(true);
  const [sortMode, setSortMode] = useState<SortMode>('saldo_desc');
  const [selectedMemberForMutasi, setSelectedMemberForMutasi] = useState<MemberUser | null>(null);

  const wilayahList = Object.keys(WILAYAH_CODE_MAP) as WilayahKoperasi[];

  const enrichedMembers = useMemo(() => {
    const members = sortMembersDesc(state.members || []);
    const { transactions: cleanAllTxs } = filterAndDeduplicateMemberTransactions({
      transactions: state.memberTransactions || [],
      setoranList: state.setoranList || [],
      deletedTransactionIds: state.deletedTransactionIds || [],
      deletedSetoranIds: state.deletedSetoranIds || [],
      members: state.members || [],
      deletedMemberIds: state.deletedMemberIds || [],
    });

    return members.map((m) => {
      const memberTxs = cleanAllTxs.filter((tx) => tx.memberId === m.id);
      const umumTxs = memberTxs.filter(
        (tx) =>
          tx.kategori === 'umum' ||
          String(tx.keterangan || '').toLowerCase().includes('tabungan umum') ||
          String(tx.keterangan || '').toLowerCase().includes('tabungan bebas') ||
          String(tx.keterangan || '').toLowerCase().includes('transfer')
      );
      const lastUmumTx = umumTxs
        .slice()
        .sort((a, b) => `${b.tanggal} ${b.jam || ''}`.localeCompare(`${a.tanggal} ${a.jam || ''}`))[0];
      return {
        member: m,
        saldoUmum: Number(m.saldoUmum) || 0,
        umumTxCount: umumTxs.length,
        lastTxDate: lastUmumTx?.tanggal || '',
      };
    });
  }, [
    state.members,
    state.memberTransactions,
    state.setoranList,
    state.deletedTransactionIds,
    state.deletedSetoranIds,
    state.deletedMemberIds,
  ]);

  const summary = useMemo(() => {
    const holders = enrichedMembers.filter((item) => item.saldoUmum > 0);
    const totalDana = holders.reduce((acc, item) => acc + item.saldoUmum, 0);
    const countHolders = holders.length;
    const avgSaldo = countHolders > 0 ? Math.round(totalDana / countHolders) : 0;
    const topHolder = holders.slice().sort((a, b) => b.saldoUmum - a.saldoUmum)[0] || null;
    return {
      totalMembers: enrichedMembers.length,
      countHolders,
      totalDana,
      avgSaldo,
      topHolder,
    };
  }, [enrichedMembers]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const list = enrichedMembers.filter((item) => {
      if (onlyPositive && item.saldoUmum <= 0) return false;
      if (wilayahFilter !== 'semua' && item.member.wilayah !== wilayahFilter) return false;
      if (!q) return true;
      return (
        item.member.nama.toLowerCase().includes(q) ||
        String(item.member.nomorRekening || '').toLowerCase().includes(q) ||
        String(item.member.nomorAnggota || '').toLowerCase().includes(q) ||
        String(item.member.wilayah || '').toLowerCase().includes(q) ||
        (qDigits.length >= 3 && String(item.member.whatsapp || '').replace(/\D/g, '').includes(qDigits))
      );
    });

    return list.slice().sort((a, b) => {
      if (sortMode === 'saldo_desc') {
        if (b.saldoUmum !== a.saldoUmum) return b.saldoUmum - a.saldoUmum;
        return a.member.nama.localeCompare(b.member.nama, 'id');
      }
      if (sortMode === 'saldo_asc') {
        if (a.saldoUmum !== b.saldoUmum) return a.saldoUmum - b.saldoUmum;
        return a.member.nama.localeCompare(b.member.nama, 'id');
      }
      if (sortMode === 'nama_asc') {
        return a.member.nama.localeCompare(b.member.nama, 'id');
      }
      return 0; // 'terbaru' preserves sortMembersDesc order
    });
  }, [enrichedMembers, onlyPositive, wilayahFilter, searchQuery, sortMode]);

  const filteredTotalSaldo = useMemo(
    () => filteredList.reduce((acc, item) => acc + item.saldoUmum, 0),
    [filteredList]
  );

  const handleExportExcel = () => {
    const rows = filteredList.map((item, idx) => ({
      No: idx + 1,
      'No. Rekening / Anggota': item.member.nomorRekening,
      'Nama Anggota': item.member.nama,
      Wilayah: item.member.wilayah,
      'No. WhatsApp': item.member.whatsapp,
      'Status Anggota': item.member.status,
      'Jumlah Mutasi Tabungan Umum': item.umumTxCount,
      'Transaksi Terakhir': item.lastTxDate ? formatWibDateShort(item.lastTxDate) : '-',
      'Saldo Tabungan Umum (Rp)': item.saldoUmum,
    }));
    const today = new Date().toISOString().slice(0, 10);
    downloadExcelCsv(rows, `Daftar_Tabungan_Umum_Anggota_${today}.csv`);
  };

  const handleExportPdf = () => {
    const rowsHtml = filteredList
      .map(
        (item, idx) => `
        <tr>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;font-family:'JetBrains Mono',monospace;">${item.member.nomorRekening}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;">${item.member.nama}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;">${item.member.wilayah}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">${item.umumTxCount}x</td>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:#0369a1;">${formatRupiah(item.saldoUmum)}</td>
        </tr>`
      )
      .join('');

    const html = `
      <div class="watermark-container">
        <div class="watermark-security-stamp">KOPERASI HWS • TABUNGAN UMUM</div>
        <div class="content-layer">
          <div style="border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;">
            <div>
              <h1 style="font-size:18px;font-weight:900;color:#0f172a;">LAPORAN SIMPANAN TABUNGAN UMUM ANGGOTA</h1>
              <p style="font-size:12px;color:#475569;margin-top:2px;">${state.profile.nama} • Filter: ${onlyPositive ? 'Memiliki Saldo > Rp 0' : 'Semua Anggota'} • Wilayah: ${wilayahFilter === 'semua' ? 'Semua Wilayah' : wilayahFilter}</p>
            </div>
            <div style="text-align:right;font-size:11px;color:#475569;">
              <div>Dicetak: ${formatWibDateShort(new Date())}</div>
              <div>Admin: ${currentAdmin.nama}</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
            <div style="padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Jumlah Anggota Ditampilkan</div>
              <div style="font-size:16px;font-weight:900;color:#0f172a;margin-top:2px;">${filteredList.length} Anggota</div>
            </div>
            <div style="padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#f0f9ff;">
              <div style="font-size:10px;color:#0369a1;text-transform:uppercase;font-weight:700;">Total Dana Tabungan Umum</div>
              <div style="font-size:16px;font-weight:900;color:#0369a1;margin-top:2px;font-family:'JetBrains Mono',monospace;">${formatRupiah(filteredTotalSaldo)}</div>
            </div>
            <div style="padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Total Seluruh Pemilik Saldo &gt; 0</div>
              <div style="font-size:16px;font-weight:900;color:#0f172a;margin-top:2px;">${summary.countHolders} dari ${summary.totalMembers} Anggota</div>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#0f172a;color:#ffffff;">
                <th style="padding:8px;border:1px solid #334155;width:40px;">No</th>
                <th style="padding:8px;border:1px solid #334155;text-align:left;">No. Rekening</th>
                <th style="padding:8px;border:1px solid #334155;text-align:left;">Nama Anggota</th>
                <th style="padding:8px;border:1px solid #334155;text-align:left;">Wilayah</th>
                <th style="padding:8px;border:1px solid #334155;text-align:center;">Mutasi</th>
                <th style="padding:8px;border:1px solid #334155;text-align:right;">Saldo Tabungan Umum</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="6" style="padding:16px;text-align:center;color:#64748b;border:1px solid #cbd5e1;">Tidak ada data anggota yang sesuai filter.</td></tr>'}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9;font-weight:900;">
                <td colspan="5" style="padding:9px;border:1px solid #cbd5e1;text-align:right;">TOTAL DANA TABUNGAN UMUM:</td>
                <td style="padding:9px;border:1px solid #cbd5e1;text-align:right;font-family:'JetBrains Mono',monospace;color:#0369a1;">${formatRupiah(filteredTotalSaldo)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
    printDocumentHtml(html, 'Laporan Tabungan Umum Anggota - Koperasi HWS');
  };

  return (
    <div className="space-y-5">
      {/* Header & Export Actions */}
      <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Simpanan Tabungan Umum Anggota
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Daftar anggota pemilik simpanan tabungan umum beserta rincian mutasi rekening
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Unduh Excel</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Pemilik Tabungan Umum
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-1.5 font-mono tabular-nums">
            {summary.countHolders}{' '}
            <span className="text-xs font-semibold text-slate-400 font-sans">
              / {summary.totalMembers} anggota
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Saldo &gt; Rp 0</div>
        </div>

        <div className="bg-[#0d1424] border border-sky-500/30 rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
            Total Dana Tabungan Umum
          </div>
          <div className="text-xl sm:text-2xl font-black text-sky-400 mt-1.5 font-mono tabular-nums break-all">
            {formatRupiah(summary.totalDana)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Akumulasi seluruh pemilik</div>
        </div>

        <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Rata-Rata Saldo
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1.5 font-mono tabular-nums break-all">
            {formatRupiah(summary.avgSaldo)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Per pemilik tabungan umum</div>
        </div>

        <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Saldo Tertinggi
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1.5 font-mono tabular-nums break-all">
            {formatRupiah(summary.topHolder?.saldoUmum || 0)}
          </div>
          <div className="text-[11px] text-slate-300 mt-1 truncate">
            {summary.topHolder ? summary.topHolder.member.nama : 'Belum ada pemilik saldo'}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama anggota, nomor rekening, wilayah, atau HP..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggles & Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Filter: Saldo > 0 vs Semua */}
            <div className="inline-flex rounded-xl bg-slate-900 border border-slate-700/80 p-0.5">
              <button
                type="button"
                onClick={() => setOnlyPositive(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  onlyPositive
                    ? 'bg-sky-500 text-slate-950 font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Punya Saldo ({summary.countHolders})
              </button>
              <button
                type="button"
                onClick={() => setOnlyPositive(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  !onlyPositive
                    ? 'bg-amber-500 text-slate-950 font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua ({summary.totalMembers})
              </button>
            </div>

            {/* Wilayah Filter */}
            <div className="relative flex items-center">
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                value={wilayahFilter}
                onChange={(e) => setWilayahFilter(e.target.value as any)}
                className="pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-semibold text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="semua">Semua Wilayah</option>
                {wilayahList.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Filter */}
            <div className="relative flex items-center">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-semibold text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="saldo_desc">Saldo Tertinggi</option>
                <option value="saldo_asc">Saldo Terendah</option>
                <option value="nama_asc">Nama (A - Z)</option>
                <option value="terbaru">Pendaftaran Terbaru</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Result Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-sky-400" />
            <span>
              Menampilkan <b className="text-white font-mono tabular-nums">{filteredList.length}</b> anggota
              {wilayahFilter !== 'semua' ? ` di wilayah ${wilayahFilter}` : ''}
            </span>
          </span>
          <span>
            Subtotal Tabungan Umum:{' '}
            <b className="text-sky-400 font-mono tabular-nums">{formatRupiah(filteredTotalSaldo)}</b>
          </span>
        </div>
      </div>

      {/* Member Table (Desktop) */}
      <div className="hidden md:block bg-[#0d1424] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Anggota</th>
                <th className="py-3 px-4">No. Rekening / Anggota</th>
                <th className="py-3 px-4">Wilayah</th>
                <th className="py-3 px-4 text-center">Aktivitas Umum</th>
                <th className="py-3 px-4 text-right">Saldo Tabungan Umum</th>
                <th className="py-3 px-4 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <div className="font-bold text-slate-300">
                      Tidak ada anggota yang sesuai filter
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Coba ubah kata kunci pencarian, wilayah, atau tampilkan semua anggota.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr key={item.member.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{item.member.nama}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.member.whatsapp}</div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-300">
                      {item.member.nomorRekening}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{item.member.wilayah}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="font-mono tabular-nums font-bold text-slate-200">
                        {item.umumTxCount} transaksi
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.lastTxDate ? `Terakhir ${formatWibDateShort(item.lastTxDate)}` : 'Belum ada mutasi'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-extrabold text-sky-400 text-sm">
                      {formatRupiah(item.saldoUmum)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedMemberForMutasi(item.member)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat Mutasi</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Card List (Mobile) */}
      <div className="md:hidden space-y-2.5">
        {filteredList.length === 0 ? (
          <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <div className="text-xs font-bold text-slate-300">Tidak ada anggota yang sesuai filter</div>
          </div>
        ) : (
          filteredList.map((item, idx) => (
            <div
              key={item.member.id}
              className="bg-[#0d1424] border border-slate-800 rounded-2xl p-3.5 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono tabular-nums text-slate-500">#{idx + 1}</span>
                    <span className="text-sm font-extrabold text-white truncate">{item.member.nama}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                    {item.member.nomorRekening} • {item.member.wilayah}
                  </div>
                </div>
                <span className="text-sm font-black font-mono tabular-nums text-sky-400 shrink-0">
                  {formatRupiah(item.saldoUmum)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-slate-400">
                  {item.umumTxCount} mutasi •{' '}
                  {item.lastTxDate ? formatWibDateShort(item.lastTxDate) : 'Belum ada transaksi'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMemberForMutasi(item.member)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-sky-300 border border-sky-500/30 font-bold cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>Mutasi</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Mutasi Rekening Anggota */}
      {selectedMemberForMutasi && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedMemberForMutasi(null);
          }}
        >
          <div className="bg-[#0b1120] border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 sticky top-0 bg-[#0b1120] z-10">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  Mutasi Rekening • {selectedMemberForMutasi.nama}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  No. Rekening: {selectedMemberForMutasi.nomorRekening} • Saldo Tabungan Umum:{' '}
                  <span className="text-sky-400 font-bold">
                    {formatRupiah(selectedMemberForMutasi.saldoUmum)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberForMutasi(null)}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <MutasiRekeningView state={state} member={selectedMemberForMutasi} />
          </div>
        </div>
      )}
    </div>
  );
};
