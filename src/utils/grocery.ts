import { supabase } from '@/lib/supabase';

export async function getGroceryItems(householdId: string, listType: 'weekly' | 'monthly') {
  if (!householdId) return [];
  const { data, error } = await supabase
    .from('grocery_items')
    .select('*')
    .eq('household_id', householdId)
    .eq('list_type', listType)
    .order('category', { ascending: true })
    .order('order_index', { ascending: true });

  if (error) { console.error('getGroceryItems error:', error); return []; }
  return data ?? [];
}

export async function saveGroceryItems(
  householdId: string,
  listType: 'weekly' | 'monthly',
  items: { name: string; quantity: string; category: string }[]
) {
  await supabase
    .from('grocery_items')
    .delete()
    .eq('household_id', householdId)
    .eq('list_type', listType);

  if (items.length === 0) return true;

  const { error } = await supabase
    .from('grocery_items')
    .insert(
      items.map((item, index) => ({
        household_id: householdId,
        name: item.name,
        quantity: item.quantity,
        category: item.category || 'General',
        list_type: listType,
        order_index: index,
      }))
    );

  if (error) { console.error('saveGroceryItems error:', error); return false; }
  return true;
}

export async function getGrocerySuggestions(householdId: string) {
  if (!householdId) return [];
  const { data, error } = await supabase
    .from('grocery_suggestions')
    .select(`*, household_members(first_name)`)
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) { console.error('getGrocerySuggestions error:', error); return []; }
  return data ?? [];
}

export async function addGrocerySuggestion(
  householdId: string,
  memberId: string,
  listType: 'weekly' | 'monthly',
  suggestion: string
) {
  const { error } = await supabase
    .from('grocery_suggestions')
    .insert({ household_id: householdId, member_id: memberId, list_type: listType, suggestion });

  if (error) { console.error('addGrocerySuggestion error:', error); return false; }
  return true;
}

export async function markSuggestionsRead(householdId: string) {
  await supabase
    .from('grocery_suggestions')
    .update({ is_read: true })
    .eq('household_id', householdId);
}