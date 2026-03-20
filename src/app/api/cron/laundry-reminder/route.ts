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

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get today's day name
  const today = 'friday';

  // Get all members assigned to laundry today
  const { data: assignments } = await supabase
    .from('laundry_assignments')
    .select('member_id, household_id')
    .eq('day_of_week', today);

  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ message: `No laundry assignments for ${today}` });
  }

  // Get push subscriptions for those members
  const memberIds = assignments.map((a) => a.member_id);

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    //.in('user_id', memberIds);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ message: 'No subscribers found for today\'s members' });
  }

  const payload = JSON.stringify({
    title: '🧺 Laundry Day!',
    body: "Kapadaaa Dhovaaa nakhhh😊",
  });

  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(row.subscription, payload)
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({ today, sent, failed });
}