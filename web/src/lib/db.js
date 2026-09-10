import { supabase } from './supabase'

// --- Household Info ---

export async function listHouseholdInfo(category = null) {
  let query = supabase
    .from('household_info')
    .select('*')
    .order('category')
    .order('title')
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function searchHouseholdInfo(query) {
  const q = `%${query}%`
  const { data, error } = await supabase
    .from('household_info')
    .select('*')
    .or(`title.ilike.${q},content.ilike.${q}`)
    .order('category')
    .order('title')
  if (error) throw error
  return data
}

export async function addHouseholdInfo(title, content, category) {
  const { data, error } = await supabase
    .from('household_info')
    .insert({ title, content, category })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHouseholdInfo(id, fields) {
  const { data, error } = await supabase
    .from('household_info')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHouseholdInfo(id) {
  const { error } = await supabase.from('household_info').delete().eq('id', id)
  if (error) throw error
}

// --- Todo Lists ---

export async function listTodoLists() {
  const { data, error } = await supabase
    .from('todo_lists')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}

export async function addTodoList(name) {
  const { data: maxRow, error: maxErr } = await supabase
    .from('todo_lists')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (maxErr) throw maxErr
  const nextOrder = (maxRow?.sort_order ?? 0) + 1
  const { data, error } = await supabase
    .from('todo_lists')
    .insert({ name, sort_order: nextOrder })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameTodoList(id, name) {
  const { data, error } = await supabase
    .from('todo_lists')
    .update({ name })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTodoList(id) {
  const { error: itemsError } = await supabase.from('todo_items').delete().eq('list_id', id)
  if (itemsError) throw itemsError
  const { error } = await supabase.from('todo_lists').delete().eq('id', id)
  if (error) throw error
}

export async function swapTodoListOrder(idA, orderA, idB, orderB) {
  const { error: e1 } = await supabase.from('todo_lists').update({ sort_order: orderB }).eq('id', idA)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('todo_lists').update({ sort_order: orderA }).eq('id', idB)
  if (e2) {
    await supabase.from('todo_lists').update({ sort_order: orderA }).eq('id', idA)
    throw e2
  }
}

export async function listAllTodoItems() {
  const { data, error } = await supabase
    .from('todo_items')
    .select('list_id, is_done')
  if (error) throw error
  return data
}

export async function listTodoItems(listId) {
  const { data, error } = await supabase
    .from('todo_items')
    .select('*')
    .eq('list_id', listId)
    .order('id')
  if (error) throw error
  return data.map(row => ({ ...row, done: row.is_done }))
}

export async function addTodoItem(listId, text, tag = null) {
  const { data, error } = await supabase
    .from('todo_items')
    .insert({ list_id: listId, text, tag, is_done: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTodoItem(id, fields) {
  const { data, error } = await supabase
    .from('todo_items')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function checkTodoItem(id, done) {
  return updateTodoItem(id, { is_done: done })
}

export async function deleteTodoItem(id) {
  const { error } = await supabase.from('todo_items').delete().eq('id', id)
  if (error) throw error
}

export async function clearCheckedTodoItems(listId) {
  const { error } = await supabase
    .from('todo_items')
    .delete()
    .eq('list_id', listId)
    .eq('is_done', true)
  if (error) throw error
}

// --- Grocery ---

export async function listGroceryItems() {
  const { data, error } = await supabase
    .from('grocery_items')
    .select('*')
    .order('id')
  if (error) throw error
  return data
}

export async function addGroceryItem(name, quantity = null) {
  const { data, error } = await supabase
    .from('grocery_items')
    .insert({ name, quantity, is_checked: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function checkGroceryItem(id, isChecked) {
  const { data, error } = await supabase
    .from('grocery_items')
    .update({ is_checked: isChecked })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGroceryItem(id) {
  const { error } = await supabase.from('grocery_items').delete().eq('id', id)
  if (error) throw error
}

export async function clearCheckedGroceryItems() {
  const { error } = await supabase
    .from('grocery_items')
    .delete()
    .eq('is_checked', true)
  if (error) throw error
}

export async function addIngredientsToGroceryList(ingredients) {
  const existing = await listGroceryItems()
  const uncheckedNames = new Set(
    existing.filter(i => !i.is_checked).map(i => i.name.toLowerCase())
  )
  const toAdd = ingredients.filter(i => !uncheckedNames.has(i.toLowerCase()))
  if (toAdd.length === 0) return 0
  const rows = toAdd.map(name => ({ name, is_checked: false }))
  const { error } = await supabase.from('grocery_items').insert(rows)
  if (error) throw error
  return toAdd.length
}

// --- Meal Plan ---

export async function listMealPlan() {
  const { data, error } = await supabase
    .from('meal_plan')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function addMealPlanEntry(date, name, notes = null, ingredients = null, sourceUrl = null) {
  const { data, error } = await supabase
    .from('meal_plan')
    .insert({ date, meal_name: name, notes, ingredients, source_url: sourceUrl })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMealPlanEntry(id, fields) {
  const updateFields = { ...fields }
  if ('sourceUrl' in updateFields) {
    updateFields.source_url = updateFields.sourceUrl
    delete updateFields.sourceUrl
  }
  if ('name' in updateFields) {
    updateFields.meal_name = updateFields.name
    delete updateFields.name
  }
  const { data, error } = await supabase
    .from('meal_plan')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMealPlanEntry(id) {
  const { error } = await supabase.from('meal_plan').delete().eq('id', id)
  if (error) throw error
}

// --- Notes ---

export async function listNotes({ orderBy = 'sort_order' } = {}) {
  let query = supabase.from('notes').select('*')
  if (orderBy === 'updated_at') {
    query = query.order('updated_at', { ascending: false })
  } else {
    query = query.order('sort_order')
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function searchNotes(query) {
  const q = `%${query}%`
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .or(`title.ilike.${q},body.ilike.${q}`)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addNote(title, body = '') {
  const { data: maxRow, error: maxErr } = await supabase
    .from('notes')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (maxErr) throw maxErr
  const nextOrder = (maxRow?.sort_order ?? 0) + 1
  const { data, error } = await supabase
    .from('notes')
    .insert({ title, body, sort_order: nextOrder })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateNote(id, fields) {
  const { data, error } = await supabase
    .from('notes')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteNote(id) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}

export async function swapNoteOrder(idA, orderA, idB, orderB) {
  const { error: e1 } = await supabase.from('notes').update({ sort_order: orderB }).eq('id', idA)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('notes').update({ sort_order: orderA }).eq('id', idB)
  if (e2) {
    await supabase.from('notes').update({ sort_order: orderA }).eq('id', idA)
    throw e2
  }
}
