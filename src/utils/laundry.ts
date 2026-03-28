import { supabase } from '@/lib/supabase';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export async function getLaundryAssignments(householdId: string) {
  if (!householdId) return [];
  const { data, error } = await supabase
    .from('laundry_assignments')
    .select(`
      *,
      household_members(id, first_name, last_name, status)
    `)
    .eq('household_id', householdId);

  if (error) { console.error('getLaundryAssignments error:', error); return []; }
  return data ?? [];
}

export async function assignLaundry(
  householdId: string,
  memberId: string,
  day: string
) {
  const { data, error } = await supabase
    .from('laundry_assignments')
    .insert({ household_id: householdId, member_id: memberId, day_of_week: day })
    .select()
    .single();

  if (error) { console.error('assignLaundry error:', error); return null; }
  return data;
}

export async function removeLaundryAssignment(assignmentId: string) {
  const { error } = await supabase
    .from('laundry_assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) { console.error('removeLaundryAssignment error:', error); return false; }
  return true;
}

export async function getTodayLaundrySessions(householdId: string) {
  if (!householdId) return [];
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('laundry_sessions')
    .select(`
      *,
      household_members(id, first_name, last_name)
    `)
    .eq('household_id', householdId)
    .eq('date', today);

  if (error) { console.error('getTodayLaundrySessions error:', error); return []; }
  return data ?? [];
}

export async function upsertLaundrySession(session: any) {
  const { data, error } = await supabase
    .from('laundry_sessions')
    .upsert(session, { onConflict: 'household_id,member_id,date' })
    .select()
    .single();

  if (error) { console.error('upsertLaundrySession error:', error); return null; }
  return data;
}