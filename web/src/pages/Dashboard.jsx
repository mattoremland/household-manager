import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { listTodoLists, listAllTodoItems, listGroceryItems, listNotes } from '../lib/db'
import { getEvents } from '../lib/calendar'
import './Dashboard.css'

export default function Dashboard() {
  const [calendarEvents, setCalendarEvents] = useState([])
  const [calendarError, setCalendarError] = useState(false)
  const [todoSummaries, setTodoSummaries] = useState([])
  const [groceryCount, setGroceryCount] = useState(0)
  const [recentNotes, setRecentNotes] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        loadCalendar(),
        loadTodos(),
        loadGrocery(),
        loadNotes(),
      ])

      const [cal, todos, grocery, notes] = results

      if (cal.status === 'fulfilled') {
        setCalendarEvents(cal.value)
      } else {
        setCalendarError(true)
      }

      if (todos.status === 'fulfilled') setTodoSummaries(todos.value)
      if (grocery.status === 'fulfilled') setGroceryCount(grocery.value)
      if (notes.status === 'fulfilled') setRecentNotes(notes.value)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="page">
      <PageHeader title="Dashboard" subtitle="Your household at a glance" />

      {loading && <p className="muted-text">Loading...</p>}

      {!loading && (
        <div className="dashboard-grid">
          <DashboardCard title="Today's Events" linkTo="/calendar" linkLabel="View calendar">
            {calendarError ? (
              <p className="muted-text">Could not load calendar.</p>
            ) : calendarEvents.length === 0 ? (
              <p className="muted-text">No events today.</p>
            ) : (
              <ul className="dash-list">
                {calendarEvents.map(evt => (
                  <li key={evt.id} className="dash-event">
                    <span className="dash-event-time">{evt.timeLabel}</span>
                    <span className="dash-event-title">{evt.summary}</span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>

          <DashboardCard title="Lists" linkTo="/lists" linkLabel="View lists">
            {todoSummaries.length === 0 ? (
              <p className="muted-text">No lists yet.</p>
            ) : (
              <ul className="dash-list">
                {todoSummaries.map(list => (
                  <li key={list.id} className="dash-list-item">
                    <span>{list.name}</span>
                    <span className="dash-count">{list.unchecked} unchecked</span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>

          <DashboardCard title="Grocery" linkTo="/grocery" linkLabel="View grocery list">
            {groceryCount === 0 ? (
              <p className="muted-text">Grocery list is empty.</p>
            ) : (
              <p className="dash-grocery-count">
                <span className="dash-count-number">{groceryCount}</span> item{groceryCount !== 1 ? 's' : ''} to buy
              </p>
            )}
          </DashboardCard>

          <DashboardCard title="Recent Notes" linkTo="/notes" linkLabel="View notes">
            {recentNotes.length === 0 ? (
              <p className="muted-text">No notes yet.</p>
            ) : (
              <ul className="dash-list">
                {recentNotes.map(note => (
                  <li key={note.id} className="dash-note">
                    <span className="dash-note-title">{note.title}</span>
                    <span className="muted-text dash-note-date">{formatDate(note.updated_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        </div>
      )}
    </div>
  )
}

function DashboardCard({ title, linkTo, linkLabel, children }) {
  return (
    <div className="card dash-card">
      <div className="dash-card-header">
        <h3 className="dash-card-title">{title}</h3>
        <Link to={linkTo} className="dash-card-link">{linkLabel}</Link>
      </div>
      {children}
    </div>
  )
}

async function loadCalendar() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)

  const events = await getEvents(startOfDay.toISOString(), endOfDay.toISOString())

  return events.slice(0, 5).map(evt => {
    let timeLabel = 'All day'
    if (!evt.allDay && evt.start) {
      timeLabel = new Date(evt.start).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    }
    return { id: evt.id, summary: evt.title || '(No title)', timeLabel }
  })
}

async function loadTodos() {
  const [lists, allItems] = await Promise.all([listTodoLists(), listAllTodoItems()])
  const uncheckedByList = {}
  for (const item of allItems) {
    if (!item.is_done) {
      uncheckedByList[item.list_id] = (uncheckedByList[item.list_id] || 0) + 1
    }
  }
  return lists.map(list => ({
    id: list.id,
    name: list.name,
    unchecked: uncheckedByList[list.id] || 0,
  }))
}

async function loadGrocery() {
  const items = await listGroceryItems()
  return items.filter(i => !i.is_checked).length
}

async function loadNotes() {
  const notes = await listNotes({ orderBy: 'updated_at' })
  return notes.slice(0, 5)
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
