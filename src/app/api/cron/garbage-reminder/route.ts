import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushNotifications } from '@/lib/send-push';
=======
import { supabaseAdmin } from '@/lib/supabase-server';
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const day = searchParams.get('day') || 'wednesday';

  const targetHouseholds = day === 'thursday'
    ? ['HariNaman', 'HariChintan']
    : ['HariSanmukh', 'HariSharan', 'SuhradVihar'];

<<<<<<< HEAD
  const { data: households, error } = await getSupabaseAdmin()
=======
  const { data: households, error } = await supabaseAdmin
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121
    .from('households')
    .select('id, name');

  if (error || !households) {
    return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 });
  }

  const householdsToNotify = households.filter((h) => targetHouseholds.includes(h.name));

  if (householdsToNotify.length === 0) {
    return NextResponse.json({ message: 'No matching households for this day' });
  }

  const results = await Promise.allSettled(
    householdsToNotify.map((h) =>
      sendPushNotifications({
        householdId: h.id,
        title: '🗑️ Garbage Day Tomorrow!',
        body: "Hey! Don't forget to put your garbage bin out. Better out than forgotten! 😄",
      })
    )
  );

  return NextResponse.json({ notifiedCount: householdsToNotify.length, day, results });
}
