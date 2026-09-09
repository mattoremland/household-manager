import { useState, useEffect, useCallback, useRef } from 'react'
import PageHeader from '../components/PageHeader'
import KebabMenu from '../components/KebabMenu'
import ConfirmDialog from '../components/ConfirmDialog'
import Linkify from '../components/Linkify'
import {
  listGroceryItems, addGroceryItem, checkGroceryItem, deleteGroceryItem,
  clearCheckedGroceryItems, addIngredientsToGroceryList,
  listMealPlan, addMealPlanEntry, updateMealPlanEntry, deleteMealPlanEntry
} from '../lib/db'
import './GroceryMeals.css'

export default function GroceryMeals() {
  const [groceryItems, setGroceryItems] = useState([])
  const [mealEntries, setMealEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    try {
      const [items, meals] = await Promise.all([listGroceryItems(), listMealPlan()])
      setGroceryItems(items)
      setMealEntries(meals)
    } catch (err) {
      console.error('Failed to load grocery/meals:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const loadGrocery = useCallback(async () => {
    try {
      const items = await listGroceryItems()
      setGroceryItems(items)
    } catch (err) {
      console.error('Failed to load grocery items:', err)
    }
  }, [])

  const loadMeals = useCallback(async () => {
    try {
      const meals = await listMealPlan()
      setMealEntries(meals)
    } catch (err) {
      console.error('Failed to load meal plan:', err)
    }
  }, [])

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Grocery & Meals" />
        <p className="muted-text">Loading...</p>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title="Grocery & Meals" subtitle="Shared grocery list and meal plan" />

      <GrocerySection items={groceryItems} onChanged={loadGrocery} />

      <hr className="divider" />

      <MealPlanSection entries={mealEntries} onChanged={loadMeals} onGroceryChanged={loadGrocery} />
    </div>
  )
}


// ─── Grocery Section ────────────────────────────────────────

function GrocerySection({ items, onChanged }) {
  const unchecked = items.filter(i => !i.is_checked)
  const checked = items.filter(i => i.is_checked)
  const sorted = [...unchecked, ...checked]

  return (
    <div className="grocery-section">
      <h3 className="section-heading">Grocery list</h3>

      <GroceryAddForm onAdded={onChanged} />

      {sorted.length === 0 && (
        <p className="muted-text">Grocery list is empty — add something above.</p>
      )}

      {sorted.map(item => (
        <GroceryItemRow key={item.id} item={item} onChanged={onChanged} />
      ))}

      {checked.length > 0 && (
        <ClearCheckedButton count={checked.length} onCleared={onChanged} />
      )}

      {unchecked.length > 0 && (
        <CopyListToggle items={unchecked} />
      )}
    </div>
  )
}

function GroceryAddForm({ onAdded }) {
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState(null)
  const nameRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Item name is required.'); return }
    try {
      await addGroceryItem(name.trim(), qty.trim() || null)
      setName('')
      setQty('')
      setError(null)
      nameRef.current?.focus()
      onAdded()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="grocery-add-form" onSubmit={handleSubmit}>
      <input
        ref={nameRef}
        type="text"
        placeholder="Item name..."
        value={name}
        onChange={e => setName(e.target.value)}
        className="grocery-add-name"
      />
      <input
        type="text"
        placeholder="Qty"
        value={qty}
        onChange={e => setQty(e.target.value)}
        className="grocery-add-qty"
      />
      <button type="submit" className="btn btn-primary">Add</button>
      {error && <p className="form-error" style={{ flex: '1 1 100%' }}>{error}</p>}
    </form>
  )
}

function GroceryItemRow({ item, onChanged }) {
  async function handleCheck() {
    await checkGroceryItem(item.id, !item.is_checked)
    onChanged()
  }

  async function handleDelete() {
    await deleteGroceryItem(item.id)
    onChanged()
  }

  const label = item.quantity
    ? <>{item.name} <span className="qty">({item.quantity})</span></>
    : item.name

  return (
    <div className={`grocery-item${item.is_checked ? ' checked' : ''}`}>
      <label className="grocery-check">
        <input type="checkbox" checked={item.is_checked} onChange={handleCheck} />
        <span className="grocery-check-label">{label}</span>
      </label>
      <div className="grocery-delete">
        <button className="btn btn-ghost" onClick={handleDelete} aria-label="Delete">
          &#10005;
        </button>
      </div>
    </div>
  )
}

