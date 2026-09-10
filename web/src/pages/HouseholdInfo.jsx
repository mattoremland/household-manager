import { useState, useEffect, useCallback } from 'react'
import PageHeader from '../components/PageHeader'
import Linkify from '../components/Linkify'
import KebabMenu from '../components/KebabMenu'
import ConfirmDialog from '../components/ConfirmDialog'
import { Badge } from '../components/Badge'
import { listHouseholdInfo, searchHouseholdInfo, addHouseholdInfo, updateHouseholdInfo, deleteHouseholdInfo } from '../lib/db'
import { extractPhone, useDebouncedValue } from '../lib/utils'
import './HouseholdInfo.css'

const CATEGORIES = ['Contacts', 'Manuals', 'Medical']

export default function HouseholdInfo() {
  const [entries, setEntries] = useState([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [allCategories, setAllCategories] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [deletingEntry, setDeletingEntry] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const debouncedSearch = useDebouncedValue(search)

  const load = useCallback(async () => {
    try {
      let data
      if (debouncedSearch) {
        data = await searchHouseholdInfo(debouncedSearch)
      } else {
        data = await listHouseholdInfo()
      }
      data.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))

      const cats = [...new Set(data.map(e => e.category))].sort()
      setAllCategories(cats)

      if (!debouncedSearch && categoryFilter !== 'All') {
        data = data.filter(e => e.category === categoryFilter)
      }
      setEntries(data)
    } catch (err) {
      console.error('Failed to load household info:', err)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, categoryFilter])

  useEffect(() => { load() }, [load])

  const grouped = !debouncedSearch && categoryFilter === 'All'

  let content
  if (loading) {
    content = <p className="muted-text">Loading...</p>
  } else if (entries.length === 0) {
    content = <p className="muted-text">{search ? 'No matches found.' : 'No entries yet — add one above.'}</p>
  } else if (grouped) {
    const byCategory = {}
    for (const e of entries) {
      ;(byCategory[e.category] ||= []).push(e)
    }
    content = Object.keys(byCategory).sort().map(cat => (
      <div key={cat} className="category-group">
        <h3 className="category-heading">{cat}</h3>
        {byCategory[cat].map(entry => (
          <EntryCard
            key={entry.id}
            entry={entry}
            showCategory={false}
            editingId={editingId}
            setEditingId={setEditingId}
            onDelete={setDeletingEntry}
            onSaved={load}
          />
        ))}
      </div>
    ))
  } else {
    content = entries.map(entry => (
      <EntryCard
        key={entry.id}
        entry={entry}
        showCategory={!!search}
        editingId={editingId}
        setEditingId={setEditingId}
        onDelete={setDeletingEntry}
        onSaved={load}
      />
    ))
  }

  return (
    <div className="page">
      <PageHeader title="Household Info" subtitle="Manuals, contacts, wifi, and other reference info" />

      <input
        type="text"
        placeholder="Search title or content..."
        value={search}
        onChange={e => { setSearch(e.target.value); setCategoryFilter('All') }}
      />

      {!search && allCategories.length > 0 && (
        <select
          className="category-select"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="All">All</option>
          {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      )}

      <hr className="divider" />

      <button className="btn btn-secondary btn-full add-toggle" onClick={() => setShowAddForm(v => !v)}>
        {showAddForm ? 'Cancel' : 'Add new entry'}
      </button>

      {showAddForm && <AddForm onAdded={() => { setShowAddForm(false); load() }} />}

      <hr className="divider" />

      {content}

      {deletingEntry && (
        <ConfirmDialog
          message={`Delete "${deletingEntry.title}"?`}
          onConfirm={async () => {
            await deleteHouseholdInfo(deletingEntry.id)
            setDeletingEntry(null)
            load()
          }}
          onCancel={() => setDeletingEntry(null)}
        />
      )}
    </div>
  )
}

function EntryCard({ entry, showCategory, editingId, setEditingId, onDelete, onSaved }) {
  if (editingId === entry.id) {
    return <EditForm entry={entry} onCancel={() => setEditingId(null)} onSaved={() => { setEditingId(null); onSaved() }} />
  }

  const phone = extractPhone(entry.content || '')

  return (
    <div className="card entry-card">
      <div className="entry-header">
        <div className="entry-title-row">
          {phone ? (
            <a href={`sms:${phone}`} className="entry-title-link" title={`Text ${entry.title}`}>
              {entry.title}
            </a>
          ) : (
            <strong>{entry.title}</strong>
          )}
          {showCategory && <Badge>{entry.category}</Badge>}
        </div>
        <KebabMenu>
          <button onClick={() => setEditingId(entry.id)}>Edit</button>
          <button className="danger" onClick={() => onDelete(entry)}>Delete</button>
        </KebabMenu>
      </div>
      {entry.content && (
        <div className="entry-content">
          <Linkify text={entry.content} />
        </div>
      )}
    </div>
  )
}

function AddForm({ onAdded }) {
  const [category, setCategory] = useState(CATEGORIES[0])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    try {
      await addHouseholdInfo(title.trim(), content.trim(), category)
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card entry-form" onSubmit={handleSubmit}>
      <label className="form-label">
        Category
        <select value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="form-label">
        Title
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} />
      </label>
      <label className="form-label">
        Content
        <textarea rows={4} value={content} onChange={e => setContent(e.target.value)} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
        {saving ? 'Adding...' : 'Add'}
      </button>
    </form>
  )
}

function EditForm({ entry, onCancel, onSaved }) {
  const editOptions = CATEGORIES.includes(entry.category) ? CATEGORIES : [...CATEGORIES, entry.category]
  const [category, setCategory] = useState(entry.category)
  const [title, setTitle] = useState(entry.title)
  const [content, setContent] = useState(entry.content || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    try {
      await updateHouseholdInfo(entry.id, { category, title: title.trim(), content: content.trim() })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card entry-form" onSubmit={handleSubmit}>
      <label className="form-label">
        Category
        <select value={category} onChange={e => setCategory(e.target.value)}>
          {editOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="form-label">
        Title
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} />
      </label>
      <label className="form-label">
        Content
        <textarea rows={4} value={content} onChange={e => setContent(e.target.value)} />
      </label>
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
