import React, { useState, useEffect } from 'react';
import {
  AppState,
  AdminUser,
  MemberUser,
  WilayahKoperasi,
  BankAccount,
  PengurusItem,
} from '../types';
import { formatRupiah, createAuditLog } from '../lib/storage';
import { downloadExcelCsv, printDocumentHtml } from '../lib/exportPdf';
import { LogoHws } from '../lib/logo';
import {
  X,
  User,
  Shield,
  Key,
  Smartphone,
  Server,
  Cloud,
  FileText,
  DollarSign,
  Plus,
  Trash2,
  Upload,
  LogOut,
  CheckCircle2,
  RefreshCw,
  QrCode,
  Building,
  Edit2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Lock,
} from 'lucide-react';

interface SettingModalProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin?: AdminUser;
  currentMember?: MemberUser;
  initialSubModal?:
    | null
    | 'edit_profile'
    | 'tambah_admin'
    | 'daftar_admin'
    | 'profil_koperasi'
    | 'cloud_server'
    | 'google_drive'
    | 'log_audit'
    | 'sesuaikan_saldo'
    | 'install_pwa';
  onClose: () => void;
  onLogout: () => void;
  onOpenKta?: () => void;
  onOpenMutasi?: () => void;
  onOpenChat?: () => void;
}

