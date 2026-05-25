import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { getAuthUser, getDbUser, unauthorized, forbidden } from '@/lib/api-auth';
import { sendPushNotifications } from '@/lib/send-push';
=======
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-server';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

<<<<<<< HEAD
  const { householdId, userId, title, body, url } = await request.json();
  const caller = await getDbUser(authUser.id);
  if (!caller?.household_id) return forbidden();
=======
  let query = supabaseAdmin.from('push_subscriptions').select('subscription');
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121

  if (userId) {
    if (userId !== authUser.id && caller.role !== 'admin') {
      return forbidden('Cannot notify other users');
    }
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
