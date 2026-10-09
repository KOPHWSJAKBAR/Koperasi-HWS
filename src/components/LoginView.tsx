import React, { useState } from 'react';
import { LogoHws } from '../lib/logo';
import { AppState, MemberUser, AdminUser, WilayahKoperasi } from '../types';
import { generateNomorRekening, generateNomorAnggota, createAuditLog } from '../lib/storage';
import { Fingerprint, Lock, User, ArrowRight, ShieldCheck, UserPlus, HelpCircle, X, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

interface LoginViewProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  onLoginMember: (member: MemberUser) => void;
  onLoginAdmin: (admin: AdminUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  state,
  updateState,
  onLoginMember,
  onLoginAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'member' | 'admin'>('member');

  // Anggota login fields
  const [memberIdentifier, setMemberIdentifier] = useState('');
  const [memberPassword, setMemberPassword] = useState('');

  // Admin login fields
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState<'id' | 'password' | null>(null);

  // Register Form State
  const [regForm, setRegForm] = useState({
    nama: '',
    nik: '',
    whatsapp: '',
    email: '',
    wilayah: 'Cengkareng' as WilayahKoperasi,
    alamatLengkap: '',
    provinsi: 'DKI Jakarta',
    kota: 'Jakarta Barat',
    kecamatan: 'Cengkareng',
    kelurahan: '',
    rt: '001',
    rw: '001',
    kodePos: '',
    namaBank: 'Bank Central Asia (BCA)',
    nomorRekeningBank: '',
    atasNamaBank: '',
    password: '',
    confirmPassword: '',
    pinTransaksi: '',
    confirmPinTransaksi: '',
    securityQuestion: 'Nama hewan peliharaan pertama?',
    securityAnswer: '',
    ktpPhotoUrl: '',
  });

  // Forgot Password / ID State
  const [forgotInput, setForgotInput] = useState('');
  const [securityAnswerInput, setForgotAnswer] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);

  // Handle Login Anggota
  const handleMemberSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    const cleanId = memberIdentifier.trim();

    const member = state.members.find(
      (m) =>
        m.nomorAnggota.toLowerCase() === cleanId.toLowerCase() ||
        m.whatsapp.replace(/\D/g, '') === cleanId.replace(/\D/g, '') ||
        m.nomorRekening === cleanId
    );

    if (!member) {
      setErrorMessage('Nomor Anggota / No. HP / Rekening tidak ditemukan.');
      return;
    }

    if (member.password && member.password !== memberPassword) {
      setErrorMessage('Password yang Anda masukkan salah.');
      return;
    }

    onLoginMember(member);
  };

  // Handle Login Admin
  const handleAdminSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    const clean = adminUsername.trim().toLowerCase();

    const admin = state.admins.find(
      (a) => a.username.toLowerCase() === clean || a.email.toLowerCase() === clean
    );

    if (!admin) {
      setErrorMessage('Username atau Email Admin tidak ditemukan.');
      return;
    }

    if (admin.password && admin.password !== adminPassword) {
      setErrorMessage('Password pengurus salah.');
      return;
    }

    onLoginAdmin(admin);
  };

  // Biometric Login (WebAuthn / Fingerprint simulation)
  const handleBiometricAuth = async () => {
    try {
      if (activeTab === 'member') {
        const defaultMember = state.members[0];
        if (!defaultMember) {
          setErrorMessage('Belum ada anggota terdaftar untuk biometrik.');
          return;
        }
        setSuccessMessage('Verifikasi Biometrik Berhasil! Mengalihkan...');
        setTimeout(() => {
          onLoginMember(defaultMember);
        }, 600);
      } else {
        const abzqarAdmin = state.admins.find((a) => a.username.toLowerCase() === 'abzqar') || state.admins[0];
        if (!abzqarAdmin) {
          setErrorMessage('Pengurus tidak ditemukan.');
          return;
        }
        setSuccessMessage(`Biometrik diverifikasi untuk ${abzqarAdmin.nama}. Mengalihkan...`);
        setTimeout(() => {
          onLoginAdmin(abzqarAdmin);
        }, 600);
      }
    } catch {
      setErrorMessage('Gagal memverifikasi biometrik pada perangkat ini.');
    }
  };

  // Upload KTP image handler
  const handleKtpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRegForm((prev) => ({ ...prev, ktpPhotoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Handle Register Anggota Baru
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (regForm.password !== regForm.confirmPassword) {
      setErrorMessage('Password dan Konfirmasi Password tidak sama.');
      return;
    }

    if (!regForm.pinTransaksi || regForm.pinTransaksi.length !== 6 || !/^\d{6}$/.test(regForm.pinTransaksi)) {
      setErrorMessage('PIN Transaksi harus berupa 6 digit angka.');
      return;
    }

    if (regForm.pinTransaksi !== regForm.confirmPinTransaksi) {
      setErrorMessage('PIN Transaksi dan Konfirmasi PIN tidak cocok.');
      return;
    }

    // Validation: NIK & No HP cannot be used twice per prompt
    const existingNik = state.members.find((m) => m.nik === regForm.nik.trim());
    if (existingNik) {
      setErrorMessage('NIK ini sudah terdaftar sebagai anggota koperasi.');
      return;
    }

    const cleanHp = regForm.whatsapp.replace(/\D/g, '');
    const existingHp = state.members.find((m) => m.whatsapp.replace(/\D/g, '') === cleanHp);
    if (existingHp) {
      setErrorMessage('Nomor HP / WhatsApp ini sudah digunakan oleh anggota lain.');
      return;
    }

    // Generate Nomor Rekening & Nomor Anggota
    const { nomorRekening, nextRunningNumber } = generateNomorRekening(
      regForm.wilayah,
      regForm.whatsapp,
      state.lastRunningNumber
    );
    const nomorAnggota = generateNomorAnggota(regForm.wilayah, state.members.length);

    const newMember: MemberUser = {
      id: `mem-${Date.now()}`,
      nomorAnggota,
      nomorRekening,
      nama: regForm.nama.trim(),
      nik: regForm.nik.trim(),
      whatsapp: regForm.whatsapp.trim(),
      email: regForm.email.trim(),
      wilayah: regForm.wilayah,
      alamatLengkap: regForm.alamatLengkap.trim(),
      provinsi: regForm.provinsi,
      kota: regForm.kota,
      kecamatan: regForm.kecamatan,
      kelurahan: regForm.kelurahan,
      rt: regForm.rt,
      rw: regForm.rw,
      kodePos: regForm.kodePos,
      ktpPhotoUrl: regForm.ktpPhotoUrl,
      bankPribadi: {
        namaBank: regForm.namaBank,
        nomorRekening: regForm.nomorRekeningBank,
        atasNama: regForm.atasNamaBank || regForm.nama,
      },
      password: regForm.password,
      pinTransaksi: regForm.pinTransaksi,
      securityQuestion: regForm.securityQuestion,
      securityAnswer: regForm.securityAnswer.toLowerCase().trim(),
      saldoPokok: 0,
      isPokokLocked: true,
      saldoZakatFitrah: 0,
      saldoQurban: 0,
      saldoUmum: 0,
      status: 'aktif',
      terdaftarSejak: new Date().toISOString().split('T')[0],
    };

    await updateState((prev) => ({
      ...prev,
      members: [...prev.members, newMember],
      lastRunningNumber: nextRunningNumber,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          adminId: 'system',
          adminNama: 'Sistem Registrasi',
          adminRole: 'super_admin',
          action: 'Pendaftaran Anggota Baru',
          detail: `Anggota ${newMember.nama} (${newMember.nomorAnggota}) terdaftar di wilayah ${newMember.wilayah}. Rek: ${newMember.nomorRekening}`,
          targetId: newMember.id,
        },
        ...prev.auditLogs,
      ],
    }));

    setShowRegisterModal(false);
    setSuccessMessage(`Pendaftaran berhasil! No. Rekening: ${nomorRekening}, No. Anggota: ${nomorAnggota}`);
    setMemberIdentifier(nomorAnggota);
    setMemberPassword(regForm.password);
  };

  // Find User for Lupa Password / ID
  const handleForgotSearch = () => {
    setErrorMessage('');
    const q = forgotInput.trim().toLowerCase();

    if (activeTab === 'member') {
      const u = state.members.find(
        (m) =>
          m.nik.toLowerCase() === q ||
          m.whatsapp.replace(/\D/g, '') === q.replace(/\D/g, '') ||
          m.email.toLowerCase() === q
      );
      if (!u) {
        setErrorMessage('Data anggota tidak ditemukan dengan NIK / No. HP / Email tersebut.');
        return;
      }
      setFoundUser(u);
    } else {
      const u = state.admins.find(
        (a) =>
          a.username.toLowerCase() === q ||
          a.email.toLowerCase() === q ||
          a.nik.toLowerCase() === q
      );
      if (!u) {
        setErrorMessage('Data pengurus tidak ditemukan.');
        return;
      }
      setFoundUser(u);
    }
  };

  // Reset Password via Security Question
  const handleResetPasswordSubmit = async () => {
    if (!foundUser) return;
    if (securityAnswerInput.trim().toLowerCase() !== (foundUser.securityAnswer || '').toLowerCase()) {
      setErrorMessage('Jawaban keamanan tidak cocok.');
      return;
    }
    if (!newPasswordInput.trim()) {
      setErrorMessage('Masukkan password baru.');
      return;
    }

    if (activeTab === 'member') {
      await updateState((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.id === foundUser.id ? { ...m, password: newPasswordInput.trim() } : m
        ),
      }));
      setSuccessMessage('Password anggota berhasil diperbarui!');
    } else {
      await updateState((prev) => ({
        ...prev,
        admins: prev.admins.map((a) =>
          a.id === foundUser.id ? { ...a, password: newPasswordInput.trim() } : a
        ),
      }));
      setSuccessMessage('Password pengurus berhasil diperbarui!');
    }

    setShowForgotModal(null);
    setFoundUser(null);
    setForgotAnswer('');
    setNewPasswordInput('');
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-amber-500 selection:text-black">
      {/* Container matching Tampilan Login.png */}
      <div className="w-full max-w-[430px] flex flex-col items-center">
        {/* Logo Badge */}
        <div className="w-24 h-24 bg-white rounded-3xl p-2.5 shadow-2xl flex items-center justify-center mb-4 ring-4 ring-amber-500/20">
          <LogoHws className="w-full h-full" />
        </div>

        {/* Header Typography */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-center">
          KOPERASI HWS
        </h1>
        <p className="text-xs text-slate-400 font-medium text-center mt-1">
          Koperasi Himpunan Wirausaha Sejahtera
        </p>
        <p className="text-[11px] text-amber-400 font-bold tracking-wide text-center mt-1">
          Cengkareng • Kalideres • Kembangan • Kebon Jeruk
        </p>

        {/* Tab Switcher */}
        <div className="w-full mt-6 bg-[#162035] p-1.5 rounded-2xl flex gap-1 border border-slate-700/60 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActiveTab('member');
              setErrorMessage('');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'member'
                ? 'bg-[#f59e0b] text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            Aplikasi Anggota
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setErrorMessage('');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'admin'
                ? 'bg-[#f59e0b] text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Portal Pengurus / Admin
          </button>
        </div>

        {/* Notification Banners */}
        {errorMessage && (
          <div className="w-full mt-3 p-3 bg-red-950/80 border border-red-500/40 text-red-200 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="w-full mt-3 p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Main Card Form (White container matching mobile design) */}
        <div className="w-full mt-4 bg-white rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-900 border border-slate-200">
          {activeTab === 'member' ? (
            /* ================= ANGGOTA LOGIN FORM ================= */
            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Masuk Aplikasi Anggota (Android & Web)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gunakan Nomor Anggota / No. HP dan Password terdaftar Anda.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Anggota / No. HP / No. Rekening
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={memberIdentifier}
                    onChange={(e) => setMemberIdentifier(e.target.value)}
                    placeholder="Contoh: HWS-CKR-2026-001"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={memberPassword}
                    onChange={(e) => setMemberPassword(e.target.value)}
                    placeholder="Masukkan password Anda"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] pt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotModal('id')}
                  className="text-amber-600 hover:text-amber-700 font-semibold"
                >
                  Lupa No. Anggota?
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotModal('password')}
                  className="text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Lupa Password?
                </button>
              </div>

              {/* Biometric Login Button */}
              <button
                type="button"
                onClick={handleBiometricAuth}
                className="w-full py-2.5 px-3 border border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/50 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-all"
              >
                <Fingerprint className="w-4 h-4 text-amber-500" />
                Masuk dengan Biometrik (Sidik Jari / Face ID)
              </button>

              <button
                type="submit"
                className="w-full py-3 bg-[#f59e0b] hover:bg-[#d97706] active:scale-[0.99] text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all"
              >
                Masuk Sekarang
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-500 mb-2">
                  Belum terdaftar sebagai anggota koperasi?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setShowRegisterModal(true);
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <UserPlus className="w-4 h-4 text-amber-600" />
                  Daftar Anggota Baru (Upload KTP)
                </button>
              </div>
            </form>
          ) : (
            /* ================= ADMIN LOGIN FORM ================= */
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Masuk Portal Pengurus & Admin
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Khusus pengurus Koperasi Himpunan Wirausaha Sejahtera.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Username / Email Admin
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="Contoh: Abzqar"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Masukkan password admin"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] pt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotModal('id')}
                  className="text-amber-600 hover:text-amber-700 font-semibold"
                >
                  Lupa Username?
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotModal('password')}
                  className="text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Lupa Password?
                </button>
              </div>

              {/* Biometric Login Button */}
              <button
                type="button"
                onClick={handleBiometricAuth}
                className="w-full py-2.5 px-3 border border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/50 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-all"
              >
                <Fingerprint className="w-4 h-4 text-amber-500" />
                Masuk dengan Biometrik Pengurus
              </button>

              <button
                type="submit"
                className="w-full py-3 bg-[#f59e0b] hover:bg-[#d97706] active:scale-[0.99] text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all"
              >
                Masuk Sekarang
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800">Akun Pengurus Resmi:</div>
                  <div className="flex justify-between items-center">
                    <span>👑 Super Admin: <b>Abzqar</b> (pass: ciganea)</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminUsername('Abzqar');
                        setAdminPassword('ciganea');
                      }}
                      className="text-amber-600 font-bold hover:underline"
                    >
                      Pilih
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Quick Member Demo Chip */}
        {activeTab === 'member' && state.members.length > 0 && (
          <div className="mt-3 text-center">
            <span className="text-[11px] text-slate-400">Akun Anggota Tersedia: </span>
            <button
              type="button"
              onClick={() => {
                const m = state.members[0];
                setMemberIdentifier(m.nomorAnggota);
                setMemberPassword(m.password || 'user123');
              }}
              className="text-amber-400 hover:text-amber-300 text-[11px] font-bold underline"
            >
              {state.members[0].nama} ({state.members[0].nomorAnggota})
            </button>
          </div>
        )}
      </div>

      {/* ================= REGISTER MODAL (UPLOAD KTP & FULL ADDRESS) ================= */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-[#0f172a] text-slate-100 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="p-4 sm:p-5 border-b border-slate-700/80 flex items-center justify-between bg-[#162035]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-slate-950 font-black">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Pendaftaran Anggota Koperasi Baru
                  </h3>
                  <p className="text-xs text-slate-400">
                    Koperasi Himpunan Wirausaha Sejahtera
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nama Lengkap (Sesuai KTP) *
                  </label>
                  <input
                    type="text"
                    required
                    value={regForm.nama}
                    onChange={(e) => setRegForm({ ...regForm, nama: e.target.value })}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nomor Induk Kependudukan (NIK) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    value={regForm.nik}
                    onChange={(e) => setRegForm({ ...regForm, nik: e.target.value.replace(/\D/g, '') })}
                    placeholder="16 digit NIK KTP"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nomor WhatsApp / HP Aktif *
                  </label>
                  <input
                    type="tel"
                    required
                    value={regForm.whatsapp}
                    onChange={(e) => setRegForm({ ...regForm, whatsapp: e.target.value })}
                    placeholder="Contoh: 085817554296"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Alamat Email Aktif *
                  </label>
                  <input
                    type="email"
                    required
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    placeholder="email@anda.com"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Dropdown Wilayah: requirement 49 "Pada pendaftaran anggota pemilihan wilayah jangan tampilkan angka kode wilayah 76,77,78,79" */}
              <div className="bg-[#162035] p-3 rounded-xl border border-slate-700">
                <label className="block text-xs font-bold text-amber-400 mb-1">
                  Pilih Wilayah Keanggotaan Koperasi *
                </label>
                <select
                  value={regForm.wilayah}
                  onChange={(e) =>
                    setRegForm({
                      ...regForm,
                      wilayah: e.target.value as WilayahKoperasi,
                      kecamatan: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="Cengkareng">Cengkareng</option>
                  <option value="Kalideres">Kalideres</option>
                  <option value="Kembangan">Kembangan</option>
                  <option value="Kebon Jeruk">Kebon Jeruk</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  * Nomor rekening 10 digit resmi koperasi akan dibuatkan secara otomatis berdasarkan wilayah ini.
                </p>
              </div>

              {/* Data Alamat Lengkap per req 5 */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-200">
                  Alamat Domisili Lengkap (Sesuai KTP)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400">Provinsi</label>
                    <input
                      type="text"
                      value={regForm.provinsi}
                      onChange={(e) => setRegForm({ ...regForm, provinsi: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Kota</label>
                    <input
                      type="text"
                      value={regForm.kota}
                      onChange={(e) => setRegForm({ ...regForm, kota: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Kecamatan</label>
                    <input
                      type="text"
                      value={regForm.kecamatan}
                      onChange={(e) => setRegForm({ ...regForm, kecamatan: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Kelurahan</label>
                    <input
                      type="text"
                      required
                      placeholder="Kelurahan"
                      value={regForm.kelurahan}
                      onChange={(e) => setRegForm({ ...regForm, kelurahan: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">RT</label>
                    <input
                      type="text"
                      placeholder="001"
                      value={regForm.rt}
                      onChange={(e) => setRegForm({ ...regForm, rt: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">RW</label>
                    <input
                      type="text"
                      placeholder="001"
                      value={regForm.rw}
                      onChange={(e) => setRegForm({ ...regForm, rw: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-400">Kode Pos</label>
                    <input
                      type="text"
                      placeholder="11740"
                      value={regForm.kodePos}
                      onChange={(e) => setRegForm({ ...regForm, kodePos: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Jalan / No. Rumah</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Jl. Albarkah Raya No. 8"
                    value={regForm.alamatLengkap}
                    onChange={(e) => setRegForm({ ...regForm, alamatLengkap: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Upload KTP */}
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-dashed border-slate-600">
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Upload Foto KTP Asli *
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleKtpUpload}
                    className="text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                  />
                  {regForm.ktpPhotoUrl && (
                    <div className="relative w-28 h-16 rounded-lg overflow-hidden border border-slate-600">
                      <img
                        src={regForm.ktpPhotoUrl}
                        alt="Preview KTP"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-center text-emerald-400 py-0.5">
                        ✓ Terunggah
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rekening Bank Pribadi Anggota */}
              <div className="bg-[#162035] p-3 rounded-xl border border-slate-700 space-y-2">
                <div className="text-xs font-bold text-white">
                  Rekening Bank Pribadi (Untuk Penarikan Tabungan Umum)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400">Nama Bank</label>
                    <select
                      value={regForm.namaBank}
                      onChange={(e) => setRegForm({ ...regForm, namaBank: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    >
                      <option>Bank Central Asia (BCA)</option>
                      <option>Bank Mandiri</option>
                      <option>Bank Rakyat Indonesia (BRI)</option>
                      <option>Bank Negara Indonesia (BNI)</option>
                      <option>Bank Syariah Indonesia (BSI)</option>
                      <option>Bank Danamon</option>
                      <option>Bank Permata</option>
                      <option>Bank CIMB Niaga</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">No. Rekening Pribadi</label>
                    <input
                      type="text"
                      required
                      placeholder="Nomor Rekening Bank"
                      value={regForm.nomorRekeningBank}
                      onChange={(e) => setRegForm({ ...regForm, nomorRekeningBank: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Atas Nama Rekening</label>
                    <input
                      type="text"
                      required
                      placeholder="Nama di Buku Tabungan"
                      value={regForm.atasNamaBank}
                      onChange={(e) => setRegForm({ ...regForm, atasNamaBank: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Password & Keamanan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Buat Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Konfirmasi Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regForm.confirmPassword}
                    onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                    placeholder="Ulangi password"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Pertanyaan Keamanan (Lupa Sandi)
                  </label>
                  <select
                    value={regForm.securityQuestion}
                    onChange={(e) => setRegForm({ ...regForm, securityQuestion: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option>Nama hewan peliharaan pertama?</option>
                    <option>Nama ibu kandung?</option>
                    <option>Nama sekolah dasar Anda?</option>
                    <option>Kota kelahiran Anda?</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Jawaban Keamanan *
                  </label>
                  <input
                    type="text"
                    required
                    value={regForm.securityAnswer}
                    onChange={(e) => setRegForm({ ...regForm, securityAnswer: e.target.value })}
                    placeholder="Jawaban Anda"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Selesaikan Pendaftaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL LUPA PASSWORD / ID ================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-[#0f172a] text-slate-100 border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="text-sm font-extrabold text-white">
                {showForgotModal === 'id' ? 'Cari Nomor Anggota / Username' : 'Pemulihan Password'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(null);
                  setFoundUser(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!foundUser ? (
              <div className="space-y-3 pt-3">
                <p className="text-xs text-slate-400">
                  Masukkan NIK atau No. WhatsApp / Email yang terdaftar:
                </p>
                <input
                  type="text"
                  value={forgotInput}
                  onChange={(e) => setForgotInput(e.target.value)}
                  placeholder="NIK atau No. WhatsApp atau Email"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleForgotSearch}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl"
                >
                  Cari Akun
                </button>
              </div>
            ) : showForgotModal === 'id' ? (
              <div className="pt-4 space-y-3">
                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 text-xs space-y-1">
                  <div className="text-emerald-400 font-bold">✓ Akun Ditemukan:</div>
                  <div>Nama: <b>{foundUser.nama}</b></div>
                  {foundUser.nomorAnggota && <div>Nomor Anggota: <b className="text-amber-400 font-mono">{foundUser.nomorAnggota}</b></div>}
                  {foundUser.nomorRekening && <div>No. Rekening Koperasi: <b className="text-amber-400 font-mono">{foundUser.nomorRekening}</b></div>}
                  {foundUser.username && <div>Username: <b className="text-amber-400 font-mono">{foundUser.username}</b></div>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (foundUser.nomorAnggota) setMemberIdentifier(foundUser.nomorAnggota);
                    if (foundUser.username) setAdminUsername(foundUser.username);
                    setShowForgotModal(null);
                    setFoundUser(null);
                  }}
                  className="w-full py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl"
                >
                  Gunakan untuk Masuk
                </button>
              </div>
            ) : (
              <div className="pt-3 space-y-3">
                <div className="text-xs text-slate-300">
                  Akun: <b>{foundUser.nama}</b>
                </div>
                <div>
                  <label className="block text-[11px] text-amber-400 font-bold mb-1">
                    {foundUser.securityQuestion || 'Pertanyaan Keamanan:'}
                  </label>
                  <input
                    type="text"
                    value={securityAnswerInput}
                    onChange={(e) => setForgotAnswer(e.target.value)}
                    placeholder="Masukkan jawaban Anda"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 font-bold mb-1">
                    Password Baru
                  </label>
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Ketik password baru"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleResetPasswordSubmit}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl"
                >
                  Simpan Password Baru
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
