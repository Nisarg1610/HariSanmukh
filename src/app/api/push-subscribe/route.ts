import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const { subscription, userId, householdId } = await request.json();

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert({ user_id: userId, household_id: householdId, subscription },
      { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
