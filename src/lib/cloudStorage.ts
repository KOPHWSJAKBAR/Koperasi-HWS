/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, logAnalyticsEvent } from './firebase';

export interface UploadOptions {
  folder?: string;
  customFileName?: string;
  contentType?: string;
}

const STORAGE_UPLOAD_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Upload a File object or Base64 Data URL to Google Cloud / Firebase Storage.
 * Returns public HTTPS download URL or a resilient fallback URL.
 */
export async function uploadToCloudStorage(
  fileOrDataUrl: File | Blob | string,
  options: UploadOptions = {}
): Promise<string> {
  const folder = options.folder || 'uploads';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  // 1. If it's a base64 Data URL
  if (typeof fileOrDataUrl === 'string') {
    if (!fileOrDataUrl.startsWith('data:')) {
      // Already an HTTP or Cloud Storage URL
      return fileOrDataUrl;
    }

    try {
      // Determine file extension and MIME type
      const mimeMatch = fileOrDataUrl.match(/^data:([^;]+);base64,/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      let ext = 'jpg';
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('pdf')) ext = 'pdf';

      const fileName = options.customFileName || `${timestamp}_${randomSuffix}.${ext}`;
      const storagePath = `${folder}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      // Upload directly to Firebase Storage bucket with timeout guard
      await withTimeout(
        uploadString(storageRef, fileOrDataUrl, 'data_url', {
          contentType: mime,
        }),
        STORAGE_UPLOAD_TIMEOUT_MS,
        'Firebase Storage uploadString'
      );

      const downloadUrl = await withTimeout(
        getDownloadURL(storageRef),
        STORAGE_UPLOAD_TIMEOUT_MS,
        'Firebase Storage getDownloadURL'
      );
      logAnalyticsEvent('file_uploaded', { folder, type: 'data_url', ext });
      return downloadUrl;
    } catch (err) {
      console.warn('[Cloud Storage] Upload string notice, using persistent fallback:', err);
      // Fallback: return data URL safely
      return fileOrDataUrl;
    }
  }

  // 2. If it's a File or Blob
  try {
    const file = fileOrDataUrl as File;
    const name = options.customFileName || `${timestamp}_${randomSuffix}_${file.name || 'file.bin'}`;
    const storagePath = `${folder}/${name}`;
    const storageRef = ref(storage, storagePath);

    await withTimeout(
      uploadBytes(storageRef, file, {
        contentType: options.contentType || file.type || 'application/octet-stream',
      }),
      STORAGE_UPLOAD_TIMEOUT_MS,
      'Firebase Storage uploadBytes'
    );

    const downloadUrl = await withTimeout(
      getDownloadURL(storageRef),
      STORAGE_UPLOAD_TIMEOUT_MS,
      'Firebase Storage getDownloadURL'
    );
    logAnalyticsEvent('file_uploaded', { folder, type: 'binary', name });
    return downloadUrl;
  } catch (err) {
    console.warn('[Cloud Storage] Upload binary notice, converting to DataURL fallback:', err);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrDataUrl);
    });
  }
}
