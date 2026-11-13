import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';

export interface NetworkStatusState {
  isOnline: boolean;
  showWarning: boolean;
  offlineSeconds: number;
  countdown: number;
  isChecking: boolean;
  checkNow: () => Promise<boolean>;
}

const OFFLINE_WARNING_THRESHOLD_SEC = 60; // Muncul peringatan apabila dalam 60 detik tidak terkoneksi ke internet
const AUTO_LOGOUT_GRACE_SEC = 30; // 30 detik hitung mundur setelah peringatan muncul (total 90 detik)

export function useNetworkStatus(
  onAutoLogout?: (reason: string) => void,
  isSessionActive: boolean = false
): NetworkStatusState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [offlineSeconds, setOfflineSeconds] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(AUTO_LOGOUT_GRACE_SEC);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const timerRef = useRef<any>(null);
  const onAutoLogoutRef = useRef(onAutoLogout);
  onAutoLogoutRef.current = onAutoLogout;
  const isSessionActiveRef = useRef(isSessionActive);
  isSessionActiveRef.current = isSessionActive;

  // Active ping function to verify real internet/server connectivity
  const checkNow = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setIsChecking(false);
      return false;
    }

    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`/api/ping?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const online = res.ok;
      setIsOnline((prevOnline) => {
        if (!prevOnline && online) {
          import('../lib/firebase-init').then(({ ensureFirestoreOnline }) => ensureFirestoreOnline()).catch(() => {});
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hws:network_restored'));
          }
        }
        return online;
      });
      if (online) {
        setShowWarning(false);
        setOfflineSeconds(0);
        setCountdown(AUTO_LOGOUT_GRACE_SEC);
      }
      setIsChecking(false);
      return online;
    } catch {
      setIsOnline(false);
      setIsChecking(false);
      return false;
    }
  }, []);

  // Window online/offline event listeners & continuous live heartbeat ping (3s online, 2s offline retry)
  useEffect(() => {
    const handleOnline = () => {
      checkNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkNow();
      }
    };

    const handleFocus = () => {
      checkNow();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Check immediately on mount & keep active heartbeat ping while app is open
    checkNow();
    const pingInterval = setInterval(() => {
      checkNow();
    }, isOnline ? 3000 : 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(pingInterval);
    };
  }, [checkNow, isOnline]);

  // Track offline duration:
  // - Status badge immediately turns RED when disconnected
  // - After 60 seconds disconnected -> show blocking warning modal
  // - 30 seconds grace countdown while warning is displayed -> auto-logout
  useEffect(() => {
    if (!isOnline) {
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setOfflineSeconds((prevSec) => {
          const newSec = prevSec + 1;

          if (newSec >= OFFLINE_WARNING_THRESHOLD_SEC) {
            setShowWarning(true);
            const remaining = Math.max(
              0,
              OFFLINE_WARNING_THRESHOLD_SEC + AUTO_LOGOUT_GRACE_SEC - newSec
            );
            setCountdown(remaining);
          } else {
            setShowWarning(false);
          }

          if (newSec >= OFFLINE_WARNING_THRESHOLD_SEC + AUTO_LOGOUT_GRACE_SEC) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            if (isSessionActiveRef.current && onAutoLogoutRef.current) {
              onAutoLogoutRef.current(
                'Sesi Anda telah di-logout otomatis karena perangkat tidak terkoneksi ke jaringan internet demi menjaga keamanan akun dan transaksi perbankan Anda.'
              );
            }
          }

          return newSec;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setShowWarning(false);
      setOfflineSeconds(0);
      setCountdown(AUTO_LOGOUT_GRACE_SEC);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOnline]);

  return {
    isOnline,
    showWarning,
    offlineSeconds,
    countdown,
    isChecking,
    checkNow,
  };
}

// Visual Connection Status Badge
// Hijau = Terkoneksi Internet, Merah = Tidak Terkoneksi Internet
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

// Fullscreen Blocking Modal Guard
// Muncul peringatan apabila dalam 60 detik tidak terkoneksi ke internet
export interface NetworkStatusGuardProps {
  isOnline: boolean;
  showWarning: boolean;
  countdown: number;
  offlineSeconds?: number;
  isChecking: boolean;
  onCheckNow: () => Promise<boolean>;
  onLogout?: (reason: string) => void;
  isSessionActive: boolean;
}

export const NetworkStatusGuard: React.FC<NetworkStatusGuardProps> = ({
  isOnline,
  showWarning,
  countdown,
  offlineSeconds = 60,
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

      {/* Immediate Reconnecting Notice whenever Internet Drops while app is open */}
      {!isOnline && !showWarning && (
        <div className="fixed top-3 inset-x-0 mx-auto w-fit max-w-[92vw] z-[9998] px-4 py-2 bg-rose-950/95 text-rose-100 border border-rose-500/80 rounded-2xl shadow-2xl text-[11px] font-bold flex items-center gap-2.5 backdrop-blur">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
          <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>Aplikasi harus terhubung internet. Menyambung ulang ({offlineSeconds}/{OFFLINE_WARNING_THRESHOLD_SEC} dtk)...</span>
        </div>
      )}

      {/* Unclosable Full-Screen Blocking Modal when Disconnected for 60 seconds */}
      {showWarning && (
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
                <span>Merah: Tidak Terkoneksi Internet ({offlineSeconds} dtk)</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                Periksa Jaringan Koneksi Anda
              </h2>
              <p className="text-xs text-rose-200/90 leading-relaxed max-w-sm mx-auto">
                Perangkat Anda telah <b>tidak terkoneksi ke internet selama 60 detik</b>. Aplikasi dibekukan dan <b>tidak bisa digunakan</b> demi menjaga keamanan data saldo & transaksi koperasi.
              </p>
            </div>

            {/* Countdown Box */}
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-rose-500/40 text-center space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Waktu Tersisa Menuju Auto-Logout:
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
                  style={{ width: `${(countdown / AUTO_LOGOUT_GRACE_SEC) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {isSessionActive ? (
                  <>
                    Aplikasi akan otomatis <b className="text-rose-400">ter-logout</b> dalam{' '}
                    <span className="font-mono font-bold text-white">{countdown}</span> detik jika koneksi tidak pulih.
                  </>
                ) : (
                  <>
                    Menunggu jaringan internet kembali terhubung untuk melanjutkan aktivitas koperasi...
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
