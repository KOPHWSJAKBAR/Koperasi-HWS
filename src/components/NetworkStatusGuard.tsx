import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';

interface NetworkStatusState {
  isOnline: boolean;
  countdown: number;
  isChecking: boolean;
  checkNow: () => Promise<boolean>;
}

export function useNetworkStatus(onAutoLogout?: (reason: string) => void, isSessionActive: boolean = false): NetworkStatusState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [countdown, setCountdown] = useState<number>(30);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const countdownTimerRef = useRef<any>(null);
  const onAutoLogoutRef = useRef(onAutoLogout);
  onAutoLogoutRef.current = onAutoLogout;

  // Active ping function to verify real connectivity
  const checkNow = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`/api/ping?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const online = res.ok;
      setIsOnline(online);
      setIsChecking(false);
      return online;
    } catch {
      // Fallback check to navigator.onLine
      const navOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
      setIsOnline(navOnline);
      setIsChecking(false);
      return navOnline;
    }
  }, []);

  // Window online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      checkNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic heartbeat ping every 10 seconds to detect silent connection loss
    const pingInterval = setInterval(() => {
      checkNow();
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pingInterval);
    };
  }, [checkNow]);

  // 30 seconds countdown when disconnected (Req 2)
  useEffect(() => {
    if (!isOnline) {
      setCountdown(30);

      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            if (isSessionActive && onAutoLogoutRef.current) {
              onAutoLogoutRef.current(
                'Sesi Anda telah di-logout otomatis karena tidak terkoneksi ke jaringan internet selama 30 detik demi menjaga keamanan akun dan transaksi perbankan Anda.'
              );
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(30);
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [isOnline, isSessionActive]);

  return { isOnline, countdown, isChecking, checkNow };
}

// Visual Connection Status Badge (Hijau = Terkoneksi Internet, Merah = Tidak Terkoneksi Internet per Req 2)
export const ConnectionStatusBadge: React.FC<{
  isOnline: boolean;
  className?: string;
  compact?: boolean;
}> = ({ isOnline, className = '', compact = false }) => {
  if (isOnline) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm transition-all ${className}`}
        title="Status: Terkoneksi Internet (Online Realtime)"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
        <span>{compact ? 'Online' : 'Terkoneksi Internet'}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/60 shadow-sm transition-all animate-pulse ${className}`}
      title="Status: Tidak Terkoneksi Internet (Offline)"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-90"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
      </span>
      <WifiOff className="w-3 h-3 text-rose-400 shrink-0" />
      <span>{compact ? 'Offline' : 'Tidak Terkoneksi Internet'}</span>
    </div>
  );
};

// Fullscreen Blocking Modal Guard when Connection is Lost (Req 2)
interface NetworkStatusGuardProps {
  isOnline: boolean;
  countdown: number;
  isChecking: boolean;
  onCheckNow: () => Promise<boolean>;
  onLogout?: (reason: string) => void;
  isSessionActive: boolean;
}

export const NetworkStatusGuard: React.FC<NetworkStatusGuardProps> = ({
  isOnline,
  countdown,
  isChecking,
  onCheckNow,
  onLogout,
  isSessionActive,
}) => {
  const [showRestoredToast, setShowRestoredToast] = useState(false);
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    if (!prevOnlineRef.current && isOnline) {
      setShowRestoredToast(true);
      const timer = setTimeout(() => setShowRestoredToast(false), 3500);
      return () => clearTimeout(timer);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  return (
    <>
      {/* Toast when internet connection is restored */}
      {showRestoredToast && (
        <div className="fixed top-4 inset-x-0 mx-auto w-fit z-[10000] px-4 py-2.5 bg-emerald-950/95 text-emerald-200 border-2 border-emerald-500/80 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2.5 backdrop-blur animate-in fade-in slide-in-from-top-4">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>✓ Koneksi internet berhasil tersambung kembali. Sistem aktif realtime.</span>
        </div>
      )}

      {/* Unclosable Full-Screen Blocking Modal when Disconnected (Req 2: Merah, tidak bisa digunakan, 30 detik ter-logout) */}
      {!isOnline && (
        <div
          className="fixed inset-0 z-[9999] bg-[#070b14]/95 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="w-full max-w-md bg-[#0f172a] border-2 border-rose-500 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5 ring-4 ring-rose-500/20">
            {/* Warning Icon with Pulsing Effect */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-3xl bg-rose-500/20 animate-ping opacity-60" />
              <div className="relative w-20 h-20 rounded-3xl bg-rose-600/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-950/50">
                <WifiOff className="w-10 h-10 text-rose-400" />
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[11px] font-black uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Merah: Tidak Terkoneksi Internet</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                Periksa Jaringan Koneksi Anda
              </h2>
              <p className="text-xs text-rose-200/90 leading-relaxed max-w-sm mx-auto">
                Aplikasi dibekukan sementara dan <b>tidak bisa digunakan</b> karena perangkat Anda kehilangan koneksi internet. Demi keamanan saldo perbankan & keaslian transaksi, akses dibatasi.
              </p>
            </div>

            {/* 30 Seconds Countdown Box */}
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-rose-500/40 text-center space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Waktu Menunggu Pemulihan Jaringan:
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-4xl sm:text-5xl font-black text-rose-400 tracking-tight">
                  {countdown}
                </span>
                <span className="text-xs font-black text-slate-300 uppercase">
                  Detik
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(countdown / 30) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {isSessionActive ? (
                  <>
                    Aplikasi akan otomatis <b className="text-rose-400">ter-logout</b> dalam{' '}
                    <span className="font-mono font-bold text-white">{countdown}</span> detik jika koneksi tidak kembali.
                  </>
                ) : (
                  <>
                    Menunggu jaringan internet kembali terhubung untuk melanjutkan aktivitas...
                  </>
                )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={isChecking}
                onClick={() => onCheckNow()}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'Memeriksa Jaringan...' : 'Coba Periksa Ulang Koneksi'}</span>
              </button>

              {isSessionActive && onLogout && (
                <button
                  type="button"
                  onClick={() => onLogout('Anda keluar dari akun karena kendala jaringan koneksi.')}
                  className="w-full sm:w-auto py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