function ClearCheckedButton({ count, onCleared }) {
  async function handleClear() {
    await clearCheckedGroceryItems()
    onCleared()
  }

  return (
    <button className="btn btn-secondary btn-full" onClick={handleClear} style={{ marginTop: '0.5rem' }}>
      Clear {count} checked
    </button>
  )
}

function CopyListToggle({ items }) {
  const [show, setShow] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')
  const textareaRef = useRef(null)

  const text = items.map(i =>
    i.quantity ? `${i.name} (${i.quantity})` : i.name
  ).join('\n')

  function handleTextareaClick() {
    const el = textareaRef.current
    if (el) {
      el.focus()
      el.setSelectionRange(0, el.value.length)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMsg('Copied!')
    } catch {
      const el = textareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(0, el.value.length)
        const ok = document.execCommand('copy')
        setCopyMsg(ok ? 'Copied!' : 'Tap the list to select, then Copy.')
      }
    }
    setTimeout(() => setCopyMsg(''), 2500)
  }

  return (
    <div className="copy-toggle" style={{ marginTop: '0.75rem' }}>
      <button
        className="btn btn-secondary btn-full"
        onClick={() => setShow(v => !v)}
      >
        {show ? 'Hide copy list' : 'Copy list'}
      </button>
      {show && (
        <div className="copy-box-container" style={{ marginTop: '0.5rem' }}>
          <textarea
            ref={textareaRef}
            readOnly
            className="copy-box"
            value={text}
            rows={Math.min(12, items.length + 1)}
            onClick={handleTextareaClick}
          />
          <p className="copy-hint">Tap the list to select it, then tap Copy.</p>
          <button className="btn btn-primary btn-full" onClick={handleCopy} style={{ marginTop: '0.5rem' }}>
            Copy to clipboard
          </button>
          {copyMsg && <p className="copy-result">{copyMsg}</p>}
        </div>
      )}
    </div>
  )
}


// ─── Meal Plan Section ──────────────────────────────────────

