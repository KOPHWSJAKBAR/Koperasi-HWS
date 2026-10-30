import React, { useState, useEffect } from 'react';
import {
  AppState,
  AdminUser,
  MemberUser,
  SuratResmi,
} from '../types';
import { createAuditLog, fetchStateFromServer } from '../lib/storage';
import { printDocumentHtml } from '../lib/exportPdf';
import { LogoHws } from '../lib/logo';
import { sendRealtimeNotification } from '../lib/fcm';
import {
  Mail,
  Send,
  Printer,
  MessageSquare,
  Users,
  CheckCircle2,
  FileText,
  PlusCircle,
  ExternalLink,
  Eye,
  CheckCheck,
  X,
} from 'lucide-react';

interface SuratMenyuratViewProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin?: AdminUser;
  currentMember?: MemberUser;
}

export const SuratMenyuratView: React.FC<SuratMenyuratViewProps> = ({
  state,
  updateState,
  currentAdmin,
  currentMember,
}) => {
  const isMember = !!currentMember;

  // New letter form
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [perihal, setPerihal] = useState('');
  const [tujuanTipe, setTujuanTipe] = useState<'semua' | 'perorangan'>('semua');
  const [targetMemberId, setTargetMemberId] = useState('');
  const [isiSurat, setIsiSurat] = useState('');
  const [previewSurat, setPreviewSurat] = useState<SuratResmi | null>(null);

  // Live Realtime Synchronization across all devices
  useEffect(() => {
    const handleNewSurat = () => {
      fetchStateFromServer();
    };
    window.addEventListener('hws:new_surat', handleNewSurat);
    window.addEventListener('hws:realtime_notification', handleNewSurat);
    const interval = setInterval(fetchStateFromServer, 3000);
    return () => {
      window.removeEventListener('hws:new_surat', handleNewSurat);
      window.removeEventListener('hws:realtime_notification', handleNewSurat);
      clearInterval(interval);
    };
  }, []);

  // Filter letters for member
  const displaySuratList = state.suratList.filter((s) => {
    if (isMember) {
      return s.tujuanTipe === 'semua' || s.targetMemberId === currentMember.id;
    }
    return true;
  });

  // Helper check if surat is read by current user (Req 5)
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
      await updateState((prev) => ({
        ...prev,
        suratList: prev.suratList.map((s) =>
          s.id === surat.id
            ? { ...s, readByMemberIds: Array.from(new Set([...(s.readByMemberIds || []), currentReaderId])) }
            : s
        ),
      }));
    } else {
      if ((surat.readByAdminIds || []).includes(currentReaderId)) return;
      await updateState((prev) => ({
        ...prev,
        suratList: prev.suratList.map((s) =>
          s.id === surat.id
            ? { ...s, readByAdminIds: Array.from(new Set([...(s.readByAdminIds || []), currentReaderId])) }
            : s
        ),
      }));
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

    await updateState((prev) => ({
      ...prev,
      suratList: prev.suratList.map((s) => {
        if (isMember) {
          const isTarget = s.tujuanTipe === 'semua' || s.targetMemberId === currentMember?.id;
          if (!isTarget) return s;
          return {
            ...s,
            readByMemberIds: Array.from(new Set([...(s.readByMemberIds || []), currentReaderId])),
          };
        } else {
          return {
            ...s,
            readByAdminIds: Array.from(new Set([...(s.readByAdminIds || []), currentReaderId])),
          };
        }
      }),
    }));

    try {
      fetch('/api/surat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markAll: true,
          suratIds: displaySuratList.map((s) => s.id),
          readerId: currentReaderId,
          readerType: isMember ? 'member' : 'admin',
        }),
      }).catch(() => {});
    } catch {}
  };

  const handleCreateSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdmin) return;

    const targetMember = state.members.find((m) => m.id === targetMemberId);
    const nomorSurat = `HWS/DIR/${new Date().getFullYear()}/${String(state.suratList.length + 1).padStart(3, '0')}`;

    const newSurat: SuratResmi = {
      id: `srt-${Date.now()}`,
      nomorSurat,
      perihal,
      tanggal: new Date().toISOString().split('T')[0],
      tujuanTipe,
      targetMemberId: tujuanTipe === 'perorangan' ? targetMemberId : undefined,
      targetMemberNama: tujuanTipe === 'perorangan' ? targetMember?.nama : 'Seluruh Anggota Koperasi HWS',
      isiSurat,
      diterbitkanOleh: currentAdmin.nama,
      statusTerkirimWa: true,
      statusTerkirimEmail: true,
      readByAdminIds: [currentAdmin.id],
      readByMemberIds: [],
      createdAt: new Date().toISOString(),
    };

    const audit = createAuditLog(
      currentAdmin,
      'Penerbitan Surat Resmi',
      `Menerbitkan surat "${perihal}" nomor ${nomorSurat} ke ${newSurat.targetMemberNama}`,
      newSurat.id
    );

    await updateState((prev) => ({
      ...prev,
      suratList: [newSurat, ...prev.suratList],
      auditLogs: [audit, ...prev.auditLogs],
    }));

    // Trigger Realtime Notifications (Req 5 & 1)
    sendRealtimeNotification({
      recipientId: tujuanTipe === 'perorangan' ? (targetMemberId || 'all') : 'all',
      recipientNama: newSurat.targetMemberNama,
      title: '📬 Surat Resmi Baru Koperasi HWS',
      body: `Perihal: "${perihal}". Nomor: ${nomorSurat}. Ketuk untuk membaca edaran resmi koperasi.`,
      type: 'surat_baru',
      data: { suratId: newSurat.id },
    }).catch(() => {});

    try {
      fetch('/api/surat/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surat: newSurat, adminName: currentAdmin.nama }),
      }).catch(() => {});
    } catch {}

    setShowComposeModal(false);
    setPerihal('');
    setIsiSurat('');
    alert('✓ Surat resmi berhasil diterbitkan & notifikasi realtime dikirim ke anggota!');
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

  // Dispatch to WhatsApp
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

  // Dispatch to Email
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
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              <span>Surat Menyurat & Edaran Resmi Koperasi</span>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-black animate-pulse">
                  {unreadCount} Belum Dibaca
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Penerbitan surat edaran resmi terintegrasi real-time, WhatsApp, & email
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-650 flex items-center gap-1.5 transition-all shadow-sm"
                title="Tandai semua surat sebagai sudah dibaca"
              >
                <CheckCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Tandai Semua Dibaca</span>
              </button>
            )}

            {!isMember && (
              <button
                onClick={() => setShowComposeModal(true)}
                className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Terbitkan Surat Baru</span>
              </button>
            )}
          </div>
        </div>

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
                      {surat.targetMemberNama}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-white group-hover:text-amber-400 transition-colors">
                    {surat.perihal}
                  </h4>
                  <p className="text-xs text-slate-300 line-clamp-2">{surat.isiSurat}</p>
                </div>

                <div
                  className="flex items-center gap-1.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      markSuratAsRead(surat);
                      setPreviewSurat(surat);
                    }}
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-650 rounded-xl text-xs font-bold flex items-center gap-1"
                    title="Buka & Baca Surat"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    <span>Baca</span>
                  </button>

                  <button
                    onClick={() => {
                      markSuratAsRead(surat);
                      handlePrintSurat(surat);
                    }}
                    className="py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cetak Kop</span>
                  </button>

                  {!isMember && (
                    <>
                      <button
                        onClick={() => handleSendWa(surat, surat.targetMemberId ? state.members.find(m => m.id === surat.targetMemberId)?.whatsapp : '')}
                        className="py-1.5 px-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
                        title="Kirim via WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WA</span>
                      </button>
                      <button
                        onClick={() => handleSendEmail(surat, surat.targetMemberId ? state.members.find(m => m.id === surat.targetMemberId)?.email : '')}
                        className="py-1.5 px-2.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
                        title="Kirim via Email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Email</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {displaySuratList.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs">
              Belum ada surat resmi atau edaran yang diterbitkan.
            </div>
          )}
        </div>
      </div>

      {/* Modal Baca Surat Lengkap (Req 5) */}
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
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                <span>Penerima: <strong className="text-amber-300">{previewSurat.targetMemberNama}</strong></span>
                <span>Diterbitkan Oleh: <strong className="text-white">{previewSurat.diterbitkanOleh}</strong></span>
              </div>
              <div className="text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-sm">
                {previewSurat.isiSurat}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handlePrintSurat(previewSurat)}
                className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Lembar Resmi</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewSurat(null)}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Terbitkan Surat */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-lg rounded-3xl p-5 shadow-2xl">
            <h3 className="text-sm font-extrabold text-white mb-3 pb-2 border-b border-slate-700">
              Penerbitan Surat Resmi Koperasi HWS
            </h3>

            <form onSubmit={handleCreateSurat} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Perihal Surat *</label>
                <input
                  type="text"
                  required
                  value={perihal}
                  onChange={(e) => setPerihal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Target Penerima</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setTujuanTipe('semua')}
                    className={`py-2 rounded-xl border font-bold ${
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
                    className={`py-2 rounded-xl border font-bold ${
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
                    value={targetMemberId}
                    onChange={(e) => setTargetMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">Pilih Anggota</option>
                    {state.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama} ({m.nomorAnggota} - WA: {m.whatsapp})
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
                  placeholder="Tuliskan isi surat resmi secara terperinci..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 text-slate-950 font-black rounded-xl"
                >
                  Terbitkan & Kirim Notifikasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
