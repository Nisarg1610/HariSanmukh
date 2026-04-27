import { supabase } from '@/lib/supabase';

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function getPickupDropAssignments(householdId: string) {
  if (!householdId) return [];
  const { data, error } = await supabase
    .from('pickup_drop_assignments')
    .select(`
      *,
      household_members(id, first_name, last_name, status)
    `)
    .eq('household_id', householdId);

  if (error) { console.error('getPickupDropAssignments error:', error); return []; }
  return data ?? [];
}

export async function assignPickupDrop(householdId: string, memberId: string, day: string) {
  const { data, error } = await supabase
    .from('pickup_drop_assignments')
    .insert({ household_id: householdId, member_id: memberId, day_of_week: day })
    .select(`*, household_members(id, first_name, last_name, status)`)
    .single();

  if (error) { console.error('assignPickupDrop error:', error); return null; }
  return data;
}

export async function removePickupDropAssignment(assignmentId: string) {
  const { error } = await supabase
    .from('pickup_drop_assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) { console.error('removePickupDropAssignment error:', error); return false; }
  return true;
}
