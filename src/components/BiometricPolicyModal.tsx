import React from 'react';
import {
  X,
  Fingerprint,
  ShieldCheck,
  Lock,
  Smartphone,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Cpu,
  HelpCircle,
} from 'lucide-react';

interface BiometricPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BiometricPolicyModal: React.FC<BiometricPolicyModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b1329] border border-amber-500/40 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 text-left">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/40 border-b border-slate-700/80 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Perlindungan Data Pribadi
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Zero-Server Storage
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-1">
                Aturan & Standar Keamanan Biometrik Sidik Jari
              </h2>
              <p className="text-[11px] text-slate-400">
                Koperasi Himpunan Wirausaha Sejahtera (HWS) • Standar Keamanan Perbankan Digital
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-300 leading-relaxed">
          {/* Intro Card */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">Komitmen Keamanan KHWS:</span> Fitur Biometric / Fingerscan (Pemindaian Sidik Jari) dirancang mengikuti standar keamanan perbankan digital dan perlindungan data pribadi (PDP). Sidik jari fisik Anda tidak pernah tersimpan di database koperasi.
            </div>
          </div>

          {/* 1. Fungsi & Ruang Lingkup */}
          <div className="p-4 rounded-2xl bg-[#131d36] border border-slate-700/70 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs">
              <span className="w-5 h-5 rounded-lg bg-amber-500/20 flex items-center justify-center text-[11px] font-black">
                1
              </span>
              <h3>Fungsi & Ruang Lingkup Biometrik</h3>
            </div>
            <ul className="space-y-2 pl-2 text-slate-300 text-[11px]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Khusus Login Cepat (Quick Access):</strong> Biometrik sidik jari digunakan untuk mempercepat proses masuk (login) anggota ke aplikasi KHWS tanpa perlu mengetik ulang Nomor Anggota / No. Rekening dan Password setiap kali aplikasi dibuka di perangkat smartphone pribadi.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Hanya Berlaku untuk Perangkat Terdaftar (Device Binding):</strong> Fitur biometrik terikat langsung pada fisik smartphone yang digunakan oleh anggota. Data autentikasi tidak dapat dipindahkan atau dipergunakan oleh perangkat lain.
                </div>
              </li>
            </ul>
          </div>

          {/* 2. Aturan Privasi & Keamanan Data (Zero-Server Storage) */}
          <div className="p-4 rounded-2xl bg-[#131d36] border border-slate-700/70 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs">
              <span className="w-5 h-5 rounded-lg bg-emerald-500/20 flex items-center justify-center text-[11px] font-black">
                2
              </span>
              <h3>Aturan Privasi & Keamanan Data (Zero-Server Storage)</h3>
            </div>
            <ul className="space-y-2 pl-2 text-slate-300 text-[11px]">
              <li className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Sidik Jari Tidak Disimpan di Server Koperasi:</strong> Data fisik sidik jari Anda <span className="text-rose-300 font-bold underline">tidak pernah dikirim atau disimpan</span> di database Cloud Firestore maupun server Koperasi HWS.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Otentikasi Berbasis Hardware Lokal:</strong> Pemindaian sidik jari diproses 100% di dalam modul keamanan perangkat (<em className="text-amber-300 not-italic">Secure Element / Trusted Execution Environment (TEE)</em>) smartphone Anda via sistem keamanan bawaan Android / iOS.
                </div>
              </li>
            </ul>
          </div>

          {/* 3. Pemisahan Wewenang: Biometrik vs PIN Transaksi 6 Digit */}
          <div className="p-4 rounded-2xl bg-[#131d36] border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs">
              <span className="w-5 h-5 rounded-lg bg-amber-500/20 flex items-center justify-center text-[11px] font-black">
                3
              </span>
              <h3>Pemisahan Wewenang: Biometrik vs PIN Transaksi 6 Digit</h3>
            </div>
            <p className="text-[11px] text-slate-300">
              Demi melindungi saldo tabungan anggota, aplikasi menerapkan sistem <strong className="text-white">Pengamanan Berlapis (Two-Factor Protection)</strong>:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>1. Fingerscan / Biometrik</span>
                </div>
                <div className="text-[10px] text-slate-300 leading-snug">
                  Hanya untuk <strong className="text-white">membuka aplikasi (Login)</strong> dan melihat ringkasan saldo / mutasi rekening.
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>2. PIN Transaksi 6 Digit</span>
                </div>
                <div className="text-[10px] text-slate-300 leading-snug">
                  <strong className="text-white">Wajib dimasukkan</strong> setiap kali melakukan:
                  <ul className="list-disc pl-3.5 mt-0.5 space-y-0.5 text-amber-200/90">
                    <li>Penarikan Dana Tabungan Umum (Tarik Saldo)</li>
                    <li>Transfer Saldo Antar Sesama Rekening Anggota</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[10px] text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Aturan:</strong> Biometrik tidak dapat menggantikan PIN Transaksi 6 digit untuk mencegah penarikan atau transfer yang tidak disengaja.
              </span>
            </div>
          </div>

          {/* 4. Aturan Aktivasi & Penonaktifan */}
          <div className="p-4 rounded-2xl bg-[#131d36] border border-slate-700/70 space-y-2">
            <div className="flex items-center gap-2 text-sky-400 font-extrabold text-xs">
              <span className="w-5 h-5 rounded-lg bg-sky-500/20 flex items-center justify-center text-[11px] font-black">
                4
              </span>
              <h3>Aturan Aktivasi & Penonaktifan</h3>
            </div>
            <ul className="space-y-2 pl-2 text-slate-300 text-[11px]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Bersifat Sukarela (Opt-in):</strong> Fitur ini tidak dipaksakan aktif otomatis. Anggota yang ingin menggunakannya dapat mengaktifkannya melalui menu <strong className="text-white">Pengaturan Akun & Keamanan</strong> di Dashboard Anggota.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Dapat Dimatikan Kapan Saja:</strong> Anggota dapat menonaktifkan fitur biometrik kapan pun melalui menu Pengaturan yang sama.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Smartphone className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Ganti Perangkat:</strong> Jika Anda berganti smartphone atau menginstal ulang aplikasi, fitur biometrik pada smartphone lama otomatis tidak berlaku dan Anda harus mengaktifkannya kembali di smartphone baru setelah login pertama kali menggunakan password.
                </div>
              </li>
            </ul>
          </div>

          {/* 5. Mekanisme Cadangan (Fallback Mechanism) */}
          <div className="p-4 rounded-2xl bg-[#131d36] border border-slate-700/70 space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-extrabold text-xs">
              <span className="w-5 h-5 rounded-lg bg-purple-500/20 flex items-center justify-center text-[11px] font-black">
                5
              </span>
              <h3>Mekanisme Cadangan (Fallback Mechanism)</h3>
            </div>
            <p className="text-[11px] text-slate-300">
              Jika sensor sidik jari gagal mendeteksi (misalnya jari basah, kotor, atau sensor perangkat mengalami gangguan), sistem secara otomatis menyediakan opsi masuk cadangan:
            </p>
            <ul className="space-y-1.5 pl-2 text-slate-300 text-[11px]">
              <li className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <div>
                  Masuk menggunakan <strong className="text-white">Nomor Anggota / No. Rekening Koperasi + Password Akun</strong>.
                </div>
              </li>
              <li className="flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <div>
                  Fitur <strong className="text-white">Lupa No. Anggota / Lupa Password</strong> dengan verifikasi NIK dan No. WhatsApp resmi yang terdaftar di koperasi.
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Button */}
        <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer text-center"
          >
            Saya Mengerti & Setuju
          </button>
        </div>
      </div>
    </div>
  );
};
