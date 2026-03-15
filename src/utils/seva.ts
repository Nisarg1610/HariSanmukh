import { supabase } from '@/lib/supabase';

// Get all sevas for household
export async function getSevas(householdId: string) {
  try {
    const { data, error } = await supabase
      .from('sevas')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching sevas:', err);
    return [];
  }
}

// Get seva assignments with member details
export async function getSevaAssignments(householdId: string) {
  try {
    const { data, error } = await supabase
      .from('seva_assignments')
      .select(`
        *,
        sevas(id, name, description, cap),
        household_members(id, name)
      `)
      .eq('sevas.household_id', householdId);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching assignments:', err);
    return [];
  }
}

// Get assignments for specific user
// Get assignments for specific user (match by first_name)
export async function getUserSevaAssignments(householdId: string, userName: string) {
  try {
    const { data, error } = await supabase
      .from('seva_assignments')
      .select(`
        *,
        sevas(id, name, description, cap),
        household_members(id, name, first_name, last_name)
      `)
      .eq('sevas.household_id', householdId)
      .eq('household_members.first_name', userName);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching user assignments:', err);
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
export async function markSevaComplete(sevaAssignmentId: string, sevaId: string, memberId: string) {
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
    // Get all sevas
    const sevas = await getSevas(householdId);
    
    // Get all active members
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (membersError) throw membersError;

    if (!members || members.length === 0) {
      throw new Error('No active members found');
    }

    // Delete old assignments
    const sevaIds = sevas.map(s => s.id);
    
    if (sevaIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('seva_assignments')
        .delete()
        .in('seva_id', sevaIds);

      if (deleteError) throw deleteError;
    }

    // Create new assignments with round-robin rotation
    const newAssignments = [];
    let memberIndex = 0;

    // For each seva, assign 'cap' number of members
    for (const seva of sevas) {
      for (let i = 0; i < seva.cap; i++) {
        if (memberIndex >= members.length) {
          memberIndex = 0; // Wrap around
        }

        newAssignments.push({
          seva_id: seva.id,
          member_id: members[memberIndex].id,
          is_completed: false,
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

// Get pending sevas (uncompleted)
export async function getPendingSevas(householdId: string) {
  try {
    const { data, error } = await supabase
      .from('seva_assignments')
      .select(`
        *,
        sevas(id, name),
        household_members(id, name)
      `)
      .eq('sevas.household_id', householdId)
      .eq('is_completed', false);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching pending sevas:', err);
    return [];
  }
}