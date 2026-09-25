import { requirePasscode } from '../lib/passcode.js'

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const MEALIE_URL = process.env.MEALIE_URL
const MEALIE_TOKEN = process.env.MEALIE_API_TOKEN

export default async (req) => {
  const denied = await requirePasscode(req)
  if (denied) return denied

  if (!MEALIE_URL || !MEALIE_TOKEN) {
    return json(500, { error: 'Mealie not configured' })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  if (action === 'search') {
    const search = url.searchParams.get('q') || ''
    const page = url.searchParams.get('page') || '1'
    const endpoint = `${MEALIE_URL}/api/recipes?search=${encodeURIComponent(search)}&page=${page}&perPage=20&orderBy=created_at&orderDirection=desc`

    try {
      const resp = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${MEALIE_TOKEN}` },
        signal: AbortSignal.timeout(10000),
      })
      if (!resp.ok) return json(502, { error: `Mealie returned ${resp.status}` })
      const data = await resp.json()
      return json(200, data)
    } catch (err) {
      return json(502, { error: err.message })
    }
  }

  if (action === 'recipe') {
    const slug = url.searchParams.get('slug')
    if (!slug) return json(400, { error: 'Missing slug' })

    try {
      const resp = await fetch(`${MEALIE_URL}/api/recipes/${encodeURIComponent(slug)}`, {
        headers: { Authorization: `Bearer ${MEALIE_TOKEN}` },
        signal: AbortSignal.timeout(10000),
      })
      if (!resp.ok) return json(502, { error: `Mealie returned ${resp.status}` })
      const data = await resp.json()

      const ingredients = (data.recipeIngredient || []).map(ing => {
        if (typeof ing === 'string') return ing
        const parts = []
        if (ing.quantity && ing.quantity !== 0) parts.push(String(ing.quantity))
        if (ing.unit?.name) parts.push(ing.unit.name)
        if (ing.food?.name) parts.push(ing.food.name)
        if (ing.note) parts.push(ing.note)
        return parts.join(' ').trim() || ing.display || ing.note || ''
      }).filter(Boolean)

      return json(200, {
        name: data.name,
        slug: data.slug,
        description: data.description || '',
        ingredients,
        totalTime: data.totalTime || '',
        sourceUrl: data.orgURL || '',
        image: data.id ? `${MEALIE_URL}/api/media/recipes/${data.id}/images/min-original.webp` : null,
      })
    } catch (err) {
      return json(502, { error: err.message })
    }
  }

  return json(400, { error: 'Unknown action. Use ?action=search or ?action=recipe' })
}
