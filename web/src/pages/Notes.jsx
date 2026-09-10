import { useState, useEffect, useCallback } from 'react'
import PageHeader from '../components/PageHeader'
import Linkify from '../components/Linkify'
import KebabMenu from '../components/KebabMenu'
import ConfirmDialog from '../components/ConfirmDialog'
import { listNotes, searchNotes, addNote, updateNote, deleteNote, swapNoteOrder } from '../lib/db'
import { useDebouncedValue } from '../lib/utils'
import './Notes.css'

export default function Notes() {
  const [notes, setNotes] = useState([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [deletingNote, setDeletingNote] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const debouncedSearch = useDebouncedValue(search)

  const load = useCallback(async () => {
    try {
      const data = debouncedSearch ? await searchNotes(debouncedSearch) : await listNotes()
      setNotes(data)
    } catch (err) {
      console.error('Failed to load notes:', err)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { load() }, [load])

  async function handleMove(index, direction) {
    const target = notes[index]
    const neighbor = notes[index + direction]
    await swapNoteOrder(target.id, target.sort_order, neighbor.id, neighbor.sort_order)
    load()
  }

  const isSearching = !!debouncedSearch

  return (
    <div className="page">
      <PageHeader title="Notes" subtitle="Freeform notes" />

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

      {notes.map((note, i) => (
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
            onMoveUp={!isSearching && i > 0 ? () => handleMove(i, -1) : null}
            onMoveDown={!isSearching && i < notes.length - 1 ? () => handleMove(i, 1) : null}
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

function NoteCard({ note, onEdit, onDelete, onMoveUp, onMoveDown }) {
  return (
    <div className="card note-card">
      <div className="note-header">
        <strong className="note-title">{note.title}</strong>
        <div className="note-actions">
          {(onMoveUp || onMoveDown) && (
            <div className="reorder-btns">
              <button className="btn btn-ghost btn-sm" onClick={onMoveUp} disabled={!onMoveUp} aria-label="Move up">&#9650;</button>
              <button className="btn btn-ghost btn-sm" onClick={onMoveDown} disabled={!onMoveDown} aria-label="Move down">&#9660;</button>
            </div>
          )}
          <KebabMenu>
            <button onClick={onEdit}>Edit</button>
            <button className="danger" onClick={onDelete}>Delete</button>
          </KebabMenu>
        </div>
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
