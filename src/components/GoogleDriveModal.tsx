import React, { useState, useEffect } from 'react';
import {
  DriveFileItem,
  connectGoogleDrive,
  disconnectGoogleDrive,
  getDriveAccessToken,
  getDriveUser,
  initGoogleDriveAuth,
  listDriveFiles,
  backupDatabaseToDrive,
  exportKasToDriveSpreadsheet,
  uploadCustomFileToDrive,
  deleteDriveFile,
  ensureKoperasiDriveFolder,
} from '../lib/googleDrive';
import { AppState, AdminUser } from '../types';
import {
  HardDrive,
  X,
  RefreshCw,
  Upload,
  Database,
  FileSpreadsheet,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Folder,
  FileText,
  LogOut,
} from 'lucide-react';

interface GoogleDriveModalProps {
  state: AppState;
  currentAdmin?: AdminUser;
  onClose: () => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  state,
  currentAdmin,
  onClose,
}) => {
  const [token, setToken] = useState<string | null>(getDriveAccessToken());
  const [user, setUser] = useState(getDriveUser());
  const [isConnecting, setIsConnecting] = useState(false);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);

  // Initialize listener
  useEffect(() => {
    const unsubscribe = initGoogleDriveAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fetch files when token is available
  const loadFiles = async (tok: string) => {
    setIsLoadingFiles(true);
    setStatusMsg(null);
    try {
      const fId = await ensureKoperasiDriveFolder(tok);
      setFolderId(fId);
      const list = await listDriveFiles(tok, fId);
      setFiles(list);
    } catch (err: any) {
      console.error('Error loading Drive files:', err);
      setStatusMsg({ type: 'error', text: err.message || 'Gagal memuat file Google Drive' });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadFiles(token);
    }
  }, [token]);

  // Handle Connect with Google OAuth
  const handleConnect = async () => {
    setIsConnecting(true);
    setStatusMsg(null);
    try {
      const res = await connectGoogleDrive();
      setToken(res.accessToken);
      setUser(res.user);
      setStatusMsg({
        type: 'success',
        text: `✓ Terhubung dengan Google Drive akun: ${res.user.email}`,
      });
      await loadFiles(res.accessToken);
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Koneksi ke Google Drive dibatalkan atau gagal.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle Disconnect
  const handleDisconnect = async () => {
    await disconnectGoogleDrive();
    setToken(null);
    setUser(null);
    setFiles([]);
    setStatusMsg({ type: 'success', text: 'Koneksi Google Drive telah diputus.' });
  };

  // Handle Backup Database to Drive
  const handleBackupToDrive = async () => {
    if (!token) return;
    setIsBackingUp(true);
    setStatusMsg(null);
    try {
      const result = await backupDatabaseToDrive(token, state);
      setStatusMsg({
        type: 'success',
        text: `✓ Berhasil mencadangkan database ke Google Drive: "${result.name}"`,
      });
      await loadFiles(token);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Gagal mencadangkan ke Google Drive.' });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Handle Export Kas to Google Sheets
  const handleExportSheets = async () => {
    if (!token) return;
    setIsExportingSheets(true);
    setStatusMsg(null);
    try {
      const result = await exportKasToDriveSpreadsheet(token, state.kasList, state.profile.nama);
      setStatusMsg({
        type: 'success',
        text: `✓ Berhasil mengekspor Buku Kas ke Google Spreadsheet: "${result.name}"`,
      });
      await loadFiles(token);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Gagal mengekspor ke Google Sheets.' });
    } finally {
      setIsExportingSheets(false);
    }
  };

  // Handle Custom File Upload
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setIsLoadingFiles(true);
    setStatusMsg(null);
    try {
      const result = await uploadCustomFileToDrive(token, file);
      setStatusMsg({
        type: 'success',
        text: `✓ File "${result.name}" berhasil diunggah ke folder Google Drive Koperasi HWS!`,
      });
      await loadFiles(token);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Gagal mengunggah file.' });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Handle Delete File
  const handleDelete = async (file: DriveFileItem) => {
    if (!token) return;
    try {
      await deleteDriveFile(token, file.id, file.name);
      setStatusMsg({ type: 'success', text: `✓ File "${file.name}" berhasil dihapus dari Google Drive.` });
      await loadFiles(token);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Gagal menghapus file.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-700/80 w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl my-4 text-xs space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                Integrasi Google Drive & Sheets
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase">
                  Workspace Resmi
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Penyimpanan cadangan database cloud, ekspor laporan spreadsheet & arsip dokumen koperasi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/80 border-red-500/40 text-red-200'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span className="text-xs">{statusMsg.text}</span>
          </div>
        )}

        {/* AUTHENTICATION STATE */}
        {!token ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400">
              <HardDrive className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="font-extrabold text-white text-sm">
                Hubungkan Akun Google Drive Koperasi
              </h4>
              <p className="text-slate-400 text-xs">
                Hubungkan Google Drive untuk menyimpan cadangan snapshot database otomatis, membuat file Google Sheets jurnal kas, dan mengamankan arsip dokumen secara cloud online realtime.
              </p>
            </div>

            {/* Official Google Sign-in Button per Workspace Skill */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                disabled={isConnecting}
                onClick={handleConnect}
                className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-2xl shadow-xl flex items-center gap-3 transition-all border border-slate-300 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span className="text-sm font-bold text-slate-800">
                  {isConnecting ? 'Menghubungkan...' : 'Sign in with Google Drive'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Account Info Card */}
            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google User'}
                    className="w-10 h-10 rounded-full border border-amber-500/40"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center">
                    G
                  </div>
                )}
                <div>
                  <div className="font-bold text-white text-xs sm:text-sm">
                    {user?.displayName || 'Pengurus Koperasi'}
                  </div>
                  <div className="text-[11px] text-sky-400 font-mono">{user?.email}</div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Google Drive Terhubung Aktif
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadFiles(token)}
                  disabled={isLoadingFiles}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold flex items-center gap-1.5 transition-all"
                  title="Segarkan daftar file"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  Segarkan
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 rounded-xl font-bold flex items-center gap-1.5 transition-all"
                  title="Putuskan koneksi Google Drive"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  Putuskan
                </button>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Backup Database */}
              <button
                type="button"
                disabled={isBackingUp}
                onClick={handleBackupToDrive}
                className="p-3 bg-[#131f38] hover:bg-[#1a2b4e] border border-slate-700 rounded-2xl text-left transition-all space-y-1.5 group disabled:opacity-50"
              >
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-white text-xs group-hover:text-amber-400 transition-colors">
                    {isBackingUp ? 'Menyimpan...' : 'Cadangkan Database'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Upload snapshot JSON ke folder Drive
                  </div>
                </div>
              </button>

              {/* Export Google Sheets */}
              <button
                type="button"
                disabled={isExportingSheets}
                onClick={handleExportSheets}
                className="p-3 bg-[#131f38] hover:bg-[#1a2b4e] border border-slate-700 rounded-2xl text-left transition-all space-y-1.5 group disabled:opacity-50"
              >
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-white text-xs group-hover:text-emerald-400 transition-colors">
                    {isExportingSheets ? 'Mengekspor...' : 'Ekspor Google Sheets'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Buat spreadsheet Buku Kas di Drive
                  </div>
                </div>
              </button>

              {/* Upload File Dokumen */}
              <label className="p-3 bg-[#131f38] hover:bg-[#1a2b4e] border border-slate-700 rounded-2xl text-left transition-all space-y-1.5 group cursor-pointer block">
                <div className="w-7 h-7 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-white text-xs group-hover:text-sky-400 transition-colors">
                    Upload File / Dokumen
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Simpan surat, KTA, berkas ke Drive
                  </div>
                </div>
                <input
                  type="file"
                  onChange={handleUploadFile}
                  className="hidden"
                />
              </label>
            </div>

            {/* FOLDER INFO & FILE LIST */}
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-white text-xs">
                    Folder: Koperasi HWS - Cloud Storage
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {files.length} file tersimpan
                </span>
              </div>

              {isLoadingFiles ? (
                <div className="text-center py-6 text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Memuat daftar file dari Google Drive...</span>
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Belum ada file di folder Google Drive Koperasi HWS. Klik "Cadangkan Database" atau "Ekspor Google Sheets" di atas untuk menyimpan file pertama.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 max-h-60 overflow-y-auto">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="py-2.5 px-1.5 flex items-center justify-between gap-2 hover:bg-slate-800/50 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {file.mimeType.includes('spreadsheet') ? (
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : file.mimeType.includes('json') ? (
                          <Database className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-white text-xs truncate max-w-xs sm:max-w-md">
                            {file.name}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{file.size || 'Google Doc'}</span>
                            {file.modifiedTime && <span>• Diperbarui: {file.modifiedTime}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg transition-all"
                            title="Buka di Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(file)}
                          className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-lg transition-all"
                          title="Hapus file dari Google Drive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
