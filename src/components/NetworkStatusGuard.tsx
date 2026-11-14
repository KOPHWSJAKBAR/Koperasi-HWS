import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, LogOut, CheckCircle2, Lock } from 'lucide-react';

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

interface SharedNetworkSnapshot {
  isOnline: boolean;
  showWarning: boolean;
  offlineSeconds: number;
  countdown: number;
  isChecking: boolean;
  blockedMessage: string | null;
}

const snapshot: SharedNetworkSnapshot = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  showWarning: false,
  offlineSeconds: 0,
  countdown: AUTO_LOGOUT_GRACE_SEC,
  isChecking: false,
  blockedMessage: null,
};

const subscribers = new Set<() => void>();
const sessionLogoutListeners = new Set<{
  isSessionActive: () => boolean;
  onLogout: (reason: string) => void;
}>();

let inFlightPing: Promise<boolean> | null = null;
let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
let offlineSecondTimer: ReturnType<typeof setInterval> | null = null;
let blockedNoticeTimer: ReturnType<typeof setTimeout> | null = null;
let monitorRefCount = 0;

function notifySubscribers() {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

function stopOfflineCounter() {
  if (offlineSecondTimer) {
    clearInterval(offlineSecondTimer);
    offlineSecondTimer = null;
  }
}

function startOfflineCounter() {
  if (offlineSecondTimer) return;
  offlineSecondTimer = setInterval(() => {
    if (snapshot.isOnline) {
      stopOfflineCounter();
      return;
    }

    const nextSec = snapshot.offlineSeconds + 1;
    snapshot.offlineSeconds = nextSec;

    if (nextSec >= OFFLINE_WARNING_THRESHOLD_SEC) {
      snapshot.showWarning = true;
      snapshot.countdown = Math.max(
        0,
        OFFLINE_WARNING_THRESHOLD_SEC + AUTO_LOGOUT_GRACE_SEC - nextSec
      );
    } else {
      snapshot.showWarning = false;
      snapshot.countdown = AUTO_LOGOUT_GRACE_SEC;
    }

    if (nextSec >= OFFLINE_WARNING_THRESHOLD_SEC + AUTO_LOGOUT_GRACE_SEC) {
      stopOfflineCounter();
      sessionLogoutListeners.forEach((entry) => {
        try {
          if (entry.isSessionActive()) {
            entry.onLogout(
              'Sesi Anda telah di-logout otomatis karena perangkat tidak terkoneksi ke jaringan internet demi menjaga keamanan akun dan transaksi perbankan Anda.'
            );
          }
        } catch {}
      });
    }

    notifySubscribers();
  }, 1000);
}

function applyOnlineState(nextOnline: boolean) {
  const prevOnline = snapshot.isOnline;
  snapshot.isOnline = nextOnline;

  if (nextOnline) {
    stopOfflineCounter();
    snapshot.showWarning = false;
    snapshot.offlineSeconds = 0;
    snapshot.countdown = AUTO_LOGOUT_GRACE_SEC;
    snapshot.blockedMessage = null;

    if (!prevOnline) {
      import('../lib/firebase-init')
        .then(({ ensureFirestoreOnline }) => ensureFirestoreOnline())
        .catch(() => {});
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hws:network_restored'));
      }
    }
  } else {
    startOfflineCounter();
  }

  notifySubscribers();
}

export function getIsInternetConnected(): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  return snapshot.isOnline;
}

export function showOfflineTransactionBlockedNotice(actionLabel?: string) {
  const label = actionLabel ? ` (${actionLabel})` : '';
  snapshot.blockedMessage = `Transaksi${label} diblokir: Status jaringan MERAH (tidak ada koneksi data internet). Hubungkan internet terlebih dahulu.`;
  notifySubscribers();

  if (blockedNoticeTimer) clearTimeout(blockedNoticeTimer);
  blockedNoticeTimer = setTimeout(() => {
    snapshot.blockedMessage = null;
    notifySubscribers();
  }, 4500);
}

export function assertInternetForTransaction(actionLabel?: string): boolean {
  if (!getIsInternetConnected()) {
    showOfflineTransactionBlockedNotice(actionLabel);
    return false;
  }
  return true;
}

