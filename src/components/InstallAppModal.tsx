import React, { useState, useEffect } from 'react';
import {
  promptInstallDirectly,
  directDownload,
  installAndDownload,
  isAppInstalled,
  hasDeferredPrompt,
  DownloadPackageType,
} from '../lib/pwaInstall';
import { LogoHws } from '../lib/logo';
import {
  Smartphone,
  Download,
  CheckCircle2,
  X,
  Laptop,
  Apple,
  ExternalLink,
  ShieldCheck,
  Zap,
  Database,
  FileCode,
  HardDrive,
  RefreshCw,
} from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDeviceTab, setSelectedDeviceTab] = useState<'all' | 'android' | 'ios' | 'pc' | 'database'>('all');
  const [notificationMsg, setNotificationMsg] = useState<{
    text: string;
    type: 'success' | 'info' | 'warn';
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setNotificationMsg(null);
      return;
    }
    setInstalled(isAppInstalled());
    setCanPrompt(hasDeferredPrompt());

    const handleReady = () => setCanPrompt(true);
    const handleInstalled = () => {
      setInstalled(true);
      setNotificationMsg({
        text: '✓ Koperasi HWS berhasil terpasang di perangkat Anda!',
        type: 'success',
      });
    };

    window.addEventListener('app:pwa_ready', handleReady);
    window.addEventListener('app:pwa_installed', handleInstalled);
    return () => {
      window.removeEventListener('app:pwa_ready', handleReady);
      window.removeEventListener('app:pwa_installed', handleInstalled);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDirectInstallClick = async () => {
    setIsProcessing(true);
    try {
      const res = await promptInstallDirectly();
      if (res.status === 'installed') {
        setInstalled(true);
        setNotificationMsg({ text: res.message, type: 'success' });
      } else if (res.status === 'already_installed') {
        setInstalled(true);
        setNotificationMsg({ text: res.message, type: 'info' });
      } else if (res.status === 'ios_guide') {
        setIosGuideOpen(true);
        setNotificationMsg({ text: res.message, type: 'info' });
      } else if (res.status === 'manual_android' || res.status === 'manual_pc') {
        setNotificationMsg({ text: res.message, type: 'info' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Tombol Pasang Device: Langsung download dari database dan otomatis install ke device yang dipilih
  const handleInstallDevice = async (type: DownloadPackageType) => {
    setIsProcessing(true);
    try {
      const res = await installAndDownload(type);
      if (res.status === 'installed' || res.status === 'already_installed') {
        setInstalled(true);
        setNotificationMsg({ text: res.message, type: 'success' });
      } else if (res.status === 'ios_guide') {
        setIosGuideOpen(true);
        setNotificationMsg({ text: res.message, type: 'info' });
      } else {
        setNotificationMsg({ text: res.message, type: 'success' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (type: DownloadPackageType) => {
    directDownload(type);
    let label = '';
    if (type === 'apk') label = 'Android (.APK)';
    else if (type === 'exe') label = 'PC Windows (.EXE)';
    else if (type === 'ios') label = 'iOS WebClip Profile';
    else if (type === 'database') label = 'Database Koperasi (koperasi_db.json)';
    else if (type === 'bat') label = 'Script Installer Windows (.BAT)';
    else if (type === 'google-services') label = 'Konfigurasi Firebase (google-services.json)';
    else label = 'Shortcut Desktop';

    setNotificationMsg({
      text: `✓ Berkas ${label} langsung terunduh dari database ke perangkat Anda.`,
      type: 'success',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0f172a] text-slate-100 border border-slate-700/80 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-6 relative animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center p-1.5 shrink-0 border border-amber-500/30">
              <LogoHws className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                Pasang & Unduh Aplikasi Koperasi HWS
              </h3>
              <p className="text-[11px] text-slate-400">
                Instalasi instan & unduh installer resmi terhubung database online
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

        {/* Tab Pilih Device */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold border-b border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedDeviceTab('all')}
            className={`py-1.5 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              selectedDeviceTab === 'all'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Semua Device
          </button>
          <button
            type="button"
            onClick={() => setSelectedDeviceTab('android')}
            className={`py-1.5 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              selectedDeviceTab === 'android'
                ? 'bg-emerald-500 text-slate-950 font-black shadow'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>🤖 Android</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedDeviceTab('pc')}
            className={`py-1.5 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              selectedDeviceTab === 'pc'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>💻 PC Windows</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedDeviceTab('ios')}
            className={`py-1.5 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              selectedDeviceTab === 'ios'
                ? 'bg-sky-500 text-slate-950 font-black shadow'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>🍏 Apple iOS</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedDeviceTab('database')}
            className={`py-1.5 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              selectedDeviceTab === 'database'
                ? 'bg-indigo-500 text-white font-black shadow'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>💾 Database</span>
          </button>
        </div>

        {/* Status Notification */}
        {notificationMsg && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-start gap-2 border ${
              notificationMsg.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                : 'bg-sky-950/80 border-sky-500/40 text-sky-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{notificationMsg.text}</span>
          </div>
        )}

        {/* UTAMA: TOMBOL PASANG CEPAT KE PERANGKAT AKTIF */}
        {(selectedDeviceTab === 'all' || selectedDeviceTab === 'android' || selectedDeviceTab === 'pc') && (
          <div className="p-4 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 border-2 border-amber-400/60 rounded-2xl space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500 text-slate-950 rounded-lg">
                  <Zap className="w-4 h-4 fill-slate-950" />
                </span>
                <div>
                  <div className="text-xs font-black text-white">
                    Instal Langsung ke Perangkat Ini
                  </div>
                  <div className="text-[10px] text-slate-300">
                    {installed
                      ? 'Aplikasi telah terpasang di perangkat Anda'
                      : 'Terdownload langsung pada database dan otomatis install'}
                  </div>
                </div>
              </div>
              {installed && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                  Terpasang ✓
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleDirectInstallClick}
              disabled={isProcessing}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Smartphone className="w-4 h-4 text-slate-950" />
              <span>
                {isProcessing
                  ? 'Sedang Memproses Pemasangan...'
                  : installed
                  ? '✓ Buka / Perbarui Aplikasi Terpasang'
                  : '⚡ Pasang Sekarang (Download & Otomatis Install)'}
              </span>
            </button>
          </div>
        )}

        {/* PILIHAN MENU DOWNLOAD SESUAI PERANGKAT YANG DIPILIH */}
        <div className="space-y-3 pt-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>
              {selectedDeviceTab === 'all'
                ? 'Pilih Perangkat & Menu Download:'
                : `Menu Unduhan & Pemasangan (${selectedDeviceTab.toUpperCase()}):`}
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">Database Online</span>
          </div>

          {/* 1. Android Card */}
          {(selectedDeviceTab === 'all' || selectedDeviceTab === 'android') && (
            <div className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0 font-bold border border-emerald-500/30">
                  🤖
                </div>
                <div>
                  <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <span>Android (Smartphone & Tablet)</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      APK v2.4 / PWA
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Tombol pasang langsung terdownload dari database & otomatis install
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleInstallDevice('apk')}
                  disabled={isProcessing}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Tombol Pasang: langsung download database dan otomatis install ke Android"
                >
                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Pasang ke Android</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('apk')}
                  className="px-2.5 py-2 bg-slate-750 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                  title="Unduh Berkas .APK Manual dari database"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.APK</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. Apple iOS Card */}
          {(selectedDeviceTab === 'all' || selectedDeviceTab === 'ios') && (
            <div className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl space-y-2.5 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-xl shrink-0 font-bold border border-sky-500/30">
                    🍏
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <span>Apple iOS (iPhone & iPad)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                        iOS 14+
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Profil WebClip resmi Apple & PWA Layar Utama Safari
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleInstallDevice('ios')}
                    disabled={isProcessing}
                    className="px-3.5 py-2 bg-gradient-to-r from-sky-500 to-sky-400 hover:from-sky-400 hover:to-sky-300 text-slate-950 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    title="Tombol Pasang: profil iOS terdownload dari database & siap pasang"
                  >
                    <Zap className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Pasang ke iOS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIosGuideOpen(!iosGuideOpen)}
                    className="px-2.5 py-2 bg-slate-750 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-bold rounded-xl flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Petunjuk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('ios')}
                    className="p-2 bg-slate-750 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    title="Unduh Profil .mobileconfig dari database"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {iosGuideOpen && (
                <div className="p-3 bg-slate-900 rounded-xl border border-sky-500/30 text-[11px] text-slate-300 space-y-1.5">
                  <div className="font-bold text-sky-300 flex items-center gap-1">
                    <span>📱</span> Cara Pasang di iPhone/iPad:
                  </div>
                  <div className="space-y-1 pl-1 text-slate-300">
                    <div>1. Buka halaman ini melalui browser <b>Safari</b>.</div>
                    <div>2. Ketuk tombol <b>Bagikan (Share 📤)</b> di bilah bawah Safari.</div>
                    <div>3. Pilih <b>"Tambah ke Layar Utama" (Add to Home Screen)</b>.</div>
                    <div>4. Ikon resmi Koperasi HWS akan langsung terpasang di layar utama iPhone Anda!</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. PC Windows Desktop Card */}
          {(selectedDeviceTab === 'all' || selectedDeviceTab === 'pc') && (
            <div className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl shrink-0 font-bold border border-amber-500/30">
                  💻
                </div>
                <div>
                  <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <span>PC Desktop (Windows & Mac)</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                      Setup .EXE & Desktop App
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Tombol pasang langsung terdownload dari database & otomatis install ke PC
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleInstallDevice('exe')}
                  disabled={isProcessing}
                  className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Tombol Pasang: langsung download database dan otomatis install ke PC"
                >
                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Pasang ke PC</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('exe')}
                  className="px-2.5 py-2 bg-slate-750 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                  title="Unduh Berkas .EXE Manual dari database"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.EXE</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('bat')}
                  className="px-2 py-2 bg-slate-750 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                  title="Unduh Script Batch Installer Windows (.BAT)"
                >
                  <span>.BAT</span>
                </button>
              </div>
            </div>
          )}

          {/* 4. Database & Konfigurasi Card */}
          {(selectedDeviceTab === 'all' || selectedDeviceTab === 'database') && (
            <div className="p-3.5 bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-500/40 rounded-2xl space-y-2.5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl shrink-0 font-bold border border-indigo-500/30">
                    💾
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <span>Database & Konfigurasi Server Koperasi</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Unduh salinan berkas database aktif & google-services.json
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownload('database')}
                  className="p-2.5 bg-slate-800/90 hover:bg-slate-800 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Database JSON (koperasi_db.json)</span>
                  </div>
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload('google-services')}
                  className="p-2.5 bg-slate-800/90 hover:bg-slate-800 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                    <span>google-services.json (Android)</span>
                  </div>
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security & Cloud integration note */}
        <div className="pt-3 border-t border-slate-700 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            Terintegrasi realtime online dengan AI Studio & database cloud Koperasi HWS.
          </span>
        </div>
      </div>
    </div>
  );
};
