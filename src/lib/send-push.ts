import webpush from 'web-push';
import { getSupabaseAdmin } from './supabase-admin';

let vapidReady = false;

function ensureVapidConfigured() {
  if (vapidReady) return true;

  const email = process.env.VAPID_EMAIL;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!email || !publicKey || !privateKey) return false;

  const subject = email.startsWith('mailto:') ? email : `mailto:${email}`;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export type SendPushParams = {
  userId?: string;
  householdId?: string;
  title: string;
  body: string;
  url?: string;
};

export type SendPushResult = {
  sent: number;
  failed: number;
  message?: string;
};

export async function sendPushNotifications(params: SendPushParams): Promise<SendPushResult> {
  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0, message: 'Push not configured on server (VAPID keys)' };
  }

  const { userId, householdId, title, body, url } = params;
  const supabase = getSupabaseAdmin();

  let subscriptions: { subscription: webpush.PushSubscription }[] | null = null;

  if (userId) {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId);
    subscriptions = data;
  } else if (householdId) {
    const { data: householdUsers } = await supabase
      .from('users')
      .select('id')
      .eq('household_id', householdId);

    const userIds = householdUsers?.map((u) => u.id) ?? [];
    if (userIds.length === 0) {
      return { sent: 0, failed: 0, message: 'No users found in this household' };
    }

    const { data } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .in('user_id', userIds);
    subscriptions = data;
  } else {
    return { sent: 0, failed: 0, message: 'No target specified' };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return {
      sent: 0,
      failed: 0,
      message: 'No members have push notifications enabled yet. Ask them to enable notifications in the app.',
    };
  }

  const payload = JSON.stringify({ title, body, url });

  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(row.subscription, payload)
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  if (sent === 0 && failed > 0) {
    return { sent, failed, message: 'Push delivery failed for all subscribers' };
  }

  return { sent, failed };
}
