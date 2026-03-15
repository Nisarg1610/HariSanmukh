import { supabase } from '@/lib/supabase';

// Get all sevas for household
export async function getSevas(householdId: string) {
  try {
    const { data, error } = await supabase
      .from('sevas')
      .select()
      .eq('household_id', householdId);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching sevas:', err);
    return [];
  }
}

// Get all assignments with related data
export async function getSevaAssignments(householdId: string) {
  try {
    // Get all sevas for this household
    const { data: sevas, error: sevaError } = await supabase
      .from('sevas')
      .select()
      .eq('household_id', householdId);

    if (sevaError) throw sevaError;
    if (!sevas || sevas.length === 0) return [];

    const sevaIds = sevas.map(s => s.id);

    // Get assignments for these sevas
    const { data: assignments, error: assignError } = await supabase
      .from('seva_assignments')
      .select()
      .in('seva_id', sevaIds);

    if (assignError) throw assignError;
    if (!assignments || assignments.length === 0) return [];

    // Get members
    const { data: members, error: memberError } = await supabase
      .from('household_members')
      .select()
      .eq('household_id', householdId);

    if (memberError) throw memberError;

    // Manually join the data
    const result = assignments.map(assignment => ({
      id: assignment.id,
      seva_id: assignment.seva_id,
      member_id: assignment.member_id,
      is_completed: assignment.is_completed,
      completed_date: assignment.completed_date,
      assigned_date: assignment.assigned_date,
      sevas: sevas.find(s => s.id === assignment.seva_id) || null,
      household_members: members?.find(m => m.id === assignment.member_id) || null,
    }));

    return result;
  } catch (err) {
    console.error('Error fetching assignments:', err);
    return [];
  }
}

// Create seva
export async function createSeva(
  householdId: string,
  name: string,
  description: string,
  cap: number
) {
  try {
    const { data, error } = await supabase
      .from('sevas')
      .insert({
        household_id: householdId,
        name: name.trim(),
        description: description.trim(),
        cap,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creating seva:', err);
    return null;
  }
}

// Update seva
export async function updateSeva(
  sevaId: string,
  name: string,
  description: string,
  cap: number
) {
  try {
    const { data, error } = await supabase
      .from('sevas')
      .update({
        name: name.trim(),
        description: description.trim(),
        cap,
      })
      .eq('id', sevaId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating seva:', err);
    return null;
  }
}

// Delete seva
export async function deleteSeva(sevaId: string) {
  try {
    const { error } = await supabase
      .from('sevas')
      .delete()
      .eq('id', sevaId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting seva:', err);
    return false;
  }
}

// Mark seva as completed
export async function markSevaComplete(
  sevaAssignmentId: string,
  sevaId: string,
  memberId: string
) {
  try {
    const { error: updateError } = await supabase
      .from('seva_assignments')
      .update({
        is_completed: true,
        completed_date: new Date().toISOString(),
      })
      .eq('id', sevaAssignmentId);

    if (updateError) throw updateError;

    const { error: historyError } = await supabase
      .from('seva_completion_history')
      .insert({
        seva_id: sevaId,
        member_id: memberId,
        completed_date: new Date().toISOString(),
      });

    if (historyError) throw historyError;

    return true;
  } catch (err) {
    console.error('Error marking seva complete:', err);
    return false;
  }
}

// Refresh/reassign sevas (round-robin)
export async function refreshSevaAssignments(householdId: string) {
  try {
    // Get sevas
    const { data: sevas, error: sevaError } = await supabase
      .from('sevas')
      .select()
      .eq('household_id', householdId);

    if (sevaError) throw sevaError;
    if (!sevas || sevas.length === 0) return true;

    // Get active members
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select()
      .eq('household_id', householdId)
      .eq('status', 'active');

    if (membersError) throw membersError;
    if (!members || members.length === 0) {
      throw new Error('No active members found');
    }

    // Delete old assignments
    const sevaIds = sevas.map(s => s.id);
    const { error: deleteError } = await supabase
      .from('seva_assignments')
      .delete()
      .in('seva_id', sevaIds);

    if (deleteError) throw deleteError;

    // Create new assignments
    const newAssignments = [];
    let memberIndex = 0;

    for (const seva of sevas) {
      for (let i = 0; i < seva.cap; i++) {
        if (memberIndex >= members.length) {
          memberIndex = 0;
        }

        newAssignments.push({
          seva_id: seva.id,
          member_id: members[memberIndex].id,
          is_completed: false,
          assigned_date: new Date().toISOString(),
        });

        memberIndex++;
      }
    }

    // Insert assignments
    if (newAssignments.length > 0) {
      const { error: insertError } = await supabase
        .from('seva_assignments')
        .insert(newAssignments);

      if (insertError) throw insertError;
    }

    return true;
  } catch (err) {
    console.error('Error refreshing assignments:', err);
    return false;
  }
}

// Get pending sevas
export async function getPendingSevas(householdId: string) {
  try {
    // Get sevas
    const { data: sevas, error: sevaError } = await supabase
      .from('sevas')
      .select()
      .eq('household_id', householdId);

    if (sevaError) throw sevaError;
    if (!sevas || sevas.length === 0) return [];

    const sevaIds = sevas.map(s => s.id);

    // Get uncompleted assignments
    const { data: assignments, error: assignError } = await supabase
      .from('seva_assignments')
      .select()
      .in('seva_id', sevaIds)
      .eq('is_completed', false);

    if (assignError) throw assignError;
    if (!assignments || assignments.length === 0) return [];

    // Get members
    const { data: members, error: memberError } = await supabase
      .from('household_members')
      .select()
      .eq('household_id', householdId);

    if (memberError) throw memberError;

    // Manually join
    const result = assignments.map(assignment => ({
      id: assignment.id,
      seva_id: assignment.seva_id,
      member_id: assignment.member_id,
      is_completed: assignment.is_completed,
      completed_date: assignment.completed_date,
      assigned_date: assignment.assigned_date,
      sevas: sevas.find(s => s.id === assignment.seva_id) || null,
      household_members: members?.find(m => m.id === assignment.member_id) || null,
    }));

    return result;
  } catch (err) {
    console.error('Error fetching pending sevas:', err);
    return [];
  }
}