export async function checkSharedInternetConnectivity(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    snapshot.isChecking = false;
    applyOnlineState(false);
    return false;
  }

  if (inFlightPing) {
    return inFlightPing;
  }

  snapshot.isChecking = true;
  notifySubscribers();

  inFlightPing = (async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      try {
        controller?.abort();
      } catch {}
    }, 3200);

    try {
      const res = await fetch(`/api/ping?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller?.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        applyOnlineState(false);
        return false;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        applyOnlineState(false);
        return false;
      }

      const data = await res.json().catch(() => null);
      const online = Boolean(
        data && (data.online === true || data.internet === true || data.status === 'online')
      );
      applyOnlineState(online);
      return online;
    } catch {
      clearTimeout(timeoutId);
      applyOnlineState(false);
      return false;
    } finally {
      snapshot.isChecking = false;
      inFlightPing = null;
      notifySubscribers();
    }
  })();

  return inFlightPing;
}

function scheduleNextPing() {
  if (heartbeatTimeout) {
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = null;
  }
  if (monitorRefCount <= 0) return;

  const delayMs = snapshot.isOnline ? 3500 : 2000;
  heartbeatTimeout = setTimeout(async () => {
    await checkSharedInternetConnectivity();
    scheduleNextPing();
  }, delayMs);
}

function handleWindowOnline() {
  checkSharedInternetConnectivity().finally(() => scheduleNextPing());
}

function handleWindowOffline() {
  applyOnlineState(false);
  scheduleNextPing();
}

function handleWindowFocusOrVisible() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  checkSharedInternetConnectivity();
}

function retainNetworkMonitor() {
  monitorRefCount += 1;
  if (monitorRefCount === 1 && typeof window !== 'undefined') {
    window.addEventListener('online', handleWindowOnline);
    window.addEventListener('offline', handleWindowOffline);
    window.addEventListener('focus', handleWindowFocusOrVisible);
    window.addEventListener('pageshow', handleWindowFocusOrVisible);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleWindowFocusOrVisible);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      applyOnlineState(false);
    } else {
      checkSharedInternetConnectivity();
    }
    scheduleNextPing();
  }
}

function releaseNetworkMonitor() {
  monitorRefCount = Math.max(0, monitorRefCount - 1);
  if (monitorRefCount === 0 && typeof window !== 'undefined') {
    window.removeEventListener('online', handleWindowOnline);
    window.removeEventListener('offline', handleWindowOffline);
    window.removeEventListener('focus', handleWindowFocusOrVisible);
    window.removeEventListener('pageshow', handleWindowFocusOrVisible);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleWindowFocusOrVisible);
    }
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    }
    stopOfflineCounter();
  }
}

export function useNetworkStatus(
  onAutoLogout?: (reason: string) => void,
  isSessionActive: boolean = false
): NetworkStatusState {
  const [, setTick] = useState(0);

  const onAutoLogoutRef = useRef(onAutoLogout);
  onAutoLogoutRef.current = onAutoLogout;
  const isSessionActiveRef = useRef(isSessionActive);
  isSessionActiveRef.current = isSessionActive;

  useEffect(() => {
    const listener = () => setTick((t) => (t + 1) % 1000000);
    subscribers.add(listener);
    retainNetworkMonitor();

    let logoutEntry: { isSessionActive: () => boolean; onLogout: (reason: string) => void } | null = null;
    if (onAutoLogout) {
      logoutEntry = {
        isSessionActive: () => isSessionActiveRef.current,
        onLogout: (reason: string) => onAutoLogoutRef.current?.(reason),
      };
      sessionLogoutListeners.add(logoutEntry);
    }

    return () => {
      subscribers.delete(listener);
      if (logoutEntry) {
        sessionLogoutListeners.delete(logoutEntry);
      }
      releaseNetworkMonitor();
    };
  }, [Boolean(onAutoLogout)]);

  return {
    isOnline: snapshot.isOnline,
    showWarning: snapshot.showWarning,
    offlineSeconds: snapshot.offlineSeconds,
    countdown: snapshot.countdown,
    isChecking: snapshot.isChecking,
    checkNow: checkSharedInternetConnectivity,
  };
}

// Visual Connection Status Badge
// Hijau = Terkoneksi Internet (Data Aktif), Merah = Tidak Terkoneksi Internet (Transaksi Terkunci)
export const ConnectionStatusBadge: React.FC<{
  isOnline: boolean;
  className?: string;
  compact?: boolean;
}> = ({ isOnline, className = '', compact = false }) => {
  if (isOnline) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm transition-all ${className}`}
        title="Status Hijau: Terkoneksi Data Internet (Semua Transaksi Aktif)"
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600/25 text-rose-200 border border-rose-500/80 shadow-sm transition-all animate-pulse ${className}`}
      title="Status Merah: Tidak Ada Koneksi Data Internet (Semua Transaksi Dikunci)"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-90"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
      </span>
      <WifiOff className="w-3 h-3 text-rose-400 shrink-0" />
      <span>{compact ? 'Offline (Terkunci)' : 'Tidak Terkoneksi Internet'}</span>
    </div>
  );
};

// Fullscreen Blocking Modal Guard & Transaction Lock Banner
// Merah saat offline -> semua transaksi diblokir langsung; muncul peringatan blocking setelah 60 detik
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
  offlineSeconds = 0,
  isChecking,
  onCheckNow,
  onLogout,
  isSessionActive,
}) => {
  const [showRestoredToast, setShowRestoredToast] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(snapshot.blockedMessage);
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    const syncBlocked = () => setBlockedMsg(snapshot.blockedMessage);
    subscribers.add(syncBlocked);
    return () => {
      subscribers.delete(syncBlocked);
    };
  }, []);

  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!wasOnline && isOnline) {
      setShowRestoredToast(true);
      const timer = setTimeout(() => setShowRestoredToast(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  return (
    <>
      {/* Toast when internet connection is restored (Hijau) */}
      {showRestoredToast && (
        <div className="fixed top-4 inset-x-0 mx-auto w-fit max-w-[92vw] z-[10000] px-4 py-2.5 bg-emerald-950/95 text-emerald-200 border-2 border-emerald-500/80 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2.5 backdrop-blur animate-in fade-in slide-in-from-top-4">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>✓ Koneksi internet tersambung kembali (Hijau). Semua transaksi aktif realtime.</span>
        </div>
      )}

      {/* Blocked Transaction Alert Toast */}
      {blockedMsg && !showWarning && (
        <div className="fixed bottom-5 inset-x-0 mx-auto w-fit max-w-[92vw] z-[10001] px-4 py-3 bg-rose-950/95 text-rose-100 border-2 border-rose-500 rounded-2xl shadow-2xl text-xs font-extrabold flex items-center gap-2.5 backdrop-blur">
          <Lock className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{blockedMsg}</span>
        </div>
      )}

      {/* Immediate Red Connection & Transaction Lock Banner whenever Internet Drops */}
      {!isOnline && !showWarning && (
        <div className="fixed top-3 inset-x-0 mx-auto w-fit max-w-[94vw] z-[9998] px-4 py-2.5 bg-rose-950/95 text-rose-100 border-2 border-rose-500/90 rounded-2xl shadow-2xl text-[11px] font-bold flex items-center gap-2.5 backdrop-blur">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
          <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>
            Status Merah: Tidak ada data internet. <b>Semua transaksi dikunci</b> sementara ({offlineSeconds}/{OFFLINE_WARNING_THRESHOLD_SEC} dtk).
          </span>
          <button
            type="button"
            disabled={isChecking}
            onClick={() => onCheckNow()}
            className="ml-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-black cursor-pointer shrink-0"
          >
            {isChecking ? 'Cek...' : 'Cek Ulang'}
          </button>
        </div>
      )}

      {/* Unclosable Full-Screen Blocking Modal when Disconnected for 60 seconds */}
      {showWarning && (
        <div
          className="fixed inset-0 z-[9999] bg-[#070b14]/95 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="w-full max-w-md bg-[#0f172a] border-2 border-rose-500 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5 ring-4 ring-rose-500/20">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-3xl bg-rose-500/20 animate-ping opacity-60" />
              <div className="relative w-20 h-20 rounded-3xl bg-rose-600/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-950/50">
                <WifiOff className="w-10 h-10 text-rose-400" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[11px] font-black uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Merah: Tidak Terkoneksi Internet ({offlineSeconds} dtk)</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                Periksa Jaringan Koneksi Anda
              </h2>
              <p className="text-xs text-rose-200/90 leading-relaxed max-w-sm mx-auto">
                Perangkat Anda telah <b>tidak terkoneksi ke internet selama 60 detik</b>. Semua transaksi & aplikasi dibekukan sementara demi menjaga keamanan data saldo koperasi.
              </p>
            </div>

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
