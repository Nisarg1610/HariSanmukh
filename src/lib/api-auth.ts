import { createClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from './supabase-admin';

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function getAuthUser(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function getDbUser(userId: string) {
  const { data } = await getSupabaseAdmin()
    .from('users')
    .select('id, household_id, role')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

export async function assertSameHousehold(
  authUserId: string,
  targetUserIds: string[]
): Promise<boolean> {
  const caller = await getDbUser(authUserId);
  if (!caller?.household_id) return false;

  const { data: targets } = await getSupabaseAdmin()
    .from('users')
    .select('id, household_id')
    .in('id', targetUserIds);

  if (!targets || targets.length !== targetUserIds.length) return false;
  return targets.every((t) => t.household_id === caller.household_id);
}
