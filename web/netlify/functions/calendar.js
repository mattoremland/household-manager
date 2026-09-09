import { google } from 'googleapis'

let cachedAuth = null
let calendarTz = null

function getAuth() {
  if (cachedAuth) return cachedAuth

  const tokenJson = process.env.GOOGLE_OAUTH_TOKEN
  if (!tokenJson) throw new Error('GOOGLE_OAUTH_TOKEN not set')

  const token = JSON.parse(tokenJson)
  const oauth2 = new google.auth.OAuth2(
    token.client_id,
    token.client_secret
  )
  oauth2.setCredentials({
    access_token: token.token,
    refresh_token: token.refresh_token,
    token_type: 'Bearer',
    expiry_date: token.expiry ? new Date(token.expiry).getTime() : 0,
  })
  cachedAuth = oauth2
  return oauth2
}

function getCalendar() {
  return google.calendar({ version: 'v3', auth: getAuth() })
}

function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || 'primary'
}

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  })
}

function normalizeEvent(raw) {
  const startRaw = raw.start || {}
  const endRaw = raw.end || {}
  const allDay = !!startRaw.date
  const start = startRaw.date || startRaw.dateTime
  let end = endRaw.date || endRaw.dateTime

  if (allDay && end) {
    const d = new Date(end)
    d.setDate(d.getDate() - 1)
    end = d.toISOString().slice(0, 10)
  }

  let status = 'confirmed'
  if (raw.attendees) {
    const self = raw.attendees.find(a => a.self)
    if (self) status = self.responseStatus || 'needsAction'
  }

  return {
    id: raw.id,
    title: raw.summary || '(no title)',
    allDay,
    start,
    end,
    location: raw.location || '',
    description: raw.description || '',
    status,
  }
}

export default async (req) => {
  try {
    const url = new URL(req.url)
    const method = req.method
    const action = url.searchParams.get('action')
    const cal = getCalendar()
    const calendarId = getCalendarId()

    if (method === 'GET' && action === 'events') {
      const timeMin = url.searchParams.get('timeMin')
      const timeMax = url.searchParams.get('timeMax')
      if (!timeMin || !timeMax) return json(400, { error: 'timeMin and timeMax required' })

      const res = await cal.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500,
      })

      if (!calendarTz && res.data.timeZone) calendarTz = res.data.timeZone

      return json(200, {
        events: (res.data.items || []).map(normalizeEvent),
        timeZone: res.data.timeZone || calendarTz || 'UTC',
      })
    }

    if (method === 'GET' && action === 'timezone') {
      if (calendarTz) return json(200, { timeZone: calendarTz })

      const res = await cal.events.list({
        calendarId,
        maxResults: 1,
        singleEvents: true,
        orderBy: 'startTime',
      })
      calendarTz = res.data.timeZone || 'UTC'
      return json(200, { timeZone: calendarTz })
    }

    if (method === 'POST' && action === 'create') {
      const body = await req.json()
      const { summary, start, end, allDay, location, description } = body

      const startField = allDay ? { date: start } : { dateTime: start }
      const endField = allDay ? { date: end } : { dateTime: end }

      if (!allDay && calendarTz) {
        startField.timeZone = calendarTz
        endField.timeZone = calendarTz
      }

      const eventBody = { summary, start: startField, end: endField }
      if (location) eventBody.location = location
      if (description) eventBody.description = description

      const res = await cal.events.insert({ calendarId, requestBody: eventBody })
      return json(200, normalizeEvent(res.data))
    }

    if (method === 'PUT' && action === 'update') {
      const body = await req.json()
      const { eventId, summary, start, end, allDay, location, description } = body

      if (!eventId) return json(400, { error: 'eventId required' })

      const patch = {}
      if (summary !== undefined) patch.summary = summary
      if (location !== undefined) patch.location = location
      if (description !== undefined) patch.description = description

      if (start !== undefined && end !== undefined && allDay !== undefined) {
        const startField = allDay ? { date: start } : { dateTime: start }
        const endField = allDay ? { date: end } : { dateTime: end }
        if (!allDay && calendarTz) {
          startField.timeZone = calendarTz
          endField.timeZone = calendarTz
        }
        patch.start = startField
        patch.end = endField
      }

      const res = await cal.events.patch({
        calendarId,
        eventId,
        requestBody: patch,
      })
      return json(200, normalizeEvent(res.data))
    }

    if (method === 'DELETE' && action === 'delete') {
      const eventId = url.searchParams.get('eventId')
      if (!eventId) return json(400, { error: 'eventId required' })

      await cal.events.delete({ calendarId, eventId })
      return json(200, { ok: true })
    }

    return json(404, { error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('Calendar function error:', err)
    return json(500, { error: err.message })
  }
}
