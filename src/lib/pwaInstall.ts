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
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  if (type === 'apk') {
    link.href = '/api/download/apk';
    link.download = 'koperasi-hws-v2.4.apk';
  } else if (type === 'app') {
    link.href = '/api/download/app';
    link.download = 'koperasi-hws-v2.4.apk';
  } else if (type === 'exe') {
    link.href = '/api/download/exe';
    link.download = 'koperasi-hws-setup.exe';
  } else if (type === 'ios') {
    link.href = '/api/download/ios';
    link.download = 'koperasi-hws.mobileconfig';
  } else if (type === 'bat') {
    link.href = '/api/download/pc-installer';
    link.download = 'Install-Koperasi-HWS.bat';
  } else if (type === 'database') {
    link.href = '/api/download/database';
    link.download = 'koperasi_db.json';
  } else if (type === 'google-services') {
    link.href = '/api/download/google-services.json';
    link.download = 'google-services.json';
  } else if (type === 'shortcut') {
    link.href = '/api/download/pc-shortcut';
    link.download = 'Koperasi-HWS.url';
  }

  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
    } catch {}
  }, 300);
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
  // 1. Immediately trigger download of installer package from database
  directDownload(type);

  if (type === 'database' || type === 'google-services') {
    return {
      status: 'downloaded',
      message:
        type === 'database'
          ? '✓ Salinan database resmi Koperasi HWS berhasil diunduh ke perangkat Anda.'
          : '✓ Berkas konfigurasi google-services.json berhasil diunduh.',
    };
  }

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
    message: `✓ Berkas installer ${
      type === 'apk' ? 'Android (.APK)' : 'PC Desktop (.EXE)'
    } langsung terunduh dari database. Klik berkas atau pilih "Pasang" untuk instalasi otomatis.`,
  };
}
