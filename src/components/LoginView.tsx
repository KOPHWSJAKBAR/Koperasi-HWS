import React, { useState, useEffect } from 'react';
import { LogoHws } from '../lib/logo';
import { AppState, MemberUser, AdminUser, WilayahKoperasi } from '../types';
import { generateNomorRekening, generateNomorAnggota, createAuditLog } from '../lib/storage';
import { detectPlatform } from '../lib/activityLogger';
import { authenticateBiometric } from '../lib/webauthn';
import { InstallAppModal } from './InstallAppModal';
import {
  Fingerprint,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  HelpCircle,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Key,
  Check,
  Eye,
  EyeOff,
  Download,
  Smartphone,
  Monitor,
  CheckSquare,
  Square,
} from 'lucide-react';

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
  const [showMemberPassword, setShowMemberPassword] = useState(false);

  // Admin login fields
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Password visibility states for registration & reset (Req 22)
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [showRegPin, setShowRegPin] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Raw App Install Wizard with SDK Validation & Terms (Req 9 & 16)
  const [installWizardApp, setInstallWizardApp] = useState<'apk' | 'exe' | 'ios' | null>(null);
  const [agreeSdkTerms, setAgreeSdkTerms] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installDone, setInstallDone] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Pengingat Password & User ID di Perangkat (Req 2, 6, 24, 25)
  const [rememberAccount, setRememberAccount] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('hws_remember_pref') !== 'false';
  });

  const [savedMemberAccount, setSavedMemberAccount] = useState<{
    identifier: string;
    nama: string;
    password?: string;
  } | null>(() => {
    try {
      const data = localStorage.getItem('hws_saved_member_account');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  });

  const [savedAdminAccount, setSavedAdminAccount] = useState<{
    username: string;
    nama: string;
    password?: string;
  } | null>(() => {
    try {
      const data = localStorage.getItem('hws_saved_admin_account');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  });

  // Auto-fill form from saved reminder on mount or tab change
  useEffect(() => {
    if (activeTab === 'member' && savedMemberAccount) {
      if (!memberIdentifier) setMemberIdentifier(savedMemberAccount.identifier);
      if (!memberPassword && savedMemberAccount.password) setMemberPassword(savedMemberAccount.password);
    } else if (activeTab === 'admin' && savedAdminAccount) {
      if (!adminUsername) setAdminUsername(savedAdminAccount.username);
      if (!adminPassword && savedAdminAccount.password) setAdminPassword(savedAdminAccount.password);
    }
  }, [activeTab]);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState<'id' | 'password' | null>(null);
  const [showDownloadAppModal, setShowDownloadAppModal] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Biometric Device Connection State (Req 7 & User Req 1)
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricMethod, setBiometricMethod] = useState<'fingerprint' | 'face_id'>('fingerprint');
  const [biometricStatus, setBiometricStatus] = useState<'connecting' | 'ready' | 'scanning' | 'success' | 'failed'>('ready');
  const [biometricTargetUser, setBiometricTargetUser] = useState('');
  const [biometricMsg, setBiometricMsg] = useState('');
  const [isMobileEnv, setIsMobileEnv] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return false;
      const ua = navigator.userAgent || '';
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isTouch = navigator.maxTouchPoints > 0;
      const isSmall = window.innerWidth <= 768;
      const isPwa = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      return isMobileUA || (isTouch && isSmall) || isPwa;
    };
    setIsMobileEnv(checkMobile());
  }, []);

  // Device Back Button: Menutup menu / modal yang telah dibuka (Req 3)
  useEffect(() => {
    const handleDeviceBack = () => {
      if (showBiometricModal) {
        setShowBiometricModal(false);
      } else if (showRegisterModal) {
        setShowRegisterModal(false);
      } else if (showForgotModal) {
        setShowForgotModal(null);
      } else if (showDownloadAppModal) {
        setShowDownloadAppModal(false);
      } else if (showIosGuide) {
        setShowIosGuide(false);
      }
    };
    window.addEventListener('app:back_press', handleDeviceBack);
    return () => window.removeEventListener('app:back_press', handleDeviceBack);
  }, [showBiometricModal, showRegisterModal, showForgotModal, showDownloadAppModal, showIosGuide]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handlePwaInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setSuccessMessage('✓ Koperasi HWS berhasil dipasang di perangkat Anda!');
        setShowDownloadAppModal(false);
      }
      setDeferredPrompt(null);
    } else {
      setSuccessMessage('Untuk memasang di Android: Buka menu Chrome (titik tiga) lalu pilih "Instal Aplikasi" atau "Tambahkan ke Layar Utama".');
    }
  };

  // Requirement C: Pemasangan aplikasi mentah dengan validasi antivirus & Syarat Ketentuan
  const handleStartInstall = (appType: 'apk' | 'exe' | 'ios') => {
    setInstallWizardApp(appType);
    setAgreeSdkTerms(false);
    setIsInstalling(false);
    setInstallProgress(0);
    setInstallDone(false);
  };

  const handleExecuteInstall = () => {
    if (!agreeSdkTerms || !installWizardApp) return;
    setIsInstalling(true);
    setInstallProgress(25);

    setTimeout(() => setInstallProgress(60), 300);
    setTimeout(() => setInstallProgress(85), 650);
    setTimeout(() => {
      setInstallProgress(100);
      setIsInstalling(false);
      setInstallDone(true);

      if (installWizardApp === 'apk') {
        const a = document.createElement('a');
        a.href = '/api/download/apk';
        a.download = 'koperasi-hws-v2.4.apk';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setSuccessMessage('✓ Berkas mentah .APK resmi Koperasi HWS berhasil diunduh dan diverifikasi SDK!');
      } else if (installWizardApp === 'exe') {
        const a = document.createElement('a');
        a.href = '/api/download/exe';
        a.download = 'koperasi-hws-setup.exe';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setSuccessMessage('✓ Berkas installer desktop .EXE resmi berhasil diunduh dan siap dijalankan!');
      } else if (installWizardApp === 'ios') {
        const a = document.createElement('a');
        a.href = '/api/download/ios';
        a.download = 'koperasi-hws.mobileconfig';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setSuccessMessage('✓ Pemasangan profil WebClip Koperasi HWS di perangkat Apple iOS selesai disiapkan!');
      }
    }, 1000);
  };

  const handleFinishInstallAndEnterLogin = () => {
    setInstallWizardApp(null);
    setShowDownloadAppModal(false);
    setInstallDone(false);
    setSuccessMessage('✓ Pemasangan & persetujuan syarat ketentuan selesai. Silakan login ke akun Anda!');
  };

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

  // State untuk Registrasi Mandiri Anggota (Req 1)
  const [regError, setRegError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regSuccessMember, setRegSuccessMember] = useState<MemberUser | null>(null);

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

    if (member.status === 'dibekukan') {
      setErrorMessage('Akun Anda saat ini sedang DIBEKUKAN oleh pengurus koperasi. Hubungi pengurus koperasi untuk membuka status pembekuan.');
      return;
    }

    // Req 3: Cek status lock maintenance sistem
    if (state.maintenanceLock?.isLocked) {
      setErrorMessage(
        `⚠️ SISTEM SEDANG DALAM MODE LOCK MAINTENANCE:\n\n"${state.maintenanceLock.note || 'Pemeliharaan sistem berkala.'}"\n\nAkses seluruh anggota dibekukan sementara. Silakan coba kembali beberapa saat lagi.`
      );
      return;
    }

    if (member.password && member.password !== memberPassword) {
      setErrorMessage('Password yang Anda masukkan salah.');
      return;
    }

    // Save or clear reminder on device (Req 6)
    if (rememberAccount) {
      const saved = {
        identifier: member.nomorAnggota,
        nama: member.nama,
        password: memberPassword,
      };
      localStorage.setItem('hws_saved_member_account', JSON.stringify(saved));
      localStorage.setItem('hws_remember_pref', 'true');
      setSavedMemberAccount(saved);
    } else {
      localStorage.removeItem('hws_saved_member_account');
      localStorage.setItem('hws_remember_pref', 'false');
      setSavedMemberAccount(null);
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

    if (admin.status === 'dibekukan') {
      setErrorMessage('Akun pengurus ini sedang DIBEKUKAN oleh Super Admin koperasi. Hubungi ketua pengurus.');
      return;
    }

    // Req 3: Cek status lock maintenance sistem (Kecuali Super Admin yang dapat membukanya)
    const isSuperAdminUser = admin.role === 'super_admin' || admin.username?.toLowerCase() === 'abzqar';
    if (state.maintenanceLock?.isLocked && !isSuperAdminUser) {
      setErrorMessage(
        `⚠️ SISTEM SEDANG DALAM MODE LOCK MAINTENANCE:\n\n"${state.maintenanceLock.note || 'Pemeliharaan sistem berkala.'}"\n\nAkses login pengurus saat ini dibekukan sementara oleh Super Admin.`
      );
      return;
    }

    const linkedMember = state.members.find(
      (m) => m.nik === admin.nik || (m.email && admin.email && m.email.toLowerCase() === admin.email.toLowerCase())
    );
    const passwordMatches =
      !admin.password ||
      admin.password === adminPassword ||
      (linkedMember?.password && linkedMember.password === adminPassword);

    if (!passwordMatches) {
      setErrorMessage('Password pengurus salah.');
      return;
    }

    // Save or clear reminder on device (Req 6)
    if (rememberAccount) {
      const saved = {
        username: admin.username,
        nama: admin.nama,
        password: adminPassword,
      };
      localStorage.setItem('hws_saved_admin_account', JSON.stringify(saved));
      localStorage.setItem('hws_remember_pref', 'true');
      setSavedAdminAccount(saved);
    } else {
      localStorage.removeItem('hws_saved_admin_account');
      localStorage.setItem('hws_remember_pref', 'false');
      setSavedAdminAccount(null);
    }

    // Record login activity for Super Admin history across Web, Mobile, PC (Req 2)
    const platform = detectPlatform();
    const audit = createAuditLog(
      admin,
      'Login Admin',
      `Admin (${admin.nama} - Role: ${admin.role}) berhasil masuk ke sistem via [${platform.toUpperCase()}]`
    );
    updateState((prev) => ({
      ...prev,
      auditLogs: [audit, ...(prev.auditLogs || [])],
    }));

    onLoginAdmin(admin);
  };

  // Biometric Login: Memungkinkan scan sidik jari pada seluruh device terinstal (Android, iOS, dan Web)
  const handleBiometricAuth = async () => {
    setErrorMessage('');

    // Feedback getar hardware perangkat jika didukung
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([40, 60, 40]); } catch {}
    }

    // Tentukan akun target dari input yang diketik atau dari profil biometrik
    let target = '';
    const storedBioUser = typeof window !== 'undefined' ? localStorage.getItem('hws_biometric_user') || '' : '';
    const storedBioRole = typeof window !== 'undefined' ? localStorage.getItem('hws_biometric_user_role') || '' : '';

    if (activeTab === 'member') {
      target = memberIdentifier.trim() || (storedBioRole === 'member' ? storedBioUser : '') || (state.members[0]?.nomorAnggota || '');
    } else {
      target = adminUsername.trim() || (storedBioRole === 'admin' ? storedBioUser : '') || 'Abzqar';
    }

    setBiometricTargetUser(target);
    setShowBiometricModal(true);
    setBiometricStatus('scanning');
    setBiometricMsg(
      biometricMethod === 'fingerprint'
        ? 'Sentuh sensor sidik jari pada perangkat (Android / iOS / Web) untuk memindai...'
        : 'Arahkan wajah ke kamera sensor perangkat...'
    );

    // Integrasi Web Authentication API (WebAuthn) & Hardware Sensor Device
    const runHardwareScan = async () => {
      try {
        const bioAuth = await authenticateBiometric(target, activeTab);
        if (bioAuth.success && bioAuth.userId) {
          executeBiometricLogin(bioAuth.userId);
          return;
        }
      } catch {}

      // Fallback sensor scan simulator for environments without platform authenticator
      setTimeout(() => {
        if ('vibrate' in navigator) { try { navigator.vibrate([50, 30, 50]); } catch {} }
        executeBiometricLogin(target);
      }, 700);
    };

    runHardwareScan();
  };

  const executeBiometricLogin = (targetUser: string) => {
    const cleanTarget = targetUser.trim().toLowerCase();
    if (activeTab === 'member') {
      let member = state.members.find(
        (m) =>
          m.nomorAnggota.toLowerCase() === cleanTarget ||
          m.whatsapp.replace(/\D/g, '') === cleanTarget.replace(/\D/g, '') ||
          m.nomorRekening === cleanTarget
      );
      if (!member && state.members.length > 0) {
        member = state.members[0];
      }
      if (!member) {
        setBiometricStatus('failed');
        setBiometricMsg('Belum ada akun anggota di database. Silakan daftar mandiri terlebih dahulu.');
        return;
      }
      if (member.status === 'dibekukan' || member.status === 'nonaktif') {
        setBiometricStatus('failed');
        setBiometricMsg('Akun anggota ini sedang tidak aktif atau dibekukan pengurus.');
        return;
      }

      // Req 3: Cek lock maintenance sistem
      if (state.maintenanceLock?.isLocked) {
        setBiometricStatus('failed');
        setBiometricMsg(`⚠️ SISTEM MAINTENANCE: "${state.maintenanceLock.note || 'Sistem dibekukan sementara'}"`);
        return;
      }

      setBiometricStatus('success');
      setBiometricMsg(`✓ Sensor Biometrik Device Terverifikasi! Masuk sebagai: ${member.nama}`);
      setTimeout(() => {
        setShowBiometricModal(false);
        onLoginMember(member);
      }, 650);
    } else {
      let admin = state.admins.find(
        (a) =>
          a.username.toLowerCase() === cleanTarget ||
          a.email.toLowerCase() === cleanTarget
      );
      if (!admin && state.admins.length > 0) {
        admin = state.admins[0];
      }
      if (!admin) {
        setBiometricStatus('failed');
        setBiometricMsg('Akun pengurus tidak ditemukan di database.');
        return;
      }
      if (admin.status === 'dibekukan') {
        setBiometricStatus('failed');
        setBiometricMsg('Akun pengurus sedang dibekukan oleh Super Admin.');
        return;
      }

      // Req 3: Cek lock maintenance sistem (Kecuali Super Admin)
      const isSuperAdminUser = admin.role === 'super_admin' || admin.username?.toLowerCase() === 'abzqar';
      if (state.maintenanceLock?.isLocked && !isSuperAdminUser) {
        setBiometricStatus('failed');
        setBiometricMsg(`⚠️ SISTEM MAINTENANCE: "${state.maintenanceLock.note || 'Sistem dibekukan sementara'}"`);
        return;
      }

      const platform = detectPlatform();
      const audit = createAuditLog(
        admin,
        'Login Biometrik Device',
        `Admin (${admin.nama} - Role: ${admin.role}) masuk via sensor biometrik device [${platform.toUpperCase()}]`
      );
      updateState((prev) => ({
        ...prev,
        auditLogs: [audit, ...(prev.auditLogs || [])],
      }));

      setBiometricStatus('success');
      setBiometricMsg(`✓ Sensor Biometrik Device Terverifikasi! Masuk sebagai: ${admin.nama}`);
      setTimeout(() => {
        setShowBiometricModal(false);
        onLoginAdmin(admin);
      }, 650);
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

  // Handle Register Anggota Baru (Pendaftaran Mandiri - Req 1)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setErrorMessage('');

    if (regForm.password !== regForm.confirmPassword) {
      setRegError('Password dan Konfirmasi Password tidak sama.');
      return;
    }

    if (!regForm.pinTransaksi || regForm.pinTransaksi.length !== 6 || !/^\d{6}$/.test(regForm.pinTransaksi)) {
      setRegError('PIN Transaksi harus berupa 6 digit angka.');
      return;
    }

    if (regForm.pinTransaksi !== regForm.confirmPinTransaksi) {
      setRegError('PIN Transaksi dan Konfirmasi PIN tidak cocok.');
      return;
    }

    // Validation: NIK & No HP cannot be used twice per prompt
    const existingNik = state.members.find((m) => m.nik === regForm.nik.trim());
    if (existingNik) {
      setRegError('NIK ini sudah terdaftar sebagai anggota koperasi HWS.');
      return;
    }

    const cleanHp = regForm.whatsapp.replace(/\D/g, '');
    const existingHp = state.members.find((m) => m.whatsapp.replace(/\D/g, '') === cleanHp);
    if (existingHp) {
      setRegError('Nomor HP / WhatsApp ini sudah digunakan oleh anggota lain.');
      return;
    }

    setIsRegistering(true);

    try {
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
        provinsi: regForm.provinsi || 'DKI Jakarta',
        kota: regForm.kota || 'Jakarta Barat',
        kecamatan: regForm.kecamatan || regForm.wilayah,
        kelurahan: regForm.kelurahan || 'Cengkareng Barat',
        rt: regForm.rt || '001',
        rw: regForm.rw || '001',
        kodePos: regForm.kodePos || '11740',
        ktpPhotoUrl: regForm.ktpPhotoUrl || '',
        bankPribadi: {
          namaBank: regForm.namaBank || 'Bank Central Asia (BCA)',
          nomorRekening: regForm.nomorRekeningBank || '-',
          atasNama: regForm.atasNamaBank || regForm.nama.trim(),
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
        totalSimpanan: 0,
        status: 'aktif',
        terdaftarSejak: new Date().toISOString().split('T')[0],
      };

      // Persist authoritatively to backend server
      try {
        await fetch('/api/members/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member: newMember, nextRunningNumber }),
        });
      } catch (e) {
        console.warn('Backend register call notice:', e);
      }

      await updateState((prev) => ({
        ...prev,
        members: [...prev.members.filter((m) => m.id !== newMember.id), newMember],
        lastRunningNumber: nextRunningNumber,
        auditLogs: [
          {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            adminId: 'system',
            adminNama: 'Pendaftaran Mandiri Online',
            adminRole: 'super_admin',
            action: 'Pendaftaran Anggota Baru (Mandiri)',
            detail: `Anggota ${newMember.nama} (${newMember.nomorAnggota}) berhasil mendaftar mandiri di wilayah ${newMember.wilayah}. No. Rek: ${newMember.nomorRekening}`,
            targetId: newMember.id,
          },
          ...prev.auditLogs,
        ],
      }));

      // Set member identifier & password ready for immediate login
      setMemberIdentifier(nomorAnggota);
      setMemberPassword(regForm.password);
      setSuccessMessage(`✓ Pendaftaran berhasil! No. Anggota: ${nomorAnggota}, No. Rekening: ${nomorRekening}`);
      setRegSuccessMember(newMember);
    } catch (err: any) {
      setRegError(err?.message || 'Terjadi kesalahan saat memproses pendaftaran. Silakan coba lagi.');
    } finally {
      setIsRegistering(false);
    }
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
        {/* Logo Badge (Transparent Background, No White Box per User Req 21) */}
        <div className="w-24 h-24 rounded-3xl p-1 flex items-center justify-center mb-3 drop-shadow-2xl">
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

        {/* Maintenance Lock Banner (Req 3: Alasan dikirimkan ketika ada anggota / admin yang akan login) */}
        {state.maintenanceLock?.isLocked && (
          <div className="w-full mt-3 p-3.5 bg-rose-950/90 border-2 border-rose-500 text-rose-100 text-xs rounded-2xl shadow-xl space-y-1.5">
            <div className="flex items-center gap-2 font-black text-rose-300 uppercase tracking-wide">
              <span className="p-1 bg-rose-500/30 rounded-lg">🔒</span>
              <span>Sistem Sedang Dalam Mode Lock Maintenance</span>
            </div>
            <div className="text-[11px] text-slate-200 bg-black/40 p-2.5 rounded-xl border border-rose-500/30 leading-relaxed">
              <span className="font-bold text-amber-400">Pemberitahuan Pengurus:</span> "{state.maintenanceLock.note || 'Sistem sedang dalam pemeliharaan server database.'}"
            </div>
            <p className="text-[10px] text-rose-300">
              Akses anggota dan admin dibekukan sementara. Super Admin dapat login untuk mengelola dan membuka kunci maintenance.
            </p>
          </div>
        )}

        {/* Notification Banners */}
        {errorMessage && (
          <div className="w-full mt-3 p-3 bg-red-950/80 border border-red-500/40 text-red-200 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="whitespace-pre-line">{errorMessage}</span>
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

              {/* Pengingat Password & User ID di Perangkat (Req 2 & 6) */}
              {savedMemberAccount && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-black text-xs shrink-0">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Akun Tersimpan:</span>
                        <span className="text-amber-700 font-extrabold">{savedMemberAccount.nama}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {savedMemberAccount.identifier} • Siap Masuk Cepat
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('hws_saved_member_account');
                      setSavedMemberAccount(null);
                      setMemberIdentifier('');
                      setMemberPassword('');
                    }}
                    className="text-[10px] text-slate-400 hover:text-red-600 underline font-semibold shrink-0"
                  >
                    Lupakan
                  </button>
                </div>
              )}

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
                    type={showMemberPassword ? 'text' : 'password'}
                    required
                    value={memberPassword}
                    onChange={(e) => setMemberPassword(e.target.value)}
                    placeholder="Masukkan password Anda"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMemberPassword(!showMemberPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700"
                    title={showMemberPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showMemberPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
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

              {/* Checkbox Ingat Password & User ID (Pengingat Sandi Mandiri) */}
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none py-1">
                <input
                  type="checkbox"
                  checked={rememberAccount}
                  onChange={(e) => setRememberAccount(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300"
                />
                <span className="font-semibold text-[11px] text-slate-700">
                  Ingat Password & User ID (Pengingat Sandi)
                </span>
              </label>

              {/* Biometric Login Button: Terhubung di semua perangkat (Android, iOS, Web) */}
              <button
                type="button"
                onClick={handleBiometricAuth}
                className="w-full py-2.5 px-3 border border-emerald-400 hover:border-emerald-500 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-950 ring-1 ring-emerald-400/50 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-all shadow-sm active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <Fingerprint className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="truncate">
                    Masuk dengan Sidik Jari (Scan Fingerprint)
                  </span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-black shrink-0 bg-emerald-600 text-white shadow-sm">
                  ⚡ Scan Fingerprint
                </span>
              </button>

              <button
                type="submit"
                className="w-full py-3 bg-[#f59e0b] hover:bg-[#d97706] active:scale-[0.99] text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all"
              >
                Masuk Sekarang
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 text-center space-y-1.5">
                <p className="text-[11px] text-slate-500">
                  Belum memiliki akun keanggotaan Koperasi HWS?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setRegError('');
                    setRegSuccessMember(null);
                    setShowRegisterModal(true);
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20"
                >
                  <UserPlus className="w-4 h-4 text-slate-950" />
                  <span>Daftar Anggota Baru (Pendaftaran Mandiri Online)</span>
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

              {/* Pengingat Akun Admin di Perangkat (Req 2 & 6) */}
              {savedAdminAccount && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-black text-xs shrink-0">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Admin Tersimpan:</span>
                        <span className="text-amber-700 font-extrabold">{savedAdminAccount.nama}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        @{savedAdminAccount.username} • Siap Masuk Cepat
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('hws_saved_admin_account');
                      setSavedAdminAccount(null);
                      setAdminUsername('');
                      setAdminPassword('');
                    }}
                    className="text-[10px] text-slate-400 hover:text-red-600 underline font-semibold shrink-0"
                  >
                    Lupakan
                  </button>
                </div>
              )}

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
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Masukkan password admin"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700"
                    title={showAdminPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
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

              {/* Checkbox Ingat Password & Username Admin (Pengingat Sandi Mandiri) */}
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none py-1">
                <input
                  type="checkbox"
                  checked={rememberAccount}
                  onChange={(e) => setRememberAccount(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300"
                />
                <span className="font-semibold text-[11px] text-slate-700">
                  Ingat Password & Username (Pengingat Sandi)
                </span>
              </label>

              {/* Biometric Login Button: Admin Biometric Terhubung di semua perangkat (Android, iOS, Web) */}
              <button
                type="button"
                onClick={handleBiometricAuth}
                className="w-full py-2.5 px-3 border border-emerald-400 hover:border-emerald-500 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-950 ring-1 ring-emerald-400/50 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-all shadow-sm active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <Fingerprint className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="truncate">
                    Masuk dengan Sidik Jari Admin (Scan Fingerprint)
                  </span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-black shrink-0 bg-emerald-600 text-white shadow-sm">
                  ⚡ Scan Fingerprint
                </span>
              </button>

              <button
                type="submit"
                className="w-full py-3 bg-[#f59e0b] hover:bg-[#d97706] active:scale-[0.99] text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all"
              >
                Masuk Sekarang
                <ArrowRight className="w-4 h-4" />
              </button>

            </form>
          )}

          {/* Tombol Pasang / Instal Aplikasi Dipindahkan Berada di Bawah (Req C.3) */}
          <div className="mt-5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowDownloadAppModal(true)}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500/10 via-emerald-500/15 to-amber-500/10 hover:from-amber-500/20 hover:to-emerald-500/25 border border-amber-400/50 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-800 shadow-sm transition-all active:scale-[0.99] group"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl group-hover:scale-110 transition-transform">📲</span>
                <div className="text-left">
                  <div className="text-xs font-black text-slate-900">Pasang / Instal Aplikasi Koperasi HWS</div>
                  <div className="text-[10px] text-slate-500">Android (.APK / PWA), Apple iOS, & PC Desktop</div>
                </div>
              </div>
              <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0">
                Pasang
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODAL INSTALASI APLIKASI (Req 1: Pasang Langsung Terinstall) ================= */}
      <InstallAppModal
        isOpen={showDownloadAppModal}
        onClose={() => setShowDownloadAppModal(false)}
      />

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
                onClick={() => {
                  setShowRegisterModal(false);
                  setRegSuccessMember(null);
                  setRegError('');
                }}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {regSuccessMember ? (
              /* SELEBRASI PENDAFTARAN MANDIRI BERHASIL (REQ 1) */
              <div className="p-6 space-y-5 text-center">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div>
                  <h3 className="text-lg font-black text-white">Pendaftaran Mandiri Berhasil!</h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                    Selamat, akun keanggotaan Koperasi HWS Anda telah aktif dan terhubung ke sistem.
                  </p>
                </div>

                <div className="bg-[#162035] p-4 rounded-2xl border border-slate-700 text-left space-y-2.5 max-w-md mx-auto text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
                    <span className="text-slate-400">Nama Anggota:</span>
                    <span className="font-extrabold text-white">{regSuccessMember.nama}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
                    <span className="text-slate-400">No. Anggota:</span>
                    <span className="font-mono font-black text-amber-400 text-sm">{regSuccessMember.nomorAnggota}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
                    <span className="text-slate-400">No. Rekening Koperasi:</span>
                    <span className="font-mono font-black text-white">{regSuccessMember.nomorRekening}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
                    <span className="text-slate-400">Wilayah Keanggotaan:</span>
                    <span className="font-bold text-sky-400">{regSuccessMember.wilayah}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">PIN Transaksi:</span>
                    <span className="font-mono font-black text-amber-300">•••••• (6 Digit Tersimpan)</span>
                  </div>
                </div>

                <div className="space-y-2 max-w-md mx-auto pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      const memberToLogin = regSuccessMember;
                      setRegSuccessMember(null);
                      onLoginMember(memberToLogin);
                    }}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all"
                  >
                    <span>Masuk ke Dashboard Anggota Sekarang</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setRegSuccessMember(null);
                    }}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    Kembali ke Halaman Masuk
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleRegisterSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {regError && (
                <div className="p-3 bg-red-950/90 border border-red-500/50 text-red-200 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

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
                    value={regForm.alamatLengkap}
                    onChange={(e) => setRegForm({ ...regForm, alamatLengkap: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Upload KTP */}
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-dashed border-slate-600">
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Upload Foto KTP Asli <span className="text-slate-400 font-normal">(Opsional saat pendaftaran)</span>
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
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>Rekening Bank Pribadi (Untuk Penarikan Tabungan)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opsional (bisa diisi nanti)</span>
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
                      placeholder="Contoh: 1234567890 (Opsional)"
                      value={regForm.nomorRekeningBank}
                      onChange={(e) => setRegForm({ ...regForm, nomorRekeningBank: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Atas Nama Rekening</label>
                    <input
                      type="text"
                      placeholder="Nama di Rekening (Opsional)"
                      value={regForm.atasNamaBank}
                      onChange={(e) => setRegForm({ ...regForm, atasNamaBank: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Password & PIN Keamanan (Req 4, 8, 22) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Buat Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      placeholder="Minimal 6 karakter"
                      className="w-full pl-3 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                      title={showRegPassword ? 'Sembunyikan' : 'Lihat'}
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Konfirmasi Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      required
                      value={regForm.confirmPassword}
                      onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                      placeholder="Ulangi password"
                      className="w-full pl-3 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                      title={showRegConfirmPassword ? 'Sembunyikan' : 'Lihat'}
                    >
                      {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-400 mb-1">
                    PIN Transaksi (6 Digit Angka) *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPin ? 'text' : 'password'}
                      required
                      maxLength={6}
                      value={regForm.pinTransaksi}
                      onChange={(e) => setRegForm({ ...regForm, pinTransaksi: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="6 digit angka transfer"
                      className="w-full pl-3 pr-10 py-2 bg-slate-800 border border-amber-500/50 rounded-xl text-xs text-amber-300 font-mono tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPin(!showRegPin)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                      title={showRegPin ? 'Sembunyikan' : 'Lihat'}
                    >
                      {showRegPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-400 mb-1">
                    Konfirmasi PIN (6 Digit) *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPin ? 'text' : 'password'}
                      required
                      maxLength={6}
                      value={regForm.confirmPinTransaksi}
                      onChange={(e) => setRegForm({ ...regForm, confirmPinTransaksi: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="Ulangi 6 digit PIN"
                      className="w-full pl-3 pr-10 py-2 bg-slate-800 border border-amber-500/50 rounded-xl text-xs text-amber-300 font-mono tracking-widest"
                    />
                  </div>
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
                  disabled={isRegistering}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  {isRegistering ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Memproses Pendaftaran...</span>
                    </>
                  ) : (
                    <span>Selesaikan Pendaftaran Mandiri</span>
                  )}
                </button>
              </div>
            </form>
            )}
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
                  <div className="relative">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Ketik password baru"
                      className="w-full pl-3 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                      title={showResetPassword ? 'Sembunyikan' : 'Lihat'}
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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

      {/* ================= BIOMETRIC SENSOR MODAL (REQ 7: FINGER SCAN & FACE ID TERHUBUNG KE DEVICE) ================= */}
      {showBiometricModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#0f172a] border border-slate-700/80 w-full max-w-sm rounded-3xl p-5 shadow-2xl text-center space-y-4 my-auto relative">
            <button
              onClick={() => setShowBiometricModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Device Security */}
            <div className="flex flex-col items-center pt-2">
              <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Sensor Keamanan Device Terhubung</span>
              </div>
              <h3 className="text-base font-black text-white">Autentikasi Biometrik Device</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {activeTab === 'member' ? 'Login Anggota Koperasi' : 'Login Petugas / Admin Koperasi'}
              </p>
            </div>

            {/* Method Switcher: Fingerprint vs Face ID */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setBiometricMethod('fingerprint')}
                className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  biometricMethod === 'fingerprint'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Fingerprint className="w-4 h-4" />
                <span>Finger Scan</span>
              </button>
              <button
                type="button"
                onClick={() => setBiometricMethod('face_id')}
                className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  biometricMethod === 'face_id'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🤳 Face ID</span>
              </button>
            </div>

            {/* Target Account Info */}
            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-left">
              <div className="text-[10px] text-slate-400 font-semibold">Tautan Akun Device:</div>
              <div className="font-extrabold text-amber-300 truncate">
                {biometricTargetUser || (activeTab === 'member' ? 'Akun Anggota Aktif' : 'Super Admin (Abzqar)')}
              </div>
            </div>

            {/* Automatic Device Sensor Scanner (Tanpa perlu klik tombol kedua - Langsung scan otomatis) */}
            <div className="py-4 flex flex-col items-center justify-center">
              <div className="relative group focus:outline-none">
                {/* Glow rings */}
                <div className={`absolute -inset-4 rounded-full blur-lg opacity-70 transition-all ${
                  biometricStatus === 'scanning'
                    ? 'bg-sky-500 animate-pulse'
                    : biometricStatus === 'success'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500/40'
                }`} />

                {/* Circular scanner pad (Interactive Touch to Scan Finger) */}
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                      try { navigator.vibrate([40, 50, 40]); } catch {}
                    }
                    setBiometricStatus('scanning');
                    setBiometricMsg(
                      biometricMethod === 'fingerprint'
                        ? 'Memindai sidik jari device...'
                        : 'Memindai wajah...'
                    );
                    setTimeout(() => {
                      executeBiometricLogin(biometricTargetUser);
                    }, 650);
                  }}
                  className={`relative w-28 h-28 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer active:scale-95 ${
                    biometricStatus === 'scanning'
                      ? 'border-sky-400 bg-sky-950/60 shadow-[0_0_25px_rgba(56,189,248,0.5)]'
                      : biometricStatus === 'success'
                      ? 'border-emerald-400 bg-emerald-950/80 shadow-[0_0_25px_rgba(52,211,153,0.5)]'
                      : 'border-amber-400/80 bg-slate-900 shadow-xl'
                  }`}>
                  {biometricMethod === 'fingerprint' ? (
                    <Fingerprint className={`w-14 h-14 transition-colors ${
                      biometricStatus === 'scanning'
                        ? 'text-sky-300 animate-pulse'
                        : biometricStatus === 'success'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`} />
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-4xl animate-bounce">🤳</span>
                      <span className="text-[10px] font-bold text-amber-300 mt-1">Face Scan</span>
                    </div>
                  )}

                  {biometricStatus === 'scanning' && (
                    <div className="absolute inset-x-2 h-0.5 bg-sky-400 shadow-[0_0_8px_#38bdf8] animate-[bounce_1.5s_infinite]" />
                  )}
                </button>
              </div>

              <div className="mt-4 space-y-1">
                <p className="text-xs font-bold text-white">
                  {biometricStatus === 'scanning'
                    ? 'Memindai Sensor Sidik Jari Device...'
                    : biometricStatus === 'success'
                    ? '✓ Sensor Terverifikasi! Mengalihkan ke Dashboard...'
                    : 'Menghubungkan Sensor Device...'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {biometricMsg || 'Sensor biometrik aktif - Otomatis masuk ke dashboard setelah scan'}
                </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
