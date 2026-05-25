import { NextResponse } from 'next/server';
import {
  assertSameHousehold,
  getAuthUser,
  unauthorized,
  forbidden,
} from '@/lib/api-auth';
import { sendPushNotifications } from '@/lib/send-push';

const MAX_DELAY_MINS = 120;
const MAX_TARGET_USERS = 20;

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const body = await request.json();
  const { delayMins, targetUserIds, msg } = body;

  if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
    return NextResponse.json({ error: 'targetUserIds required' }, { status: 400 });
  }

  if (targetUserIds.length > MAX_TARGET_USERS) {
    return NextResponse.json({ error: 'Too many targets' }, { status: 400 });
  }

  const delay = Number(delayMins);
  if (!Number.isFinite(delay) || delay < 1 || delay > MAX_DELAY_MINS) {
    return NextResponse.json(
      { error: `delayMins must be between 1 and ${MAX_DELAY_MINS}` },
      { status: 400 }
    );
  }

  const sameHouse = await assertSameHousehold(authUser.id, targetUserIds);
  if (!sameHouse) return forbidden('Invalid notification targets');

  const delayMs = delay * 60 * 1000;
  const title = 'Laundry Tracker';
  const message = typeof msg === 'string' ? msg : 'Laundry reminder';

  setTimeout(() => {
    Promise.all(
      targetUserIds.map((userId: string) =>
        sendPushNotifications({ userId, title, body: message }).catch(() => {})
      )
    ).catch((err) => console.error('Scheduled push failed', err));
  }, delayMs);

  return NextResponse.json({ scheduled: true, delayMins: delay });
}
