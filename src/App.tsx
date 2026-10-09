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

  // Handle Logout
  const handleLogout = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
    setActiveSession(null);
  };

  // Handle Login Member
  const handleLoginMember = (member: MemberUser) => {
    const session = { type: 'member' as const, id: member.id };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {}
    setActiveSession(session);
  };

  // Handle Login Admin
  const handleLoginAdmin = (admin: AdminUser) => {
    const session = { type: 'admin' as const, id: admin.id };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {}
    setActiveSession(session);
  };

  // Find active entity
  const currentMember =
    activeSession?.type === 'member'
      ? state.members.find((m) => m.id === activeSession.id) || state.members[0]
      : null;

  const currentAdmin =
    activeSession?.type === 'admin'
      ? state.admins.find((a) => a.id === activeSession.id) || state.admins[0]
      : null;

  // Request browser notification permission once for mobile & PC notification requirement
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission();
      } catch {}
    }
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
