import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import { getAuthHeaders } from '@/utils/api';

export { browserSupportsWebAuthn };

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
const LAST_ACTIVE_KEY = 'hs_last_active';
const USER_ID_KEY = 'hs_user_id';

export type PasskeyResult = { ok: boolean; error?: string };

export function saveLastActive() {
  localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}

export function clearLastActive() {
  localStorage.removeItem(LAST_ACTIVE_KEY);
}

export function saveUserId(userId: string) {
  localStorage.setItem(USER_ID_KEY, userId);
}

export function getSavedUserId() {
  return localStorage.getItem(USER_ID_KEY);
}

export function clearUserId() {
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(LAST_ACTIVE_KEY);
}

export function isSessionExpired(): boolean {
  const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
  if (!lastActive) return true;
  return Date.now() - parseInt(lastActive) > SESSION_TIMEOUT_MS;
}

export async function registerPasskey(userId: string, email: string): Promise<PasskeyResult> {
  try {
    const headers = await getAuthHeaders();
    if (!headers.Authorization) {
      return { ok: false, error: 'You must be signed in with Google before enabling Face ID.' };
    }

    const optionsRes = await fetch('/api/webauthn/register-options', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, email }),
    });

    const optionsBody = await optionsRes.json().catch(() => ({}));
    if (!optionsRes.ok) {
      return {
        ok: false,
        error: optionsBody.error || `Could not start Face ID setup (${optionsRes.status})`,
      };
    }
    if (!optionsBody.challenge) {
      return { ok: false, error: 'Invalid registration options from server' };
    }

    const registration = await startRegistration({ optionsJSON: optionsBody });

    const verifyRes = await fetch('/api/webauthn/register-verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        response: registration,
      }),
    });

    const verifyData = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok) {
      return {
        ok: false,
        error: verifyData.error || `Verification failed (${verifyRes.status})`,
      };
    }
    if (!verifyData.verified) {
      return { ok: false, error: verifyData.error || 'Face ID verification failed' };
    }

    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      return { ok: false, error: 'Face ID was cancelled or not allowed.' };
    }
    const message = err instanceof Error ? err.message : 'Passkey registration failed';
    console.error('Passkey registration error:', err);
    return { ok: false, error: message };
  }
}

export async function authenticateWithPasskey(userId: string): Promise<boolean> {
  try {
    const optionsRes = await fetch('/api/webauthn/auth-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!optionsRes.ok) return false;
    const options = await optionsRes.json();
    if (options.error) return false;

    const authentication = await startAuthentication({ optionsJSON: options });

    const verifyRes = await fetch('/api/webauthn/auth-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        response: authentication,
      }),
    });

    const { verified } = await verifyRes.json();
    return verified;
  } catch (err) {
    console.error('Passkey auth error:', err);
    return false;
  }
}
