import { useState, useEffect, useCallback } from 'react'
import PageHeader from '../components/PageHeader'
import Linkify from '../components/Linkify'
import KebabMenu from '../components/KebabMenu'
import ConfirmDialog from '../components/ConfirmDialog'
import { listNotes, searchNotes, addNote, updateNote, deleteNote } from '../lib/db'
import './Notes.css'

export default function Notes() {
  const [notes, setNotes] = useState([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [deletingNote, setDeletingNote] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = search ? await searchNotes(search) : await listNotes()
      setNotes(data)
    } catch (err) {
      console.error('Failed to load notes:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  return (
    <div className="page">
      <PageHeader title="Notes" subtitle="Freeform notes, sorted by most recently updated" />

      <input
        type="text"
        placeholder="Search title or body..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <hr className="divider" />

      <button className="btn btn-secondary btn-full add-toggle" onClick={() => setShowAddForm(v => !v)}>
        {showAddForm ? 'Cancel' : 'Add new note'}
      </button>

      {showAddForm && <AddNoteForm onAdded={() => { setShowAddForm(false); load() }} />}

      <hr className="divider" />

      {loading && <p className="muted-text">Loading...</p>}
      {!loading && notes.length === 0 && (
        <p className="muted-text">{search ? 'No matches found.' : 'No notes yet — add one above.'}</p>
      )}

      {notes.map(note => (
        editingId === note.id ? (
          <EditNoteForm
            key={note.id}
            note={note}
            onCancel={() => setEditingId(null)}
            onSaved={() => { setEditingId(null); load() }}
          />
        ) : (
          <NoteCard
            key={note.id}
            note={note}
            onEdit={() => setEditingId(note.id)}
            onDelete={() => setDeletingNote(note)}
          />
        )
      ))}

      {deletingNote && (
        <ConfirmDialog
          message={`Delete "${deletingNote.title}"?`}
          onConfirm={async () => {
            await deleteNote(deletingNote.id)
            setDeletingNote(null)
            load()
          }}
          onCancel={() => setDeletingNote(null)}
        />
      )}
    </div>
  )
}

function NoteCard({ note, onEdit, onDelete }) {
  return (
    <div className="card note-card">
      <div className="note-header">
        <strong className="note-title">{note.title}</strong>
        <KebabMenu>
          <button onClick={onEdit}>Edit</button>
          <button className="danger" onClick={onDelete}>Delete</button>
        </KebabMenu>
      </div>
      {note.body && (
        <div className="note-body">
          <Linkify text={note.body} />
        </div>
      )}
      <p className="note-updated">
        Updated {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  )
}

function AddNoteForm({ onAdded }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    try {
      await addNote(title.trim(), body.trim())
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card note-form" onSubmit={handleSubmit}>
      <label className="form-label">
        Title
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="form-label">
        Body
        <textarea rows={6} value={body} onChange={e => setBody(e.target.value)} />
      </label>
      <p className="note-tip">Tip: start a line with "- " for a bullet or "1. " for a numbered list. URLs, phone numbers, and addresses become clickable links automatically.</p>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
        {saving ? 'Adding...' : 'Add'}
      </button>
    </form>
  )
}

function EditNoteForm({ note, onCancel, onSaved }) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    try {
      await updateNote(note.id, { title: title.trim(), body: body.trim() })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card note-form" onSubmit={handleSubmit}>
      <label className="form-label">
        Title
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="form-label">
        Body
        <textarea rows={6} value={body} onChange={e => setBody(e.target.value)} />
      </label>
      <p className="note-tip">Tip: start a line with "- " for a bullet or "1. " for a numbered list. URLs, phone numbers, and addresses become clickable links automatically.</p>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
