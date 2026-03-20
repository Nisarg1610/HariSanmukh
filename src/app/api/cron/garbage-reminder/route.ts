import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Secure the cron endpoint so only Vercel can call it
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      householdId: 'all', // or however you target all households
      title: '🗑️ Garbage Day Tomorrow!',
      body: "Hey! Don't forget to put your garbage bin out. Better out than forgotten! 😄",
    }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}