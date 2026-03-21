import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  const { householdId, userId, title, body } = await request.json();

  let query = supabase.from('push_subscriptions').select('subscription');

  if (userId) {
    // Target specific user only (e.g. welcome notification)
    query = query.eq('user_id', userId);
  } else if (householdId !== 'all') {
    // Target specific household
    query = query.eq('household_id', householdId);
  }
  // else fetch all (householdId === 'all')

  const { data: subscriptions } = await query;

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ message: 'No subscribers' });
  }

  const payload = JSON.stringify({ title, body });

  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(row.subscription, payload)
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({ sent, failed });
}