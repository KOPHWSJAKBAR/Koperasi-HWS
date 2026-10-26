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

      // Upload directly to Firebase Storage bucket (gen-lang-client-0761736071.firebasestorage.app)
      await uploadString(storageRef, fileOrDataUrl, 'data_url', {
        contentType: mime,
      });

      const downloadUrl = await getDownloadURL(storageRef);
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

    await uploadBytes(storageRef, file, {
      contentType: options.contentType || file.type || 'application/octet-stream',
    });

    const downloadUrl = await getDownloadURL(storageRef);
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
