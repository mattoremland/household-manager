import { useState, useEffect, useCallback } from 'react'
import PageHeader from '../components/PageHeader'
import KebabMenu from '../components/KebabMenu'
import ConfirmDialog from '../components/ConfirmDialog'
import { TagBadge } from '../components/Badge'
import {
  listTodoLists, addTodoList, renameTodoList, deleteTodoList,
  listTodoItems, addTodoItem, updateTodoItem, checkTodoItem, deleteTodoItem, clearCheckedTodoItems
} from '../lib/db'
import './Lists.css'

export default function Lists() {
  const [lists, setLists] = useState([])
  const [showNewList, setShowNewList] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await listTodoLists()
      setLists(data)
    } catch (err) {
      console.error('Failed to load lists:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="page">
      <PageHeader title="Lists" subtitle="Shared checklists" />

      <button className="btn btn-secondary btn-full" onClick={() => setShowNewList(v => !v)}>
        {showNewList ? 'Cancel' : 'New list'}
      </button>

      {showNewList && <NewListForm onCreated={() => { setShowNewList(false); load() }} />}

      <hr className="divider" />

      {loading && <p className="muted-text">Loading...</p>}
      {!loading && lists.length === 0 && <p className="muted-text">No lists yet — create one above.</p>}

      {lists.map(list => (
        <TodoList key={list.id} list={list} onChanged={load} />
      ))}
    </div>
  )
}

function NewListForm({ onCreated }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    try {
      await addTodoList(name.trim())
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card new-list-form" onSubmit={handleSubmit}>
      <input type="text" placeholder="List name" value={name} onChange={e => setName(e.target.value)} autoFocus />
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
        {saving ? 'Creating...' : 'Create'}
      </button>
    </form>
  )
}

function TodoList({ list, onChanged }) {
  const [items, setItems] = useState([])
  const [editingItemId, setEditingItemId] = useState(null)
  const [renamingList, setRenamingList] = useState(false)
  const [deletingList, setDeletingList] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  const loadItems = useCallback(async () => {
    try {
      const data = await listTodoItems(list.id)
      setItems(data)
    } catch (err) {
      console.error('Failed to load items:', err)
    }
  }, [list.id])

  useEffect(() => { loadItems() }, [loadItems])

  const active = items.filter(i => !i.done)
  const completed = items.filter(i => i.done)

  async function handleCheck(item) {
    await checkTodoItem(item.id, !item.done)
    loadItems()
  }

  async function handleDeleteItem(id) {
    await deleteTodoItem(id)
    loadItems()
  }

  async function handleRestore(id) {
    await checkTodoItem(id, false)
    loadItems()
  }

  async function handleClearCompleted() {
    await clearCheckedTodoItems(list.id)
    loadItems()
  }

  if (renamingList) {
    return (
      <div className="list-section">
        <RenameListForm
          list={list}
          onCancel={() => setRenamingList(false)}
          onSaved={() => { setRenamingList(false); onChanged() }}
        />
        <hr className="divider" />
      </div>
    )
  }

  return (
    <div className="list-section">
      <div className="list-header">
        <h3 className="list-heading">{list.name}</h3>
        <KebabMenu>
          <button onClick={() => setRenamingList(true)}>Rename</button>
          <button className="danger" onClick={() => setDeletingList(true)}>Delete list</button>
          {completed.length > 0 && (
            <>
              <hr className="kebab-divider" />
              <button onClick={() => setShowCompleted(v => !v)}>
                {showCompleted ? 'Hide' : 'Show'} completed ({completed.length})
              </button>
              <button className="danger" onClick={handleClearCompleted}>Clear completed</button>
            </>
          )}
        </KebabMenu>
      </div>

      <AddItemForm listId={list.id} onAdded={loadItems} />

      {active.length === 0 && completed.length === 0 && (
        <p className="muted-text list-empty">No items yet — add one above.</p>
      )}
      {active.length === 0 && completed.length > 0 && (
        <p className="muted-text list-empty">All done! Checked items are in this list's ⋮ menu.</p>
      )}

      {active.map(item => (
        editingItemId === item.id ? (
          <EditItemForm
            key={item.id}
            item={item}
            onCancel={() => setEditingItemId(null)}
            onSaved={() => { setEditingItemId(null); loadItems() }}
          />
        ) : (
          <div key={item.id} className="todo-item">
            <label className="todo-check">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => handleCheck(item)}
              />
              <span className="todo-text">{item.text}</span>
              {item.tag && <TagBadge tag={item.tag} />}
            </label>
            <div className="todo-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingItemId(item.id)} aria-label="Edit">
                &#9998;
              </button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => handleDeleteItem(item.id)} aria-label="Delete">
                &#10005;
              </button>
            </div>
          </div>
        )
      ))}

      {showCompleted && completed.length > 0 && (
        <div className="completed-section">
          <p className="completed-heading">Completed ({completed.length})</p>
          {completed.map(item => (
            <div key={item.id} className="todo-item completed">
              <span className="todo-text struck">{item.text}</span>
              {item.tag && <TagBadge tag={item.tag} />}
              <div className="todo-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => handleRestore(item.id)} aria-label="Restore" title="Restore">
                  &#8634;
                </button>
                <button className="btn btn-ghost btn-sm danger" onClick={() => handleDeleteItem(item.id)} aria-label="Delete">
                  &#10005;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <hr className="divider" />

      {deletingList && (
        <ConfirmDialog
          message={`Delete "${list.name}"? This removes all its items.`}
          onConfirm={async () => {
            await deleteTodoList(list.id)
            setDeletingList(false)
            onChanged()
          }}
          onCancel={() => setDeletingList(false)}
        />
      )}
    </div>
  )
}

function AddItemForm({ listId, onAdded }) {
  const [text, setText] = useState('')
  const [tag, setTag] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) { setError('Item text is required.'); return }
    try {
      await addTodoItem(listId, text.trim(), tag.trim() || null)
      setText('')
      setTag('')
      setError(null)
      onAdded()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="add-item-form" onSubmit={handleSubmit}>
      <div className="add-item-row">
        <input
          type="text"
          placeholder="Add an item..."
          value={text}
          onChange={e => setText(e.target.value)}
          className="add-item-input"
        />
        <input
          type="text"
          placeholder="Tag"
          value={tag}
          onChange={e => setTag(e.target.value)}
          className="add-item-tag"
        />
        <button type="submit" className="btn btn-primary btn-sm">Add</button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  )
}

function EditItemForm({ item, onCancel, onSaved }) {
  const [text, setText] = useState(item.text)
  const [tag, setTag] = useState(item.tag || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) { setError('Item text is required.'); return }
    setSaving(true)
    try {
      await updateTodoItem(item.id, { text: text.trim(), tag: tag.trim() || null })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card edit-item-form" onSubmit={handleSubmit}>
      <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Item text" autoFocus />
      <input type="text" value={tag} onChange={e => setTag(e.target.value)} placeholder="Tag (optional)" />
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

function RenameListForm({ list, onCancel, onSaved }) {
  const [name, setName] = useState(list.name)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    try {
      await renameTodoList(list.id, name.trim())
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card edit-item-form" onSubmit={handleSubmit}>
      <label className="form-label">
        Rename list
        <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus />
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
