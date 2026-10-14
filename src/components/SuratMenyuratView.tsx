import React, { useState } from 'react';
import {
  AppState,
  AdminUser,
  MemberUser,
  SuratResmi,
} from '../types';
import { createAuditLog } from '../lib/storage';
import { printDocumentHtml } from '../lib/exportPdf';
import { sendRealtimeNotification } from '../lib/fcm';
import { LogoHws } from '../lib/logo';
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

  // Filter letters for member
  const displaySuratList = state.suratList.filter((s) => {
    if (isMember && currentMember) {
      return s.tujuanTipe === 'semua' || s.targetMemberId === currentMember.id;
    }
    return true;
  });

  // Calculate unread count (Req 5)
  const unreadCount = displaySuratList.filter((s) => {
    if (isMember && currentMember) {
      return !s.readByMemberIds?.includes(currentMember.id);
    }
    if (currentAdmin) {
      return !s.readByAdminIds?.includes(currentAdmin.id);
    }
    return false;
  }).length;

  // Mark single letter as read (Req 5)
  const handleMarkAsRead = async (surat: SuratResmi) => {
    if (isMember && currentMember) {
      if (surat.readByMemberIds?.includes(currentMember.id)) return;
      await updateState((prev) => ({
        ...prev,
        suratList: prev.suratList.map((s) =>
          s.id === surat.id
            ? { ...s, readByMemberIds: Array.from(new Set([...(s.readByMemberIds || []), currentMember.id])) }
            : s
        ),
      }));
    } else if (currentAdmin) {
      if (surat.readByAdminIds?.includes(currentAdmin.id)) return;
      await updateState((prev) => ({
        ...prev,
        suratList: prev.suratList.map((s) =>
          s.id === surat.id
            ? { ...s, readByAdminIds: Array.from(new Set([...(s.readByAdminIds || []), currentAdmin.id])) }
            : s
        ),
      }));
    }
  };

  // Mark all visible letters as read (Req 5)
  const handleMarkAllAsRead = async () => {
    if (isMember && currentMember) {
      await updateState((prev) => ({
        ...prev,
        suratList: prev.suratList.map((s) => {
          const isForMe = s.tujuanTipe === 'semua' || s.targetMemberId === currentMember.id;
          if (!isForMe) return s;
          return {
            ...s,
            readByMemberIds: Array.from(new Set([...(s.readByMemberIds || []), currentMember.id])),
          };
        }),
      }));
    } else if (currentAdmin) {
      await updateState((prev) => ({
        ...prev,
        suratList: prev.suratList.map((s) => ({
          ...s,
          readByAdminIds: Array.from(new Set([...(s.readByAdminIds || []), currentAdmin.id])),
        })),
      }));
    }
  };

  const handleOpenPreview = (surat: SuratResmi) => {
    setPreviewSurat(surat);
    handleMarkAsRead(surat);
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

    // Kirim notifikasi realtime FCM & Firestore (Req 5 & Req 1)
    sendRealtimeNotification({
      recipientId: tujuanTipe === 'perorangan' ? (targetMemberId || 'all') : 'all',
      recipientNama: newSurat.targetMemberNama,
      title: '📨 Surat Resmi Baru Koperasi HWS',
      body: `Surat baru nomor ${nomorSurat}: "${perihal}" telah diterbitkan untuk Anda.`,
      type: 'surat_baru',
      data: { suratId: newSurat.id, nomorSurat, perihal },
    }).catch(() => {});

    setShowComposeModal(false);
    setPerihal('');
    setIsiSurat('');
    alert('✓ Surat resmi berhasil diterbitkan dan notifikasi telah dikirim ke anggota!');
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

  return (
    <div className="space-y-6">
      <div className="bg-[#111c33] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-500" />
                Surat Menyurat & Edaran Resmi Koperasi
              </h3>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black animate-pulse shadow-sm">
                  {unreadCount} Belum Dibaca
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Penerbitan surat edaran terintegrasi WhatsApp, Email, dan notifikasi realtime
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow"
                title="Tandai semua surat telah dibaca"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>Tandai Semua Dibaca</span>
              </button>
            )}

            {!isMember && (
              <button
                onClick={() => setShowComposeModal(true)}
                className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                + Terbitkan Surat Baru
              </button>
            )}
          </div>
        </div>

        {/* List of letters */}
        <div className="space-y-3 mt-4">
          {displaySuratList.map((surat) => {
            const isUnread = isMember
              ? currentMember && !surat.readByMemberIds?.includes(currentMember.id)
              : currentAdmin && !surat.readByAdminIds?.includes(currentAdmin.id);

            return (
              <div
                key={surat.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isUnread
                    ? 'bg-slate-800/90 border-amber-500/80 ring-1 ring-amber-500/30 shadow-md shadow-amber-500/10'
                    : 'bg-slate-800/60 hover:bg-slate-800/90 border-slate-700/60'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-amber-400 text-xs font-bold">
                      {surat.nomorSurat}
                    </span>
                    <span className="text-[10px] text-slate-400">• {surat.tanggal}</span>
                    <span className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/20 font-bold">
                      {surat.targetMemberNama}
                    </span>
                    {isUnread && (
                      <span className="text-[9px] bg-red-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                        BARU / BELUM DIBACA
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-extrabold text-white">{surat.perihal}</h4>
                  <p className="text-xs text-slate-300 line-clamp-2">{surat.isiSurat}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleOpenPreview(surat)}
                    className="py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1 shadow-sm transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Baca Surat</span>
                  </button>

                  {isUnread && (
                    <button
                      onClick={() => handleMarkAsRead(surat)}
                      className="py-1.5 px-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1"
                      title="Tandai Sudah Dibaca"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="hidden sm:inline">Sudah Baca</span>
                    </button>
                  )}

                  <button
                    onClick={() => handlePrintSurat(surat)}
                    className="py-1.5 px-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Cetak</span>
                  </button>

                  {!isMember && (
                    <>
                      <button
                        onClick={() => handleSendWa(surat, surat.targetMemberId ? state.members.find(m => m.id === surat.targetMemberId)?.whatsapp : '')}
                        className="py-1.5 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
                        title="Kirim via WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        WA
                      </button>
                      <button
                        onClick={() => handleSendEmail(surat, surat.targetMemberId ? state.members.find(m => m.id === surat.targetMemberId)?.email : '')}
                        className="py-1.5 px-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
                        title="Kirim via Email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Email
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

      {/* Modal Baca & Preview Surat Lengkap (Req 5) */}
      {previewSurat && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center gap-2.5">
                <LogoHws className="w-8 h-8" />
                <div>
                  <h3 className="text-sm font-black text-white">SURAT RESMI KOPERASI HWS</h3>
                  <div className="text-[10px] text-amber-400 font-mono font-bold">{previewSurat.nomorSurat}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSurat(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-start text-slate-300 border-b border-slate-800 pb-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">Penerima / Tujuan Surat:</span>
                  <span className="font-extrabold text-white text-sm">{previewSurat.targetMemberNama}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Tanggal Terbit:</span>
                  <span className="font-bold text-amber-300">{previewSurat.tanggal}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block">Perihal:</span>
                <span className="font-black text-white text-sm">{previewSurat.perihal}</span>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-1">Isi Lengkap Surat:</span>
                <div className="p-3.5 bg-slate-950/80 rounded-xl text-slate-200 leading-relaxed whitespace-pre-line font-normal border border-slate-800/80">
                  {previewSurat.isiSurat}
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-slate-800">
                <div>
                  Diterbitkan Oleh: <span className="font-bold text-white">{previewSurat.diterbitkanOleh}</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Status: Surat Telah Dibaca</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handlePrintSurat(previewSurat)}
                className="py-2 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                Cetak Kop Surat
              </button>
              <button
                type="button"
                onClick={() => setPreviewSurat(null)}
                className="py-2 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
