import { supabase } from './supabase'
import { categorizeWith, normalizeItemName } from './groceryKeywords'

export { SECTION_ORDER, SECTION_LABELS, STORE_ONLY_SECTIONS } from './groceryKeywords'

export function categorizeItem(itemName) {
  return categorizeWith(supabase, itemName)
}

export async function saveCategoryMapping(itemName, category) {
  const { error } = await supabase
    .from('grocery_category_mappings')
    .upsert({ item_name: normalizeItemName(itemName), category }, { onConflict: 'item_name' })
  if (error) throw error
}
