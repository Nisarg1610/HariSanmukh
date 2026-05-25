import { getAuthHeaders } from '@/utils/api';

export type PushNotifyResult = {
  ok: boolean;
  sent?: number;
  failed?: number;
  error?: string;
  message?: string;
};

export async function sendHouseholdPush(
  householdId: string,
  title: string,
  body: string,
  url?: string
): Promise<PushNotifyResult> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) {
    return { ok: false, error: 'You must be signed in to send notifications.' };
  }

  try {
    const response = await fetch('/api/push-notify', {
      method: 'POST',
      headers,
      body: JSON.stringify({ householdId, title, body, url }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        error: data.error || `Request failed (${response.status})`,
      };
    }

    const sent = typeof data.sent === 'number' ? data.sent : 0;

    if (sent === 0) {
      return {
        ok: true,
        sent: 0,
        failed: data.failed,
        message:
          data.message ||
          'No members received the notification. They may need to enable notifications in the app first.',
      };
    }

    return { ok: true, sent, failed: data.failed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send notification';
    return { ok: false, error: message };
  }
}

export async function registerPushNotifications(userId: string, householdId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const permission = Notification.permission;
    if (permission !== 'granted') return false;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    });

    const headers = await getAuthHeaders();
    const res = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subscription,
        userId,
        householdId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('push-subscribe failed:', err);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Push registration error:', err);
    return false;
  }
}

export async function sendSevaNotification(householdId: string) {
  return sendHouseholdPush(
    householdId,
    '🙏 New Seva Assigned!',
    'Admin has assigned new sevas. Check your seva list!'
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