function MealPlanSection({ entries, onChanged, onGroceryChanged }) {
  const [showForm, setShowForm] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deletingEntry, setDeletingEntry] = useState(null)

  const todayIso = new Date().toISOString().slice(0, 10)
  const visible = showPast ? entries : entries.filter(e => e.date >= todayIso)

  return (
    <div className="meals-section">
      <h3 className="section-heading">Meal plan</h3>

      <div className="meal-form-toggle">
        <button
          className="btn btn-secondary btn-full"
          onClick={() => setShowForm(v => !v)}
        >
          {showForm ? 'Cancel' : 'Add a planned meal'}
        </button>
      </div>

      {showForm && (
        <AddMealForm
          onAdded={() => { setShowForm(false); onChanged() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="past-toggle">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={showPast}
            onChange={() => setShowPast(v => !v)}
            style={{ accentColor: 'var(--accent-teal)', width: '1rem', height: '1rem' }}
          />
          Show past meals
        </label>
      </div>

      {visible.length === 0 && (
        <p className="muted-text">No upcoming meals planned — add one above.</p>
      )}

      {visible.map(entry => (
        editingId === entry.id ? (
          <EditMealForm
            key={entry.id}
            entry={entry}
            onSaved={() => { setEditingId(null); onChanged() }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <MealCard
            key={entry.id}
            entry={entry}
            onEdit={() => setEditingId(entry.id)}
            onDelete={() => setDeletingEntry(entry)}
            onGroceryChanged={onGroceryChanged}
          />
        )
      ))}

      {deletingEntry && (
        <ConfirmDialog
          message={`Delete "${deletingEntry.meal_name}"?`}
          onConfirm={async () => {
            await deleteMealPlanEntry(deletingEntry.id)
            setDeletingEntry(null)
            onChanged()
          }}
          onCancel={() => setDeletingEntry(null)}
        />
      )}
    </div>
  )
}

function AddMealForm({ onAdded, onCancel }) {
  const todayIso = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(todayIso)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  async function handleFetchRecipe() {
    if (!sourceUrl.trim()) { setFetchError('Paste a recipe URL first.'); return }
    setFetching(true)
    setFetchError(null)
    try {
      const resp = await fetch('/.netlify/functions/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl.trim() }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setFetchError(data.error || 'Failed to fetch recipe')
        return
      }
      if (data.title && !name) setName(data.title)
      if (data.ingredients?.length) {
        setIngredients(data.ingredients.join('\n'))
      }
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setFetching(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Meal name is required.'); return }
    setSaving(true)
    try {
      await addMealPlanEntry(
        date,
        name.trim(),
        notes.trim() || null,
        ingredients.trim() || null,
        sourceUrl.trim() || null,
      )
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card meal-form" onSubmit={handleSubmit}>
      <div className="recipe-fetch-row">
        <input
          type="url"
          placeholder="Paste a recipe link..."
          value={sourceUrl}
          onChange={e => setSourceUrl(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleFetchRecipe}
          disabled={fetching}
        >
          {fetching ? 'Fetching...' : 'Fetch'}
        </button>
      </div>
      {fetchError && <p className="form-error">{fetchError}</p>}

      <label className="form-label">
        Date
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </label>

      <label className="form-label">
        Meal
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Meal name" />
      </label>

      <label className="form-label">
        Notes (optional)
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={3} />
      </label>

      <label className="form-label">
        Ingredients (one per line)
        <textarea
          value={ingredients}
          onChange={e => setIngredients(e.target.value)}
          placeholder={"2 chicken breasts\n1 bag rice\nBroccoli"}
          rows={5}
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Add meal'}
        </button>
      </div>
    </form>
  )
}

function EditMealForm({ entry, onSaved, onCancel }) {
  const [date, setDate] = useState(entry.date)
  const [name, setName] = useState(entry.meal_name)
  const [notes, setNotes] = useState(entry.notes || '')
  const [ingredients, setIngredients] = useState(entry.ingredients || '')
  const [sourceUrl, setSourceUrl] = useState(entry.source_url || '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Meal name is required.'); return }
    setSaving(true)
    try {
      await updateMealPlanEntry(entry.id, {
        date,
        name: name.trim(),
        notes: notes.trim() || null,
        ingredients: ingredients.trim() || null,
        sourceUrl: sourceUrl.trim() || null,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card meal-form" onSubmit={handleSubmit}>
      <label className="form-label">
        Date
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </label>

      <label className="form-label">
        Meal
        <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus />
      </label>

      <label className="form-label">
        Notes (optional)
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </label>

      <label className="form-label">
        Ingredients (one per line)
        <textarea value={ingredients} onChange={e => setIngredients(e.target.value)} rows={5} />
      </label>

      <label className="form-label">
        Recipe URL (optional)
        <input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
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

function MealCard({ entry, onEdit, onDelete, onGroceryChanged }) {
  const [addingMsg, setAddingMsg] = useState(null)

  let prettyDate
  try {
    const d = new Date(entry.date + 'T00:00:00')
    prettyDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    prettyDate = entry.date
  }

  const ingredientLines = (entry.ingredients || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  async function handleAddIngredients() {
    try {
      const added = await addIngredientsToGroceryList(ingredientLines)
      if (added > 0) {
        setAddingMsg(`Added ${added} item${added !== 1 ? 's' : ''} to the grocery list.`)
      } else {
        setAddingMsg('Those are already on the grocery list.')
      }
      onGroceryChanged()
      setTimeout(() => setAddingMsg(null), 3000)
    } catch (err) {
      setAddingMsg('Error: ' + err.message)
    }
  }

  return (
    <div className="meal-card">
      <div className="meal-header">
        <div>
          <div className="meal-date">{prettyDate}</div>
          <div className="meal-name">{entry.meal_name}</div>
        </div>
        <KebabMenu>
          <button onClick={onEdit}>Edit</button>
          <button className="danger" onClick={onDelete}>Delete</button>
        </KebabMenu>
      </div>

      {entry.notes && (
        <div className="meal-notes">
          <Linkify text={entry.notes} />
        </div>
      )}

      {entry.source_url && (
        <div className="meal-link">
          <a href={entry.source_url} target="_blank" rel="noopener noreferrer">View recipe</a>
        </div>
      )}

      {ingredientLines.length > 0 && (
        <div className="meal-ingredients">
          <ul>
            {ingredientLines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}

      {ingredientLines.length > 0 && (
        <button className="btn btn-secondary btn-full" onClick={handleAddIngredients}>
          Add {ingredientLines.length} ingredient{ingredientLines.length !== 1 ? 's' : ''} to grocery list
        </button>
      )}

      {addingMsg && <p className="copy-result" style={{ marginTop: '0.35rem' }}>{addingMsg}</p>}
    </div>
  )
}
