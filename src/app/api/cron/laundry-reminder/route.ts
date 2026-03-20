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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// export async function GET(request: Request) {
//   const authHeader = request.headers.get('authorization');
//   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }

//   const today = 'Friday'; // temporary for testing, revert to DAYS[new Date().getDay()] later

//   // Get members assigned to laundry today
//   const { data: assignments } = await supabase
//     .from('laundry_assignments')
//     .select('member_id')
//     .eq('day_of_week', today);

//   if (!assignments || assignments.length === 0) {
//     return NextResponse.json({ message: `No laundry assignments for ${today}` });
//   }

//   const memberIds = assignments.map((a) => a.member_id);

//   // Get linked_user_id from household_members
//   const { data: members } = await supabase
//     .from('household_members')
//     .select('linked_user_id')
//     .in('id', memberIds)
//     .not('linked_user_id', 'is', null);

//   if (!members || members.length === 0) {
//     return NextResponse.json({ message: 'No linked users found for today\'s members' });
//   }

//   const userIds = members.map((m) => m.linked_user_id);

//   // Get push subscriptions for those users
//   const { data: subscriptions } = await supabase
//     .from('push_subscriptions')
//     .select('subscription')
//     .in('user_id', userIds);

//   if (!subscriptions || subscriptions.length === 0) {
//     return NextResponse.json({ message: 'No push subscriptions found' });
//   }

//   const payload = JSON.stringify({
//     title: '🧺 Laundry Day!',
//     body: "Hey! It's your turn to do the laundry today. Don't forget! 😊",
//   });

//   const results = await Promise.allSettled(
//     subscriptions.map((row) =>
//       webpush.sendNotification(row.subscription, payload)
//     )
//   );

//   const sent = results.filter((r) => r.status === 'fulfilled').length;
//   const failed = results.filter((r) => r.status === 'rejected').length;

//   return NextResponse.json({ today, sent, failed });
// }


export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all subscriptions for testing
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('subscription');

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ message: 'No subscribers found' });
  }

  const payload = JSON.stringify({
    title: '🧺 Laundry Day!',
    body: "Kapaddaaa Dhovaaa Nankhhhhh😊",
  });

  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(row.subscription, payload)
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({ sent, failed });
}