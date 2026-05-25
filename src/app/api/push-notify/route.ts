import { NextResponse } from 'next/server';
import { getAuthUser, getDbUser, unauthorized, forbidden } from '@/lib/api-auth';
import { sendPushNotifications } from '@/lib/send-push';

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { householdId, userId, title, body, url } = await request.json();
  const caller = await getDbUser(authUser.id);
  if (!caller?.household_id) {
    return forbidden('User profile not set up yet');
  }

  if (userId) {
    if (userId !== authUser.id) {
      const target = await getDbUser(userId);
      if (!target || target.household_id !== caller.household_id) {
        return forbidden('Target user not in your household');
      }
    }
  } else if (householdId) {
    if (householdId !== caller.household_id) {
      return forbidden('Cannot notify other households');
    }
  } else {
    return NextResponse.json({ error: 'userId or householdId required' }, { status: 400 });
  }

  const result = await sendPushNotifications({ householdId, userId, title, body, url });
  return NextResponse.json(result);
}
