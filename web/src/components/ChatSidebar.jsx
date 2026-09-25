import { useState, useEffect, useRef } from 'react'
import { functionFetch } from '../lib/passcode'
import './ChatSidebar.css'

const TOOL_LABELS = {
  get_upcoming_events: 'Checked the calendar',
  create_event: 'Added a calendar event',
  update_event: 'Updated a calendar event',
  delete_event: 'Deleted a calendar event',
  list_todo_lists: 'Looked up the lists',
  list_todo_items: 'Read a list',
  add_todo_item: 'Added a list item',
  check_todo_item: 'Checked off a list item',
  search_household_info: 'Searched household info',
  add_household_info: 'Saved household info',
  list_grocery_items: 'Read the grocery list',
  add_grocery_item: 'Added a grocery item',
  list_meal_plan: 'Read the meal plan',
  add_meal_plan_entry: 'Added a planned meal',
  search_notes: 'Searched the notes',
  add_note: 'Saved a note',
}

function loadStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

const MAX_STORED_DISPLAY = 50
const MAX_STORED_MESSAGES = 40

function saveStorage(key, value, limit) {
  try {
    const trimmed = value.length > limit ? value.slice(-limit) : value
    localStorage.setItem(key, JSON.stringify(trimmed))
  } catch {}
}

// API history must start on a plain user message: cutting mid-turn would leave a
// tool_result whose tool_use was dropped, and the API rejects that.
function trimHistory(msgs, limit) {
  for (let i = Math.max(0, msgs.length - limit); i < msgs.length; i++) {
    if (msgs[i].role === 'user' && typeof msgs[i].content === 'string') return msgs.slice(i)
  }
  return []
}

export default function ChatSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [display, setDisplay] = useState(() => loadStorage('chatDisplay', []))
  const [messages, setMessages] = useState(() => trimHistory(loadStorage('chatMessages', []), MAX_STORED_MESSAGES))
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    saveStorage('chatDisplay', display, MAX_STORED_DISPLAY)
  }, [display])

  useEffect(() => {
    try {
      localStorage.setItem('chatMessages', JSON.stringify(trimHistory(messages, MAX_STORED_MESSAGES)))
    } catch {}
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [display, isLoading])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  // The open panel gets its own history entry so the iPhone back-swipe closes it
  // instead of navigating the page underneath. The router's state is kept intact.
  // iOS animates the swipe itself, so a swipe-close skips our slide-out animation.
  const closingFromUiRef = useRef(false)
  const [skipAnimation, setSkipAnimation] = useState(false)

  useEffect(() => {
    if (window.history.state?.chatOpen) {
      window.history.replaceState({ ...window.history.state, chatOpen: false }, '')
    }
    const onPopState = () => {
      const open = !!window.history.state?.chatOpen
      setSkipAnimation(!open && !closingFromUiRef.current)
      closingFromUiRef.current = false
      setIsOpen(open)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function openPanel() {
    window.history.pushState({ ...window.history.state, chatOpen: true }, '')
    setSkipAnimation(false)
    setIsOpen(true)
  }

  function closePanel() {
    setSkipAnimation(false)
    if (window.history.state?.chatOpen) {
      closingFromUiRef.current = true
      window.history.back()
    } else {
      setIsOpen(false)
    }
  }

  function handleClear() {
    setDisplay([])
    setMessages([])
    try {
      localStorage.removeItem('chatDisplay')
      localStorage.removeItem('chatMessages')
    } catch {}
  }

  async function handleSend(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')

    const newDisplay = [...display, { role: 'user', kind: 'text', text }]
    const newMessages = trimHistory([...messages, { role: 'user', content: text }], MAX_STORED_MESSAGES)
    setDisplay(newDisplay)
    setMessages(newMessages)
    setIsLoading(true)

    try {
      const resp = await functionFetch('/.netlify/functions/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })

      const contentType = resp.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Assistant is not available — are you running on Netlify?')
      }

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`)

      const updatedDisplay = [...newDisplay]
      for (const event of data.events) {
        if (event.type === 'text') {
          updatedDisplay.push({ role: 'assistant', kind: 'text', text: event.text })
        } else if (event.type === 'tool') {
          updatedDisplay.push({ role: 'assistant', kind: 'tool', name: event.name, ok: event.ok })
        } else if (event.type === 'error') {
          updatedDisplay.push({ role: 'assistant', kind: 'error', text: event.text })
        }
      }
      setDisplay(updatedDisplay)
      setMessages([...newMessages, ...data.newMessages])
    } catch (err) {
      setDisplay([
        ...newDisplay,
        { role: 'assistant', kind: 'error', text: err.message },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        className={`chat-fab ${display.length > 0 ? 'has-response' : ''}`}
        onClick={openPanel}
        aria-label="Open assistant"
        style={{ display: isOpen ? 'none' : undefined }}
      >
        💬
      </button>

      <div
        className={`chat-backdrop ${isOpen ? 'open' : ''} ${skipAnimation ? 'no-anim' : ''}`}
        onClick={closePanel}
      />

      <div className={`chat-panel ${isOpen ? 'open' : ''} ${skipAnimation ? 'no-anim' : ''}`}>
        <div className="chat-header">
          <h2>Assistant</h2>
          <div className="chat-header-actions">
            <button
              onClick={handleClear}
              disabled={display.length === 0}
              title="Clear conversation"
            >
              🗑
            </button>
            <button onClick={closePanel} title="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="chat-messages">
          {display.length === 0 && !isLoading && (
            <div className="chat-empty">
              Ask about the calendar, lists, groceries, meals, notes, or household
              info — or tell me to add something.
            </div>
          )}

          {display.map((entry, i) => {
            if (entry.role === 'user') {
              return (
                <div key={i} className="chat-msg-user">
                  {entry.text}
                </div>
              )
            }
            if (entry.kind === 'text') {
              return (
                <div key={i} className="chat-msg-assistant">
                  {entry.text}
                </div>
              )
            }
            if (entry.kind === 'tool') {
              const label = TOOL_LABELS[entry.name] || entry.name
              return (
                <div key={i} className="chat-msg-tool">
                  <span className={`tool-icon ${entry.ok ? 'tool-ok' : 'tool-fail'}`}>
                    {entry.ok ? '✓' : '✗'}
                  </span>
                  {label}
                  {entry.ok ? '' : ' — failed'}
                </div>
              )
            }
            if (entry.kind === 'error') {
              return (
                <div key={i} className="chat-msg-error">
                  {entry.text}
                </div>
              )
            }
            return null
          })}

          {isLoading && (
            <div className="chat-thinking">
              Thinking<span className="chat-thinking-dots" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-area" onSubmit={handleSend}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask or tell me something"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!input.trim() || isLoading}
          >
            Send
          </button>
        </form>
      </div>
    </>
  )
}
