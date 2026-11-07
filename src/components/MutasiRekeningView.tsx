import React, { useState } from 'react';
import {
  AppState,
  MemberUser,
  MemberTransaction,
  KategoriTabunganMutasi,
} from '../types';
import { formatRupiah } from '../lib/storage';
import {
  generateMutasiRekeningPdf,
  downloadExcelCsv,
  getOneDayBefore,
  getLastDayOfMonth,
  formatIndonesianDate,
  addDaysToDate,
  getDaysDifference,
} from '../lib/exportPdf';
import { LogoHws } from '../lib/logo';
import {
  FileText,
  Calendar,
  Download,
  Printer,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  Info,
} from 'lucide-react';

interface MutasiRekeningViewProps {
  state: AppState;
  member: MemberUser;
}

export const MutasiRekeningView: React.FC<MutasiRekeningViewProps> = ({ state, member }) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [kategoriTabungan, setKategoriTabungan] = useState<KategoriTabunganMutasi>('semua');
  const [periodeTipe, setPeriodeTipe] = useState<'semua' | 'bulanan' | 'custom'>('bulanan');
  const [selectedBulan, setSelectedBulan] = useState<string>(todayStr.slice(0, 7)); // YYYY-MM
  const [startDate, setStartDate] = useState<string>(addDaysToDate(todayStr, -10));
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [dateNotice, setDateNotice] = useState<string>('');

  // Handle custom date range change with maximum 30 days restriction per User Request:
  // "Penarikan periode tanggal maksimal 30 hari (contoh dari 15 November 2026 sampai dengan 25 November 2026, saldo awal = saldo pada saat tanggal 14 november 2026, saldo 1 hari sebelumnya, periode yang di tarik tetap memberikan perincian)"
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setDateNotice('');
    if (!val) return;
    const maxEnd = addDaysToDate(val, 29);
    if (endDate) {
      if (endDate < val) {
        setEndDate(val);
      } else if (getDaysDifference(val, endDate) > 30) {
        setEndDate(maxEnd);
        setDateNotice(`Rentang periode tanggal otomatis disesuaikan ke batas maksimal 30 hari (${formatIndonesianDate(val)} s/d ${formatIndonesianDate(maxEnd)}).`);
      }
    } else {
      setEndDate(maxEnd);
    }
  };

  const handleEndDateChange = (val: string) => {
    setDateNotice('');
    if (!val) {
      setEndDate('');
      return;
    }
    if (!startDate) {
      setEndDate(val);
      setStartDate(addDaysToDate(val, -29));
      return;
    }
    if (val < startDate) {
      setDateNotice('Tanggal akhir tidak boleh mendahului tanggal awal.');
      setEndDate(startDate);
      return;
    }
    const diff = getDaysDifference(startDate, val);
    if (diff > 30) {
      const clampedEnd = addDaysToDate(startDate, 29);
      setEndDate(clampedEnd);
      setDateNotice(`Penarikan periode tanggal dibatasi maksimal 30 hari. Disesuaikan ke tanggal ${formatIndonesianDate(clampedEnd)} (30 hari).`);
    } else {
      setEndDate(val);
    }
  };

  // Determine effective period boundaries and 1 day prior
  let periodStartDate = '';
  let periodEndDate = '';
  let prevDay = '';

  if (periodeTipe === 'bulanan' && selectedBulan) {
    periodStartDate = `${selectedBulan}-01`;
    periodEndDate = getLastDayOfMonth(selectedBulan);
    prevDay = getOneDayBefore(periodStartDate);
  } else if (periodeTipe === 'custom' && startDate) {
    periodStartDate = startDate;
    periodEndDate = endDate || startDate;
    prevDay = getOneDayBefore(startDate);
  }

  // Transactions for this member (exclude deleted transactions)
  const deletedTxSet = new Set(state.deletedTransactionIds || []);
  const allMemberTxs = (state.memberTransactions || []).filter(
    (tx) => tx.memberId === member.id && !deletedTxSet.has(tx.id) && (tx as any).status !== 'deleted'
  );

  // Filter based on options
  let filtered = allMemberTxs.filter((tx) => {
    if (kategoriTabungan !== 'semua' && tx.kategori !== kategoriTabungan) return false;

    if (periodStartDate && tx.tanggal < periodStartDate) return false;
    if (periodEndDate && tx.tanggal > periodEndDate) return false;
    return true;
  });

  // Sort chronological: requirement "urutannya dari awal ada di atas serta selanjutnya ke bawah"
  filtered.sort((a, b) => {
    const da = `${a.tanggal} ${a.jam || '00:00'}`;
    const db = `${b.tanggal} ${b.jam || '00:00'}`;
    return da.localeCompare(db);
  });

  // Saldo Awal calculation per User Request:
  // Saldo awal = akumulasi saldo pada 1 hari sebelumnya (sebelum periodStartDate)
  const allCategoryTx = allMemberTxs.filter((tx) => {
    if (kategoriTabungan !== 'semua' && tx.kategori !== kategoriTabungan) return false;
    return true;
  });

  let saldoAwal = 0;
  if (periodStartDate) {
    const priorTx = allCategoryTx.filter((tx) => tx.tanggal < periodStartDate);
    priorTx.forEach((tx) => {
      if (tx.tipe === 'masuk') saldoAwal += tx.nominal;
      else saldoAwal -= tx.nominal;
    });
  } else {
    saldoAwal = 0;
  }
  if (saldoAwal < 0) saldoAwal = 0;

  // Running balance calculation starting strictly from saldoAwal
  let totalMasuk = 0;
  let totalKeluar = 0;
  let runningSaldo = saldoAwal;

  const enrichedFiltered = filtered.map((tx) => {
    if (tx.tipe === 'masuk') {
      totalMasuk += tx.nominal;
      runningSaldo += tx.nominal;
    } else {
      totalKeluar += tx.nominal;
      runningSaldo -= tx.nominal;
    }
    return {
      ...tx,
      debit: tx.tipe === 'keluar' ? tx.nominal : 0,
      kredit: tx.tipe === 'masuk' ? tx.nominal : 0,
      computedSaldo: runningSaldo,
    };
  });

  const saldoAkhir = runningSaldo;

  const getPeriodeLabel = () => {
    if (periodeTipe === 'bulanan') {
      const [year, month] = selectedBulan.split('-');
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
      ];
      return `Bulan ${monthNames[parseInt(month) - 1]} ${year} (01/${month}/${year} s/d ${periodEndDate.split('-').reverse().join('/')})`;
    }
    if (periodeTipe === 'custom' && startDate && endDate) {
      const diff = getDaysDifference(startDate, endDate);
      return `${formatIndonesianDate(startDate)} s/d ${formatIndonesianDate(endDate)} (${diff} Hari)`;
    }
    return 'Semua Periode Transaksi';
  };

  const handlePrintPdf = () => {
    generateMutasiRekeningPdf(member, state.memberTransactions, {
      kategori: kategoriTabungan,
      periodeLabel: getPeriodeLabel(),
      startDate: periodStartDate || undefined,
      endDate: periodEndDate || undefined,
    });
  };

  const handleExportCsv = () => {
    const prevDateShort = prevDay ? prevDay.split('-').reverse().join('/') : '-';
    const rows = [
      ...(prevDay
        ? [
            {
              Tanggal: prevDateShort,
              Jam: '23:59',
              Keterangan: `SALDO AWAL PER ${formatIndonesianDate(prevDay).toUpperCase()} (1 HARI SEBELUMNYA)`,
              Cabang: '0001',
              Tipe: 'SALDO AWAL',
              Nominal: 0,
              Saldo: saldoAwal,
              Kategori: kategoriTabungan,
            },
          ]
        : []),
      ...enrichedFiltered.map((tx) => ({
        Tanggal: tx.tanggal,
        Jam: tx.jam || '',
        Keterangan: tx.keterangan,
        Cabang: tx.cbg || '0001',
        Tipe: tx.tipe === 'masuk' ? 'MASUK (CR)' : 'KELUAR (DB)',
        Nominal: tx.nominal,
        Saldo: tx.computedSaldo,
        Kategori: tx.kategori,
      })),
      {
        Tanggal: periodEndDate || todayStr,
        Jam: '23:59',
        Keterangan: `TOTAL MUTASI & SALDO AKHIR PERIODE (CR: +${totalMasuk}, DB: -${totalKeluar})`,
        Cabang: '0001',
        Tipe: 'SALDO AKHIR',
        Nominal: totalMasuk - totalKeluar,
        Saldo: saldoAkhir,
        Kategori: kategoriTabungan,
      },
    ];
    downloadExcelCsv(rows, `Mutasi_${member.nomorRekening}_${getPeriodeLabel().replace(/[^a-zA-Z0-9]/g, '_')}`);
  };

  return (
    <div className="space-y-6">
      {/* Filter Card */}
      <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Mutasi Rekening & Rekening Koran Digital
            </h3>
            <p className="text-xs text-slate-400">
              Pilih tabungan dan rentang periode cetak laporan resmi berformat PDF
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-4 h-4" />
              Cetak / Unduh PDF
            </button>
            <button
              onClick={handleExportCsv}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
            >
              <Download className="w-4 h-4" />
              Unduh CSV/Excel
            </button>
          </div>
        </div>

        {/* Filter Selection Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Pilihan Rekening Tabungan
            </label>
            <select
              value={kategoriTabungan}
              onChange={(e) => setKategoriTabungan(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
            >
              <option value="semua">Semua Tabungan (Konsolidasi)</option>
              <option value="pokok">Tabungan Pokok / Kewajiban (Rp1.000/hr)</option>
              <option value="umum">Tabungan Umum Bebas</option>
              <option value="zakat">Tabungan Zakat Fitrah (Rp500/hr)</option>
              <option value="qurban">Tabungan Qurban (Rp500/hr)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Mode Periode Laporan
            </label>
            <select
              value={periodeTipe}
              onChange={(e) => setPeriodeTipe(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
            >
              <option value="bulanan">Bulanan</option>
              <option value="custom">Harian / Rentang Tanggal</option>
              <option value="semua">Semua Waktu</option>
            </select>
          </div>

          <div>
            {periodeTipe === 'bulanan' ? (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Pilih Bulan</label>
                <input
                  type="month"
                  value={selectedBulan}
                  onChange={(e) => setSelectedBulan(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  Saldo awal: <span className="text-amber-400 font-medium">{prevDay ? formatIndonesianDate(prevDay) : '-'}</span> (1 hari sebelumnya)
                </div>
              </div>
            ) : periodeTipe === 'custom' ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">Dari & Sampai Tanggal</label>
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    Maks. 30 Hari
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[11px] text-white"
                      title="Tanggal Awal"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-bold">s/d</span>
                  <div className="flex-1">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      max={startDate ? addDaysToDate(startDate, 29) : undefined}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[11px] text-white"
                      title="Tanggal Akhir (Maksimal 30 hari dari tanggal awal)"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>{startDate && endDate ? `Durasi: ${getDaysDifference(startDate, endDate)} hari (Maks. 30 hari)` : 'Maksimal 30 hari'}</span>
                  {prevDay && (
                    <span className="text-amber-400 font-medium">Saldo awal: {formatIndonesianDate(prevDay)}</span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Status</label>
                <div className="text-xs text-slate-400 py-2">Menampilkan semua riwayat transaksi</div>
              </div>
            )}
          </div>
        </div>

        {dateNotice && (
          <div className="mt-3 p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs text-amber-300 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{dateNotice}</span>
          </div>
        )}

        {/* Total Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-700/60">
          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700">
            <span className="text-[10px] text-amber-300 font-bold">1. Saldo Awal (1 Hari Sebelumnya)</span>
            <div className="text-sm font-extrabold text-amber-400 mt-0.5">{formatRupiah(saldoAwal)}</div>
            <span className="text-[9px] text-slate-300 block truncate" title={prevDay ? `Posisi per ${formatIndonesianDate(prevDay)}` : 'Awal Periode'}>
              {prevDay ? `Per ${formatIndonesianDate(prevDay)}` : 'Awal Periode'}
            </span>
          </div>
          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700">
            <span className="text-[10px] text-emerald-400 font-bold">2. Total Masuk / Kredit (+)</span>
            <div className="text-sm font-extrabold text-emerald-400 mt-0.5">{formatRupiah(totalMasuk)}</div>
            <span className="text-[9px] text-slate-400">Pemasukan periode ini</span>
          </div>
          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700">
            <span className="text-[10px] text-red-400 font-bold">3. Total Keluar / Debit (-)</span>
            <div className="text-sm font-extrabold text-red-400 mt-0.5">{formatRupiah(totalKeluar)}</div>
            <span className="text-[9px] text-slate-400">Pengurangan / penarikan</span>
          </div>
          <div className="bg-slate-800/60 p-3 rounded-2xl border border-amber-500/30">
            <span className="text-[10px] text-sky-400 font-bold">4. Saldo Akhir Periode</span>
            <div className="text-sm font-extrabold text-sky-300 mt-0.5">
              {formatRupiah(saldoAkhir)}
            </div>
            <span className="text-[9px] text-emerald-400">Awal + Masuk - Keluar</span>
          </div>
        </div>
      </div>

      {/* Screen Preview Container: Styled clean matching the PDF layout */}
      <div className="bg-white text-slate-900 border border-slate-300 rounded-3xl p-5 sm:p-7 shadow-xl">
        {/* Header Preview */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b-2 border-slate-900 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl shadow flex items-center justify-center p-1 border">
              <LogoHws className="w-full h-full" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-950 uppercase tracking-wide">
                KOPERASI HWS
              </h2>
              <p className="text-[11px] font-bold text-slate-600 uppercase">
                KCP {member.wilayah}
              </p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-slate-950">
              REKENING TAHAPAN
            </h1>
            <p className="text-xs font-bold text-amber-600">
              Periode: {getPeriodeLabel()}
            </p>
          </div>
        </div>

        {/* Two Columns Meta Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
          <div className="border border-slate-900 rounded-xl p-3 text-xs leading-relaxed">
            <div className="font-extrabold text-slate-950 uppercase">{member.nama}</div>
            <div className="font-bold text-slate-700">KEC {member.kecamatan.toUpperCase()}</div>
            <div>RT {member.rt} RW {member.rw} KEL {member.kelurahan.toUpperCase()}</div>
            <div>{member.alamatLengkap.toUpperCase()}</div>
            <div>{member.kota.toUpperCase()} {member.kodePos} - INDONESIA</div>
          </div>

          <div className="border border-slate-900 rounded-xl p-3 text-xs leading-relaxed space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">NO. REKENING:</span>
              <span className="font-extrabold font-mono text-slate-950">{member.nomorRekening}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">NO. ANGGOTA:</span>
              <span className="font-mono text-slate-800">{member.nomorAnggota}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">MATA UANG:</span>
              <span className="font-bold text-slate-950">IDR</span>
            </div>
          </div>
        </div>

        {/* Table of Transactions with Debit, Credit, Saldo */}
        <div className="overflow-x-auto border border-slate-900 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-900 text-slate-800 font-extrabold text-[10px] uppercase">
                <th className="py-2.5 px-3">TANGGAL</th>
                <th className="py-2.5 px-3">KETERANGAN</th>
                <th className="py-2.5 px-3 text-center">CBG</th>
                <th className="py-2.5 px-3 text-right text-red-700">DEBIT (DB)</th>
                <th className="py-2.5 px-3 text-right text-emerald-700">KREDIT (CR)</th>
                <th className="py-2.5 px-3 text-right">SALDO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* Row 0: Saldo Awal Periode (1 Hari Sebelumnya) */}
              <tr className="bg-amber-50/70 font-semibold border-b border-slate-300">
                <td className="py-2.5 px-3 font-mono text-slate-800 font-bold">
                  {prevDay ? prevDay.split('-').reverse().slice(0, 2).join('/') : '-'}
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-extrabold text-amber-900 uppercase">
                    SALDO AWAL PER {prevDay ? formatIndonesianDate(prevDay).toUpperCase() : 'HARI SEBELUMNYA'} (1 HARI SEBELUMNYA)
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono">
                    Saldo posisi per tanggal {prevDay ? formatIndonesianDate(prevDay) : '-'} (1 hari sebelum periode penarikan mutasi)
                  </div>
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-slate-500">0001</td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-400">-</td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-400">-</td>
                <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950">
                  {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(saldoAwal)}
                </td>
              </tr>

              {/* Transaction Rows */}
              {enrichedFiltered.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono text-slate-700">
                    {tx.tanggal.split('-').reverse().slice(0, 2).join('/')}
                  </td>
                  <td className="py-2 px-3">
                    <div className="font-bold text-slate-900 uppercase">{tx.keterangan}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{tx.jam}</div>
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-slate-600">{tx.cbg || '0001'}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-red-700">
                    {tx.debit > 0 ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(tx.debit) : '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                    {tx.kredit > 0 ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(tx.kredit) : '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-black text-slate-950">
                    {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(tx.computedSaldo)}
                  </td>
                </tr>
              ))}
              {enrichedFiltered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500 text-xs italic">
                    Tidak ada mutasi transaksi tambahan pada periode ini. Saldo tetap {formatRupiah(saldoAwal)}.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-900 text-slate-900">
              <tr>
                <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px] font-black">
                  TOTAL MUTASI PERIODE & SALDO AKHIR:
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-black text-red-700">
                  {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(totalKeluar)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700">
                  {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(totalMasuk)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950 text-sm">
                  {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2 }).format(saldoAkhir)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 text-[10px] text-slate-500 text-center italic">
          * Laporan mutasi elektronik resmi Koperasi HWS sah tanpa tanda tangan basah pengurus atau pemilik rekening.
        </div>
      </div>
    </div>
  );
};
