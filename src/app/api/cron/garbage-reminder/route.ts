import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      householdId: 'all',
      title: '🗑️ Garbage Day Tomorrow!',
      body: "Hey! Don't forget to put your garbage bin out. Better out than forgotten! 😄",
    }),
  });

  // Check if response is actually JSON before parsing
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const text = await res.text();
    console.error('Non-JSON response:', res.status, text);
    return NextResponse.json({ error: 'Unexpected response', status: res.status, body: text }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}