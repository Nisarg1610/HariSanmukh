import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const day = searchParams.get('day') || 'wednesday'; // ?day=wednesday or ?day=thursday

  // Determine which households to notify
  const targetHouseholds = day === 'thursday' 
    ? ['HariNaman', 'HariChintan']
    : ['HariSanmukh', 'HariSharan', 'SuhradVihar'];

  const { data: households, error } = await supabase
    .from('households')
    .select('id, name');

  if (error || !households) {
    return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 });
  }

  const householdsToNotify = households.filter((h: any) => targetHouseholds.includes(h.name));
  
  if (householdsToNotify.length === 0) {
    return NextResponse.json({ message: 'No matching households for this day' });
  }

  // Promise.all to fetch the push notification endpoint for each matching household
  const results = await Promise.allSettled(
    householdsToNotify.map((h: any) => 
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: h.id,
          title: '🗑️ Garbage Day Tomorrow!',
          body: "Hey! Don't forget to put your garbage bin out. Better out than forgotten! 😄",
        }),
      }).then(res => res.json())
    )
  );

  return NextResponse.json({ notifiedCount: householdsToNotify.length, day, results });
}