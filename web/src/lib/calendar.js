const BASE = '/.netlify/functions/calendar'

async function calendarFetch(params, options = {}) {
  const url = new URL(BASE, window.location.origin)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Calendar API error ${res.status}`)
  return data
}

export async function getEvents(timeMin, timeMax) {
  const data = await calendarFetch({ action: 'events', timeMin, timeMax })
  return data.events
}

export async function getTimezone() {
  const data = await calendarFetch({ action: 'timezone' })
  return data.timeZone
}

export async function createEvent({ summary, start, end, allDay, location, description }) {
  return calendarFetch({ action: 'create' }, {
    method: 'POST',
    body: JSON.stringify({ summary, start, end, allDay, location, description }),
  })
}

export async function updateEvent({ eventId, summary, start, end, allDay, location, description }) {
  return calendarFetch({ action: 'update' }, {
    method: 'PUT',
    body: JSON.stringify({ eventId, summary, start, end, allDay, location, description }),
  })
}

export async function deleteEvent(eventId) {
  return calendarFetch({ action: 'delete', eventId }, { method: 'DELETE' })
}
