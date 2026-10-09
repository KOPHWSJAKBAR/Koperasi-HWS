import React from 'react';
import { MemberUser } from '../types';
import { LogoHws } from '../lib/logo';
import { X, ShieldCheck, QrCode } from 'lucide-react';

interface KtaDigitalModalProps {
  member: MemberUser;
  onClose: () => void;
}

export const KtaDigitalModal: React.FC<KtaDigitalModalProps> = ({ member, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#162035]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-extrabold text-white">Kartu Tanda Anggota Digital (KTA)</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The Digital Card Design */}
        <div className="p-6 flex flex-col items-center">
          <div className="w-full aspect-[85.6/53.98] rounded-2xl bg-gradient-to-br from-[#0d1b2a] via-[#1b263b] to-[#0a1128] border-2 border-amber-500/40 p-4 relative shadow-2xl overflow-hidden flex flex-col justify-between text-white">
            {/* Background Watermark */}
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
              <LogoHws className="w-48 h-48" />
            </div>

            {/* Header KTA */}
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white p-1 shadow flex items-center justify-center">
                  <LogoHws className="w-full h-full" />
                </div>
                <div>
                  <div className="text-xs font-black tracking-wider text-amber-400 uppercase">
                    KOPERASI HWS
                  </div>
                  <div className="text-[8px] text-slate-300 font-medium">
                    Himpunan Wirausaha Sejahtera
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  ANGGOTA RESMI
                </span>
                <div className="text-[8px] text-slate-400 mt-0.5">Wilayah {member.wilayah}</div>
              </div>
            </div>

            {/* Middle Content */}
            <div className="my-auto py-2 flex items-center gap-4 relative z-10">
              {/* Member Avatar / Initial */}
              <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 shadow-md shrink-0">
                <div className="w-full h-full rounded-[10px] bg-slate-900 flex items-center justify-center font-black text-2xl text-amber-400 overflow-hidden">
                  {member.ktpPhotoUrl ? (
                    <img src={member.ktpPhotoUrl} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    member.nama.charAt(0).toUpperCase()
                  )}
                </div>
              </div>

              {/* Member Meta */}
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="text-sm font-extrabold text-white truncate uppercase tracking-wide">
                  {member.nama}
                </div>
                <div className="text-[10px] text-slate-300 font-mono">
                  ID: <span className="text-amber-400 font-bold">{member.nomorAnggota}</span>
                </div>
                <div className="text-[10px] text-slate-300 font-mono">
                  Rek: <span className="text-amber-300 font-bold">{member.nomorRekening}</span>
                </div>
                <div className="text-[9px] text-slate-400">
                  Terdaftar: {member.terdaftarSejak || '2026-02-01'}
                </div>
              </div>
            </div>

            {/* Bottom Bar: QR Code Simulation & Note */}
            <div className="border-t border-slate-700/60 pt-2 flex items-center justify-between text-[8px] text-slate-400 relative z-10">
              <div className="flex items-center gap-1.5">
                <QrCode className="w-6 h-6 text-amber-400" />
                <div>
                  <div className="font-semibold text-slate-200">KTA DIGITAL ELEKTRONIK</div>
                  <div>Berlaku di seluruh jaringan Koperasi HWS</div>
                </div>
              </div>
              <div className="text-right text-[7.5px] text-slate-400 italic">
                *Sah tanpa tanda tangan basah
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-4 text-center">
            Kartu Tanda Anggota (KTA) digital ini sah digunakan untuk seluruh transaksi simpanan, pinjaman, dan layanan syariah di Koperasi HWS.
          </p>

          <button
            onClick={() => window.print()}
            className="mt-4 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20"
          >
            🖨️ Cetak / Simpan KTA
          </button>
        </div>
      </div>
    </div>
  );
};
