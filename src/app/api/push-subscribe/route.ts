import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
=======
import { supabaseAdmin } from '@/lib/supabase-server';
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { subscription, userId, householdId } = await request.json();

<<<<<<< HEAD
  if (userId !== authUser.id) {
    return forbidden('Cannot subscribe for another user');
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
=======
  const { error } = await supabaseAdmin
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, household_id: householdId, subscription },
      { onConflict: 'user_id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
