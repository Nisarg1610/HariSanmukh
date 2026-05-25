import { NextResponse } from 'next/server';
import { getAuthUser, getDbUser, unauthorized, forbidden } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { subscription, userId, householdId } = await request.json();

  if (!userId || !subscription) {
    return NextResponse.json({ error: 'userId and subscription are required' }, { status: 400 });
  }

  if (userId !== authUser.id) {
    return forbidden('Cannot subscribe for another user');
  }

  const caller = await getDbUser(authUser.id);
  const resolvedHouseholdId = householdId || caller?.household_id;
  if (!resolvedHouseholdId) {
    return NextResponse.json(
      { error: 'No household linked to your account yet' },
      { status: 400 }
    );
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY === 'placeholder' || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('push-subscribe: SUPABASE_SERVICE_ROLE_KEY is not configured');
    return NextResponse.json(
      { error: 'Server push configuration is missing' },
      { status: 500 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, household_id: resolvedHouseholdId, subscription },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('push-subscribe upsert:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
