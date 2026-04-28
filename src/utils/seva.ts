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

// ── NEW: toggle lock on a single assignment ───────────────────────────────────
export async function toggleSevaLock(assignmentId: string, lock: boolean) {
  const { error } = await supabase
    .from('seva_assignments')
    .update({ is_locked: lock })
    .eq('id', assignmentId);

  if (error) { console.error('toggleSevaLock error:', error); return false; }
  return true;
}

export async function swapSevaMembers(assignmentId: string, newMemberId: string) {
  // 1. Get current assignment details to know the "old" member
  const { data: currentAssignment } = await supabase
    .from('seva_assignments')
    .select('member_id')
    .eq('id', assignmentId)
    .single();

  if (!currentAssignment) return false;
  const oldMemberId = currentAssignment.member_id;

  // 2. Find if the target member (newMemberId) is currently assigned elsewhere
  const { data: targetMemberAssignment } = await supabase
    .from('seva_assignments')
    .select('id')
    .eq('member_id', newMemberId)
    .limit(1)
    .maybeSingle();

  // 3. Perform the swap
  // Update the original slot to the new member
  const { error: err1 } = await supabase
    .from('seva_assignments')
    .update({ member_id: newMemberId })
    .eq('id', assignmentId);

  if (err1) { console.error('swap err1:', err1); return false; }

  // If the new member was already somewhere else, move the old member to THAT slot
  if (targetMemberAssignment) {
    const { error: err2 } = await supabase
      .from('seva_assignments')
      .update({ member_id: oldMemberId })
      .eq('id', targetMemberAssignment.id);
    
    if (err2) { console.error('swap err2:', err2); return false; }
  }

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

  // 2. Get active members
  const { data: activeMembers } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (!activeMembers || activeMembers.length === 0) return true;

  // 3. Get ALL current assignments — we need to preserve locked ones
  const { data: existingAssignments } = await supabase
    .from('seva_assignments')
    .select('id, seva_id, member_id, is_locked')
    .in('seva_id', sevaIds);

  const lockedAssignments = (existingAssignments ?? []).filter((a) => a.is_locked);

  // 4. Find who was last assigned (for round-robin continuity)
  const { data: lastAssignment } = await supabase
    .from('seva_assignments')
    .select('member_id, assigned_at')
    .in('seva_id', sevaIds)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .single();

  let startIndex = 0;
  if (lastAssignment) {
    const lastMemberIndex = activeMembers.findIndex(
      (m) => m.id === lastAssignment.member_id
    );
    if (lastMemberIndex !== -1) {
      startIndex = (lastMemberIndex + 1) % activeMembers.length;
    }
  }

  // 5. Delete only UNLOCKED assignments, and reset complete status for locked ones
  const unlockedIds = (existingAssignments ?? [])
    .filter((a) => !a.is_locked)
    .map((a) => a.id);

  if (unlockedIds.length > 0) {
    await supabase
      .from('seva_assignments')
      .delete()
      .in('id', unlockedIds);
  }

  const lockedIds = lockedAssignments.map((a) => a.id);
  if (lockedIds.length > 0) {
    await supabase
      .from('seva_assignments')
      .update({ is_completed: false, completed_at: null })
      .in('id', lockedIds);
  }

  // 6. Build new assignments for unlocked slots only
  //    For each seva, locked slots are already filled — only fill remaining slots
  const newAssignments: { seva_id: string; member_id: string }[] = [];
  let memberIndex = startIndex;

  for (const seva of sevasList) {
    // Members already locked into this seva
    const lockedForThisSeva = lockedAssignments
      .filter((a) => a.seva_id === seva.id)
      .map((a) => a.member_id);

    // How many free slots remain after locked ones
    const remainingSlots = Math.max(0, Math.min(seva.cap, activeMembers.length) - lockedForThisSeva.length);

    const assignedToThisSeva = new Set<string>(lockedForThisSeva);

    for (let i = 0; i < remainingSlots; i++) {
      // Skip members already assigned to this seva (locked or just added)
      let attempts = 0;
      while (
        assignedToThisSeva.has(activeMembers[memberIndex % activeMembers.length].id) &&
        attempts < activeMembers.length
      ) {
        memberIndex++;
        attempts++;
      }

      const mId = activeMembers[memberIndex % activeMembers.length].id;
      assignedToThisSeva.add(mId);
      newAssignments.push({ seva_id: seva.id, member_id: mId });
      memberIndex++;
    }
  }

  // 7. Insert new (unlocked) assignments
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