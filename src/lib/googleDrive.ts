import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from './firebase';
import { AppState, KasEntry } from '../types';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

const provider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory token storage (per Google Workspace security guidelines)
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;
let isSigningIn = false;

// Initialize Google Drive Auth Listener
export function initGoogleDriveAuth(
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void
) {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      cachedGoogleUser = user;
      if (onSuccess) onSuccess(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedGoogleUser = null;
      cachedAccessToken = null;
      if (onFailure) onFailure();
    }
  });
}

// Connect / Sign-in to Google Drive via Popup
export async function connectGoogleDrive(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google OAuth');
    }

    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Koneksi Google Drive error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

// Disconnect / Sign-out from Google Drive
export async function disconnectGoogleDrive(): Promise<void> {
  try {
    await signOut(auth);
  } finally {
    cachedAccessToken = null;
    cachedGoogleUser = null;
  }
}

// Get current in-memory access token
export function getDriveAccessToken(): string | null {
  return cachedAccessToken;
}

// Get current Google User
export function getDriveUser(): User | null {
  return cachedGoogleUser;
}

// Ensure "Koperasi HWS - Cloud Storage" folder exists in Drive
export async function ensureKoperasiDriveFolder(accessToken: string): Promise<string> {
  const folderName = 'Koperasi HWS - Cloud Storage';
  const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Folder penyimpanan cadangan database dan dokumen resmi Koperasi HWS',
    }),
  });

  if (!createRes.ok) {
    throw new Error('Gagal membuat folder Koperasi HWS di Google Drive');
  }

  const folderData = await createRes.json();
  return folderData.id;
}

// List files from Google Drive
export async function listDriveFiles(
  accessToken: string,
  folderId?: string
): Promise<DriveFileItem[]> {
  let query = 'trashed = false';
  if (folderId) {
    query += ` and '${folderId}' in parents`;
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal memuat daftar file dari Google Drive');
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? `${(Number(f.size) / 1024).toFixed(1)} KB` : undefined,
    modifiedTime: f.modifiedTime ? new Date(f.modifiedTime).toLocaleString('id-ID') : undefined,
    webViewLink: f.webViewLink,
    thumbnailLink: f.thumbnailLink,
  }));
}

// Backup App Database JSON Snapshot to Google Drive
export async function backupDatabaseToDrive(
  accessToken: string,
  state: AppState
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const folderId = await ensureKoperasiDriveFolder(accessToken);
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-');
  const fileName = `Backup_Database_Koperasi_HWS_${dateStr}.json`;

  const payload = JSON.stringify(
    {
      ...state,
      exportedAt: now.toISOString(),
      source: 'Koperasi HWS Web & Mobile',
    },
    null,
    2
  );

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
    description: `Cadangan snapshot database lengkap Koperasi HWS per tanggal ${now.toLocaleDateString('id-ID')}`,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([payload], { type: 'application/json' }));

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal mengunggah cadangan ke Google Drive');
  }

  const result = await res.json();
  return {
    id: result.id,
    name: result.name,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
  };
}

// Export Kas Entries as Google Spreadsheet into Google Drive
export async function exportKasToDriveSpreadsheet(
  accessToken: string,
  kasList: KasEntry[],
  koperasiNama: string
): Promise<{ id: string; name: string; spreadsheetUrl: string }> {
  const folderId = await ensureKoperasiDriveFolder(accessToken);
  const now = new Date();
  const title = `Buku_Kas_${koperasiNama.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}`;

  // 1. Create a Google Sheet via Sheets API
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: 'Jurnal Kas Koperasi',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal membuat Google Spreadsheet');
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  // 2. Populate Rows in Google Sheets
  const rows: any[][] = [
    ['Tanggal', 'Buku Kas', 'Kategori', 'Keterangan', 'Pihak Terkait', 'Tipe Mutasi', 'Nominal (Rp)', 'Petugas', 'Status'],
  ];

  kasList.forEach((k) => {
    rows.push([
      k.tanggal,
      k.bukuKas === 'koperasi' ? 'Kas Koperasi' : 'Kas Anggota',
      k.kategori,
      k.keterangan,
      k.namaPenerima || '-',
      k.tipe === 'masuk' ? 'Pemasukan (CR)' : 'Pengeluaran (DB)',
      k.nominal,
      k.inputBy,
      k.status,
    ]);
  });

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: 'A1',
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  // 3. Move file to Koperasi HWS folder in Drive
  try {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${folderId}&fields=id,parents`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  } catch {}

  return {
    id: spreadsheetId,
    name: title,
    spreadsheetUrl: spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

// Upload Custom File to Google Drive
export async function uploadCustomFileToDrive(
  accessToken: string,
  file: File,
  description?: string
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const folderId = await ensureKoperasiDriveFolder(accessToken);

  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    parents: [folderId],
    description: description || `Dokumen diunggah ke Google Drive Koperasi HWS pada ${new Date().toLocaleString('id-ID')}`,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal mengunggah file ke Google Drive');
  }

  const result = await res.json();
  return {
    id: result.id,
    name: result.name,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
  };
}

// Delete file from Google Drive (Mandatory user confirmation per skill)
export async function deleteDriveFile(
  accessToken: string,
  fileId: string,
  fileName: string
): Promise<void> {
  const confirmed = window.confirm(
    `Apakah Anda yakin ingin menghapus file "${fileName}" dari Google Drive? Tindakan ini tidak dapat dibatalkan.`
  );
  if (!confirmed) return;

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal menghapus file dari Google Drive');
  }
}
