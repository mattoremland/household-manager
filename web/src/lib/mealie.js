export async function searchMealieRecipes(query = '', page = 1) {
  const params = new URLSearchParams({ action: 'search', q: query, page: String(page) })
  const resp = await fetch(`/.netlify/functions/mealie?${params}`)
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Failed to search Mealie')
  return data
}

export async function getMealieRecipe(slug) {
  const params = new URLSearchParams({ action: 'recipe', slug })
  const resp = await fetch(`/.netlify/functions/mealie?${params}`)
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Failed to fetch recipe')
  return data
}
