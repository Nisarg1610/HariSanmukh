import { getAuthHeaders } from '@/utils/api';

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
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subscription,
        userId,
        householdId,
      }),
    });

    return true;
  } catch (err) {
    console.error('Push registration error:', err);
    return false;
  }
}

export async function sendSevaNotification(householdId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/push-notify', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      householdId,
      title: '🙏 New Seva Assigned!',
      body: 'Admin has assigned new sevas. Check your seva list!',
    }),
  });
  return response.json();
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
