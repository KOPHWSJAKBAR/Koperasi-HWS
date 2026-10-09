import React, { useState } from 'react';
import {
  AppState,
  AdminUser,
} from '../types';
import { formatRupiah } from '../lib/storage';
import { LogoHws } from '../lib/logo';
import { MemberVerificationView } from './MemberVerificationView';
import { MemberListView } from './MemberListView';
import { BukuKasView } from './BukuKasView';
import { ZakatQurbanView } from './ZakatQurbanView';
import { SuratMenyuratView } from './SuratMenyuratView';
import { ChatOnlineView } from './ChatOnlineView';
import { SettingModal } from './SettingModal';
import { downloadExcelCsv, printDocumentHtml } from '../lib/exportPdf';
import {
  BookOpen,
  Users,
  CheckCircle2,
  HeartHandshake,
  Mail,
  MessageSquare,
  Settings,
  LogOut,
  DollarSign,
  ChevronLeft,
  FileDown,
  Printer,
  PlusCircle,
  TrendingUp,
  Building,
  Shield,
  Layers,
} from 'lucide-react';

interface AdminDashboardProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  admin: AdminUser;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  state,
  updateState,
  admin,
  onLogout,
}) => {
  // Sync admin with latest state
  const currentAdmin = state.admins.find((a) => a.id === admin.id) || admin;

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'verifikasi' | 'anggota' | 'kas' | 'zakat' | 'surat' | 'chat'
  >('dashboard');

  const [showSettings, setShowSettings] = useState(false);
  const [settingSubModal, setSettingSubModal] = useState<any>(null);

  // Role permissions
  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const isKelola = currentAdmin.role === 'admin_kelola' || currentAdmin.role === 'admin_pembukuan';
  const isWriter = currentAdmin.role === 'admin_write';
  const isLaporan = currentAdmin.role === 'admin_laporan';

  // Calculate totals
  const totalPokok = state.members.reduce((acc, m) => acc + m.saldoPokok, 0);
  const totalUmum = state.members.reduce((acc, m) => acc + m.saldoUmum, 0);
  const totalZakat = state.members.reduce((acc, m) => acc + m.saldoZakatFitrah, 0);
  const totalQurban = state.members.reduce((acc, m) => acc + m.saldoQurban, 0);

  // Calculate running balances for the two cash books
  let saldoKasAnggota = 0;
  state.kasList
    .filter((k) => k.bukuKas === 'anggota' && k.status === 'approved')
    .forEach((k) => {
      if (k.tipe === 'masuk') saldoKasAnggota += k.nominal;
      else saldoKasAnggota -= k.nominal;
    });

  let saldoKasKoperasi = 0;
  state.kasList
    .filter((k) => k.bukuKas === 'koperasi' && k.status === 'approved')
    .forEach((k) => {
      if (k.tipe === 'masuk') saldoKasKoperasi += k.nominal;
      else saldoKasKoperasi -= k.nominal;
    });

  // Pending deposits count
  const pendingDepositsCount = state.setoranList.filter((s) => s.status === 'pending').length;

  // Unread chat messages from members
  const unreadChatCount = state.chatMessages.filter(
    (m) => m.senderType === 'member' && !m.isReadByAdmin
  ).length;

  // Print summary report
  const handlePrintSummary = () => {
    const html = `
      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px;">
          <div>
            <h2 style="font-size: 16px; font-weight: 900; margin: 0;">KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA</h2>
            <div style="font-size: 12px; font-weight: 700; color: #b45309;">Laporan Ringkasan Posisi Kas & Saldo Anggota</div>
          </div>
          <div style="font-size: 10px; text-align: right;">Dicetak: ${new Date().toLocaleDateString('id-ID')}</div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px;">
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Total Simpanan Pokok:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(totalPokok)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Total Tabungan Umum:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(totalUmum)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Total Titipan Zakat Fitrah:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(totalZakat)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Total Titipan Tabungan Qurban:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(totalQurban)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Saldo Berjalan Buku Kas Anggota:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(saldoKasAnggota)}</td></tr>
          <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px;">Saldo Berjalan Buku Kas Koperasi:</td><td style="text-align: right; font-weight: 700;">${formatRupiah(saldoKasKoperasi)}</td></tr>
          <tr style="background: #f3f4f6; font-weight: 800; font-size: 13px;"><td style="padding: 8px;">TOTAL KONSOLIDASI KEUANGAN:</td><td style="text-align: right;">${formatRupiah(saldoKasAnggota + saldoKasKoperasi)}</td></tr>
        </table>
      </div>
    `;
    printDocumentHtml(html, 'Ringkasan_Kas_HWS');
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* ================= HEADER (Matching Tampilan Pada Dashboard PC Aplikasi admin.png) ================= */}
      <header className="sticky top-0 z-40 bg-[#0d1424]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left Brand & Admin Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white p-0.5 shadow flex items-center justify-center shrink-0">
              <LogoHws className="w-full h-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-wide text-white">
                  KOPERASI HWS
                </span>
                <span className="bg-[#00bcd4] text-slate-950 font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md uppercase">
                  ADMIN
                </span>
                <span className="bg-[#f59e0b] text-slate-950 font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md uppercase">
                  {currentAdmin.role.replace('_', ' ')}
                </span>
              </div>
              <div className="text-[11px] sm:text-xs text-slate-400 font-medium">
                {currentAdmin.nama} • Wilayah {currentAdmin.wilayahKantor}
              </div>
            </div>
          </div>

          {/* Right Action Buttons: Only Setting per User Req 9 ("Menu setting pada dashboard hilangkan hanya ada setting") */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSettingSubModal(null);
                setShowSettings(true);
              }}
              className="py-1.5 px-3 rounded-xl bg-[#162035] hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Settings className="w-4 h-4 text-amber-500" />
              <span>Setting</span>
            </button>
          </div>
        </div>

        {/* Navigation Bar for Desktop (Matching Tampilan Pada Dashboard PC Aplikasi admin.png) */}
        <div className="hidden lg:flex items-center gap-1 max-w-7xl mx-auto mt-3 pt-2 border-t border-slate-800/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              activeTab === 'dashboard'
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Dashboard
          </button>

          {!isLaporan && (
            <button
              onClick={() => setActiveTab('verifikasi')}
              className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                activeTab === 'verifikasi'
                  ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verifikasi Setoran
              {pendingDepositsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center ml-1">
                  {pendingDepositsCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('anggota')}
            className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              activeTab === 'anggota'
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Data Anggota ({state.members.length})
          </button>

          <button
            onClick={() => setActiveTab('kas')}
            className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              activeTab === 'kas'
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Buku Kas & Neraca
          </button>

          <button
            onClick={() => setActiveTab('zakat')}
            className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
              activeTab === 'zakat'
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            Zakat & Qurban
          </button>

          {!isLaporan && (
            <button
              onClick={() => setActiveTab('surat')}
              className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                activeTab === 'surat'
                  ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Surat Menyurat
            </button>
          )}

          {!isLaporan && (
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                activeTab === 'chat'
                  ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat Anggota (20 Hari)
            </button>
          )}
        </div>
      </header>

      {/* ================= BACK BUTTON ON SUBMENUS (Mobile Navigation Requirement) ================= */}
      {activeTab !== 'dashboard' && (
        <div className="bg-[#111c33] border-b border-slate-800 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali ke Dashboard Admin</span>
            </button>
            <span className="text-xs text-slate-400 font-semibold uppercase">
              {activeTab === 'verifikasi' && 'Verifikasi Setoran'}
              {activeTab === 'anggota' && 'Data Anggota'}
              {activeTab === 'kas' && 'Buku Kas & Neraca'}
              {activeTab === 'zakat' && 'Zakat & Qurban'}
              {activeTab === 'surat' && 'Surat Menyurat'}
              {activeTab === 'chat' && 'Chat Online'}
            </span>
          </div>
        </div>
      )}

      {/* ================= MAIN CONTENT BODY ================= */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 flex-1">
        {activeTab === 'dashboard' ? (
          <>
            {/* Top 4 Stat Cards Grid (Matching Tampilan Pada Dashboard PC Aplikasi admin.png) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Total Simpanan Pokok */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-5 shadow-xl">
                <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider block">
                  TOTAL SIMPANAN POKOK
                </span>
                <div className="text-2xl sm:text-3xl font-black text-[#f59e0b] mt-1.5">
                  {formatRupiah(totalPokok)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Rp1.000 / hari • Terkunci oleh Admin
                </div>
              </div>

              {/* 2. Total Tabungan Umum */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-5 shadow-xl">
                <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider block">
                  TOTAL TABUNGAN UMUM
                </span>
                <div className="text-2xl sm:text-3xl font-black text-sky-400 mt-1.5">
                  {formatRupiah(totalUmum)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Bisa setor & tarik kapan saja
                </div>
              </div>

              {/* 3. Dana Zakat & Qurban */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-5 shadow-xl">
                <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider block">
                  DANA ZAKAT & QURBAN
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1.5">
                  {formatRupiah(totalZakat + totalQurban)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Fitrah: {formatRupiah(totalZakat)} • Qurban: {formatRupiah(totalQurban)}
                </div>
              </div>

              {/* 4. Saldo Kas Berjalan */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-5 shadow-xl">
                <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider block">
                  SALDO KAS BERJALAN
                </span>
                <div className="text-2xl sm:text-3xl font-black text-white mt-1.5">
                  {formatRupiah(saldoKasAnggota + saldoKasKoperasi)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Kas Anggota: {formatRupiah(saldoKasAnggota)} | Kas: {formatRupiah(saldoKasKoperasi)}
                </div>
              </div>
            </div>

            {/* 2 Main Cards: Buku Kas Anggota & Buku Kas Koperasi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Buku Kas Anggota */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-5 h-5 text-amber-500" />
                      <div>
                        <h4 className="text-base font-extrabold text-white">Buku Kas Anggota</h4>
                        <div className="text-[11px] text-slate-400">
                          Tabungan Pokok & Tabungan Umum Seluruh Anggota
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400">Saldo Berjalan</span>
                      <div className="text-sm font-black text-emerald-400 font-mono">
                        {formatRupiah(saldoKasAnggota)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mt-4 text-xs">
                    <div className="p-3 bg-[#162035] rounded-xl flex justify-between items-center">
                      <span className="text-slate-300">Total Simpanan Pokok:</span>
                      <span className="font-bold text-amber-400 font-mono">{formatRupiah(totalPokok)}</span>
                    </div>
                    <div className="p-3 bg-[#162035] rounded-xl flex justify-between items-center">
                      <span className="text-slate-300">Total Tabungan Umum Anggota:</span>
                      <span className="font-bold text-sky-400 font-mono">{formatRupiah(totalUmum)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  {(isSuperAdmin || isKelola) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSettingSubModal('sesuaikan_saldo');
                        setShowSettings(true);
                      }}
                      className="w-full py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                    >
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      <span>Sesuaikan Saldo Anggota</span>
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('kas')}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Cetak Laporan PDF
                    </button>
                    <button
                      onClick={() => setActiveTab('kas')}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Unduh Excel
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Buku Kas Koperasi */}
              <div className="bg-[#0d1424] border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <Building className="w-5 h-5 text-sky-400" />
                      <div>
                        <h4 className="text-base font-extrabold text-white">Buku Kas Koperasi</h4>
                        <div className="text-[11px] text-slate-400">
                          Overhead Operasional, Penyaluran Zakat & Qurban
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400">Saldo Berjalan</span>
                      <div className="text-sm font-black text-sky-400 font-mono">
                        {formatRupiah(saldoKasKoperasi)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mt-4 text-xs">
                    <div className="p-3 bg-[#162035] rounded-xl flex justify-between items-center">
                      <span className="text-slate-300">Total Zakat Fitrah Tersedia:</span>
                      <span className="font-bold text-emerald-400 font-mono">{formatRupiah(totalZakat)}</span>
                    </div>
                    <div className="p-3 bg-[#162035] rounded-xl flex justify-between items-center">
                      <span className="text-slate-300">Total Tabungan Qurban Tersedia:</span>
                      <span className="font-bold text-emerald-400 font-mono">{formatRupiah(totalQurban)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setActiveTab('kas')}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                    + Input Kas Koperasi
                  </button>
                  <button
                    onClick={() => setActiveTab('zakat')}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    <HeartHandshake className="w-3.5 h-3.5" />
                    Salurkan Zakat & Qurban
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Vertical Menu Stack (Matching Tampilan Pada Dasbord mobile Admin.png) */}
            <div className="lg:hidden space-y-3 pt-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Pilihan Menu Utama Admin
                </span>
                <span className="text-[11px] text-slate-500">Pilih menu di bawah</span>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="w-full p-4 rounded-2xl bg-[#f59e0b] text-slate-950 font-extrabold flex items-center justify-between shadow-lg text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-950 text-white flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black">1. Dashboard</div>
                      <div className="text-[10px] font-medium text-slate-900">
                        Ringkasan Kas, Saldo & Statistik
                      </div>
                    </div>
                  </div>
                  <span>›</span>
                </button>

                {!isLaporan && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('verifikasi')}
                    className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-sky-400 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold">2. Verifikasi Setoran</div>
                        <div className="text-[10px] text-slate-400">
                          Verifikasi bukti setor transfer anggota
                        </div>
                      </div>
                    </div>
                    <span>›</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('anggota')}
                  className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold flex items-center gap-1.5">
                        <span>3. Data Anggota</span>
                        <span className="text-[9px] bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-300">
                          {state.members.length} Anggota
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        KTA Digital, Rekening, Mutasi & Anggota Baru
                      </div>
                    </div>
                  </div>
                  <span>›</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('kas')}
                  className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold">4. Buku Kas & Neraca</div>
                      <div className="text-[10px] text-slate-400">
                        Buku Kas Anggota, Kas Koperasi & Laporan Neraca
                      </div>
                    </div>
                  </div>
                  <span>›</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('zakat')}
                  className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center">
                      <HeartHandshake className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold">5. Zakat & Qurban</div>
                      <div className="text-[10px] text-slate-400">
                        Penyaluran Zakat Fitrah & Tabungan Qurban
                      </div>
                    </div>
                  </div>
                  <span>›</span>
                </button>

                {!isLaporan && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('surat')}
                    className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-sky-400 flex items-center justify-center">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold">6. Surat Menyurat</div>
                        <div className="text-[10px] text-slate-400">
                          Terbitkan surat resmi ke WhatsApp & Email
                        </div>
                      </div>
                    </div>
                    <span>›</span>
                  </button>
                )}

                {!isLaporan && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className="w-full p-4 rounded-2xl bg-[#111c33] border border-slate-700/80 text-white flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold">7. Chat Online</div>
                        <div className="text-[10px] text-slate-400">
                          Obrolan langsung realtime dengan anggota
                        </div>
                      </div>
                    </div>
                    <span>›</span>
                  </button>
                )}
              </div>
            </div>
          </>
        ) : activeTab === 'verifikasi' ? (
          <MemberVerificationView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'anggota' ? (
          <MemberListView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'kas' ? (
          <BukuKasView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'zakat' ? (
          <ZakatQurbanView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'surat' ? (
          <SuratMenyuratView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : activeTab === 'chat' ? (
          <ChatOnlineView
            state={state}
            updateState={updateState}
            currentAdmin={currentAdmin}
          />
        ) : null}
      </main>

      {/* ================= SETTING MODAL ================= */}
      {showSettings && (
        <SettingModal
          state={state}
          updateState={updateState}
          currentAdmin={currentAdmin}
          initialSubModal={settingSubModal}
          onClose={() => {
            setShowSettings(false);
            setSettingSubModal(null);
          }}
          onLogout={onLogout}
        />
      )}
    </div>
  );
};
