import React, { useState, useEffect } from 'react';
import {
  promptInstallDirectly,
  directDownload,
  isAppInstalled,
  hasDeferredPrompt,
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
} from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
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
  };

  const handleDownload = (type: 'apk' | 'exe' | 'ios') => {
    directDownload(type);
    const label = type === 'apk' ? 'Android (.APK)' : type === 'exe' ? 'PC Windows (.EXE)' : 'iOS Configuration';
    setNotificationMsg({
      text: `✓ Berkas installer ${label} langsung diunduh ke perangkat Anda.`,
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
                Pasang Aplikasi Koperasi HWS
              </h3>
              <p className="text-[11px] text-slate-400">
                Instalasi instan untuk Android, Apple iOS, & PC Desktop
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
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

        {/* UTAMA: TOMBOL PASANG LANGSUNG (Direct One-Click Install) */}
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
                    : 'Klik langsung untuk memasang tanpa unduh berkas manual'}
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
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-slate-950" />
            <span>
              {installed
                ? '✓ Buka / Perbarui Aplikasi Terpasang'
                : '⚡ Pasang Sekarang (Langsung Terpasang)'}
            </span>
          </button>
        </div>

        {/* PILIHAN INSTALASI SPESIFIK PLATFORM */}
        <div className="space-y-2.5 pt-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Pilihan Paket Perangkat:</span>
            <span className="text-[10px] text-emerald-400 font-mono">Realtime Online Sync</span>
          </div>

          {/* 1. Android */}
          <div className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl flex items-center justify-between gap-3 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0 font-bold border border-emerald-500/30">
                🤖
              </div>
              <div>
                <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <span>Android (Smartphone & Tablet)</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    v2.4
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Mendukung Sidik Jari, Notifikasi Setoran, & Auto-Sync
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDownload('apk')}
              className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh .APK</span>
            </button>
          </div>

          {/* 2. Apple iOS */}
          <div className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl space-y-2 transition-colors">
            <div className="flex items-center justify-between gap-3">
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
                    Layar Utama Safari WebClip & Profil Resmi
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIosGuideOpen(!iosGuideOpen)}
                  className="px-2.5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black rounded-xl shadow flex items-center gap-1 shrink-0 transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Petunjuk Safari</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('ios')}
                  className="p-2 bg-slate-750 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-bold rounded-xl transition-colors"
                  title="Unduh Profil .mobileconfig"
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
                  <div>2. Ketuk tombol <b>Bagikan (Share 📤)</b> di bilah bawah.</div>
                  <div>3. Pilih <b>"Tambah ke Layar Utama" (Add to Home Screen)</b>.</div>
                  <div>4. Ikon resmi Koperasi HWS akan langsung muncul di home screen iPhone Anda!</div>
                </div>
              </div>
            )}
          </div>

          {/* 3. PC Windows Desktop */}
          <div className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl flex items-center justify-between gap-3 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl shrink-0 font-bold border border-amber-500/30">
                💻
              </div>
              <div>
                <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <span>PC Desktop (Windows / Mac)</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Desktop
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Aplikasi mandiri desktop tanpa address bar browser
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDownload('exe')}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh .EXE</span>
            </button>
          </div>
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
