import { NextResponse } from 'next/server';
import { sendPushNotifications } from '@/lib/send-push';

export async function POST(request: Request) {
  try {
    const { householdId, userId, title, body, url } = await request.json();

    if (!householdId && !userId) {
      return NextResponse.json({ error: 'userId or householdId required' }, { status: 400 });
    }

    const result = await sendPushNotifications({ householdId, userId, title, body, url });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Push notify error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
