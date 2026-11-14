import React, { useState, useEffect } from 'react';

export interface NetworkStatusState {
  isOnline: boolean;
  isChecking: boolean;
  checkNow: () => Promise<boolean>;
}

interface SharedNetworkSnapshot {
  isOnline: boolean;
  isChecking: boolean;
}

const snapshot: SharedNetworkSnapshot = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
  isChecking: false,
};

const subscribers = new Set<() => void>();
let monitorRefCount = 0;

function notifySubscribers() {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

function applyOnlineState(nextOnline: boolean) {
  const prevOnline = snapshot.isOnline;
  snapshot.isOnline = nextOnline;

  if (nextOnline && !prevOnline) {
    import('../lib/firebase-init')
      .then(({ ensureFirestoreOnline }) => ensureFirestoreOnline())
      .catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hws:network_restored'));
    }
  }

  notifySubscribers();
}

export function getIsInternetConnected(): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  return true;
}

export function assertInternetForTransaction(_actionLabel?: string): boolean {
  return true;
}

export async function checkSharedInternetConnectivity(): Promise<boolean> {
  const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  snapshot.isChecking = false;
  applyOnlineState(browserOnline);
  return browserOnline;
}

function handleWindowOnline() {
  applyOnlineState(true);
}

function handleWindowOffline() {
  applyOnlineState(false);
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
    applyOnlineState(typeof navigator !== 'undefined' ? navigator.onLine !== false : true);
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
  }
}

export function useNetworkStatus(): NetworkStatusState {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => (t + 1) % 1000000);
    subscribers.add(listener);
    retainNetworkMonitor();

    return () => {
      subscribers.delete(listener);
      releaseNetworkMonitor();
    };
  }, []);

  return {
    isOnline: snapshot.isOnline,
    isChecking: snapshot.isChecking,
    checkNow: checkSharedInternetConnectivity,
  };
}

// Connection color monitoring removed per user request
export const ConnectionStatusBadge: React.FC<{
  isOnline?: boolean;
  className?: string;
  compact?: boolean;
}> = () => null;

// 60-second offline blocking modal and auto-logout removed per user request
export interface NetworkStatusGuardProps {
  isOnline?: boolean;
  isChecking?: boolean;
  onCheckNow?: () => Promise<boolean>;
  onLogout?: (reason: string) => void;
  isSessionActive?: boolean;
}

export const NetworkStatusGuard: React.FC<NetworkStatusGuardProps> = () => null;
