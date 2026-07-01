import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const { subscription, userId, householdId } = await request.json();

    if (!userId || !householdId || !subscription) {
      return NextResponse.json({ error: 'userId, householdId, and subscription are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: userId, household_id: householdId, subscription },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Push subscribe error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Push subscribe unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
