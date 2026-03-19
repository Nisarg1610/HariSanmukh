import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

export { browserSupportsWebAuthn };

const SESSION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const LAST_ACTIVE_KEY = 'hs_last_active';
const USER_ID_KEY = 'hs_user_id';

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

export async function registerPasskey(userId: string, email: string) {
  try {
    const optionsRes = await fetch('/api/webauthn/register-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email }),
    });

    console.log('register-options status:', optionsRes.status);
    const options = await optionsRes.json();
    console.log('register-options response:', JSON.stringify(options));

    if (!options.challenge) {
      console.log('No challenge in options — aborting');
      return false;
    }

    const registration = await startRegistration({ optionsJSON: options });
    console.log('startRegistration completed');

    const verifyRes = await fetch('/api/webauthn/register-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        response: registration,
        challenge: options.challenge,
      }),
    });

    console.log('register-verify status:', verifyRes.status);
    const verifyData = await verifyRes.json();
    console.log('register-verify response:', JSON.stringify(verifyData));

    return verifyData.verified ?? false;
  } catch (err) {
    console.error('Passkey registration error:', err);
    return false;
  }
}

export async function authenticateWithPasskey(userId: string) {
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
        challenge: options.challenge,
      }),
    });

    const { verified } = await verifyRes.json();
    return verified;
  } catch (err) {
    console.error('Passkey auth error:', err);
    return false;
  }
}