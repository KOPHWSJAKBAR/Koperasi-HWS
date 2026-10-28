import { collection, doc, setDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { AdminUser, AuditLog } from '../types';

export function detectPlatform(): 'mobile_android' | 'mobile_ios' | 'desktop_pc' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'mobile_android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'mobile_ios';
  if (/windows|win32|macintosh|linux/i.test(ua) && !/mobile/i.test(ua)) return 'desktop_pc';
  return 'web';
}

/**
 * Record an admin activity log to Firestore 'logs' collection and local/server store.
 * Restricted to super-admin view only.
 */
export async function recordAdminActivity(
  admin: AdminUser,
  action: string,
  detail: string,
  targetId?: string,
  existingLogId?: string,
  existingTimestamp?: string
): Promise<AuditLog> {
  const platform = detectPlatform();
  const timestamp = existingTimestamp || new Date().toISOString();
  const logId = existingLogId || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const formattedDetail = detail.includes('[Platform:')
    ? detail
    : `[Platform: ${platform.toUpperCase()}] ${detail}`;

  const logEntry: AuditLog = {
    id: logId,
    timestamp,
    adminId: admin.id,
    adminNama: admin.nama,
    adminRole: admin.role,
    action,
    detail: formattedDetail,
    targetId,
  };

  // 1. Write to Firestore 'logs' collection with deterministic logId
  try {
    const { sanitizeForFirestore } = await import('./storage');
    const cleanLog = sanitizeForFirestore({
      ...logEntry,
      targetId: targetId || null,
      platform,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      createdAtServer: serverTimestamp(),
    });
    await setDoc(doc(db, 'logs', logId), cleanLog, { merge: true });
  } catch {
    // Handled gracefully - log is persisted reliably via /api/logs
  }

  // 2. Write to backend API /api/logs for server persistence
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        log: logEntry,
        platform,
      }),
    });
  } catch {}

  return logEntry;
}

/**
 * Fetch logs directly from Firestore 'logs' collection (restricted to super admin view)
 */
export async function fetchFirestoreActivityLogs(limitCount = 100): Promise<AuditLog[]> {
  try {
    const logsCol = collection(db, 'logs');
    const q = query(logsCol, orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    const logs: AuditLog[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      logs.push({
        id: docSnap.id,
        timestamp: data.timestamp || new Date().toISOString(),
        adminId: data.adminId || 'unknown',
        adminNama: data.adminNama || 'Admin',
        adminRole: data.adminRole || 'admin',
        action: data.action || '',
        detail: data.detail || '',
        targetId: data.targetId,
      });
    });
    return logs;
  } catch {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch {}
    return [];
  }
}
