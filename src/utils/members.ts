import { supabase } from '@/lib/supabase';

export async function getHouseholdMembers(householdId: string) {
  if (!householdId) return [];
  const { data, error } = await supabase
    .from('household_members')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getHouseholdMembers error:', error);
    return [];
  }
  return data ?? [];
}

export async function addMember(
  householdId: string,
  firstName: string,
  email: string
) {
  const { data, error } = await supabase
    .from('household_members')
    .insert({
      household_id: householdId,
      first_name: firstName,
      last_name: 'Bhai',
      email: email.toLowerCase().trim(),
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('addMember error:', error);
    return null;
  }
  return data;
}

export async function updateMember(
  memberId: string,
  firstName: string,
  email: string
) {
  const { data, error } = await supabase
    .from('household_members')
    .update({
      first_name: firstName,
      email: email.toLowerCase().trim(),
    })
    .eq('id', memberId)
    .select()
    .single();

  if (error) {
    console.error('updateMember error:', error);
    return null;
  }
  return data;
}

export async function toggleMemberStatus(memberId: string, currentStatus: string) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

  const { data, error } = await supabase
    .from('household_members')
    .update({ status: newStatus })
    .eq('id', memberId)
    .select()
    .single();

  if (error) {
    console.error('toggleMemberStatus error:', error);
    return null;
  }
  return data;
}

export async function deleteMember(memberId: string) {
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('id', memberId);

  if (error) {
    console.error('deleteMember error:', error);
    return false;
  }
  return true;
}