export const SettingModal: React.FC<SettingModalProps> = ({
  state,
  updateState,
  currentAdmin,
  currentMember,
  initialSubModal,
  onClose,
  onLogout,
  onOpenKta,
  onOpenMutasi,
  onOpenChat,
}) => {
  const isMember = !!currentMember;
  const isSuperAdmin = currentAdmin?.role === 'super_admin';

  // Sub-dialogs
  const [subModal, setSubModal] = useState<
    | null
    | 'edit_profile'
    | 'tambah_admin'
    | 'daftar_admin'
    | 'profil_koperasi'
    | 'cloud_server'
    | 'google_drive'
    | 'log_audit'
    | 'sesuaikan_saldo'
    | 'install_pwa'
  >(initialSubModal || null);

  useEffect(() => {
    if (initialSubModal) {
      setSubModal(initialSubModal);
    }
  }, [initialSubModal]);

  // Edit Profile State (Member)
  const [editMemberNama, setEditMemberNama] = useState(currentMember?.nama || '');
  const [editMemberWa, setEditMemberWa] = useState(currentMember?.whatsapp || '');
  const [editMemberEmail, setEditMemberEmail] = useState(currentMember?.email || '');
  const [editMemberAlamat, setEditMemberAlamat] = useState(currentMember?.alamatLengkap || '');
  const [editMemberRt, setEditMemberRt] = useState(currentMember?.rt || '');
  const [editMemberRw, setEditMemberRw] = useState(currentMember?.rw || '');
  const [editMemberKelurahan, setEditMemberKelurahan] = useState(currentMember?.kelurahan || '');
  const [editMemberKecamatan, setEditMemberKecamatan] = useState(currentMember?.kecamatan || '');
  const [editMemberKota, setEditMemberKota] = useState(currentMember?.kota || 'Jakarta Barat');
  const [editMemberProvinsi, setEditMemberProvinsi] = useState(currentMember?.provinsi || 'DKI Jakarta');
  const [editMemberKodePos, setEditMemberKodePos] = useState(currentMember?.kodePos || '');
  const [editMemberBankName, setEditMemberBankName] = useState(currentMember?.bankPribadi?.namaBank || 'Bank Central Asia (BCA)');
  const [editMemberBankRek, setEditMemberBankRek] = useState(currentMember?.bankPribadi?.nomorRekening || '');
  const [editMemberBankHolder, setEditMemberBankHolder] = useState(currentMember?.bankPribadi?.atasNama || '');
  const [editMemberPassword, setEditMemberPassword] = useState('');
  const [editMemberPin, setEditMemberPin] = useState(currentMember?.pinTransaksi || '123456');

  // Edit Profile State (Admin)
  const [editAdminNama, setEditAdminNama] = useState(currentAdmin?.nama || '');
  const [editAdminWa, setEditAdminWa] = useState(currentAdmin?.whatsapp || '');
  const [editAdminEmail, setEditAdminEmail] = useState(currentAdmin?.email || '');
  const [editAdminNik, setEditAdminNik] = useState(currentAdmin?.nik || '');
  const [editAdminPassword, setEditAdminPassword] = useState('');

  // Synchronize profile form states when currentMember or currentAdmin updates
  useEffect(() => {
    if (currentMember) {
      setEditMemberNama(currentMember.nama || '');
      setEditMemberWa(currentMember.whatsapp || '');
      setEditMemberEmail(currentMember.email || '');
      setEditMemberAlamat(currentMember.alamatLengkap || '');
      setEditMemberRt(currentMember.rt || '');
      setEditMemberRw(currentMember.rw || '');
      setEditMemberKelurahan(currentMember.kelurahan || '');
      setEditMemberKecamatan(currentMember.kecamatan || '');
      setEditMemberKota(currentMember.kota || 'Jakarta Barat');
      setEditMemberProvinsi(currentMember.provinsi || 'DKI Jakarta');
      setEditMemberKodePos(currentMember.kodePos || '');
      setEditMemberBankName(currentMember.bankPribadi?.namaBank || 'Bank Central Asia (BCA)');
      setEditMemberBankRek(currentMember.bankPribadi?.nomorRekening || '');
      setEditMemberBankHolder(currentMember.bankPribadi?.atasNama || '');
      setEditMemberPin(currentMember.pinTransaksi || '123456');
    }
  }, [currentMember]);

  useEffect(() => {
    if (currentAdmin) {
      setEditAdminNama(currentAdmin.nama || '');
      setEditAdminWa(currentAdmin.whatsapp || '');
      setEditAdminEmail(currentAdmin.email || '');
      setEditAdminNik(currentAdmin.nik || '');
    }
  }, [currentAdmin]);

  // Tambah Admin Baru State
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminNama, setNewAdminNama] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminWa, setNewAdminWa] = useState('');
  const [newAdminNik, setNewAdminNik] = useState('');
  const [newAdminWilayah, setNewAdminWilayah] = useState<WilayahKoperasi>('Cengkareng');
  const [newAdminRole, setNewAdminRole] = useState<'super_admin' | 'admin_kelola' | 'admin_write' | 'admin_laporan'>('admin_write');
  const [newAdminPassword, setNewAdminPassword] = useState('admin123');

  // Profil Koperasi Biodata State
  const [bioNama, setBioNama] = useState(state.profile.nama || 'Koperasi Himpunan Wirausaha Sejahtera');
  const [bioBadanHukum, setBioBadanHukum] = useState(state.profile.badanHukum || 'AHU-0004921.AH.01.29.TAHUN 2024');
  const [bioNpwp, setBioNpwp] = useState(state.profile.npwpKoperasi || '82.910.293.4-038.000');
  const [bioNik, setBioNik] = useState(state.profile.nikKoperasi || '3173010049210001');
  const [bioTglPendirian, setBioTglPendirian] = useState(state.profile.tanggalPendirian || '15 Januari 2024');
  const [bioVisi, setBioVisi] = useState(state.profile.visi || 'Membangun ekosistem wirausaha mikro dan mandiri yang berkeadilan, sejahtera, serta berlandaskan gotong royong dan syariah.');
  const [bioMisi, setBioMisi] = useState(state.profile.misi || 'Memberdayakan ekonomi anggota melalui tabungan terencana, pembiayaan produktif, dan kepedulian sosial zakat & qurban.');
  const [bioAlamat, setBioAlamat] = useState(state.profile.alamat || 'Jl. Raya Daan Mogot KM 11 No. 8, Cengkareng, Jakarta Barat 11740');
  const [bioTelepon, setBioTelepon] = useState(state.profile.telepon || '0858-1755-4296');
  const [bioEmail, setBioEmail] = useState(state.profile.email || 'koperasi.hws.jkt@gmail.com');
  const [bioWebsite, setBioWebsite] = useState(state.profile.website || 'https://koperasi-hws.id');

  // Rekening Penampungan Management
  const [newBankName, setNewBankName] = useState('Bank Central Asia (BCA)');
  const [newBankRek, setNewBankRek] = useState('');
  const [newBankHolder, setNewBankHolder] = useState('KOPERASI HWS');
  const [editingRekId, setEditingRekId] = useState<string | null>(null);
  const [editRekName, setEditRekName] = useState('');
  const [editRekNomor, setEditRekNomor] = useState('');
  const [editRekHolder, setEditRekHolder] = useState('');

  // Daftar Pengurus Management
  const [newPengurusJabatan, setNewPengurusJabatan] = useState('Ketua Pengurus');
  const [newPengurusNama, setNewPengurusNama] = useState('');
  const [newPengurusKontak, setNewPengurusKontak] = useState('');

  // Penyesuaian Saldo State
  const [adjMemberId, setAdjMemberId] = useState(state.members[0]?.id || '');
  const [adjTipe, setAdjTipe] = useState<'tambah' | 'tarik'>('tambah');
  const [adjNominal, setAdjNominal] = useState('');
  const [adjKeterangan, setAdjKeterangan] = useState('');

  // Save Member Profile
  const handleSaveMemberProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember) return;

    await updateState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === currentMember.id
          ? {
              ...m,
              nama: editMemberNama.trim() || m.nama,
              whatsapp: editMemberWa.trim() || m.whatsapp,
              email: editMemberEmail.trim() || m.email,
              alamatLengkap: editMemberAlamat.trim() || m.alamatLengkap,
              rt: editMemberRt.trim() || m.rt,
              rw: editMemberRw.trim() || m.rw,
              kelurahan: editMemberKelurahan.trim() || m.kelurahan,
              kecamatan: editMemberKecamatan.trim() || m.kecamatan,
              kota: editMemberKota.trim() || m.kota,
              provinsi: editMemberProvinsi.trim() || m.provinsi,
              kodePos: editMemberKodePos.trim() || m.kodePos,
              bankPribadi: {
                namaBank: editMemberBankName,
                nomorRekening: editMemberBankRek.trim() || m.bankPribadi.nomorRekening,
                atasNama: editMemberBankHolder.trim() || m.bankPribadi.atasNama,
              },
              password: editMemberPassword.trim() ? editMemberPassword.trim() : m.password,
              pinTransaksi: editMemberPin.trim() ? editMemberPin.trim() : m.pinTransaksi,
            }
          : m
      ),
    }));

    alert('Profil dan data diri anggota Anda berhasil diperbarui!');
    setSubModal(null);
  };

  // Save Admin Profile
  const handleSaveAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdmin) return;

    await updateState((prev) => ({
      ...prev,
      admins: prev.admins.map((a) =>
        a.id === currentAdmin.id
          ? {
              ...a,
              nama: editAdminNama.trim() || a.nama,
              whatsapp: editAdminWa.trim() || a.whatsapp,
              email: editAdminEmail.trim() || a.email,
              nik: editAdminNik.trim() || a.nik,
              password: editAdminPassword.trim() ? editAdminPassword.trim() : a.password,
            }
          : a
      ),
      auditLogs: [
        createAuditLog(currentAdmin, 'Ubah Profil Admin', `Memperbarui profil administrator`),
        ...prev.auditLogs,
      ],
    }));

    alert('Profil administrator Anda berhasil diperbarui!');
    setSubModal(null);
  };

  // Save Koperasi Biodata
  const handleSaveBiodataKoperasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdmin || !isSuperAdmin) {
      alert('Hanya Super Admin yang dapat memperbarui biodata koperasi.');
      return;
    }

    await updateState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        nama: bioNama.trim(),
        badanHukum: bioBadanHukum.trim(),
        npwpKoperasi: bioNpwp.trim(),
        nikKoperasi: bioNik.trim(),
        tanggalPendirian: bioTglPendirian.trim(),
        visi: bioVisi.trim(),
        misi: bioMisi.trim(),
        alamat: bioAlamat.trim(),
        telepon: bioTelepon.trim(),
        email: bioEmail.trim(),
        website: bioWebsite.trim(),
      },
      auditLogs: [
        createAuditLog(currentAdmin, 'Update Biodata Koperasi', 'Memperbarui profil & legalitas koperasi HWS'),
        ...prev.auditLogs,
      ],
    }));

    alert('Biodata & profil legalitas koperasi berhasil disimpan!');
  };

  // Add Rekening Penampungan
  const handleAddRekPenampungan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankRek.trim()) return;

    const newAccount: BankAccount = {
      id: `rek-${Date.now()}`,
      bankName: newBankName,
      accountNumber: newBankRek.trim(),
      accountHolder: newBankHolder.trim(),
      isPrimary: false,
    };

    await updateState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        rekeningPenampungan: [...prev.profile.rekeningPenampungan, newAccount],
      },
    }));

    setNewBankRek('');
    alert('Rekening penampungan koperasi berhasil ditambahkan!');
  };

  // Edit Rekening Penampungan
  const handleSaveEditRek = async (rekId: string) => {
    if (!editRekNomor.trim()) return;

    await updateState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        rekeningPenampungan: prev.profile.rekeningPenampungan.map((r) =>
          r.id === rekId
            ? {
                ...r,
                bankName: editRekName || r.bankName,
                accountNumber: editRekNomor.trim(),
                accountHolder: editRekHolder.trim() || r.accountHolder,
              }
            : r
        ),
      },
    }));

    setEditingRekId(null);
    alert('Rekening penampungan berhasil diubah!');
  };

  // Delete Rekening Penampungan
  const handleDeleteRekPenampungan = async (rekId: string) => {
    if (state.profile.rekeningPenampungan.length <= 1) {
      alert('Koperasi harus memiliki minimal satu rekening penampungan.');
      return;
    }
    const confirmDelete = confirm('Hapus rekening penampungan ini?');
    if (!confirmDelete) return;

    await updateState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        rekeningPenampungan: prev.profile.rekeningPenampungan.filter((r) => r.id !== rekId),
      },
    }));
  };

  // Add Pengurus Koperasi
  const handleAddPengurus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPengurusNama.trim()) return;

    const newItem: PengurusItem = {
      id: `peng-${Date.now()}`,
      jabatan: newPengurusJabatan.trim(),
      nama: newPengurusNama.trim(),
      kontak: newPengurusKontak.trim(),
    };

    const currentList = state.profile.daftarPengurus || [];
    await updateState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        daftarPengurus: [...(prev.profile.daftarPengurus || []), newItem],
      },
    }));

    setNewPengurusNama('');
    setNewPengurusKontak('');
    alert('Pengurus koperasi baru berhasil ditambahkan!');
  };

  // Delete Pengurus Koperasi
  const handleDeletePengurus = async (pengId: string) => {
    const confirmDelete = confirm('Hapus pengurus ini dari daftar kepengurusan?');
    if (!confirmDelete) return;

    await updateState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        daftarPengurus: (prev.profile.daftarPengurus || []).filter((p) => p.id !== pengId),
      },
    }));
  };

  // Delete Admin User
  const handleDeleteAdmin = async (adminId: string) => {
    if (!isSuperAdmin) {
      alert('Hanya Super Admin yang dapat menghapus pengurus.');
      return;
    }
    if (adminId === currentAdmin?.id) {
      alert('Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }
    const target = state.admins.find((a) => a.id === adminId);
    if (!target) return;

    const confirmDelete = confirm(`Hapus administrator ${target.nama} (@${target.username})?`);
    if (!confirmDelete) return;

    await updateState((prev) => ({
      ...prev,
      admins: prev.admins.filter((a) => a.id !== adminId),
      auditLogs: [
        createAuditLog(currentAdmin, 'Hapus Admin', `Menghapus administrator ${target.nama}`, adminId),
        ...prev.auditLogs,
      ],
    }));

    alert(`Administrator ${target.nama} berhasil dihapus.`);
  };

  // Handle Add New Admin
  const handleAddAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdmin || !isSuperAdmin) {
      alert('Hanya Super Admin yang dapat mendaftarkan admin baru.');
      return;
    }

    const existEmail = state.admins.find(
      (a) => a.email.toLowerCase() === newAdminEmail.trim().toLowerCase()
    );
    if (existEmail) {
      alert('Email ini sudah digunakan oleh admin lain.');
      return;
    }

    const existUsername = state.admins.find(
      (a) => a.username.toLowerCase() === newAdminUsername.trim().toLowerCase()
    );
    if (existUsername) {
      alert('Username ini sudah digunakan.');
      return;
    }

    const newAdminUser: AdminUser = {
      id: `adm-${Date.now()}`,
      username: newAdminUsername.trim().toLowerCase(),
      nama: newAdminNama.trim(),
      email: newAdminEmail.trim(),
      whatsapp: newAdminWa.trim(),
      nik: newAdminNik.trim(),
      wilayahKantor: newAdminWilayah,
      role: newAdminRole,
      password: newAdminPassword,
      createdAt: new Date().toISOString(),
    };

    await updateState((prev) => ({
      ...prev,
      admins: [...prev.admins, newAdminUser],
      auditLogs: [
        createAuditLog(
          currentAdmin,
          'Tambah Pengurus Baru',
          `Menambahkan pengurus ${newAdminUser.nama} (${newAdminUser.role})`,
          newAdminUser.id
        ),
        ...prev.auditLogs,
      ],
    }));

    alert(`Pengurus baru ${newAdminUser.nama} berhasil ditambahkan!`);
    setSubModal(null);
  };

  // Handle QRIS Upload
  const handleQrisFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result as string;
      await updateState((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          qrisImageUrl: url,
        },
      }));
      alert('Logo / Gambar QRIS resmi koperasi berhasil diperbarui!');
    };
    reader.readAsDataURL(file);
  };

  // Penyesuaian Saldo Anggota
  const handlePenyesuaianSaldoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdmin) return;
    const amount = Number(adjNominal);
    if (!amount || amount <= 0) {
      alert('Nominal harus lebih dari 0.');
      return;
    }

    const targetMember = state.members.find((m) => m.id === adjMemberId);
    if (!targetMember) return;

    const now = new Date();
    const tgl = now.toISOString().split('T')[0];
    const jam = now.toTimeString().split(' ')[0].slice(0, 5);
    const ketEntry = `Sesuaikan Saldo ${adjKeterangan || ''}`.trim();

    await updateState((prev) => {
      let updatedKasList = [...prev.kasList];
      let newTxs = [...prev.memberTransactions];

      if (adjTipe === 'tarik') {
        updatedKasList.unshift({
          id: `kas-adj-1-${Date.now()}`,
          bukuKas: 'anggota',
          tanggal: tgl,
          kategori: 'Penyesuaian Saldo',
          keterangan: ketEntry,
          tipe: 'keluar',
          nominal: amount,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        });
        updatedKasList.unshift({
          id: `kas-adj-2-${Date.now() + 1}`,
          bukuKas: 'koperasi',
          tanggal: tgl,
          kategori: 'Penyesuaian Saldo',
          keterangan: ketEntry,
          tipe: 'masuk',
          nominal: amount,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        });
        newTxs.push({
          id: `tx-adj-${Date.now()}`,
          memberId: targetMember.id,
          tanggal: tgl,
          jam,
          keterangan: ketEntry,
          cbg: `KCP ${targetMember.wilayah.toUpperCase()}`,
          tipe: 'keluar',
          nominal: amount,
          saldoSetelah: targetMember.saldoUmum - amount,
          kategori: 'umum',
        });
      } else {
        updatedKasList.unshift({
          id: `kas-adj-3-${Date.now()}`,
          bukuKas: 'koperasi',
          tanggal: tgl,
          kategori: 'Penyesuaian Saldo',
          keterangan: ketEntry,
          tipe: 'keluar',
          nominal: amount,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        });
        updatedKasList.unshift({
          id: `kas-adj-4-${Date.now() + 1}`,
          bukuKas: 'anggota',
          tanggal: tgl,
          kategori: 'Penyesuaian Saldo',
          keterangan: ketEntry,
          tipe: 'masuk',
          nominal: amount,
          saldoKasSetelah: 0,
          inputBy: currentAdmin.nama,
          status: 'approved',
          createdAt: now.toISOString(),
        });
        newTxs.push({
          id: `tx-adj-${Date.now()}`,
          memberId: targetMember.id,
          tanggal: tgl,
          jam,
          keterangan: ketEntry,
          cbg: `KCP ${targetMember.wilayah.toUpperCase()}`,
          tipe: 'masuk',
          nominal: amount,
          saldoSetelah: targetMember.saldoUmum + amount,
          kategori: 'umum',
        });
      }

      const updatedMembers = prev.members.map((m) => {
        if (m.id === targetMember.id) {
          return {
            ...m,
            saldoUmum: adjTipe === 'tambah' ? m.saldoUmum + amount : m.saldoUmum - amount,
          };
        }
        return m;
      });

      const audit = createAuditLog(
        currentAdmin,
        'Penyesuaian Saldo',
        `${adjTipe === 'tambah' ? 'Menambah' : 'Menarik'} ${formatRupiah(amount)} untuk ${targetMember.nama}. Keterangan: ${ketEntry}`,
        targetMember.id
      );

      return {
        ...prev,
        members: updatedMembers,
        memberTransactions: newTxs,
        kasList: updatedKasList,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    alert('Penyesuaian saldo berhasil diproses!');
    setSubModal(null);
  };

  // Export Audit PDF
  const handleExportAuditPdf = () => {
    const tableRows = state.auditLogs
      .map(
        (l) => `
      <tr style="border-bottom: 1px solid #ddd; font-size: 11px;">
        <td style="padding: 6px;">${l.timestamp.replace('T', ' ').slice(0, 19)}</td>
        <td style="padding: 6px; font-weight: 700;">${l.adminNama} (${l.adminRole})</td>
        <td style="padding: 6px; color: #b45309; font-weight: 700;">${l.action}</td>
        <td style="padding: 6px;">${l.detail}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      <div style="position: relative; padding: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px;">
          <div>
            <h2 style="font-size: 15px; font-weight: 900; margin: 0;">KOPERASI HIMPUNAN WIRAUSAHA SEJAHTERA</h2>
            <div style="font-size: 11px; font-weight: 700; color: #b45309;">Log Histori & Audit Trail Aktivitas Administrator (60 Hari)</div>
          </div>
          <div style="font-size: 10px; text-align: right;">Dicetak: ${new Date().toLocaleDateString('id-ID')}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #ddd;">
          <thead>
            <tr style="background: #f9fafb; font-size: 11px; text-align: left; border-bottom: 1px solid #ddd;">
              <th style="padding: 6px;">Waktu</th>
              <th style="padding: 6px;">Petugas Admin</th>
              <th style="padding: 6px;">Aksi</th>
              <th style="padding: 6px;">Rincian Detail</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;

    printDocumentHtml(html, 'Log_Audit_Aktivitas_Koperasi_HWS');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-[#0f172a] text-slate-100 border border-slate-700/80 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Header matching Anngota Setting Menu.png & mobile admin */}
        <div className="p-4 border-b border-slate-700/80 flex items-center justify-between bg-[#162035] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-bold text-base">⚙️</span>
            <h3 className="text-sm font-extrabold text-white">
              {isMember ? 'Pengaturan Akun & Profil' : 'Pengaturan & Profil Pengurus'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* ================= PROFILE CARD ================= */}
          {isMember ? (
            <div className="bg-[#162035] p-4 rounded-2xl border border-slate-700/80 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5">
                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center font-black text-amber-400 text-xl">
                    {currentMember.nama.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">{currentMember.nama}</h4>
                  <div className="text-[11px] font-mono font-bold text-amber-400">
                    {currentMember.nomorAnggota}
                  </div>
                  <div className="text-[10px] text-slate-400">Wilayah: {currentMember.wilayah}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700/60 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Rekening Koperasi:</span>
                  <span className="font-mono font-black text-white">{currentMember.nomorRekening}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Bank Pribadi:</span>
                  <span className="font-mono text-slate-200 truncate max-w-[200px]">
                    {currentMember.bankPribadi.namaBank} ({currentMember.bankPribadi.nomorRekening})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">No. WhatsApp:</span>
                  <span className="font-mono text-slate-200">{currentMember.whatsapp}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSubModal('edit_profile')}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-amber-400 border border-amber-500/20 flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Ubah Data Diri & Password
              </button>
            </div>
          ) : (
            <div className="bg-[#162035] p-4 rounded-2xl border border-slate-700/80 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-2xl shadow-lg">
                  {currentAdmin?.nama.charAt(0).toUpperCase() || 'A'}
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">{currentAdmin?.nama}</h4>
                  <div className="text-[11px] text-sky-400 font-mono">@{currentAdmin?.username}</div>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                    {currentAdmin?.role.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700/60 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">NIK:</span>
                  <span className="font-mono text-slate-200">{currentAdmin?.nik}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">No. WhatsApp:</span>
                  <span className="font-mono text-slate-200">{currentAdmin?.whatsapp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-slate-200 truncate max-w-[190px]">{currentAdmin?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Wilayah Kantor:</span>
                  <span className="text-slate-200">{currentAdmin?.wilayahKantor}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSubModal('edit_profile')}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-amber-400 border border-amber-500/20 flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Ubah Profil & Password Saya
              </button>
            </div>
          )}

          {/* ================= BUTTONS LIST ================= */}
          {isMember ? (
            /* Member Options: KTA, Ubah data diri, Lihat KTA Digital, Log Out, Instalasi Koperasi */
            <div className="space-y-2">
              <button
                onClick={() => setSubModal('edit_profile')}
                className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between text-xs font-bold text-white transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-sky-400" />
                  <span>Ubah Data Diri & Password</span>
                </div>
                <span>›</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenKta?.();
                }}
                className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between text-xs font-bold text-white transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Lihat KTA Digital Anggota</span>
                </div>
                <span>›</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenMutasi?.();
                }}
                className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between text-xs font-bold text-white transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Cetak Rekening Koran PDF</span>
                </div>
                <span>›</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenChat?.();
                }}
                className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between text-xs font-bold text-white transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-amber-400" />
                  <span>Layanan Bantuan Pengurus</span>
                </div>
                <span>›</span>
              </button>

              {/* Install PWA Button */}
              <button
                onClick={() => setSubModal('install_pwa')}
                className="w-full p-3 bg-emerald-950/40 hover:bg-emerald-950/60 rounded-2xl border border-emerald-500/40 flex items-center justify-between text-xs font-bold text-white transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <div className="text-left">
                    <div className="text-emerald-300">Instal Aplikasi Koperasi HWS</div>
                    <div className="text-[10px] text-emerald-400/80 font-normal">
                      APK Android & iOS (Langsung Terpasang)
                    </div>
                  </div>
                </div>
                <span className="text-emerald-400">›</span>
              </button>
            </div>
          ) : (
            /* Admin Options */
            <div className="space-y-2">
              <div className="text-[11px] font-black tracking-wider text-slate-400 uppercase pt-2">
                Kelola Pengurus & Sistem
              </div>

              {isSuperAdmin && (
                <button
                  onClick={() => setSubModal('tambah_admin')}
                  className="w-full p-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black text-xs flex items-center justify-between shadow-lg transition-all"
                >
                  <span>+ Tambah Admin / Pengurus Baru</span>
                  <span>›</span>
                </button>
              )}

              {/* Clickable Daftar Pengurus Koperasi per User Instruction 4 & 2 */}
              <button
                onClick={() => setSubModal('daftar_admin')}
                className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between text-xs font-bold text-white transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-sky-400" />
                  <span>Daftar Pengurus Koperasi ({state.admins.length} Admin)</span>
                </div>
                <span>›</span>
              </button>

              {/* Biodata & Legalitas Koperasi per User Instruction 5 & 6 */}
              <button
                onClick={() => setSubModal('profil_koperasi')}
                className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between text-xs font-bold text-white transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Building className="w-4 h-4 text-emerald-400" />
                  <span>Biodata & Rekening Penampungan Koperasi</span>
                </div>
                <span>›</span>
              </button>

              {/* Sesuaikan Saldo Anggota per User Instruction 10 & 11 */}
              {(isSuperAdmin || currentAdmin?.role === 'admin_kelola') && (
                <button
                  onClick={() => setSubModal('sesuaikan_saldo')}
                  className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between text-xs font-bold text-white transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Penyesuaian Saldo Anggota</span>
                  </div>
                  <span>›</span>
                </button>
              )}

              {isSuperAdmin && (
                <>
                  <button
                    onClick={() => setSubModal('cloud_server')}
                    className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between text-xs font-bold text-white transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Server className="w-4 h-4 text-purple-400" />
                      <span>Server Firebase Cloud Firestore</span>
                    </div>
                    <span>›</span>
                  </button>

                  <button
                    onClick={() => setSubModal('google_drive')}
                    className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between text-xs font-bold text-white transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Cloud className="w-4 h-4 text-amber-400" />
                      <span>Cadangan Google Drive (Backup Cloud)</span>
                    </div>
                    <span>›</span>
                  </button>

                  <button
                    onClick={() => setSubModal('log_audit')}
                    className="w-full p-3 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between text-xs font-bold text-white transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-sky-400" />
                      <span>Log Audit Aktivitas Sistem (60 Hari)</span>
                    </div>
                    <span>›</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setSubModal('install_pwa')}
                className="w-full p-3 bg-emerald-950/40 hover:bg-emerald-950/60 rounded-2xl border border-emerald-500/40 flex items-center justify-between text-xs font-bold text-white transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Instal Aplikasi Koperasi HWS (APK Android & PC)</span>
                </div>
                <span>›</span>
              </button>
            </div>
          )}

          {/* ================= LOGOUT BUTTON (Only located here per user instruction!) ================= */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-3 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 hover:text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-950/50"
            >
              <LogOut className="w-4 h-4" />
              Keluar dari Akun (Logout)
            </button>
          </div>
        </div>
      </div>

      {/* ================= SUB-MODAL: EDIT PROFIL ANGGOTA ATAU ADMIN ================= */}
      {subModal === 'edit_profile' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-sm font-extrabold text-white">
                {isMember ? 'Ubah Data Diri & Password Anggota' : 'Ubah Profil & Password Admin'}
              </h3>
              <button onClick={() => setSubModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {isMember ? (
              <form onSubmit={handleSaveMemberProfile} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={editMemberNama}
                    onChange={(e) => setEditMemberNama(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">No. WhatsApp</label>
                    <input
                      type="tel"
                      required
                      value={editMemberWa}
                      onChange={(e) => setEditMemberWa(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={editMemberEmail}
                      onChange={(e) => setEditMemberEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Alamat Lengkap</label>
                  <textarea
                    rows={2}
                    value={editMemberAlamat}
                    onChange={(e) => setEditMemberAlamat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">RT / RW</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={editMemberRt}
                        onChange={(e) => setEditMemberRt(e.target.value)}
                        placeholder="RT"
                        className="w-1/2 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-center"
                      />
                      <input
                        type="text"
                        value={editMemberRw}
                        onChange={(e) => setEditMemberRw(e.target.value)}
                        placeholder="RW"
                        className="w-1/2 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-center"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Kelurahan</label>
                    <input
                      type="text"
                      value={editMemberKelurahan}
                      onChange={(e) => setEditMemberKelurahan(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
                  <div className="font-bold text-sky-400">Rekening Bank Pribadi (Untuk Penarikan)</div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Nama Bank</label>
                    <select
                      value={editMemberBankName}
                      onChange={(e) => setEditMemberBankName(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                    >
                      <option>Bank Central Asia (BCA)</option>
                      <option>Bank Mandiri</option>
                      <option>Bank Rakyat Indonesia (BRI)</option>
                      <option>Bank Negara Indonesia (BNI)</option>
                      <option>Bank Syariah Indonesia (BSI)</option>
                      <option>Bank Danamon</option>
                      <option>Bank CIMB Niaga</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400">Nomor Rekening</label>
                      <input
                        type="text"
                        required
                        value={editMemberBankRek}
                        onChange={(e) => setEditMemberBankRek(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Atas Nama</label>
                      <input
                        type="text"
                        required
                        value={editMemberBankHolder}
                        onChange={(e) => setEditMemberBankHolder(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Ganti Password (Opsional)</label>
                    <input
                      type="password"
                      placeholder="Kosongkan jika tetap"
                      value={editMemberPassword}
                      onChange={(e) => setEditMemberPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">PIN Transaksi (6 Digit)</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={editMemberPin}
                      onChange={(e) => setEditMemberPin(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSubModal(null)}
                    className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveAdminProfile} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={editAdminNama}
                    onChange={(e) => setEditAdminNama(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">No. WhatsApp</label>
                    <input
                      type="tel"
                      required
                      value={editAdminWa}
                      onChange={(e) => setEditAdminWa(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">NIK Admin</label>
                    <input
                      type="text"
                      required
                      value={editAdminNik}
                      onChange={(e) => setEditAdminNik(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editAdminEmail}
                    onChange={(e) => setEditAdminEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Ganti Password (Opsional)</label>
                  <input
                    type="password"
                    placeholder="Kosongkan bila tidak diubah"
                    value={editAdminPassword}
                    onChange={(e) => setEditAdminPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSubModal(null)}
                    className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: DAFTAR PENGURUS KOPERASI ================= */}
      {subModal === 'daftar_admin' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-xl rounded-3xl p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  Daftar Pengurus & Administrator Koperasi
                </h3>
                <p className="text-[11px] text-slate-400">
                  Kelola struktur kepengurusan dan hak akses pengurus aplikasi
                </p>
              </div>
              <button onClick={() => setSubModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5 text-xs">
              {/* SECTION 1: ADMINISTRATOR APLIKASI */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-amber-400 text-xs">
                    Akun Administrator Aplikasi ({state.admins.length})
                  </div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setSubModal('tambah_admin')}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px]"
                    >
                      + Tambah Admin
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {state.admins.map((adm) => (
                    <div
                      key={adm.id}
                      className="p-3 bg-slate-800/90 rounded-2xl border border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white">{adm.nama}</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-black">
                            {adm.role.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          @{adm.username} • {adm.whatsapp} • Wilayah {adm.wilayahKantor}
                        </div>
                      </div>

                      {isSuperAdmin && adm.id !== currentAdmin?.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAdmin(adm.id)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-950 text-red-400 hover:text-red-300 border border-red-500/30 transition-all"
                          title="Hapus Administrator"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 2: STRUKTUR KEPENGURUSAN KOPERASI (Bisa Tambah / Kurang per User Req) */}
              <div className="pt-3 border-t border-slate-700/80">
                <div className="font-bold text-emerald-400 text-xs mb-2">
                  Daftar Pengurus Koperasi HWS
                </div>

                <div className="space-y-2">
                  {(state.profile.daftarPengurus || []).map((peng) => (
                    <div
                      key={peng.id}
                      className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[10px] text-amber-400 font-bold uppercase">
                          {peng.jabatan}
                        </div>
                        <div className="text-sm font-extrabold text-white mt-0.5">
                          {peng.nama}
                        </div>
                        {peng.kontak && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            Kontak: {peng.kontak}
                          </div>
                        )}
                      </div>

                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeletePengurus(peng.id)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-950 text-red-400 hover:text-red-300 border border-red-500/30 transition-all"
                          title="Hapus Pengurus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Form Tambah Pengurus */}
                {isSuperAdmin && (
                  <form onSubmit={handleAddPengurus} className="mt-3 p-3 bg-[#162035] rounded-2xl border border-slate-700 space-y-2">
                    <div className="font-bold text-white text-[11px]">+ Tambah Pengurus Koperasi</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400">Jabatan</label>
                        <input
                          type="text"
                          required
                          value={newPengurusJabatan}
                          onChange={(e) => setNewPengurusJabatan(e.target.value)}
                          placeholder="Contoh: Bendahara"
                          className="w-full p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">Nama Pengurus</label>
                        <input
                          type="text"
                          required
                          value={newPengurusNama}
                          onChange={(e) => setNewPengurusNama(e.target.value)}
                          placeholder="Nama lengkap"
                          className="w-full p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">No. Kontak / HP</label>
                        <input
                          type="text"
                          value={newPengurusKontak}
                          onChange={(e) => setNewPengurusKontak(e.target.value)}
                          placeholder="0812..."
                          className="w-full p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all"
                    >
                      Simpan Pengurus Baru
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: PROFIL, BIODATA & REKENING PENAMPUNGAN ================= */}
      {subModal === 'profil_koperasi' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-xl rounded-3xl p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  Biodata & Rekening Penampungan Koperasi HWS
                </h3>
                <p className="text-[11px] text-slate-400">
                  Data legalitas, alamat, visi misi, dan rekening penampungan koperasi
                </p>
              </div>
              <button onClick={() => setSubModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5 text-xs">
              {/* SECTION: BIODATA KOPERASI LENGKAP */}
              <form onSubmit={handleSaveBiodataKoperasi} className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-3">
                <div className="font-black text-amber-400 text-xs">Biodata & Legalitas Resmi</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] text-slate-400">Nama Koperasi</label>
                    <input
                      type="text"
                      required
                      value={bioNama}
                      onChange={(e) => setBioNama(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Badan Hukum (SK Kemenkumham)</label>
                    <input
                      type="text"
                      required
                      value={bioBadanHukum}
                      onChange={(e) => setBioBadanHukum(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400">NPWP Koperasi</label>
                    <input
                      type="text"
                      value={bioNpwp}
                      onChange={(e) => setBioNpwp(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">NIK Koperasi</label>
                    <input
                      type="text"
                      value={bioNik}
                      onChange={(e) => setBioNik(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Tanggal Pendirian</label>
                    <input
                      type="text"
                      value={bioTglPendirian}
                      onChange={(e) => setBioTglPendirian(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400">Alamat Kantor Koperasi</label>
                  <input
                    type="text"
                    required
                    value={bioAlamat}
                    onChange={(e) => setBioAlamat(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400">No. Telepon / WA</label>
                    <input
                      type="text"
                      value={bioTelepon}
                      onChange={(e) => setBioTelepon(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Email Resmi</label>
                    <input
                      type="email"
                      value={bioEmail}
                      onChange={(e) => setBioEmail(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Website</label>
                    <input
                      type="text"
                      value={bioWebsite}
                      onChange={(e) => setBioWebsite(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400">Visi Koperasi</label>
                  <input
                    type="text"
                    value={bioVisi}
                    onChange={(e) => setBioVisi(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400">Misi Koperasi</label>
                  <textarea
                    rows={2}
                    value={bioMisi}
                    onChange={(e) => setBioMisi(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>

                {isSuperAdmin && (
                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition-all"
                  >
                    Simpan Biodata Koperasi
                  </button>
                )}
              </form>

              {/* SECTION: REKENING BANK PENAMPUNGAN (BISA TAMBAH, KURANG & EDIT NOMOR / ATAS NAMA) */}
              <div className="space-y-3">
                <div className="font-bold text-sky-400 text-xs">
                  Rekening Bank Penampungan Koperasi ({state.profile.rekeningPenampungan.length})
                </div>

                <div className="space-y-2">
                  {state.profile.rekeningPenampungan.map((rek) => (
                    <div
                      key={rek.id}
                      className="p-3 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col gap-2"
                    >
                      {editingRekId === rek.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400">Bank</label>
                              <input
                                type="text"
                                value={editRekName}
                                onChange={(e) => setEditRekName(e.target.value)}
                                className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400">Nomor Rekening</label>
                              <input
                                type="text"
                                value={editRekNomor}
                                onChange={(e) => setEditRekNomor(e.target.value)}
                                className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400">Atas Nama</label>
                              <input
                                type="text"
                                value={editRekHolder}
                                onChange={(e) => setEditRekHolder(e.target.value)}
                                className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingRekId(null)}
                              className="px-2.5 py-1 bg-slate-700 text-slate-300 rounded-lg text-xs"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditRek(rek.id)}
                              className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs"
                            >
                              Simpan
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white text-xs">{rek.bankName}</div>
                            <div className="font-mono text-amber-400 font-bold text-sm">
                              {rek.accountNumber}
                            </div>
                            <div className="text-[10px] text-slate-400">a/n {rek.accountHolder}</div>
                          </div>

                          {isSuperAdmin && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRekId(rek.id);
                                  setEditRekName(rek.bankName);
                                  setEditRekNomor(rek.accountNumber);
                                  setEditRekHolder(rek.accountHolder);
                                }}
                                className="p-1.5 bg-slate-700 hover:bg-slate-600 text-amber-400 rounded-lg"
                                title="Edit Nomor Rekening / Atas Nama"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRekPenampungan(rek.id)}
                                className="p-1.5 bg-red-950/40 hover:bg-red-950 text-red-400 rounded-lg border border-red-500/30"
                                title="Hapus Rekening (Kurang)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Form Tambah Rekening Penampungan Baru */}
                {isSuperAdmin && (
                  <form onSubmit={handleAddRekPenampungan} className="p-3 bg-[#162035] rounded-2xl border border-slate-700 space-y-2">
                    <div className="font-bold text-white">+ Tambah Rekening Penampungan Baru</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400">Nama Bank</label>
                        <select
                          value={newBankName}
                          onChange={(e) => setNewBankName(e.target.value)}
                          className="w-full p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                        >
                          <option>Bank Central Asia (BCA)</option>
                          <option>Bank Mandiri</option>
                          <option>Bank Rakyat Indonesia (BRI)</option>
                          <option>Bank Negara Indonesia (BNI)</option>
                          <option>Bank Syariah Indonesia (BSI)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">Nomor Rekening</label>
                        <input
                          type="text"
                          required
                          value={newBankRek}
                          onChange={(e) => setNewBankRek(e.target.value)}
                          placeholder="Nomor rekening"
                          className="w-full p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Atas Nama</label>
                      <input
                        type="text"
                        required
                        value={newBankHolder}
                        onChange={(e) => setNewBankHolder(e.target.value)}
                        className="w-full p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl"
                    >
                      Simpan Rekening Baru
                    </button>
                  </form>
                )}
              </div>

              {/* QRIS Upload */}
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 space-y-2">
                <div className="font-bold text-amber-400">Foto / Scan QRIS Resmi Koperasi</div>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrisFile}
                    className="text-[11px] text-slate-300 file:py-1 file:px-2.5 file:rounded-lg file:bg-amber-500 file:border-0 file:font-bold file:text-slate-950"
                  />
                  {state.profile.qrisImageUrl && (
                    <img
                      src={state.profile.qrisImageUrl}
                      alt="QRIS"
                      className="w-12 h-12 object-contain rounded-lg border border-slate-600 bg-white p-0.5"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: TAMBAH ADMIN BARU ================= */}
      {subModal === 'tambah_admin' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-sm font-extrabold text-white">Tambah Pengurus / Admin Baru</h3>
              <button onClick={() => setSubModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAdminSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Username Admin *</label>
                <input
                  type="text"
                  required
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  placeholder="Contoh: andi_admin"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={newAdminNama}
                  onChange={(e) => setNewAdminNama(e.target.value)}
                  placeholder="Nama Pengurus"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">NIK Pengurus</label>
                  <input
                    type="text"
                    required
                    value={newAdminNik}
                    onChange={(e) => setNewAdminNik(e.target.value)}
                    placeholder="16 digit NIK"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">No. WhatsApp</label>
                  <input
                    type="tel"
                    required
                    value={newAdminWa}
                    onChange={(e) => setNewAdminWa(e.target.value)}
                    placeholder="0812..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Email Pengurus (Harus Unik) *</label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="email.admin@hws.koperasi.id"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Peran / Hak Akses *</label>
                  <select
                    value={newAdminRole}
                    onChange={(e) => setNewAdminRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="admin_write">Admin Write (Input & Verifikasi)</option>
                    <option value="admin_kelola">Admin Kelola (Approval Kas & Anggota)</option>
                    <option value="admin_laporan">Admin Laporan (Hanya Unduh)</option>
                    <option value="super_admin">Super Admin (Akses Penuh)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Wilayah Kantor</label>
                  <select
                    value={newAdminWilayah}
                    onChange={(e) => setNewAdminWilayah(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="Cengkareng">Cengkareng</option>
                    <option value="Kalideres">Kalideres</option>
                    <option value="Kembangan">Kembangan</option>
                    <option value="Kebon Jeruk">Kebon Jeruk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Password Masuk</label>
                <input
                  type="text"
                  required
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubModal(null)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 text-slate-950 font-black rounded-xl shadow"
                >
                  Daftarkan Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: LOG AUDIT (60 HARI) ================= */}
      {subModal === 'log_audit' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-2xl rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  Log Audit Aktivitas Sistem (Tersimpan 60 Hari)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Rekaman seluruh aksi login, verifikasi, perubahan kas, dan penyesuaian saldo
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportAuditPdf}
                  className="py-1 px-3 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl"
                >
                  Cetak PDF
                </button>
                <button onClick={() => setSubModal(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left divide-y divide-slate-800">
                <thead>
                  <tr className="text-slate-400 text-[10px] uppercase">
                    <th className="py-2">Waktu</th>
                    <th className="py-2">Admin</th>
                    <th className="py-2">Aksi</th>
                    <th className="py-2">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {state.auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2 font-mono text-slate-400">{log.timestamp.slice(0, 19).replace('T', ' ')}</td>
                      <td className="py-2 font-bold text-white">{log.adminNama}</td>
                      <td className="py-2 text-amber-400 font-semibold">{log.action}</td>
                      <td className="py-2 text-slate-300">{log.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: PENYESUAIAN SALDO ================= */}
      {subModal === 'sesuaikan_saldo' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-3">
              <h3 className="text-sm font-extrabold text-white">Penyesuaian Saldo Anggota</h3>
              <button onClick={() => setSubModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePenyesuaianSaldoSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Pilih Anggota</label>
                <select
                  value={adjMemberId}
                  onChange={(e) => setAdjMemberId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  {state.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama} ({m.nomorAnggota} - Saldo Umum: {formatRupiah(m.saldoUmum)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Aksi Penyesuaian</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjTipe('tambah')}
                    className={`py-2 rounded-xl font-bold border ${
                      adjTipe === 'tambah'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    + Tambah ke Anggota (Keluar Kas Koperasi)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjTipe('tarik')}
                    className={`py-2 rounded-xl font-bold border ${
                      adjTipe === 'tarik'
                        ? 'bg-red-500/20 border-red-500 text-red-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    - Tarik dari Anggota (Masuk Kas Koperasi)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={adjNominal}
                  onChange={(e) => setAdjNominal(e.target.value)}
                  placeholder="Ketik nominal rupiah"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Keterangan / Alasan</label>
                <input
                  type="text"
                  required
                  value={adjKeterangan}
                  onChange={(e) => setAdjKeterangan(e.target.value)}
                  placeholder="Contoh: Koreksi selisih transfer bank"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubModal(null)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 text-slate-950 font-black rounded-xl"
                >
                  Proses Penyesuaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: CLOUD SERVER FIREBASE & GOOGLE DRIVE ================= */}
      {(subModal === 'cloud_server' || subModal === 'google_drive') && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl text-xs space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
              <h3 className="font-extrabold text-white text-sm">
                {subModal === 'cloud_server' ? 'Server Firebase Firestore Realtime' : 'Cadangan Google Drive Online'}
              </h3>
              <button onClick={() => setSubModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Status Server: <b>ONLINE & TERSINKRONISASI AKTIF</b></span>
            </div>
            <div className="space-y-1 text-slate-300">
              <div>• Sinkronisasi multi-klien (Android, iOS, PC, Web) aktif via SSE.</div>
              <div>• Database persisten tersimpan aman dan tidak akan hilang saat restart.</div>
              <div>• Waktu sinkronisasi terakhir: {state.serverSyncStatus.lastSynced}</div>
            </div>
            <button
              onClick={() => {
                window.location.href = '/api/backup';
              }}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
            >
              Unduh File Cadangan Database (.json)
            </button>
          </div>
        </div>
      )}

      {/* ================= SUB-MODAL: INSTALL PWA ================= */}
      {subModal === 'install_pwa' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-md rounded-3xl p-5 shadow-2xl text-xs space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
              <h3 className="font-extrabold text-white text-sm">Instal Aplikasi Koperasi HWS</h3>
              <button onClick={() => setSubModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-800 rounded-2xl space-y-2 text-slate-300 leading-relaxed">
              <div className="font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Aplikasi Web Progresif (PWA) Resmi
              </div>
              <div>
                <b>Android (Chrome):</b> Ketuk menu tiga titik (⋮) di kanan atas browser, lalu pilih <b>"Tambahkan ke Layar Utama"</b> atau <b>"Instal Aplikasi"</b>.
              </div>
              <div>
                <b>iOS / iPhone (Safari):</b> Ketuk tombol <b>Share (Bagikan)</b> di bawah, lalu pilih <b>"Add to Home Screen (Tambah ke Layar Utama)"</b>.
              </div>
              <div>
                <b>PC / Laptop (Chrome / Edge):</b> Klik ikon instal komputer di bilah alamat browser di kanan atas.
              </div>
            </div>
            <button
              onClick={() => {
                alert('Aplikasi siap diinstal langsung dari menu browser Anda!');
                setSubModal(null);
              }}
              className="w-full py-2 bg-emerald-500 text-slate-950 font-extrabold rounded-xl"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
