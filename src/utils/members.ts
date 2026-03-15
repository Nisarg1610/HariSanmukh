import { supabase } from '@/lib/supabase';

// Get all members in household
// Get all members in household
export async function getHouseholdMembers(householdId: string) {
  try {
    const { data, error } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching members:', err);
    return [];
  }
}

// Add member
export async function addMember(householdId: string, firstName: string, lastName: string) {
  try {
    const { data, error } = await supabase
      .from('household_members')
      .insert({
        household_id: householdId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error adding member:', err);
    return null;
  }
}

// Toggle member status
export async function toggleMemberStatus(memberId: string, currentStatus: string) {
  try {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    const { data, error } = await supabase
      .from('household_members')
      .update({ status: newStatus })
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error toggling member status:', err);
    return null;
  }
}

// Delete member
export async function deleteMember(memberId: string) {
  try {
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting member:', err);
    return false;
  }
}