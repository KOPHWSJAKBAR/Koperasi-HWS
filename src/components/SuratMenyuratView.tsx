import React, { useState, useEffect, useMemo } from 'react';
import {
  AppState,
  AdminUser,
  MemberUser,
  SuratResmi,
} from '../types';
import {
  commitLocalStatePatch,
  createAuditLog,
  fetchStateFromServer,
  isSuratDeletedClient,
  maxIsoTsClient,
  sanitizeForFirestore,
  sortMembersDesc,
} from '../lib/storage';
import { printDocumentHtml } from '../lib/exportPdf';
import { sendRealtimeNotification } from '../lib/fcm';
import {
  Mail,
  Printer,
  MessageSquare,
  PlusCircle,
  Eye,
  CheckCheck,
  X,
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

interface SuratMenyuratViewProps {
  state: AppState;
  updateState?: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin?: AdminUser;
  currentMember?: MemberUser;
}

const SURAT_ALLOWED_ROLES = new Set([
  'super_admin',
  'admin_approval',
  'admin_kelola',
  'admin_pembukuan',
  'admin_write',
]);

export const SuratMenyuratView: React.FC<SuratMenyuratViewProps> = ({
  state,
  currentAdmin,
  currentMember,
}) => {
  const isMember = !!currentMember;
  const canManageSurat =
    !isMember && !!currentAdmin && SURAT_ALLOWED_ROLES.has(currentAdmin.role);

  // Compose letter modal (Admin only)
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [perihal, setPerihal] = useState('');
  const [tujuanTipe, setTujuanTipe] = useState<'semua' | 'perorangan'>('semua');
  const [targetMemberId, setTargetMemberId] = useState('');
  const [isiSurat, setIsiSurat] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview, confirmation modal, and inline feedback
  const [previewSurat, setPreviewSurat] = useState<SuratResmi | null>(null);
  const [confirmModal, setConfirmModal] = useState<
    { type: 'delete_single'; surat: SuratResmi } | { type: 'reset_all' } | null
  >(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Live Realtime Synchronization via SSE / Window events (no redundant 3s full polling)
  useEffect(() => {
    const handleRealtimeSurat = () => {
      fetchStateFromServer();
    };
    window.addEventListener('hws:new_surat', handleRealtimeSurat);
    window.addEventListener('hws:realtime_notification', handleRealtimeSurat);
    return () => {
      window.removeEventListener('hws:new_surat', handleRealtimeSurat);
      window.removeEventListener('hws:realtime_notification', handleRealtimeSurat);
    };
  }, []);

  useEffect(() => {
    if (!statusBanner) return;
    const timer = setTimeout(() => setStatusBanner(null), 5000);
    return () => clearTimeout(timer);
  }, [statusBanner]);

  const delSuratSet = useMemo(
    () => new Set<string>(state.deletedSuratIds || []),
    [state.deletedSuratIds]
  );

  // Filter letters cleanly (respect tombstones/reset + role access)
  const displaySuratList = useMemo(() => {
    return (state.suratList || []).filter((s) => {
      if (!s || isSuratDeletedClient(s, delSuratSet, state.suratResetAt)) {
        return false;
      }
      if (isMember && currentMember) {
        return (
          s.tujuanTipe === 'semua' ||
          (s.tujuanTipe === 'perorangan' && s.targetMemberId === currentMember.id)
        );
      }
      return true;
    });
  }, [state.suratList, delSuratSet, state.suratResetAt, isMember, currentMember]);

  // Close preview if the previewed letter was deleted/reset remotely
  useEffect(() => {
    if (previewSurat && !displaySuratList.some((s) => s.id === previewSurat.id)) {
      setPreviewSurat(null);
    }
  }, [displaySuratList, previewSurat]);

  const isSuratRead = (surat: SuratResmi) => {
    if (isMember && currentMember) {
      return (surat.readByMemberIds || []).includes(currentMember.id);
    }
    if (currentAdmin) {
      return (surat.readByAdminIds || []).includes(currentAdmin.id);
    }
    return false;
  };

  const markSuratAsRead = async (surat: SuratResmi) => {
    const currentReaderId = isMember ? currentMember?.id : currentAdmin?.id;
    if (!currentReaderId) return;

    if (isMember) {
      if ((surat.readByMemberIds || []).includes(currentReaderId)) return;
      const nextReadIds = Array.from(
        new Set([...(surat.readByMemberIds || []), currentReaderId])
      );
      commitLocalStatePatch((prev) => ({
        ...prev,
        suratList: prev.suratList.map((s) =>
          s.id === surat.id ? { ...s, readByMemberIds: nextReadIds } : s
        ),
      }));
      import('../lib/firebase')
        .then(({ db }) =>
          import('firebase/firestore').then(({ doc, updateDoc }) =>
            updateDoc(doc(db, 'surat', surat.id), { readByMemberIds: nextReadIds }).catch(() => {})
          )
        )
        .catch(() => {});
    } else {
      if ((surat.readByAdminIds || []).includes(currentReaderId)) return;
      const nextReadIds = Array.from(
        new Set([...(surat.readByAdminIds || []), currentReaderId])
      );
      commitLocalStatePatch((prev) => ({
        ...prev,
        suratList: prev.suratList.map((s) =>
          s.id === surat.id ? { ...s, readByAdminIds: nextReadIds } : s
        ),
      }));
      import('../lib/firebase')
        .then(({ db }) =>
          import('firebase/firestore').then(({ doc, updateDoc }) =>
            updateDoc(doc(db, 'surat', surat.id), { readByAdminIds: nextReadIds }).catch(() => {})
          )
        )
        .catch(() => {});
    }

    try {
      fetch('/api/surat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suratId: surat.id,
          readerId: currentReaderId,
          readerType: isMember ? 'member' : 'admin',
        }),
      }).catch(() => {});
    } catch {}
  };

  const handleMarkAllRead = async () => {
    const currentReaderId = isMember ? currentMember?.id : currentAdmin?.id;
    if (!currentReaderId) return;

    const targetIds = displaySuratList.map((s) => s.id);
    commitLocalStatePatch((prev) => ({
      ...prev,
      suratList: prev.suratList.map((s) => {
        if (isMember) {
          const isTarget =
            s.tujuanTipe === 'semua' ||
            (s.tujuanTipe === 'perorangan' && s.targetMemberId === currentMember?.id);
          if (!isTarget) return s;
          return {
            ...s,
            readByMemberIds: Array.from(
              new Set([...(s.readByMemberIds || []), currentReaderId])
            ),
          };
        }
        return {
          ...s,
          readByAdminIds: Array.from(
            new Set([...(s.readByAdminIds || []), currentReaderId])
          ),
        };
      }),
    }));

    try {
      fetch('/api/surat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markAll: true,
          suratIds: targetIds,
          readerId: currentReaderId,
          readerType: isMember ? 'member' : 'admin',
        }),
      }).catch(() => {});
    } catch {}
  };

  const handleCreateSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSurat || !currentAdmin || isSubmitting) return;

    const cleanPerihal = perihal.trim();
    const cleanIsi = isiSurat.trim();
    if (!cleanPerihal || !cleanIsi) {
      setStatusBanner({
        type: 'error',
        message: 'Perihal dan isi surat wajib diisi.',
      });
      return;
    }

    if (tujuanTipe === 'perorangan' && !targetMemberId) {
      setStatusBanner({
        type: 'error',
        message: 'Pilih anggota penerima terlebih dahulu.',
      });
      return;
    }

    const targetMember =
      tujuanTipe === 'perorangan'
        ? state.members.find((m) => m.id === targetMemberId)
        : undefined;
    if (tujuanTipe === 'perorangan' && !targetMember) {
      setStatusBanner({
        type: 'error',
        message: 'Anggota penerima tidak ditemukan.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const nextSeqNum =
        displaySuratList.reduce((max, s) => {
          const match = String(s?.nomorSurat || '').match(/(\d+)$/);
          const val = match ? parseInt(match[1], 10) : 0;
          return Number.isFinite(val) && val > max ? val : max;
        }, 0) + 1;

      const nomorSurat = `HWS/DIR/${new Date().getFullYear()}/${String(nextSeqNum).padStart(3, '0')}`;
      const senderNama = currentAdmin.nama || 'Pengurus';

      const newSurat: SuratResmi = {
        id: `srt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        nomorSurat,
        perihal: cleanPerihal,
        tanggal: new Date().toISOString().split('T')[0],
        tujuanTipe,
        targetMemberId: tujuanTipe === 'perorangan' ? targetMemberId : undefined,
        targetMemberNama:
          tujuanTipe === 'perorangan'
            ? targetMember?.nama || 'Anggota'
            : 'Seluruh Anggota Koperasi HWS',
        isiSurat: cleanIsi,
        diterbitkanOleh: senderNama,
        senderAdminId: currentAdmin.id,
        senderRole: currentAdmin.role,
        statusTerkirimWa: true,
        statusTerkirimEmail: true,
        readByAdminIds: [currentAdmin.id],
        readByMemberIds: [],
        createdAt: new Date().toISOString(),
      };

      const res = await fetch('/api/surat/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surat: newSurat,
          adminId: currentAdmin.id,
          adminName: senderNama,
          senderRole: currentAdmin.role,
          senderType: 'admin',
        }),
      });
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusBanner({
          type: 'error',
          message: resJson?.error || 'Gagal menerbitkan surat resmi.',
        });
        return;
      }

      const savedSurat: SuratResmi = resJson.surat || newSurat;

      // Direct Firestore write for zero-delay cross-device sync
      try {
        const { db } = await import('../lib/firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'surat', savedSurat.id), sanitizeForFirestore(savedSurat));
      } catch (fsErr) {
        console.warn('Direct Firestore surat write error:', fsErr);
      }

      const audit = createAuditLog(
        currentAdmin,
        'Penerbitan Surat Resmi',
        `Menerbitkan surat "${savedSurat.perihal}" nomor ${savedSurat.nomorSurat} kepada ${savedSurat.targetMemberNama}`,
        savedSurat.id
      );

      commitLocalStatePatch((prev) => ({
        ...prev,
        suratList: [
          savedSurat,
          ...(prev.suratList || []).filter((s) => s.id !== savedSurat.id),
        ],
        auditLogs: [audit, ...(prev.auditLogs || [])],
      }));

      sendRealtimeNotification({
        recipientId: tujuanTipe === 'perorangan' ? targetMemberId || 'all' : 'all',
        recipientNama: savedSurat.targetMemberNama,
        title: '📬 Surat Resmi Baru Koperasi HWS',
        body: `Perihal: "${savedSurat.perihal}". Nomor: ${savedSurat.nomorSurat}. Dari: ${senderNama}`,
        type: 'surat_baru',
        data: { suratId: savedSurat.id },
      }).catch(() => {});

      setShowComposeModal(false);
      setPerihal('');
      setIsiSurat('');
      setTargetMemberId('');
      setTujuanTipe('semua');
      setStatusBanner({
        type: 'success',
        message: `Surat resmi (${savedSurat.nomorSurat}) berhasil diterbitkan & dikirim secara realtime ke anggota.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Terjadi kesalahan jaringan saat menerbitkan surat.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDeleteSurat = async (surat: SuratResmi) => {
    if (!canManageSurat || !currentAdmin || isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      const res = await fetch('/api/surat/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suratId: surat.id,
          adminId: currentAdmin.id,
          adminName: currentAdmin.nama,
          adminRole: currentAdmin.role,
        }),
      });
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusBanner({
          type: 'error',
          message: resJson?.error || 'Gagal menghapus surat.',
        });
        return;
      }

      try {
        const { db } = await import('../lib/firebase');
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'surat', surat.id)).catch(() => {});
      } catch {}

      const audit = createAuditLog(
        currentAdmin,
        'Hapus Surat Menyurat',
        `Menghapus surat "${surat.perihal}" (${surat.nomorSurat})`,
        surat.id
      );

      commitLocalStatePatch((prev) => ({
        ...prev,
        suratList: (prev.suratList || []).filter((s) => s.id !== surat.id),
        deletedSuratIds: Array.from(
          new Set([...(prev.deletedSuratIds || []), surat.id])
        ).slice(-1000),
        auditLogs: [audit, ...(prev.auditLogs || [])],
      }));

      if (previewSurat?.id === surat.id) {
        setPreviewSurat(null);
      }
      setConfirmModal(null);
      setStatusBanner({
        type: 'success',
        message: `Surat "${surat.perihal}" (${surat.nomorSurat}) berhasil dihapus permanen.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Gagal menghapus surat karena gangguan jaringan.',
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const executeResetSurat = async () => {
    if (!canManageSurat || !currentAdmin || isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      const res = await fetch('/api/surat/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: currentAdmin.id,
          adminName: currentAdmin.nama,
          adminRole: currentAdmin.role,
        }),
      });
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusBanner({
          type: 'error',
          message: resJson?.error || 'Gagal mereset surat menyurat.',
        });
        return;
      }

      const resetAt = resJson.resetAt || new Date().toISOString();
      const oldIds = (state.suratList || []).map((s) => s.id).filter(Boolean);

      // Ensure Firestore docs are also removed from client if still cached
      try {
        const { db } = await import('../lib/firebase');
        const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'surat')).catch(() => null);
        if (snap) {
          await Promise.all(
            snap.docs.map((d) => deleteDoc(doc(db, 'surat', d.id)).catch(() => {}))
          );
        }
      } catch {}

      const audit = createAuditLog(
        currentAdmin,
        'Reset Surat Menyurat dari 0',
        `Mereset seluruh surat menyurat (${oldIds.length} surat). Penomoran dimulai kembali dari 001.`
      );

      commitLocalStatePatch((prev) => ({
        ...prev,
        suratList: [],
        deletedSuratIds: Array.from(
          new Set([...(prev.deletedSuratIds || []), ...oldIds])
        ).slice(-1000),
        suratResetAt: maxIsoTsClient(prev.suratResetAt, resetAt),
        auditLogs: [audit, ...(prev.auditLogs || [])],
      }));

      setPreviewSurat(null);
      setConfirmModal(null);
      setStatusBanner({
        type: 'success',
        message: 'Seluruh surat menyurat telah direset ke 0. Nomor surat berikutnya dimulai dari 001.',
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        message: err?.message || 'Gagal mereset surat menyurat.',
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handlePrintSurat = (surat: SuratResmi) => {
    const html = `
      <div style="padding: 24px; max-width: 750px; margin: 0 auto; color: #111;">
        <!-- KOP SURAT RESMI -->
        <table style="width: 100%; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px;">
          <tr>
            <td style="width: 70px; vertical-align: middle;">
              <svg width="65" height="65" viewBox="0 0 200 200" fill="none">
                <circle cx="100" cy="100" r="98" fill="#FEE024" stroke="#000" stroke-width="2" />
                <rect x="42" y="58" width="18" height="30" fill="#2E9E44" />
                <path d="M30 96 L100 28 L170 96 L154 96 L100 44 L46 96 Z" fill="#D62828" />
                <polygon points="100,54 124,68 124,106 100,120 76,106 76,68" fill="#007ACC" />
              </svg>
            </td>
            <td style="text-align: center; vertical-align: middle;">
              <h1 style="font-size: 18px; font-weight: 900; margin: 0; letter-spacing: 0.5px;">KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA</h1>
              <div style="font-size: 11px; font-weight: 700; color: #b45309;">BADAN HUKUM: ${state.profile.badanHukum}</div>
              <div style="font-size: 10px; color: #444; margin-top: 2px;">${state.profile.alamat} • Telp: ${state.profile.telepon} • Email: ${state.profile.email}</div>
            </td>
          </tr>
        </table>

        <!-- SURAT META -->
        <table style="width: 100%; font-size: 12px; margin-bottom: 20px;">
          <tr>
            <td style="width: 60%;">
              <div><b>Nomor</b> : ${surat.nomorSurat}</div>
              <div><b>Lampiran</b> : -</div>
              <div><b>Perihal</b> : <b>${surat.perihal}</b></div>
            </td>
            <td style="width: 40%; text-align: right; vertical-align: top;">
              <div>Jakarta, ${new Date(surat.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </td>
          </tr>
        </table>

        <div style="font-size: 12px; margin-bottom: 20px;">
          Kepada Yth,<br>
          <b>${surat.targetMemberNama}</b><br>
          Di Tempat
        </div>

        <!-- ISI SURAT -->
        <div style="font-size: 13px; line-height: 1.8; text-align: justify; margin-bottom: 40px; white-space: pre-line;">
          ${surat.isiSurat}
        </div>

        <!-- TANDA TANGAN PENGURUS -->
        <table style="width: 100%; font-size: 12px; margin-top: 40px;">
          <tr>
            <td style="width: 60%;"></td>
            <td style="width: 40%; text-align: center;">
              <div>Pengurus Koperasi HWS,</div>
              <div style="height: 60px;"></div>
              <div style="font-weight: 800; text-decoration: underline;">${surat.diterbitkanOleh}</div>
              <div style="font-size: 10px; color: #555;">Koperasi Himpunan Wirausaha Sejahtera</div>
            </td>
          </tr>
        </table>
      </div>
    `;

    printDocumentHtml(html, `Surat_Resmi_${surat.nomorSurat.replace(/\//g, '_')}`);
  };

  const handleSendWa = (surat: SuratResmi, phone?: string) => {
    const text = encodeURIComponent(
      `*PEMBERITAHUAN RESMI KOPERASI HWS*\n` +
        `No: ${surat.nomorSurat}\n` +
        `Perihal: ${surat.perihal}\n\n` +
        `${surat.isiSurat}\n\n` +
        `_Diterbitkan oleh: ${surat.diterbitkanOleh}_`
    );
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    window.open(`https://wa.me/${finalPhone}?text=${text}`, '_blank');
  };

  const handleSendEmail = (surat: SuratResmi, email?: string) => {
    const subject = encodeURIComponent(`[Koperasi HWS] ${surat.perihal} - No. ${surat.nomorSurat}`);
    const body = encodeURIComponent(
      `Pemberitahuan Resmi Koperasi HWS\n\n` +
        `Nomor: ${surat.nomorSurat}\n` +
        `Perihal: ${surat.perihal}\n\n` +
        `${surat.isiSurat}\n\n` +
        `Hormat kami,\n` +
        `Pengurus Koperasi Himpunan Wirausaha Sejahtera`
    );
    window.open(`mailto:${email || ''}?subject=${subject}&body=${body}`, '_blank');
  };

  const unreadCount = displaySuratList.filter((s) => !isSuratRead(s)).length;

  return (
    <div className="space-y-6">
      <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2 flex-wrap">
              <Mail className="w-5 h-5 text-amber-500" />
              <span>Surat Menyurat & Edaran Resmi Koperasi</span>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-black animate-pulse">
                  {unreadCount} Belum Dibaca
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isMember
                ? 'Surat resmi diterbitkan oleh Pengurus Koperasi (Super Admin, Admin Approval, Admin Write) kepada Anggota'
                : canManageSurat
                ? 'Penerbitan surat resmi khusus Admin Pengurus (Super Admin, Admin Approval, Admin Write) kepada Anggota'
                : 'Mode Baca & Arsip Surat Resmi Koperasi (Hanya Super Admin, Admin Approval, & Admin Write yang dapat menerbitkan/menghapus surat)'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-650 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="Tandai semua surat sebagai sudah dibaca"
              >
                <CheckCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Tandai Semua Dibaca</span>
              </button>
            )}

            {canManageSurat && (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmModal({ type: 'reset_all' })}
                  className="py-2 px-3 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Hapus semua surat & reset penomoran surat dari 0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Surat (0)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowComposeModal(true)}
                  className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Terbitkan Surat Baru</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusBanner && (
          <div
            className={`mt-4 px-4 py-3 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 ${
              statusBanner.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{statusBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* List of letters */}
        <div className="space-y-3 mt-4">
          {displaySuratList.map((surat) => {
            const isRead = isSuratRead(surat);
            return (
              <div
                key={surat.id}
                onClick={() => {
                  markSuratAsRead(surat);
                  setPreviewSurat(surat);
                }}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group ${
                  !isRead
                    ? 'bg-gradient-to-r from-amber-500/10 via-slate-800/80 to-slate-800/80 border-amber-500/50 hover:border-amber-400 shadow-md ring-1 ring-amber-500/30'
                    : 'bg-slate-800/60 hover:bg-slate-800/90 border-slate-700/60'
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {!isRead ? (
                      <span className="text-[10px] bg-red-500 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse shadow-sm">
                        BARU
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-700 text-slate-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCheck className="w-3 h-3 text-emerald-400" /> Sudah Dibaca
                      </span>
                    )}
                    <span className="font-mono text-amber-400 text-xs font-bold">
                      {surat.nomorSurat}
                    </span>
                    <span className="text-[10px] text-slate-400">• {surat.tanggal}</span>
                    <span className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/20 font-bold">
                      Kepada: {surat.targetMemberNama}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-white group-hover:text-amber-400 transition-colors">
                    {surat.perihal}
                  </h4>
                  <p className="text-xs text-slate-300 line-clamp-2">{surat.isiSurat}</p>
                </div>

                <div
                  className="flex flex-wrap items-center gap-1.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      markSuratAsRead(surat);
                      setPreviewSurat(surat);
                    }}
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-650 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Buka & Baca Surat"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    <span>Baca</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      markSuratAsRead(surat);
                      handlePrintSurat(surat);
                    }}
                    className="py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cetak Kop</span>
                  </button>

                  {canManageSurat && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          handleSendWa(
                            surat,
                            surat.targetMemberId
                              ? state.members.find((m) => m.id === surat.targetMemberId)?.whatsapp
                              : ''
                          )
                        }
                        className="py-1.5 px-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Kirim via WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WA</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSendEmail(
                            surat,
                            surat.targetMemberId
                              ? state.members.find((m) => m.id === surat.targetMemberId)?.email
                              : ''
                          )
                        }
                        className="py-1.5 px-2.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Kirim via Email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Email</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmModal({ type: 'delete_single', surat })}
                        className="py-1.5 px-2.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Hapus surat ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {displaySuratList.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-xs space-y-2 border border-dashed border-slate-700/70 rounded-2xl bg-slate-900/30">
              <Mail className="w-8 h-8 mx-auto text-slate-600" />
              <div className="font-bold text-slate-300">
                Belum ada surat resmi atau edaran yang diterbitkan.
              </div>
              <div className="text-[11px] text-slate-500">
                {canManageSurat
                  ? 'Penomoran surat siap dimulai dari nomor urut 001.'
                  : 'Surat resmi dari pengurus koperasi akan tampil otomatis di sini.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Baca Surat Lengkap */}
      {previewSurat && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#0f172a] text-slate-100 border border-slate-700/80 w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg shrink-0 font-bold border border-amber-500/30">
                  📬
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    {previewSurat.perihal}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {previewSurat.nomorSurat} • {previewSurat.tanggal}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSurat(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3 text-xs">
              <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                <span>
                  Penerima: <strong className="text-amber-300">{previewSurat.targetMemberNama}</strong>
                </span>
                <span>
                  Diterbitkan Oleh: <strong className="text-white">{previewSurat.diterbitkanOleh}</strong>
                </span>
              </div>
              <div className="text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-sm">
                {previewSurat.isiSurat}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintSurat(previewSurat)}
                  className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Lembar Resmi</span>
                </button>

                {canManageSurat && (
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ type: 'delete_single', surat: previewSurat })}
                    className="py-2 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Surat</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setPreviewSurat(null)}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Terbitkan Surat Resmi (Hanya Admin Pengurus: Super Admin, Admin Approval, Admin Write) */}
      {showComposeModal && canManageSurat && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-lg rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Penerbitan Surat Resmi Admin ke Anggota</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowComposeModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSurat} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Perihal Surat *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Undangan Rapat Anggota Tahunan / Pemberitahuan Resmi"
                  value={perihal}
                  onChange={(e) => setPerihal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Target Anggota Penerima</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTujuanTipe('semua');
                      setTargetMemberId('');
                    }}
                    className={`py-2 rounded-xl border font-bold cursor-pointer ${
                      tujuanTipe === 'semua'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Broadcast Seluruh Anggota
                  </button>
                  <button
                    type="button"
                    onClick={() => setTujuanTipe('perorangan')}
                    className={`py-2 rounded-xl border font-bold cursor-pointer ${
                      tujuanTipe === 'perorangan'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Anggota Perorangan
                  </button>
                </div>

                {tujuanTipe === 'perorangan' && (
                  <select
                    required
                    value={targetMemberId}
                    onChange={(e) => setTargetMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">-- Pilih Anggota Penerima --</option>
                    {sortMembersDesc(state.members).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama} ({m.nomorRekening || m.nomorAnggota} - WA: {m.whatsapp})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Isi Lengkap Surat *</label>
                <textarea
                  required
                  rows={5}
                  value={isiSurat}
                  onChange={(e) => setIsiSurat(e.target.value)}
                  placeholder="Tuliskan isi surat resmi kepada anggota secara terperinci..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowComposeModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 font-black rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 cursor-pointer"
                >
                  {isSubmitting ? 'Menerbitkan...' : 'Terbitkan & Kirim Notifikasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus / Reset Surat */}
      {confirmModal && canManageSurat && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-rose-500/40 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  {confirmModal.type === 'reset_all'
                    ? 'Reset Surat Menyurat dari 0?'
                    : 'Hapus Surat Menyurat?'}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {confirmModal.type === 'reset_all'
                    ? `Seluruh surat (${displaySuratList.length} surat) akan dihapus permanen dari server, Cloud Firestore, dan semua perangkat anggota. Penomoran surat akan dimulai ulang dari 001.`
                    : `Surat "${confirmModal.surat.perihal}" (${confirmModal.surat.nomorSurat}) akan dihapus permanen di semua perangkat.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setConfirmModal(null)}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() =>
                  confirmModal.type === 'reset_all'
                    ? executeResetSurat()
                    : executeDeleteSurat(confirmModal.surat)
                }
                className="py-2 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isProcessingAction
                    ? 'Memproses...'
                    : confirmModal.type === 'reset_all'
                    ? 'Ya, Reset ke 0'
                    : 'Ya, Hapus Permanen'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
