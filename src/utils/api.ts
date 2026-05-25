import { supabase } from '@/lib/supabase';

export async function getAuthHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  let { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}
