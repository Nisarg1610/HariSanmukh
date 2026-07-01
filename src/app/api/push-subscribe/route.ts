import { NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { subscription, userId, householdId } = await request.json();

  if (userId !== authUser.id) {
    return forbidden('Cannot subscribe for another user');
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, household_id: householdId, subscription },
      { onConflict: 'user_id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
