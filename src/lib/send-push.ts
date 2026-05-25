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

export async function sendPushNotifications(params: SendPushParams) {
  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0, message: 'Push not configured' };
  }

  const { userId, householdId, title, body, url } = params;
  const supabase = getSupabaseAdmin();

  let query = supabase.from('push_subscriptions').select('subscription');

  if (userId) {
    query = query.eq('user_id', userId);
  } else if (householdId) {
    query = query.eq('household_id', householdId);
  } else {
    return { sent: 0, failed: 0, message: 'No target specified' };
  }

  const { data: subscriptions } = await query;

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, message: 'No subscribers' };
  }

  const payload = JSON.stringify({ title, body, url });

  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(row.subscription, payload)
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return { sent, failed };
}
