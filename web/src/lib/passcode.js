const STORAGE_KEY = 'appPasscode'
const HEADER = 'X-App-Passcode'
export const PASSCODE_REQUIRED_EVENT = 'passcode-required'

export function getPasscode() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function setPasscode(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {}
}

function clearPasscode() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

// fetch() for our Netlify Functions: attaches the passcode, and if the server rejects it
// (e.g. it was changed), forgets it so the app shows the passcode screen again.
export async function functionFetch(url, options = {}) {
  const resp = await fetch(url, {
    ...options,
    headers: { ...options.headers, [HEADER]: getPasscode() || '' },
  })
  if (resp.status === 401) {
    clearPasscode()
    window.dispatchEvent(new Event(PASSCODE_REQUIRED_EVENT))
  }
  return resp
}

// Returns true if the server accepts the passcode (and remembers it on this device).
export async function verifyAndSavePasscode(code) {
  const resp = await fetch('/.netlify/functions/verify-passcode', {
    headers: { [HEADER]: code },
  })
  const isJson = (resp.headers.get('content-type') || '').includes('application/json')
  // The Vite dev server can't run functions, so accept any passcode locally.
  if (!isJson && import.meta.env.DEV) {
    setPasscode(code)
    return true
  }
  if (resp.status === 401) return false
  if (!resp.ok) {
    const data = isJson ? await resp.json() : {}
    throw new Error(data.error || `Could not check passcode (${resp.status})`)
  }
  setPasscode(code)
  return true
}
