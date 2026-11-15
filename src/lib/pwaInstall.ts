/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Global reference for PWA install prompt
let globalDeferredPrompt: any = null;

if (typeof window !== 'undefined') {
  // Capture event if fired early or later
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    (window as any).deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('app:pwa_ready', { detail: e }));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    if (typeof window !== 'undefined') {
      (window as any).deferredPrompt = null;
    }
    window.dispatchEvent(new CustomEvent('app:pwa_installed'));
  });
}

export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function hasDeferredPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(globalDeferredPrompt || (window as any).deferredPrompt);
}

export async function promptInstallDirectly(): Promise<{
  status: 'installed' | 'dismissed' | 'ios_guide' | 'manual_android' | 'manual_pc' | 'already_installed';
  message: string;
}> {
  if (isAppInstalled()) {
    return {
      status: 'already_installed',
      message: '✓ Aplikasi Koperasi HWS telah terpasang di perangkat ini.',
    };
  }

  const promptObj =
    globalDeferredPrompt ||
    (typeof window !== 'undefined' ? (window as any).deferredPrompt : null);

  if (promptObj) {
    try {
      await promptObj.prompt();
      const choice = await promptObj.userChoice;
      if (choice?.outcome === 'accepted') {
        globalDeferredPrompt = null;
        if (typeof window !== 'undefined') {
          (window as any).deferredPrompt = null;
        }
        return {
          status: 'installed',
          message: '✓ Koperasi HWS berhasil dipasang di perangkat Anda!',
        };
      }
      return {
        status: 'dismissed',
        message: 'Pemasangan dibatalkan.',
      };
    } catch (e) {
      console.warn('Install prompt error:', e);
    }
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);

  if (isIos) {
    return {
      status: 'ios_guide',
      message:
        'Ketuk tombol Bagikan (Share 📤) di bilah bawah Safari, lalu pilih "Tambah ke Layar Utama".',
    };
  } else if (isAndroid) {
    return {
      status: 'manual_android',
      message:
        'Ketuk menu titik tiga (⋮) di browser Chrome Anda, lalu pilih "Instal Aplikasi" atau "Tambahkan ke Layar Utama".',
    };
  } else {
    return {
      status: 'manual_pc',
      message:
        'Klik ikon instalasi di bilah alamat browser (URL bar) atau buka menu browser (⋮) lalu pilih "Instal Koperasi HWS".',
    };
  }
}

export type DownloadPackageType =
  | 'apk'
  | 'app'
  | 'exe'
  | 'ios'
  | 'bat'
  | 'database'
  | 'google-services'
  | 'shortcut';

export function directDownload(type: DownloadPackageType) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let url = '';
  let filename = '';

  if (type === 'apk' || type === 'app') {
    url = '/api/download/android-launcher';
    filename = 'Koperasi-HWS-Android.html';
  } else if (type === 'exe') {
    url = '/api/download/exe';
    filename = 'koperasi-hws-setup.exe';
  } else if (type === 'ios') {
    url = '/api/download/ios';
    filename = 'koperasi-hws.mobileconfig';
  } else if (type === 'bat') {
    url = '/api/download/pc-installer';
    filename = 'Install-Koperasi-HWS.bat';
  } else if (type === 'database') {
    url = '/api/download/database';
    filename = 'koperasi_db.json';
  } else if (type === 'google-services') {
    url = '/api/download/google-services.json';
    filename = 'google-services.json';
  } else if (type === 'shortcut') {
    url = '/api/download/pc-shortcut';
    filename = 'Koperasi-HWS.url';
  }

  if (!url) return;

  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.setAttribute('download', filename);

  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
    } catch {}
  }, 1000);
}

/**
 * Trigger both direct database download of installer package AND automatic device install
 */
export async function installAndDownload(type: DownloadPackageType): Promise<{
  status:
    | 'installed'
    | 'dismissed'
    | 'downloaded_and_prompted'
    | 'ios_guide'
    | 'already_installed'
    | 'downloaded';
  message: string;
}> {
  if (type === 'database' || type === 'google-services') {
    directDownload(type);
    return {
      status: 'downloaded',
      message:
        type === 'database'
          ? '✓ Salinan database resmi Koperasi HWS berhasil diunduh ke perangkat Anda.'
          : '✓ Berkas konfigurasi google-services.json berhasil diunduh.',
    };
  }

  // Untuk Android (apk/app), utamakan instalasi PWA Resmi terlebih dahulu agar langsung terhubung ke server & Firestore Koperasi HWS
  if (type === 'apk' || type === 'app') {
    const promptRes = await promptInstallDirectly();
    if (promptRes.status === 'installed' || promptRes.status === 'already_installed') {
      return {
        status: promptRes.status,
        message: '✓ Aplikasi resmi Koperasi HWS berhasil terpasang dan terhubung langsung ke Cloud Firestore!',
      };
    }
    directDownload('apk');
    return {
      status: 'downloaded_and_prompted',
      message:
        '✓ Launcher resmi Android (Koperasi-HWS-Android.html) telah diunduh. Buka file tersebut di Chrome Android lalu ketuk "Instal Aplikasi / Tambah ke Layar Utama".',
    };
  }

  // 1. Trigger download of installer package from server
  directDownload(type);

  // 2. Prompt direct installation on device
  const promptRes = await promptInstallDirectly();

  if (promptRes.status === 'already_installed') {
    return {
      status: 'already_installed',
      message:
        '✓ Berkas installer terunduh dari database & aplikasi telah terpasang di perangkat ini.',
    };
  }

  if (promptRes.status === 'installed') {
    return {
      status: 'installed',
      message:
        '✓ Berkas installer terunduh dari database & Koperasi HWS berhasil dipasang otomatis di perangkat Anda!',
    };
  }

  if (type === 'ios') {
    return {
      status: 'ios_guide',
      message:
        '✓ Profil iOS terunduh dari database. Ikuti petunjuk untuk menambahkannya ke Layar Utama iPhone/iPad Anda.',
    };
  }

  return {
    status: 'downloaded_and_prompted',
    message: '✓ Berkas installer PC Desktop (.EXE) langsung terunduh dari database. Klik berkas untuk membuka aplikasi Koperasi HWS.',
  };
}
