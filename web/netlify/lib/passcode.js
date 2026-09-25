import { createHash, timingSafeEqual } from 'node:crypto'

export const PASSCODE_HEADER = 'x-app-passcode'

const FAILURE_DELAY_MS = 1000

function digest(value) {
  return createHash('sha256').update(value).digest()
}

function deny(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Returns a Response to send back when the request lacks the shared passcode, or null if it's allowed.
// Fails closed: with APP_PASSCODE unset, every request is refused.
export async function requirePasscode(req) {
  const expected = process.env.APP_PASSCODE
  if (!expected) return deny(500, 'APP_PASSCODE is not configured on the server')

  const given = req.headers.get(PASSCODE_HEADER) || ''
  if (timingSafeEqual(digest(given), digest(expected))) return null

  await new Promise(resolve => setTimeout(resolve, FAILURE_DELAY_MS))
  return deny(401, 'Passcode required')
}
