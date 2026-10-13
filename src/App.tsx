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

const SESSION_KEY = 'koperasi_hws_active_session';

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
  const handleLogout = async () => {
    try {
      localStorage.removeItem(SESSION_KEY);
      if (auth.currentUser) {
        await signOut(auth).catch(() => {});
      }
    } catch {}
    setActiveSession(null);
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

  if (currentMember) {
    return (
      <MemberDashboard
        state={state}
        updateState={updateState}
        member={currentMember}
        onLogout={handleLogout}
      />
    );
  }

  if (currentAdmin) {
    return (
      <AdminDashboard
        state={state}
        updateState={updateState}
        admin={currentAdmin}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <LoginView
      state={state}
      updateState={updateState}
      onLoginMember={handleLoginMember}
      onLoginAdmin={handleLoginAdmin}
    />
  );
}
