import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-server';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

async function getSubscriptionsForToday() {
const today = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  timeZone: 'America/Toronto',
}).format(new Date()); // "Monday", "Tuesday", etc.

  // Get members assigned to laundry today
  const { data: assignments } = await supabaseAdmin
    .from('laundry_assignments')
    .select('member_id')
    .eq('day_of_week', today);

  if (!assignments || assignments.length === 0) return null;

  const memberIds = assignments.map((a) => a.member_id);

  // Get linked_user_id from household_members
  const { data: members } = await supabaseAdmin
    .from('household_members')
    .select('linked_user_id')
    .in('id', memberIds)
    .not('linked_user_id', 'is', null);

  if (!members || members.length === 0) return null;

  const userIds = members.map((m) => m.linked_user_id);

  // Get push subscriptions
  const { data: subscriptions } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription')
    .in('user_id', userIds);

  return subscriptions;
}

async function sendToSubscriptions(subscriptions: any[], title: string, body: string) {
  const payload = JSON.stringify({ title, body });

  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(row.subscription, payload)
    )
  );

  return {
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const type = new URL(request.url).searchParams.get('type'); // 'morning' or 'evening'

  const subscriptions = await getSubscriptionsForToday();

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ message: 'No subscribers found for today' });
  }

  if (type === 'evening') {
    const result = await sendToSubscriptions(
      subscriptions,
      '🧺 Laundry Check!',
      'Is your laundry done? Don\'t forget to finish up before bed! 😊'
    );
    return NextResponse.json(result);
  }

  // Default: morning reminder
  const result = await sendToSubscriptions(
    subscriptions,
    '🧺 Laundry Day!',
    "Hey! It's your turn to do the laundry today. Don't forget! 😊"
  );
  return NextResponse.json(result);
}
