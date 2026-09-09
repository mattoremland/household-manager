export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let url
  try {
    const body = JSON.parse(event.body || '{}')
    url = body.url
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  if (!url || typeof url !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing "url" field' }) }
  }

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HouseholdManager/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })

    if (!resp.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `Recipe site returned ${resp.status}` }),
      }
    }

    const html = await resp.text()

    const recipe = extractJsonLdRecipe(html) || extractMetaRecipe(html)

    if (!recipe) {
      return {
        statusCode: 422,
        body: JSON.stringify({ error: 'No recipe data found on that page' }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    }
  } catch (err) {
    const message = err.name === 'TimeoutError'
      ? 'Request timed out fetching the recipe page'
      : err.message
    return {
      statusCode: 502,
      body: JSON.stringify({ error: message }),
    }
  }
}

function extractJsonLdRecipe(html) {
  const scriptRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      let parsed = JSON.parse(match[1])

      if (Array.isArray(parsed)) {
        parsed = parsed.find(item => isRecipeType(item))
        if (!parsed) continue
      }

      if (parsed['@graph']) {
        parsed = parsed['@graph'].find(item => isRecipeType(item))
        if (!parsed) continue
      }

      if (!isRecipeType(parsed)) continue

      const title = parsed.name || ''
      const ingredients = Array.isArray(parsed.recipeIngredient)
        ? parsed.recipeIngredient.map(i => String(i).trim()).filter(Boolean)
        : []

      if (ingredients.length === 0) continue

      return { title, ingredients }
    } catch {
      continue
    }
  }
  return null
}

function isRecipeType(obj) {
  if (!obj || typeof obj !== 'object') return false
  const type = obj['@type']
  if (Array.isArray(type)) return type.some(t => String(t).toLowerCase() === 'recipe')
  return String(type || '').toLowerCase() === 'recipe'
}

function extractMetaRecipe(html) {
  const titleMatch = html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']+)["']/i)
    || html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''

  const ingredients = []
  const liRegex = /<li[^>]*class\s*=\s*["'][^"']*ingredient[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi
  let liMatch
  while ((liMatch = liRegex.exec(html)) !== null) {
    const text = liMatch[1].replace(/<[^>]+>/g, '').trim()
    if (text) ingredients.push(text)
  }

  if (ingredients.length === 0) return null

  return { title, ingredients }
}
