import { supabase } from '@/lib/supabase';

// Get all sevas for household
export async function getSevas(householdId: string) {
  try {
    const { data, error } = await supabase
      .from('sevas')
      .select('id, name, description, cap, household_id, created_at')
      .eq('household_id', householdId);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching sevas:', err);
    return [];
  }
}

// Get all assignments
export async function getAllAssignments() {
  try {
    const { data, error } = await supabase
      .from('seva_assignments')
      .select('id, seva_id, member_id, is_completed, completed_date, assigned_date');

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching assignments:', err);
    return [];
  }
}

// Get assignments with details for a household
export async function getSevaAssignments(householdId: string) {
  try {
    // Get sevas for this household
    const sevas = await getSevas(householdId);
    const sevaIds = sevas.map(s => s.id);

    if (sevaIds.length === 0) {
      return [];
    }

    // Get all assignments
    const { data: assignments, error: assignError } = await supabase
      .from('seva_assignments')
      .select('id, seva_id, member_id, is_completed, completed_date, assigned_date')
      .in('seva_id', sevaIds);

    if (assignError) throw assignError;

    // Get members
    const { data: members, error: memberError } = await supabase
      .from('household_members')
      .select('id, name, first_name, last_name, status')
      .eq('household_id', householdId);

    if (memberError) throw memberError;

    // Combine data
    const combined = (assignments || []).map((assignment) => ({
      ...assignment,
      sevas: sevas.find((s) => s.id === assignment.seva_id),
      household_members: members?.find((m) => m.id === assignment.member_id),
    }));

    return combined;
  } catch (err) {
    console.error('Error in getSevaAssignments:', err);
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
      .insert([{
        household_id: householdId,
        name: name.trim(),
        description: description.trim(),
        cap,
      }])
      .select('id, name, description, cap, household_id, created_at');

    if (error) throw error;
    
    return data?.[0] || null;
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
      .select('id, name, description, cap, household_id, created_at');

    if (error) throw error;
    
    return data?.[0] || null;
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
    // Update assignment
    const { error: updateError } = await supabase
      .from('seva_assignments')
      .update({
        is_completed: true,
        completed_date: new Date().toISOString(),
      })
      .eq('id', sevaAssignmentId);

    if (updateError) throw updateError;

    // Add to history
    const { error: historyError } = await supabase
      .from('seva_completion_history')
      .insert([{
        seva_id: sevaId,
        member_id: memberId,
        completed_date: new Date().toISOString(),
      }]);

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
    const sevas = await getSevas(householdId);

    // Get active members
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select('id, first_name, last_name, name, status')
      .eq('household_id', householdId)
      .eq('status', 'active');

    if (membersError) throw membersError;

    if (!members || members.length === 0) {
      throw new Error('No active members found');
    }

    // Delete old assignments for these sevas
    const sevaIds = sevas.map(s => s.id);

    if (sevaIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('seva_assignments')
        .delete()
        .in('seva_id', sevaIds);

      if (deleteError) throw deleteError;
    }

    // Create new assignments with round-robin
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

    // Insert new assignments
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
    const sevas = await getSevas(householdId);
    const sevaIds = sevas.map(s => s.id);

    if (sevaIds.length === 0) {
      return [];
    }

    // Get uncompleted assignments
    const { data: assignments, error: assignError } = await supabase
      .from('seva_assignments')
      .select('id, seva_id, member_id, is_completed, completed_date, assigned_date')
      .in('seva_id', sevaIds)
      .eq('is_completed', false);

    if (assignError) throw assignError;

    // Get members
    const { data: members, error: memberError } = await supabase
      .from('household_members')
      .select('id, name, first_name, last_name, status')
      .eq('household_id', householdId);

    if (memberError) throw memberError;

    // Combine
    const combined = (assignments || []).map((assignment) => ({
      ...assignment,
      sevas: sevas.find((s) => s.id === assignment.seva_id),
      household_members: members?.find((m) => m.id === assignment.member_id),
    }));

    return combined;
  } catch (err) {
    console.error('Error fetching pending sevas:', err);
    return [];
  }
}