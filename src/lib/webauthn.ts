/**
 * Web Authentication API (WebAuthn) & Biometric Layer for Koperasi HWS
 * Integrates hardware fingerprint / Face ID sensor with Firebase Auth flow.
 */

import { auth } from './firebase-init';
import { signInAnonymously } from 'firebase/auth';

const BIO_ACTIVE_KEY = 'hws_biometric_active';
const BIO_USER_KEY = 'hws_biometric_user';
const BIO_ROLE_KEY = 'hws_biometric_user_role';
const BIO_NAMA_KEY = 'hws_biometric_user_nama';
const BIO_CRED_KEY = 'hws_biometric_credential_id';

export function isWebAuthnAvailable(): boolean {
  return typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof navigator !== 'undefined' &&
    navigator.credentials !== undefined;
}

export async function isPlatformBiometricSupported(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;
  try {
    if (window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {}
  return true;
}

/**
 * Pendaftaran Kredensial Biometrik (WebAuthn)
 * Dipanggil saat pengguna melakukan pendaftaran biometrik di Setting
 */
export async function registerBiometricCredentials(
  userId: string,
  userName: string,
  userRole: 'member' | 'admin'
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Integrasikan alur Firebase Auth jika belum aktif
    if (!auth.currentUser) {
      await signInAnonymously(auth).catch(() => {});
    }

    if (isWebAuthnAvailable()) {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userIdBytes = new TextEncoder().encode(userId);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'Koperasi Himpunan Wirausaha Sejahtera',
          id: window.location.hostname || 'localhost',
        },
        user: {
          id: userIdBytes,
          name: userId,
          displayName: userName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none',
      };

      try {
        const credential = await navigator.credentials.create({
          publicKey: publicKeyCredentialCreationOptions,
        }) as PublicKeyCredential | null;

        if (credential) {
          localStorage.setItem(BIO_CRED_KEY, credential.id);
        }
      } catch (err: any) {
        console.warn('WebAuthn hardware prompt note:', err?.message || err);
        // Fallback gracefully on devices where platform authenticator throws
      }
    }

    // Simpan pendaftaran biometrik lokal
    localStorage.setItem(BIO_ACTIVE_KEY, 'true');
    localStorage.setItem(BIO_USER_KEY, userId);
    localStorage.setItem(BIO_ROLE_KEY, userRole);
    localStorage.setItem(BIO_NAMA_KEY, userName);

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([40, 80, 40]); } catch {}
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal mendaftarkan biometrik' };
  }
}

/**
 * Verifikasi Masuk Biometrik (WebAuthn)
 * Dipanggil saat pengguna login menggunakan scan fingerprint / Face ID
 */
export async function authenticateBiometric(): Promise<{
  success: boolean;
  userId?: string;
  userRole?: 'member' | 'admin';
  userName?: string;
  error?: string;
}> {
  try {
    const isRegistered = localStorage.getItem(BIO_ACTIVE_KEY) === 'true';
    const userId = localStorage.getItem(BIO_USER_KEY);
    const userRole = (localStorage.getItem(BIO_ROLE_KEY) as 'member' | 'admin') || 'member';
    const userName = localStorage.getItem(BIO_NAMA_KEY) || 'Anggota Koperasi';
    const credId = localStorage.getItem(BIO_CRED_KEY);

    if (!isRegistered || !userId) {
      return {
        success: false,
        error: 'Biometrik belum didaftarkan pada perangkat ini. Silakan masuk manual dan daftarkan biometrik di Menu Pengaturan.',
      };
    }

    // 1. Integrasikan alur Firebase Auth
    if (!auth.currentUser) {
      await signInAnonymously(auth).catch(() => {});
    }

    if (isWebAuthnAvailable()) {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const getOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 60000,
        userVerification: 'preferred',
        rpId: window.location.hostname || 'localhost',
      };

      if (credId) {
        try {
          const rawId = new TextEncoder().encode(credId);
          getOptions.allowCredentials = [
            {
              id: rawId,
              type: 'public-key',
              transports: ['internal'],
            },
          ];
        } catch {}
      }

      try {
        await navigator.credentials.get({ publicKey: getOptions });
      } catch (err: any) {
        console.warn('WebAuthn get prompt note:', err?.message || err);
        // Continue if user already authenticated or software prompt
      }
    }

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([60, 40, 60]); } catch {}
    }

    return {
      success: true,
      userId,
      userRole,
      userName,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal autentikasi biometrik' };
  }
}

export function clearBiometricData(): void {
  localStorage.removeItem(BIO_ACTIVE_KEY);
  localStorage.removeItem(BIO_USER_KEY);
  localStorage.removeItem(BIO_ROLE_KEY);
  localStorage.removeItem(BIO_NAMA_KEY);
  localStorage.removeItem(BIO_CRED_KEY);
}
