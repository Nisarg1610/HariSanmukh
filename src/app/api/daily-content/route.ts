import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Use day of year to cycle through content
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    // Get total counts
    const [{ count: sikshaCount }, { count: swaminiCount }] = await Promise.all([
      supabase.from('Sikshapatri').select('*', { count: 'exact', head: true }),
      supabase.from('SwaminiVato').select('*', { count: 'exact', head: true }),
    ]);

    // Calculate which row to show using modulo
    const sikshaIndex = (dayOfYear % (sikshaCount ?? 1)) + 1;
    const swaminiIndex = (dayOfYear % (swaminiCount ?? 1)) + 1;

    // Fetch the specific rows
    const [{ data: siksha }, { data: swamini }] = await Promise.all([
      supabase
        .from('Sikshapatri')
        .select('*')
        .eq('id', sikshaIndex)
        .single(),
      supabase
        .from('SwaminiVato')
        .select('*')
        .eq('id', swaminiIndex)
        .single(),
    ]);

    return NextResponse.json({ siksha, swamini });
  } catch (err: any) {
    console.error('daily-content error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}