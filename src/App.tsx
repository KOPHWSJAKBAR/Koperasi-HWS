/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useKoperasiState, CLIENT_ID } from './lib/storage';
import { MemberUser, AdminUser } from './types';
import { LoginView } from './components/LoginView';
import { MemberDashboard } from './components/MemberDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

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

  // Otomatis autentikasi Firebase anonymous agar izin baca/tulis Firestore online realtime aktif
  useEffect(() => {
    if (!auth.currentUser) {
      signInAnonymously(auth).catch(() => {});
    }
  }, []);

  // Hook useEffect untuk sinkronisasi data state dari lib/storage.ts ke Google Cloud Firestore secara realtime menggunakan onSnapshot
  const isUpdatingFromFirestoreRef = useRef(false);
  const lastUploadedJsonRef = useRef('');

  useEffect(() => {
    const docRef = doc(db, 'koperasi_state', 'main_database');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          if (state && state.profile) {
            setDoc(
              docRef,
              {
                lastSynced: new Date().toISOString(),
                updatedBy: CLIENT_ID,
                payload: JSON.stringify(state),
                totalMembers: (state.members || []).length,
                totalKas: (state.kasList || []).length,
                totalSetoran: (state.setoranList || []).length,
                totalSedekah: (state.sedekahList || []).length,
              },
              { merge: true }
            ).catch(() => {});
          }
          return;
        }

        const data = docSnap.data();
        if (data && data.payload) {
          if (data.updatedBy === CLIENT_ID || data.payload === lastUploadedJsonRef.current) {
            return;
          }
          try {
            const parsed = JSON.parse(data.payload);
            isUpdatingFromFirestoreRef.current = true;
            updateState((prev) => ({
              ...prev,
              ...parsed,
              serverSyncStatus: {
                ...(prev.serverSyncStatus || {}),
                online: true,
                firestoreActive: true,
                googleCloudBackup: true,
                lastSynced: new Date().toISOString(),
              },
            })).finally(() => {
              isUpdatingFromFirestoreRef.current = false;
            });
          } catch (err) {
            console.warn('Error sinkronisasi payload Firestore:', err);
          }
        }
      },
      (error) => {
        console.warn('Firestore onSnapshot listener notice:', error);
      }
    );

    return () => unsubscribe();
  }, [updateState]);

  // Mirror pembaruan state lokal ke Google Cloud Firestore saat data berubah
  useEffect(() => {
    if (isUpdatingFromFirestoreRef.current) return;
    if (!state || !state.profile) return;

    const currentJson = JSON.stringify(state);
    if (currentJson === lastUploadedJsonRef.current) return;

    lastUploadedJsonRef.current = currentJson;
    const docRef = doc(db, 'koperasi_state', 'main_database');
    const timer = setTimeout(() => {
      setDoc(
        docRef,
        {
          lastSynced: new Date().toISOString(),
          updatedBy: CLIENT_ID,
          payload: currentJson,
          totalMembers: (state.members || []).length,
          totalKas: (state.kasList || []).length,
          totalSetoran: (state.setoranList || []).length,
          totalSedekah: (state.sedekahList || []).length,
        },
        { merge: true }
      ).catch((err) => {
        console.warn('Pemberitahuan sinkronisasi Cloud Firestore:', err);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [state]);

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
        // 1x klik: Kembali ke menu sebelumnya / tutup modal yang terbuka (tanpa toast note sesuai Req 2)
        window.dispatchEvent(new CustomEvent('app:back_press', { cancelable: true, detail: { count: 1 } }));
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

  // Enforce Maintenance Lock: Blokir seluruh anggota & admin non-super saat sistem dikunci
  const isMaintenanceActive = !!state.maintenanceLock?.isLocked;
  const isSuperAdminUser = currentAdmin?.role === 'super_admin';

  if (isMaintenanceActive && (currentMember || (currentAdmin && !isSuperAdminUser))) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[#0f172a] border-2 border-rose-500/80 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5 animate-in fade-in">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50">
            <svg className="w-8 h-8 text-rose-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <div className="space-y-1.5">
            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider">
              Mode Lock Maintenance Aktif
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Sistem Dalam Pemeliharaan
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Akses akun Anda dibekukan sementara oleh Super Admin demi pemeliharaan dan rekonsiliasi data koperasi.
            </p>
          </div>

          {state.maintenanceLock?.note && (
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-rose-500/30 text-left space-y-1 text-xs">
              <div className="font-extrabold text-amber-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <span>⚠️ Catatan Resmi Super Admin:</span>
              </div>
              <p className="text-slate-200 leading-relaxed italic">
                "{state.maintenanceLock.note}"
              </p>
              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                Dikunci: {state.maintenanceLock.lockedAt ? new Date(state.maintenanceLock.lockedAt).toLocaleString('id-ID') : '-'}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleLogout('Keluar dari mode maintenance.')}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Kembali ke Layar Login
            </button>
          </div>
        </div>
      </div>
    );
  }

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
