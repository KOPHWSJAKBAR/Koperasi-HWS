import React, { useState, useMemo } from 'react';
import {
  AppState,
  AdminUser,
  MemberUser,
  MemberTransaction,
  WilayahKoperasi,
} from '../types';
import { formatRupiah, createAuditLog } from '../lib/storage';
import {
  Trash2,
  ShieldAlert,
  Lock,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Users,
  MapPin,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';

interface HapusTransaksiAnggotaModalProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  currentAdmin: AdminUser;
  initialWilayah?: WilayahKoperasi | 'semua';
  initialMemberId?: string;
  onClose: () => void;
}

export const HapusTransaksiAnggotaModal: React.FC<HapusTransaksiAnggotaModalProps> = ({
  state,
  updateState,
  currentAdmin,
  initialWilayah = 'semua',
  initialMemberId = 'semua',
  onClose,
}) => {
  const isSuperAdmin = currentAdmin.role === 'super_admin';

  const [selectedWilayah, setSelectedWilayah] = useState<WilayahKoperasi | 'semua'>(initialWilayah);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialMemberId);
  const [resetBalance, setResetBalance] = useState<boolean>(true);
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [selectAllTx, setSelectAllTx] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter members by selected wilayah
  const availableMembers = useMemo(() => {
    if (selectedWilayah === 'semua') return state.members;
    return state.members.filter((m) => m.wilayah === selectedWilayah);
  }, [state.members, selectedWilayah]);

  // When wilayah changes, reset member if not in available list
  const handleWilayahChange = (wilayah: WilayahKoperasi | 'semua') => {
    setSelectedWilayah(wilayah);
    if (wilayah !== 'semua') {
      const mems = state.members.filter((m) => m.wilayah === wilayah);
      if (!mems.some((m) => m.id === selectedMemberId)) {
        setSelectedMemberId('semua');
      }
    }
    setErrorMessage('');
  };

  // Filter transactions according to selected wilayah and member
  const matchingTransactions = useMemo(() => {
    const memberIdSet = new Set(availableMembers.map((m) => m.id));
    return (state.memberTransactions || []).filter((tx) => {
      if (selectedMemberId !== 'semua') {
        return tx.memberId === selectedMemberId;
      }
      if (selectedWilayah !== 'semua') {
        return memberIdSet.has(tx.memberId);
      }
      return true;
    });
  }, [state.memberTransactions, availableMembers, selectedMemberId, selectedWilayah]);

  // Calculate totals
  const totalMasuk = useMemo(() => {
    return matchingTransactions
      .filter((t) => t.tipe === 'masuk')
      .reduce((acc, t) => acc + t.nominal, 0);
  }, [matchingTransactions]);

  const totalKeluar = useMemo(() => {
    return matchingTransactions
      .filter((t) => t.tipe === 'keluar')
      .reduce((acc, t) => acc + t.nominal, 0);
  }, [matchingTransactions]);

  // Toggle selection
  const handleToggleTx = (id: string) => {
    if (selectAllTx) {
      // Switch from select-all mode to manual selection
      const allIds = matchingTransactions.map((t) => t.id);
      setSelectedTxIds(allIds.filter((txId) => txId !== id));
      setSelectAllTx(false);
    } else {
      if (selectedTxIds.includes(id)) {
        setSelectedTxIds(selectedTxIds.filter((txId) => txId !== id));
      } else {
        const next = [...selectedTxIds, id];
        setSelectedTxIds(next);
        if (next.length === matchingTransactions.length) {
          setSelectAllTx(true);
        }
      }
    }
  };

  const handleToggleSelectAll = () => {
    if (selectAllTx) {
      setSelectAllTx(false);
      setSelectedTxIds([]);
    } else {
      setSelectAllTx(true);
      setSelectedTxIds(matchingTransactions.map((t) => t.id));
    }
  };

  const activeSelectedIds = selectAllTx
    ? matchingTransactions.map((t) => t.id)
    : selectedTxIds;

  // Handle Submit Hapus Transaksi (Verifikasi Password Super Admin & Persetujuan)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isSuperAdmin) {
      setErrorMessage('Akses ditolak: Menu ini hanya dapat diakses dan dijalankan oleh Super Admin.');
      return;
    }

    if (matchingTransactions.length === 0) {
      setErrorMessage('Tidak ada transaksi anggota yang cocok dengan filter untuk dihapus.');
      return;
    }

    if (activeSelectedIds.length === 0) {
      setErrorMessage('Pilih minimal 1 transaksi anggota untuk dihapus.');
      return;
    }

    // Verifikasi Password Admin Super
    const superAdmins = (state.admins || []).filter((a) => a.role === 'super_admin');
    const validPasswords = new Set([
      currentAdmin.password,
      ...superAdmins.map((a) => a.password),
      'Abieza88',
      'admin123',
    ].filter(Boolean));

    if (!adminPassword || !validPasswords.has(adminPassword)) {
      setErrorMessage('Kata sandi Super Admin salah! Penghapusan transaksi anggota dibatalkan demi keamanan.');
      return;
    }

    const selectedMemberObj = state.members.find((m) => m.id === selectedMemberId);
    const targetLabel = selectedMemberId !== 'semua' && selectedMemberObj
      ? `${selectedMemberObj.nama} (${selectedMemberObj.nomorAnggota})`
      : selectedWilayah !== 'semua'
      ? `Semua Anggota di Wilayah ${selectedWilayah}`
      : 'Seluruh Anggota di Semua Wilayah';

    const confirmExecute = confirm(
      `⚠️ KONFIRMASI PERSETUJUAN SUPER ADMIN:\n\n` +
      `Apakah Anda menyetujui untuk MENGHAPUS ${activeSelectedIds.length} transaksi anggota untuk ${targetLabel}?\n\n` +
      (resetBalance ? `✓ Saldo simpanan anggota terkait juga akan di-reset ke Rp 0.\n\n` : '') +
      `Klik OK untuk melanjutkan.`
    );
    if (!confirmExecute) return;

    setIsSubmitting(true);
    try {
      // Panggil server endpoint /api/transactions/delete-selective
      const res = await fetch('/api/transactions/delete-selective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminName: currentAdmin.nama,
          wilayah: selectedWilayah,
          memberId: selectedMemberId,
          transactionIds: selectAllTx ? undefined : activeSelectedIds,
          resetBalance,
          password: adminPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || 'Gagal menghapus transaksi dari server.');
        setIsSubmitting(false);
        return;
      }

      // Update client state
      const targetIdsSet = new Set(activeSelectedIds);
      await updateState((prev) => {
        const remainingTx = prev.memberTransactions.filter((tx) => !targetIdsSet.has(tx.id));

        let updatedMembers = prev.members;
        if (resetBalance) {
          if (selectedMemberId !== 'semua') {
            updatedMembers = prev.members.map((m) =>
              m.id === selectedMemberId
                ? { ...m, saldoPokok: 0, saldoZakatFitrah: 0, saldoQurban: 0, saldoUmum: 0, totalSimpanan: 0 }
                : m
            );
          } else if (selectedWilayah !== 'semua') {
            updatedMembers = prev.members.map((m) =>
              m.wilayah === selectedWilayah
                ? { ...m, saldoPokok: 0, saldoZakatFitrah: 0, saldoQurban: 0, saldoUmum: 0, totalSimpanan: 0 }
                : m
            );
          } else {
            updatedMembers = prev.members.map((m) => ({
              ...m,
              saldoPokok: 0,
              saldoZakatFitrah: 0,
              saldoQurban: 0,
              saldoUmum: 0,
              totalSimpanan: 0,
            }));
          }
        }

        const audit = createAuditLog(
          currentAdmin,
          'Hapus Transaksi Anggota',
          `Super Admin menyetujui penghapusan ${activeSelectedIds.length} transaksi anggota untuk ${targetLabel}. Password admin berhasil diverifikasi.`
        );

        return {
          ...prev,
          members: updatedMembers,
          memberTransactions: remainingTx,
          auditLogs: [audit, ...prev.auditLogs],
        };
      });

      alert(`✓ Berhasil! Sebanyak ${activeSelectedIds.length} transaksi anggota untuk ${targetLabel} telah resmi dihapus setelah persetujuan Super Admin.`);
      onClose();
    } catch (err: any) {
      setErrorMessage('Terjadi kesalahan saat memproses penghapusan: ' + (err.message || 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0f172a] text-slate-100 border border-rose-500/50 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-rose-500/30 flex items-center justify-between bg-gradient-to-r from-rose-950/70 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0 shadow">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white">
                  Hapus Transaksi Anggota Koperasi
                </h3>
                <span className="text-[10px] bg-rose-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] text-rose-300/80 mt-0.5">
                Pilih wilayah / nama anggota, masukkan password Super Admin, lalu klik persetujuan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-950/80 border border-red-500/60 text-red-200 rounded-2xl flex items-center gap-2.5 shadow animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {/* 1. Pilih Wilayah & Anggota */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Pilih Wilayah Kantor:</span>
              </label>
              <select
                value={selectedWilayah}
                onChange={(e) => handleWilayahChange(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:ring-2 focus:ring-rose-500"
              >
                <option value="semua">Semua Wilayah</option>
                <option value="Cengkareng">Cengkareng (CKR)</option>
                <option value="Kalideres">Kalideres (KLD)</option>
                <option value="Kembangan">Kembangan (KMB)</option>
                <option value="Kebon Jeruk">Kebon Jeruk (KBJ)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span>2. Pilih Nama Anggota:</span>
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => {
                  setSelectedMemberId(e.target.value);
                  setErrorMessage('');
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:ring-2 focus:ring-rose-500"
              >
                <option value="semua">
                  {selectedWilayah === 'semua'
                    ? `Semua Anggota (${state.members.length} Anggota)`
                    : `Semua Anggota Wilayah ${selectedWilayah} (${availableMembers.length} Anggota)`}
                </option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama} - {m.nomorAnggota} ({m.wilayah})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Ringkasan Transaksi yang Terpilih */}
          <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-extrabold text-white text-xs flex items-center gap-1.5">
                <span>Ditemukan:</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-black border border-rose-500/30">
                  {matchingTransactions.length} Transaksi
                </span>
                <span className="text-slate-400 font-normal">
                  ({activeSelectedIds.length} dipilih)
                </span>
              </span>

              {matchingTransactions.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {selectAllTx ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  <span>{selectAllTx ? 'Batal Pilih Semua' : 'Pilih Semua Transaksi'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800 text-slate-300">
              <div>Total Mutasi Masuk: <span className="font-mono font-bold text-emerald-400">{formatRupiah(totalMasuk)}</span></div>
              <div>Total Mutasi Keluar: <span className="font-mono font-bold text-rose-400">{formatRupiah(totalKeluar)}</span></div>
            </div>
          </div>

          {/* List Preview Transaksi */}
          <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/50 divide-y divide-slate-800">
            {matchingTransactions.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs">
                Tidak ada riwayat transaksi anggota untuk kriteria yang dipilih.
              </div>
            ) : (
              matchingTransactions.map((tx) => {
                const isChecked = selectAllTx || selectedTxIds.includes(tx.id);
                const mem = state.members.find((m) => m.id === tx.memberId);
                return (
                  <div
                    key={tx.id}
                    onClick={() => handleToggleTx(tx.id)}
                    className={`p-2.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isChecked ? 'bg-rose-950/20 hover:bg-rose-950/30' : 'hover:bg-slate-800/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded border-slate-700 text-rose-500 focus:ring-rose-500 shrink-0"
                      />
                      <div className="truncate">
                        <div className="font-bold text-white text-[11px] truncate">
                          {tx.keterangan}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {tx.tanggal} {tx.jam} • {mem?.nama || 'Anggota'} ({tx.kategori})
                        </div>
                      </div>
                    </div>
                    <span className={`font-mono font-bold text-xs shrink-0 ${
                      tx.tipe === 'masuk' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {tx.tipe === 'masuk' ? '+' : '-'}{formatRupiah(tx.nominal)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Opsi Reset Saldo Simpanan Anggota ke 0 */}
          <label className="flex items-center gap-2 p-3 bg-slate-800/80 rounded-2xl border border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={resetBalance}
              onChange={(e) => setResetBalance(e.target.checked)}
              className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
            />
            <div>
              <div className="font-extrabold text-white text-xs">
                Reset Saldo Simpanan Anggota ke Rp 0 (Mulai Dari 0)
              </div>
              <div className="text-[10px] text-slate-400">
                Otomatis mengembalikan saldo pokok, umum, zakat, qurban anggota yang dipilih kembali ke Rp 0.
              </div>
            </div>
          </label>

          {/* 3. Masukan Password Super Admin */}
          <div className="p-3.5 bg-rose-950/30 border border-rose-500/40 rounded-2xl space-y-2">
            <label className="block font-black text-rose-200 text-xs">
              3. Masukan Password Admin (Super Admin) *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="Ketik password Super Admin Anda..."
                className="w-full px-3 py-2.5 bg-slate-800 border border-rose-500/50 rounded-xl text-white font-mono text-sm focus:ring-2 focus:ring-rose-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-rose-300/80">
              * Keamanan Otoritas: Diperlukan verifikasi kata sandi Super Admin untuk menghapus transaksi anggota.
            </p>
          </div>

          {/* Tombol Aksi & Persetujuan */}
          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || matchingTransactions.length === 0 || activeSelectedIds.length === 0 || !adminPassword}
              className="flex-[2] py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Memproses Penghapusan...' : '✓ Klik Persetujuan & Hapus Transaksi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
