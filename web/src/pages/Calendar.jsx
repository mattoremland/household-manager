import { useState, useEffect, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import { getEvents, createEvent, updateEvent, deleteEvent } from '../lib/calendar'
import './Calendar.css'

const WINDOW_BACK = 45
const WINDOW_FWD = 210

function toLocalDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toLocalTimeStr(d) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export default function Calendar() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addDefaults, setAddDefaults] = useState(null)
  const [deletingEvent, setDeletingEvent] = useState(null)
  const calRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const now = new Date()
      const min = new Date(now)
      min.setDate(min.getDate() - WINDOW_BACK)
      const max = new Date(now)
      max.setDate(max.getDate() + WINDOW_FWD)
      const data = await getEvents(min.toISOString(), max.toISOString())
      setEvents(data)
      setError(null)
    } catch (err) {
      console.error('Failed to load calendar:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const fcEvents = events.map(e => {
    const base = {
      id: e.id,
      title: e.title,
      start: e.start,
      allDay: !!e.allDay,
    }

    if (e.allDay) {
      const endDate = new Date(e.end)
      endDate.setDate(endDate.getDate() + 1)
      base.end = endDate.toISOString().slice(0, 10)
    } else {
      base.end = e.end
    }

    if (e.status === 'needsAction' || e.status === 'tentative') {
      base.classNames = ['fc-event-invited']
    } else if (e.status === 'declined') {
      base.classNames = ['fc-event-declined']
    }

    return base
  })

  function handleEventClick(info) {
    const ev = events.find(e => e.id === info.event.id)
    if (ev) {
      setEditingEvent(ev)
      setShowAddForm(false)
    }
  }

  async function handleEventDrop(info) {
    const ev = events.find(e => e.id === info.event.id)
    if (!ev) return

    const allDay = info.event.allDay
    let start, end

    if (allDay) {
      start = toLocalDateStr(info.event.start)
      const endDate = info.event.end ? new Date(info.event.end) : new Date(info.event.start)
      if (info.event.end) endDate.setDate(endDate.getDate() - 1)
      end = toLocalDateStr(endDate)
    } else {
      start = info.event.start.toISOString()
      end = (info.event.end || info.event.start).toISOString()
    }

    try {
      await updateEvent({ eventId: ev.id, start, end, allDay })
      load()
    } catch (err) {
      console.error('Failed to reschedule:', err)
      info.revert()
    }
  }

  function handleDateSelect(info) {
    const allDay = info.allDay
    setAddDefaults({
      date: toLocalDateStr(info.start),
      allDay,
      startTime: allDay ? '09:00' : toLocalTimeStr(info.start),
      endTime: allDay ? '10:00' : toLocalTimeStr(info.end),
    })
    setShowAddForm(true)
    setEditingEvent(null)
  }

  return (
    <div className="page calendar-page">
      <PageHeader title="Calendar" />

      {error && <p className="form-error">Could not load calendar: {error}</p>}

      {loading ? (
        <p className="muted-text">Loading calendar...</p>
      ) : (
        <div className="fc-wrapper">
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'title',
              center: '',
              right: 'prev,next',
            }}
            footerToolbar={{
              left: 'today',
              center: '',
              right: 'dayGridMonth,timeGrid3Day,listMonth',
            }}
            views={{
              timeGrid3Day: { type: 'timeGrid', duration: { days: 3 }, buttonText: '3-day' },
              dayGridMonth: { titleFormat: { year: 'numeric', month: 'short' } },
            }}
            buttonText={{
              today: 'Today',
              dayGridMonth: 'Month',
              listMonth: 'List',
            }}
            titleFormat={{ year: 'numeric', month: 'short', day: 'numeric' }}
            scrollTime="07:00:00"
            height="auto"
            contentHeight={560}
            editable={true}
            selectable={true}
            navLinks={true}
            nowIndicator={true}
            dayMaxEvents={true}
            firstDay={0}
            events={fcEvents}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventDrop}
            select={handleDateSelect}
          />
        </div>
      )}

      <p className="muted-text cal-hint">Tap an event to edit. Drag to reschedule. Select a date range to add.</p>

      <hr className="divider" />

      <div className="cal-action-row">
        <button
          className="btn btn-secondary btn-full"
          onClick={() => { setShowAddForm(v => !v); setEditingEvent(null) }}
        >
          {showAddForm ? 'Cancel' : 'Add event'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => { setLoading(true); load() }}
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      {showAddForm && (
        <EventForm
          defaults={addDefaults}
          onSaved={() => { setShowAddForm(false); setAddDefaults(null); load() }}
          onCancel={() => { setShowAddForm(false); setAddDefaults(null) }}
        />
      )}

      {editingEvent && (
        <>
          <hr className="divider" />
          <EventForm
            event={editingEvent}
            onSaved={() => { setEditingEvent(null); load() }}
            onCancel={() => setEditingEvent(null)}
            onDelete={() => setDeletingEvent(editingEvent)}
          />
        </>
      )}

      {deletingEvent && (
        <ConfirmDialog
          message={`Delete "${deletingEvent.title}"?`}
          onConfirm={async () => {
            await deleteEvent(deletingEvent.id)
            setDeletingEvent(null)
            setEditingEvent(null)
            load()
          }}
          onCancel={() => setDeletingEvent(null)}
        />
      )}
    </div>
  )
}

