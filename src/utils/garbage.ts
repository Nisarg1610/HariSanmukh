import { supabase } from '@/lib/supabase';

export async function getGarbageSchedule(householdId: string) {
  if (!householdId) return [];
  const { data, error } = await supabase
    .from('garbage_schedule')
    .select(`*, household_members(id, first_name, last_name)`)
    .eq('household_id', householdId)
    .order('scheduled_date', { ascending: true });

  if (error) { console.error('getGarbageSchedule error:', error); return []; }
  return data ?? [];
}

export async function assignGarbage(
  householdId: string,
  memberId: string,
  date: string
) {
  const { data, error } = await supabase
    .from('garbage_schedule')
    .insert({ household_id: householdId, member_id: memberId, scheduled_date: date })
    .select()
    .single();

  if (error) { console.error('assignGarbage error:', error); return null; }
  return data;
}

export async function removeGarbageAssignment(id: string) {
  const { error } = await supabase
    .from('garbage_schedule')
    .delete()
    .eq('id', id);

  if (error) { console.error('removeGarbageAssignment error:', error); return false; }
  return true;
}