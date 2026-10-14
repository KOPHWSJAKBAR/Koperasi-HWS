/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useKoperasiState } from './lib/storage';
import { MemberUser, AdminUser } from './types';
import { LoginView } from './components/LoginView';
import { MemberDashboard } from './components/MemberDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';

import { detectPlatform } from './lib/activityLogger';

const SESSION_KEY = 'koperasi_hws_active_session';
const AUTO_LOGOUT_MS = 2 * 60 * 1000; // 2 Menit (Req 12: Buat aplikasi ini auto logout dalam 2 menit apabila tidak tertutup)

export default function App() {
  const { state, updateState } = useKoperasiState();

  const [activeSession, setActiveSession] = useState<{
    type: 'member' | 'admin';
    id: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [isFirebaseAuthReady, setIsFirebaseAuthReady] = useState(false);
  const [backToastMessage, setBackToastMessage] = useState<string | null>(null);

  // Synchronize and persist user session with Firebase Authentication across all platforms (Web, Mobile, PC)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setIsFirebaseAuthReady(true);
        if (firebaseUser) {
          try {
            const saved = localStorage.getItem(SESSION_KEY);
            if (saved && !activeSession) {
              setActiveSession(JSON.parse(saved));
            }
          } catch {}
        }
      },
      () => {
        setIsFirebaseAuthReady(true);
      }
    );

    return () => unsubscribe();
  }, [activeSession]);

  // Handle Logout with Firebase Auth
  const handleLogout = async (reason?: string) => {
    try {
      localStorage.removeItem(SESSION_KEY);
      if (auth.currentUser) {
        await signOut(auth).catch(() => {});
      }
    } catch {}
    setActiveSession(null);
    if (reason) {
      alert(reason);
    }
  };

  // Helper to safely trigger optional Firebase Auth in the background
  const safeConnectFirebaseAuth = () => {
    try {
      if (!auth.currentUser) {
        signInAnonymously(auth).catch(() => {});
      }
    } catch {}
  };

  // Handle Login Member
  const handleLoginMember = async (member: MemberUser) => {
    const session = { type: 'member' as const, id: member.id };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      safeConnectFirebaseAuth();
    } catch {}
    setActiveSession(session);
  };

  // Handle Login Admin
  const handleLoginAdmin = async (admin: AdminUser) => {
    const session = { type: 'admin' as const, id: admin.id };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      safeConnectFirebaseAuth();
    } catch {}
    setActiveSession(session);
  };

  // Find active entity - Do NOT fallback to first member or super admin
  const currentMember =
    activeSession?.type === 'member'
      ? state.members.find((m) => m.id === activeSession.id) || null
      : null;

  const currentAdmin =
    activeSession?.type === 'admin'
      ? state.admins.find((a) => a.id === activeSession.id) || null
      : null;

  // Requirement 12: Auto logout dalam 2 menit apabila tidak ada interaksi / tidak tertutup
  useEffect(() => {
    if (!currentMember && !currentAdmin) return;

    let timeoutId: any;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout('Sesi Anda telah berakhir secara otomatis demi keamanan (inaktif 2 menit).');
      }, AUTO_LOGOUT_MS);
    };

    resetTimer();

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [currentMember, currentAdmin]);

  // Requirement 7: Apabila masuk kedalam suatu menu tombol 1x klik Kembali ke menu sebelumnya, 3 klik logout
  useEffect(() => {
    if (!currentMember && !currentAdmin) return;

    let backPressCount = 0;
    let lastBackPressTime = 0;
    let toastTimer: any = null;

    // Push dummy history state so popstate is captured
    window.history.pushState({ page: 'app-main' }, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      const now = Date.now();

      if (now - lastBackPressTime < 3000) {
        backPressCount += 1;
      } else {
        backPressCount = 1;
      }
      lastBackPressTime = now;

      // Push state again so next back can be captured
      window.history.pushState({ page: 'app-main' }, '', window.location.href);

      clearTimeout(toastTimer);

      if (backPressCount === 1) {
        // 1x klik: Kembali ke menu sebelumnya
        window.dispatchEvent(new CustomEvent('app:back_press', { detail: { count: 1 } }));
        setBackToastMessage('Kembali ke menu sebelumnya. (Klik 3x untuk logout)');
        toastTimer = setTimeout(() => {
          setBackToastMessage(null);
          backPressCount = 0;
        }, 3000);
      } else if (backPressCount === 2) {
        setBackToastMessage('Klik 1x lagi untuk keluar / logout dari aplikasi');
        toastTimer = setTimeout(() => {
          setBackToastMessage(null);
          backPressCount = 0;
        }, 3000);
      } else if (backPressCount >= 3) {
        // 3x klik: Logout
        setBackToastMessage('Keluar dari akun...');
        backPressCount = 0;
        setTimeout(() => {
          setBackToastMessage(null);
          handleLogout('Anda telah berhasil keluar dari akun (3x klik tombol kembali).');
        }, 300);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearTimeout(toastTimer);
    };
  }, [currentMember, currentAdmin]);

  // Online Presence Heartbeat across Web, Mobile, and PC (Req 1 & 19)
  useEffect(() => {
    const sendPresence = async () => {
      try {
        const platform = detectPlatform();
        const activeId = currentMember?.id || currentAdmin?.id || 'guest';
        const activeName = currentMember?.nama || currentAdmin?.nama || 'Pengunjung';
        const role = currentAdmin
          ? (currentAdmin.role === 'super_admin' ? 'super_admin' : 'admin')
          : 'member';

        await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: activeId,
            userName: activeName,
            role,
            platform,
          }),
        });
      } catch {}
    };

    sendPresence();
    const interval = setInterval(sendPresence, 25000);
    return () => clearInterval(interval);
  }, [currentMember, currentAdmin]);

  // Capture PWA install prompt and notification permission
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if ('Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission();
      } catch {}
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return (
    <>
      {currentMember ? (
        <MemberDashboard
          state={state}
          updateState={updateState}
          member={currentMember}
          onLogout={handleLogout}
        />
      ) : currentAdmin ? (
        <AdminDashboard
          state={state}
          updateState={updateState}
          admin={currentAdmin}
          onLogout={handleLogout}
        />
      ) : (
        <LoginView
          state={state}
          updateState={updateState}
          onLoginMember={handleLoginMember}
          onLoginAdmin={handleLoginAdmin}
        />
      )}

      {/* Floating Back Button Double-Click Toast (Req 11) */}
      {backToastMessage && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-fit z-50 px-4 py-2 bg-slate-900/95 text-white border border-amber-500/80 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 backdrop-blur animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>{backToastMessage}</span>
        </div>
      )}
    </>
  );
}
