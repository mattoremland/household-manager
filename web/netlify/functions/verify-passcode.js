import { requirePasscode } from '../lib/passcode.js'

export default async (req) => {
  const denied = await requirePasscode(req)
  if (denied) return denied
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
