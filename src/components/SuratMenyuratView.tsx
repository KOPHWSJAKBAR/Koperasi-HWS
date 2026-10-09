import React, { useState } from 'react';
import {
  AppState,
  AdminUser,
  MemberUser,
  SuratResmi,
} from '../types';
import { createAuditLog } from '../lib/storage';
import { printDocumentHtml } from '../lib/exportPdf';
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
    if (isMember) {
      return s.tujuanTipe === 'semua' || s.targetMemberId === currentMember.id;
    }
    return true;
  });

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

    setShowComposeModal(false);
    setPerihal('');
    setIsiSurat('');
    alert('Surat resmi berhasil diterbitkan!');
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
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-500" />
              Surat Menyurat & Edaran Resmi Koperasi
            </h3>
            <p className="text-xs text-slate-400">
              Penerbitan surat edaran terintegrasi WhatsApp & Email anggota
            </p>
          </div>

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

        {/* List of letters */}
        <div className="space-y-3 mt-4">
          {displaySuratList.map((surat) => (
            <div
              key={surat.id}
              className="p-4 bg-slate-800/60 hover:bg-slate-800/90 rounded-2xl border border-slate-700/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-amber-400 text-xs font-bold">
                    {surat.nomorSurat}
                  </span>
                  <span className="text-[10px] text-slate-400">• {surat.tanggal}</span>
                  <span className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/20 font-bold">
                    {surat.targetMemberNama}
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-white">{surat.perihal}</h4>
                <p className="text-xs text-slate-300 line-clamp-2">{surat.isiSurat}</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handlePrintSurat(surat)}
                  className="py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  Cetak Kop
                </button>

                {!isMember && (
                  <>
                    <button
                      onClick={() => handleSendWa(surat, surat.targetMemberId ? state.members.find(m => m.id === surat.targetMemberId)?.whatsapp : '')}
                      className="py-1.5 px-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
                      title="Kirim via WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      WA
                    </button>
                    <button
                      onClick={() => handleSendEmail(surat, surat.targetMemberId ? state.members.find(m => m.id === surat.targetMemberId)?.email : '')}
                      className="py-1.5 px-2.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
                      title="Kirim via Email"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

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
                  placeholder="Contoh: Undangan Rapat Anggota Tahunan (RAT)"
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
