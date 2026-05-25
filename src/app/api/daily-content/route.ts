import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { getSupabaseAdmin } from '@/lib/supabase-admin';
=======
import { supabaseAdmin } from '@/lib/supabase-server';
>>>>>>> 136cd50456ce83be8b9ca80a47e1198b27f02121

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    const [{ count: sikshaCount }, { count: swaminiCount }] = await Promise.all([
      supabaseAdmin.from('sikshapatri').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('swaminivato').select('*', { count: 'exact', head: true }),
    ]);

    const sikshaIndex = (dayOfYear % (sikshaCount ?? 1)) + 1;
    const swaminiIndex = (dayOfYear % (swaminiCount ?? 1)) + 1;

    const [{ data: siksha }, { data: swamini }] = await Promise.all([
      supabaseAdmin
        .from('sikshapatri')
        .select('*')
        .eq('id', sikshaIndex)
        .single(),
      supabaseAdmin
        .from('swaminivato')
        .select('*')
        .eq('id', swaminiIndex)
        .single(),
    ]);

    return NextResponse.json({ siksha, swamini });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('daily-content error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
