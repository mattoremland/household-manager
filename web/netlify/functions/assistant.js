import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 8000
const MAX_TOOL_ROUNDS = 12
const USERS = 'Matt and Lucy'
const INSTACART_MCP_URL = 'https://mcp.instacart.com/mcp'

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_KEY
  )
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Calendar helper — calls the calendar Netlify Function via HTTP
// ---------------------------------------------------------------------------

async function callCalendar(method, action, params = {}, body = null) {
  const base = process.env.URL
  if (!base) throw new Error('Calendar is not available (site URL not configured)')

  const url = new URL(`${base}/.netlify/functions/calendar`)
  url.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }

  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)

  const resp = await fetch(url, opts)
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || `Calendar returned ${resp.status}`)
  return data
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function findList(supabase, listName) {
  const { data, error } = await supabase
    .from('todo_lists')
    .select('*')
    .order('name')
  if (error) throw error

  const match = data.find(
    r => r.name.trim().toLowerCase() === listName.trim().toLowerCase()
  )
  if (match) return match

  const names = data.map(r => r.name).sort().join(', ')
  throw new Error(`No list named '${listName}'. Existing lists: ${names}`)
}

// ---------------------------------------------------------------------------
// Tool schemas — same 16 as the Python version
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'get_upcoming_events',
    description:
      'List events on the shared household Google Calendar from now through ' +
      '`days` days ahead. Returns each event\'s id, title, start, end, whether ' +
      "it's all-day, and its location.",
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'integer',
          description: 'How many days ahead to look. Default 14.',
        },
      },
    },
  },
  {
    name: 'create_event',
    description: 'Add an event to the shared household calendar.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title.' },
        start: {
          type: 'string',
          description:
            "Start. For a timed event, local calendar time as 'YYYY-MM-DDTHH:MM:SS'. " +
            "For an all-day event, 'YYYY-MM-DD'.",
        },
        end: {
          type: 'string',
          description:
            'End, same format as start. For an all-day event this is the ' +
            'LAST day of the event (inclusive), not the day after.',
        },
        all_day: { type: 'boolean', description: 'True for an all-day event.' },
        location: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['summary', 'start', 'end'],
    },
  },
  {
    name: 'update_event',
    description:
      'Change an existing calendar event. Only the fields you pass are changed. ' +
      'If you change the timing, pass start, end AND all_day together. ' +
      'Get the event_id from get_upcoming_events first.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string' },
        summary: { type: 'string' },
        start: { type: 'string', description: 'Same format as create_event.' },
        end: { type: 'string', description: 'Same format as create_event.' },
        all_day: { type: 'boolean' },
        location: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'delete_event',
    description:
      'Permanently delete a calendar event. Destructive — always confirm the ' +
      'specific event with the user in chat before calling this.',
    input_schema: {
      type: 'object',
      properties: { event_id: { type: 'string' } },
      required: ['event_id'],
    },
  },
  {
    name: 'list_todo_lists',
    description:
      "Names of all the shared checklists (e.g. 'House repair', 'Amazon'). " +
      'Chores live here too, as ordinary list items.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_todo_items',
    description:
      'Items on one checklist, with their ids, text, done state, and optional ' +
      'tag (the tag is usually who the item is assigned to).',
    input_schema: {
      type: 'object',
      properties: {
        list_name: { type: 'string' },
        include_done: {
          type: 'boolean',
          description: 'Include already-completed items. Default false.',
        },
      },
      required: ['list_name'],
    },
  },
  {
    name: 'add_todo_item',
    description: 'Add an item to one of the shared checklists.',
    input_schema: {
      type: 'object',
      properties: {
        list_name: { type: 'string' },
        text: { type: 'string' },
        tag: {
          type: 'string',
          description: "Optional short tag, usually a person's name (Matt or Lucy).",
        },
      },
      required: ['list_name', 'text'],
    },
  },
  {
    name: 'check_todo_item',
    description:
      'Mark a checklist item done (or un-done). Call list_todo_items first to ' +
      "get the item's id.",
    input_schema: {
      type: 'object',
      properties: {
        item_id: { type: 'integer' },
        is_done: { type: 'boolean', description: 'Default true.' },
      },
      required: ['item_id'],
    },
  },
  {
    name: 'search_household_info',
    description:
      'Search the household reference hub (contacts, manuals, medical info, ' +
      'wifi passwords, notes) by title or content.',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'add_household_info',
    description: 'Save a new household reference entry.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['Contacts', 'Manuals', 'Medical'],
        },
        title: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['category', 'title', 'content'],
    },
  },
  {
    name: 'list_grocery_items',
    description: 'The shared grocery list, including whether each item is checked off.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_grocery_item',
    description: 'Add one item to the shared grocery list.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        quantity: { type: 'string', description: "Optional, e.g. '2 lbs'." },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_meal_plan',
    description: 'Planned meals with their dates, notes, and ingredients.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_meal_plan_entry',
    description: 'Plan a meal for a date.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: "'YYYY-MM-DD'." },
        meal_name: { type: 'string' },
        notes: { type: 'string' },
        ingredients: {
          type: 'string',
          description: 'Ingredients, one per line.',
        },
        source_url: { type: 'string', description: 'Recipe URL, if any.' },
      },
      required: ['date', 'meal_name'],
    },
  },
  {
    name: 'search_notes',
    description: 'Search the freeform notes by title or body. Empty text returns all notes.',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'add_note',
    description: 'Save a new freeform note.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['title', 'body'],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

async function executeTool(name, input, supabase) {
  switch (name) {
    // ---- Calendar ----
    case 'get_upcoming_events': {
      const days = input.days || 14
      const now = new Date()
      const end = new Date(now)
      end.setDate(end.getDate() + days)
      const result = await callCalendar('GET', 'events', {
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
      })
      return result.events || []
    }

    case 'create_event': {
      let { summary, start, end, all_day, location, description } = input
      const allDay = !!all_day
      if (allDay && end) {
        const d = new Date(end + 'T00:00:00')
        d.setDate(d.getDate() + 1)
        end = d.toISOString().slice(0, 10)
      }
      return callCalendar('POST', 'create', {}, {
        summary, start, end, allDay, location, description,
      })
    }

    case 'update_event': {
      let { event_id, summary, start, end, all_day, location, description } = input
      const allDay = all_day !== undefined ? !!all_day : undefined
      if (allDay && end) {
        const d = new Date(end + 'T00:00:00')
        d.setDate(d.getDate() + 1)
        end = d.toISOString().slice(0, 10)
      }
      return callCalendar('PUT', 'update', {}, {
        eventId: event_id, summary, start, end, allDay, location, description,
      })
    }

    case 'delete_event':
      return callCalendar('DELETE', 'delete', { eventId: input.event_id })

    // ---- Lists ----
    case 'list_todo_lists': {
      const { data, error } = await supabase
        .from('todo_lists')
        .select('id, name')
        .order('sort_order')
      if (error) throw error
      return data
    }

    case 'list_todo_items': {
      const list = await findList(supabase, input.list_name)
      let query = supabase
        .from('todo_items')
        .select('id, text, is_done, tag')
        .eq('list_id', list.id)
        .order('id')
      if (!input.include_done) query = query.eq('is_done', false)
      const { data, error } = await query
      if (error) throw error
      return data.map(row => ({ ...row, done: row.is_done }))
    }

    case 'add_todo_item': {
      const list = await findList(supabase, input.list_name)
      const { data, error } = await supabase
        .from('todo_items')
        .insert({ list_id: list.id, text: input.text, tag: input.tag || null, is_done: false })
        .select()
        .single()
      if (error) throw error
      return data
    }

    case 'check_todo_item': {
      const isDone = input.is_done !== undefined ? input.is_done : true
      const { data, error } = await supabase
        .from('todo_items')
        .update({ is_done: isDone })
        .eq('id', input.item_id)
        .select()
        .single()
      if (error) throw error
      return data
    }

    // ---- Household info ----
    case 'search_household_info': {
      const q = `%${input.text}%`
      const { data, error } = await supabase
        .from('household_info')
        .select('*')
        .or(`title.ilike.${q},content.ilike.${q}`)
        .order('category')
        .order('title')
      if (error) throw error
      return data
    }

    case 'add_household_info': {
      const { data, error } = await supabase
        .from('household_info')
        .insert({
          title: input.title,
          content: input.content,
          category: input.category,
        })
        .select()
        .single()
      if (error) throw error
      return data
    }

    // ---- Grocery ----
    case 'list_grocery_items': {
      const { data, error } = await supabase
        .from('grocery_items')
        .select('*')
        .order('id')
      if (error) throw error
      return data
    }

    case 'add_grocery_item': {
      const { data, error } = await supabase
        .from('grocery_items')
        .insert({ name: input.name, quantity: input.quantity || null, is_checked: false })
        .select()
        .single()
      if (error) throw error
      return data
    }

    // ---- Meal plan ----
    case 'list_meal_plan': {
      const { data, error } = await supabase
        .from('meal_plan')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      return data
    }

    case 'add_meal_plan_entry': {
      const { data, error } = await supabase
        .from('meal_plan')
        .insert({
          date: input.date,
          meal_name: input.meal_name,
          notes: input.notes || null,
          ingredients: input.ingredients || null,
          source_url: input.source_url || null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    }

    // ---- Notes ----
    case 'search_notes': {
      const text = input.text || ''
      if (!text) {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .order('updated_at', { ascending: false })
        if (error) throw error
        return data
      }
      const q = `%${text}%`
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .or(`title.ilike.${q},body.ilike.${q}`)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    }

    case 'add_note': {
      const { data: maxRow } = await supabase
        .from('notes')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      const nextOrder = (maxRow?.sort_order ?? 0) + 1
      const { data, error } = await supabase
        .from('notes')
        .insert({ title: input.title, body: input.body, sort_order: nextOrder })
        .select()
        .single()
      if (error) throw error
      return data
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function systemPrompt() {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
  const monthName = today.toLocaleDateString('en-US', { month: 'long' })
  const dateStr = `${dayName}, ${monthName} ${today.getDate()}, ${today.getFullYear()}`
  const isoToday = today.toISOString().slice(0, 10)
  const isoTomorrow = tomorrow.toISOString().slice(0, 10)

  const instacartEnabled = !!process.env.INSTACART_API_KEY

  let instacartSection = ''
  if (instacartEnabled) {
    instacartSection = `
- Instacart — create shopping lists on Instacart. You'll get back a link the user can open to review and order.

Instacart rules:
- ALWAYS include exact quantities when creating a shopping list. "6 bananas" not "bananas". "2 lbs chicken breast" not "chicken breast". If the grocery list has a quantity field, use it. If not, ask the user.
- Before creating an Instacart shopping list, show the user the full item list WITH quantities and ask them to confirm. This is a hard rule — never skip confirmation.
- When the Instacart tool returns a link, share it with the user so they can review the cart and place the order themselves.
- You cannot place orders — you can only create shopping lists. The user completes checkout on Instacart.`
  }

  return `You are the household assistant for ${USERS}, a couple who share this app.
You can both answer questions about their household and make changes on their behalf.

Today is ${dateStr} (${isoToday}).
Tomorrow is ${isoTomorrow}. Resolve relative dates ("Friday", "next week") against today's date before calling a tool.

What you can reach:
- Shared Google Calendar — read upcoming events, add, change, and delete them.
- Shared checklists ("Lists") — e.g. House repair, Amazon, Short term. Chores are just list items here; an item's optional tag is usually who it's assigned to.
- Household Info — the reference hub: contacts, manuals, medical info.
- Grocery list and meal plan — including ingredients for planned meals.
- Notes — freeform notes.${instacartSection}

How to behave:
- Whoever is typing is Matt or Lucy. Don't ask which unless it actually matters.
- Read before you write. To change or complete something, look it up first so you are acting on the right record.
- Small additions (a grocery item, a list item, a note) — just do them and say what you did. No need to ask permission first.
- Deleting an event, or any change that overwrites or removes something that already exists, needs confirmation: say exactly what you're about to change or remove and wait for a clear yes before calling the tool.
- If a tool returns an error, say plainly what failed and what you'd need to retry. Don't invent data or pretend an action succeeded.
- Keep replies short — this is read on a phone. A sentence or two, or a tight list. No preamble, no restating the question back.`
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return json(500, { error: 'ANTHROPIC_API_KEY not configured' })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { messages } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: 'messages array is required' })
  }

  const client = new Anthropic({ apiKey })
  const supabase = getSupabase()
  const instacartKey = process.env.INSTACART_API_KEY

  const allTools = [...TOOLS]
  const mcpServers = []

  if (instacartKey) {
    mcpServers.push({
      type: 'url',
      url: INSTACART_MCP_URL,
      name: 'instacart',
      authorization_token: instacartKey,
    })
    allTools.push({
      type: 'mcp_toolset',
      mcp_server_name: 'instacart',
    })
  }

  const events = []
  const newMessages = []

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const allMessages = [...messages, ...newMessages]

    const apiParams = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(),
      tools: allTools,
      messages: allMessages,
    }

    let response
    try {
      if (mcpServers.length > 0) {
        response = await client.beta.messages.create({
          ...apiParams,
          mcp_servers: mcpServers,
          betas: ['mcp-client-2025-11-20'],
        })
      } else {
        response = await client.messages.create(apiParams)
      }
    } catch (err) {
      events.push({
        type: 'error',
        text: `API error: ${err.message || 'Unknown error'}`,
      })
      break
    }

    const contentBlocks = response.content.map(block => {
      if (block.type === 'text') return { type: 'text', text: block.text }
      if (block.type === 'tool_use')
        return { type: 'tool_use', id: block.id, name: block.name, input: block.input }
      if (block.type === 'mcp_tool_use')
        return { type: 'mcp_tool_use', id: block.id, name: block.name, server_name: block.server_name, input: block.input }
      if (block.type === 'mcp_tool_result')
        return { type: 'mcp_tool_result', tool_use_id: block.tool_use_id, is_error: block.is_error, content: block.content }
      return block
    })

    newMessages.push({ role: 'assistant', content: contentBlocks })

    for (const block of contentBlocks) {
      if (block.type === 'text' && block.text.trim()) {
        events.push({ type: 'text', text: block.text })
      }
      if (block.type === 'mcp_tool_use') {
        events.push({ type: 'tool', name: `instacart:${block.name}`, ok: true })
      }
    }

    const toolUses = contentBlocks.filter(b => b.type === 'tool_use')
    if (toolUses.length === 0) break

    const results = []
    for (const block of toolUses) {
      try {
        const result = await executeTool(block.name, block.input || {}, supabase)
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
        events.push({ type: 'tool', name: block.name, ok: true })
      } catch (err) {
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `${err.name || 'Error'}: ${err.message}`,
          is_error: true,
        })
        events.push({ type: 'tool', name: block.name, ok: false })
      }
    }

    newMessages.push({ role: 'user', content: results })
  }

  if (events.length === 0) {
    events.push({
      type: 'error',
      text: 'Stopped after too many steps without finishing. Try asking more specifically.',
    })
  }

  return json(200, { events, newMessages })
}