function EventForm({ event, defaults, onSaved, onCancel, onDelete }) {
  const isEdit = !!event

  const initDate = () => {
    if (event) {
      return event.allDay ? event.start : event.start.slice(0, 10)
    }
    return defaults?.date || toLocalDateStr(new Date())
  }

  const initAllDay = () => {
    if (event) return event.allDay
    return defaults?.allDay ?? false
  }

  const initStartTime = () => {
    if (event && !event.allDay) {
      const d = new Date(event.start)
      return toLocalTimeStr(d)
    }
    return defaults?.startTime || '09:00'
  }

  const initEndTime = () => {
    if (event && !event.allDay) {
      const d = new Date(event.end)
      return toLocalTimeStr(d)
    }
    return defaults?.endTime || '10:00'
  }

  const [summary, setSummary] = useState(event?.title || '')
  const [date, setDate] = useState(initDate)
  const [allDay, setAllDay] = useState(initAllDay)
  const [startTime, setStartTime] = useState(initStartTime)
  const [endTime, setEndTime] = useState(initEndTime)
  const [location, setLocation] = useState(event?.location || '')
  const [description, setDescription] = useState(event?.description || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!summary.trim()) { setError('Title is required.'); return }
    if (!allDay && endTime <= startTime) { setError('End time must be after start time.'); return }

    setSaving(true)
    try {
      let start, end
      if (allDay) {
        start = date
        end = date
      } else {
        start = `${date}T${startTime}:00`
        end = `${date}T${endTime}:00`
      }

      if (isEdit) {
        await updateEvent({
          eventId: event.id,
          summary: summary.trim(),
          start,
          end,
          allDay,
          location: location.trim(),
          description: description.trim(),
        })
      } else {
        await createEvent({
          summary: summary.trim(),
          start,
          end,
          allDay,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
        })
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card event-form" onSubmit={handleSubmit}>
      <h4 className="event-form-title">{isEdit ? 'Edit event' : 'Add event'}</h4>

      <label className="form-label">
        Title
        <input type="text" value={summary} onChange={e => setSummary(e.target.value)} autoFocus />
      </label>

      <label className="form-label">
        Date
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </label>

      <label className="form-label checkbox-label">
        <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
        All day
      </label>

      {!allDay && (
        <div className="time-row">
          <label className="form-label">
            Start
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </label>
          <label className="form-label">
            End
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </label>
        </div>
      )}

      <label className="form-label">
        Location (optional)
        <input type="text" value={location} onChange={e => setLocation(e.target.value)} />
      </label>

      <label className="form-label">
        Notes (optional)
        <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        {isEdit && onDelete && (
          <button type="button" className="btn btn-danger" onClick={onDelete}>Delete</button>
        )}
        <div className="form-actions-right">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </form>
  )
}
