import { supabase } from '@/lib/supabase';

export async function getSevas(householdId: string) {
  if (!householdId) return [];
  const { data, error } = await supabase
    .from('sevas')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (error) { console.error('getSevas error:', error); return []; }
  return data ?? [];
}

export async function getSevaAssignments(householdId: string) {
  if (!householdId) return [];
  const { data, error } = await supabase
    .from('seva_assignments')
    .select(`
      *,
      sevas!inner(id, name, description, cap, household_id),
      household_members(id, first_name, last_name, status)
    `)
    .eq('sevas.household_id', householdId);

  if (error) { console.error('getSevaAssignments error:', error); return []; }
  return data ?? [];
}

export async function getPendingSevas(householdId: string) {
  if (!householdId) return [];
  const { data, error } = await supabase
    .from('seva_assignments')
    .select(`
      *,
      sevas!inner(id, name, household_id),
      household_members(id, first_name, last_name)
    `)
    .eq('sevas.household_id', householdId)
    .eq('is_completed', false);

  if (error) { console.error('getPendingSevas error:', error); return []; }
  return data ?? [];
}

export async function createSeva(
  householdId: string,
  name: string,
  description: string,
  cap: number
) {
  const { data, error } = await supabase
    .from('sevas')
    .insert({ household_id: householdId, name, description, cap })
    .select()
    .single();

  if (error) { console.error('createSeva error:', error); return null; }
  return data;
}

export async function updateSeva(
  sevaId: string,
  name: string,
  description: string,
  cap: number
) {
  const { data, error } = await supabase
    .from('sevas')
    .update({ name, description, cap })
    .eq('id', sevaId)
    .select()
    .single();

  if (error) { console.error('updateSeva error:', error); return null; }
  return data;
}

export async function deleteSeva(sevaId: string) {
  const { error } = await supabase.from('sevas').delete().eq('id', sevaId);
  if (error) { console.error('deleteSeva error:', error); return false; }
  return true;
}

export async function markSevaComplete(assignmentId: string) {
  const { error } = await supabase
    .from('seva_assignments')
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq('id', assignmentId);

  if (error) { console.error('markSevaComplete error:', error); return false; }
  return true;
}

export async function refreshSevaAssignments(householdId: string) {
  // 1. Get all sevas for this household
  const { data: sevasList } = await supabase
    .from('sevas')
    .select('id, cap')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (!sevasList || sevasList.length === 0) return true;

  const sevaIds = sevasList.map((s) => s.id);

  // 2. Get active members ordered by created_at (stable order for round-robin)
  const { data: activeMembers } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (!activeMembers || activeMembers.length === 0) return true;

  // 3. Find who was last assigned (to continue rotation from where we left off)
  //    Look at the most recent assignment across all sevas in this household
  const { data: lastAssignment } = await supabase
    .from('seva_assignments')
    .select('member_id, assigned_at')
    .in('seva_id', sevaIds)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .single();

  // 4. Find the starting index for round-robin
  let startIndex = 0;
  if (lastAssignment) {
    const lastMemberIndex = activeMembers.findIndex(
      (m) => m.id === lastAssignment.member_id
    );
    if (lastMemberIndex !== -1) {
      // Start from the next member after the last one who was assigned
      startIndex = (lastMemberIndex + 1) % activeMembers.length;
    }
  }

  // 5. Delete existing assignments
  await supabase
    .from('seva_assignments')
    .delete()
    .in('seva_id', sevaIds);

  // 6. Build new assignments using round-robin from startIndex
  const newAssignments: { seva_id: string; member_id: string }[] = [];
  let memberIndex = startIndex;

  for (const seva of sevasList) {
    const count = Math.min(seva.cap, activeMembers.length);
    const assignedToThisSeva = new Set<string>(); // avoid duplicate per seva

    for (let i = 0; i < count; i++) {
      // Skip if this member already assigned to this seva (can happen if cap > members)
      let attempts = 0;
      while (
        assignedToThisSeva.has(activeMembers[memberIndex % activeMembers.length].id) &&
        attempts < activeMembers.length
      ) {
        memberIndex++;
        attempts++;
      }

      const memberId = activeMembers[memberIndex % activeMembers.length].id;
      assignedToThisSeva.add(memberId);
      newAssignments.push({ seva_id: seva.id, member_id: memberId });
      memberIndex++;
    }
  }

  // 7. Insert new assignments
  if (newAssignments.length > 0) {
    const { error } = await supabase
      .from('seva_assignments')
      .insert(newAssignments);

    if (error) {
      console.error('refreshSevaAssignments insert error:', error);
      return false;
    }
  }

  return true;
}