"""Claude-powered household assistant (Stage 11).

Two halves:
  * TOOLS + execute_tool()  — the Claude tool schemas and their dispatch onto the
    existing db.py / calendar_service.py helpers. No business logic lives here;
    every tool is a thin wrapper so the UI and the assistant share one
    implementation (CLAUDE.md working rule).
  * run_turn()              — the agentic loop for one user message: call Claude,
    run any tools it asks for, feed the results back, repeat until it answers.

The chat UI itself is style.render_chat_sidebar(), so every page gets the
assistant simply by calling style.page_header().

Instacart ordering (via the fig-mcp.instacart.com remote MCP server) is
deliberately NOT here — deferred to a Stage 11b after deployment, since its
consumer OAuth flow needs a real HTTPS redirect URL. See the build plan.
"""

import json
import os
from datetime import date, datetime, timedelta

import anthropic
from dotenv import load_dotenv

import calendar_service
import db

load_dotenv()

MODEL = "claude-sonnet-5"  # Matt's call 2026-09-08: Opus is overkill for household CRUD chat
MAX_TOKENS = 8000
EFFORT = "medium"  # low | medium | high | xhigh | max — tune for speed vs. thoroughness
MAX_TOOL_ROUNDS = 12  # safety valve so a confused loop can't run forever

USERS = "Matt and Lucy"


# --- Client ---

_client = None


def is_configured() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


# --- Helpers ---

def _today() -> date:
    """Today's date in the shared calendar's time zone, falling back to server-local."""
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo(calendar_service.get_calendar_timezone())).date()
    except Exception:
        return date.today()


def _json_default(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _dump(value) -> str:
    return json.dumps(value, default=_json_default)


def _parse_start_end(start: str, end: str, all_day: bool):
    if all_day:
        return date.fromisoformat(start[:10]), date.fromisoformat(end[:10])
    return datetime.fromisoformat(start), datetime.fromisoformat(end)


def _find_list(list_name: str) -> dict:
    lists = db.list_todo_lists()
    for row in lists:
        if row["name"].strip().lower() == list_name.strip().lower():
            return row
    names = ", ".join(sorted(r["name"] for r in lists))
    raise ValueError(f"No list named '{list_name}'. Existing lists: {names}")


# --- Tool schemas ---

TOOLS = [
    # Calendar
    {
        "name": "get_upcoming_events",
        "description": (
            "List events on the shared household Google Calendar from now through "
            "`days` days ahead. Returns each event's id, title, start, end, whether "
            "it's all-day, and its location."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "How many days ahead to look. Default 14.",
                }
            },
        },
    },
    {
        "name": "create_event",
        "description": "Add an event to the shared household calendar.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "description": "Event title."},
                "start": {
                    "type": "string",
                    "description": (
                        "Start. For a timed event, local calendar time as "
                        "'YYYY-MM-DDTHH:MM:SS'. For an all-day event, 'YYYY-MM-DD'."
                    ),
                },
                "end": {
                    "type": "string",
                    "description": (
                        "End, same format as start. For an all-day event this is the "
                        "LAST day of the event (inclusive), not the day after."
                    ),
                },
                "all_day": {"type": "boolean", "description": "True for an all-day event."},
                "location": {"type": "string"},
                "description": {"type": "string"},
            },
            "required": ["summary", "start", "end"],
        },
    },
    {
        "name": "update_event",
        "description": (
            "Change an existing calendar event. Only the fields you pass are changed. "
            "If you change the timing, pass start, end AND all_day together. "
            "Get the event_id from get_upcoming_events first."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {"type": "string"},
                "summary": {"type": "string"},
                "start": {"type": "string", "description": "Same format as create_event."},
                "end": {"type": "string", "description": "Same format as create_event."},
                "all_day": {"type": "boolean"},
                "location": {"type": "string"},
                "description": {"type": "string"},
            },
            "required": ["event_id"],
        },
    },
    {
        "name": "delete_event",
        "description": (
            "Permanently delete a calendar event. Destructive — always confirm the "
            "specific event with the user in chat before calling this."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"event_id": {"type": "string"}},
            "required": ["event_id"],
        },
    },
    # Lists
    {
        "name": "list_todo_lists",
        "description": (
            "Names of all the shared checklists (e.g. 'House repair', 'Amazon'). "
            "Chores live here too, as ordinary list items."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "list_todo_items",
        "description": (
            "Items on one checklist, with their ids, text, done state, and optional "
            "tag (the tag is usually who the item is assigned to)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "list_name": {"type": "string"},
                "include_done": {
                    "type": "boolean",
                    "description": "Include already-completed items. Default false.",
                },
            },
            "required": ["list_name"],
        },
    },
    {
        "name": "add_todo_item",
        "description": "Add an item to one of the shared checklists.",
        "input_schema": {
            "type": "object",
            "properties": {
                "list_name": {"type": "string"},
                "text": {"type": "string"},
                "tag": {
                    "type": "string",
                    "description": "Optional short tag, usually a person's name (Matt or Lucy).",
                },
            },
            "required": ["list_name", "text"],
        },
    },
    {
        "name": "check_todo_item",
        "description": (
            "Mark a checklist item done (or un-done). Call list_todo_items first to "
            "get the item's id."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "item_id": {"type": "integer"},
                "is_done": {"type": "boolean", "description": "Default true."},
            },
            "required": ["item_id"],
        },
    },
    # Household info
    {
        "name": "search_household_info",
        "description": (
            "Search the household reference hub (contacts, manuals, medical info, "
            "wifi passwords, notes) by title or content."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
    },
    {
        "name": "add_household_info",
        "description": "Save a new household reference entry.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["Contacts", "Manuals", "Medical", "Notes"],
                },
                "title": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["category", "title", "content"],
        },
    },
    # Grocery & meals
    {
        "name": "list_grocery_items",
        "description": "The shared grocery list, including whether each item is checked off.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "add_grocery_item",
        "description": "Add one item to the shared grocery list.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "quantity": {"type": "string", "description": "Optional, e.g. '2 lbs'."},
            },
            "required": ["name"],
        },
    },
    {
        "name": "list_meal_plan",
        "description": "Planned meals with their dates, notes, and ingredients.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "add_meal_plan_entry",
        "description": "Plan a meal for a date.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "'YYYY-MM-DD'."},
                "meal_name": {"type": "string"},
                "notes": {"type": "string"},
                "ingredients": {
                    "type": "string",
                    "description": "Ingredients, one per line.",
                },
                "source_url": {"type": "string", "description": "Recipe URL, if any."},
            },
            "required": ["date", "meal_name"],
        },
    },
    # Notes
    {
        "name": "search_notes",
        "description": "Search the freeform notes by title or body. Empty text returns all notes.",
        "input_schema": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
    },
    {
        "name": "add_note",
        "description": "Save a new freeform note.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "body": {"type": "string"},
            },
            "required": ["title", "body"],
        },
    },
]


# --- Tool dispatch ---

def execute_tool(name: str, tool_input: dict):
    """Run one tool and return a JSON-serializable result. Raises on bad input."""
    if name == "get_upcoming_events":
        return calendar_service.get_upcoming_events(days=int(tool_input.get("days", 14)))

    if name == "create_event":
        all_day = bool(tool_input.get("all_day", False))
        start, end = _parse_start_end(tool_input["start"], tool_input["end"], all_day)
        return calendar_service.create_event(
            summary=tool_input["summary"],
            start=start,
            end=end,
            all_day=all_day,
            location=tool_input.get("location"),
            description=tool_input.get("description"),
        )

    if name == "update_event":
        start = end = all_day = None
        if tool_input.get("start") and tool_input.get("end"):
            all_day = bool(tool_input.get("all_day", False))
            start, end = _parse_start_end(tool_input["start"], tool_input["end"], all_day)
        return calendar_service.update_event(
            event_id=tool_input["event_id"],
            summary=tool_input.get("summary"),
            start=start,
            end=end,
            all_day=all_day,
            location=tool_input.get("location"),
            description=tool_input.get("description"),
        )

    if name == "delete_event":
        calendar_service.delete_event(tool_input["event_id"])
        return {"deleted": True}

    if name == "list_todo_lists":
        return [{"id": r["id"], "name": r["name"]} for r in db.list_todo_lists()]

    if name == "list_todo_items":
        target = _find_list(tool_input["list_name"])
        items = db.list_todo_items(target["id"])
        if not tool_input.get("include_done", False):
            items = [i for i in items if not i["is_done"]]
        return [
            {"id": i["id"], "text": i["text"], "is_done": i["is_done"], "tag": i.get("tag")}
            for i in items
        ]

    if name == "add_todo_item":
        target = _find_list(tool_input["list_name"])
        return db.add_todo_item(
            target["id"], tool_input["text"], tool_input.get("tag") or None
        )

    if name == "check_todo_item":
        return db.set_todo_item_done(
            int(tool_input["item_id"]), bool(tool_input.get("is_done", True))
        )

    if name == "search_household_info":
        return db.search_household_info(tool_input["text"])

    if name == "add_household_info":
        return db.add_household_info(
            tool_input["category"], tool_input["title"], tool_input["content"]
        )

    if name == "list_grocery_items":
        return db.list_grocery_items()

    if name == "add_grocery_item":
        return db.add_grocery_item(tool_input["name"], tool_input.get("quantity", ""))

    if name == "list_meal_plan":
        return db.list_meal_plan()

    if name == "add_meal_plan_entry":
        return db.add_meal_plan_entry(
            date=tool_input["date"],
            meal_name=tool_input["meal_name"],
            notes=tool_input.get("notes"),
            ingredients=tool_input.get("ingredients"),
            source_url=tool_input.get("source_url"),
        )

    if name == "search_notes":
        text = tool_input.get("text", "")
        return db.search_notes(text) if text else db.list_notes()

    if name == "add_note":
        return db.add_note(tool_input["title"], tool_input["body"])

    raise ValueError(f"Unknown tool: {name}")


# --- System prompt ---

def system_prompt() -> str:
    today = _today()
    return f"""You are the household assistant for {USERS}, a couple who share this app.
You can both answer questions about their household and make changes on their behalf.

Today is {today.strftime('%A, %B %d, %Y')} ({today.isoformat()}).
Tomorrow is {(today + timedelta(days=1)).isoformat()}. Resolve relative dates
("Friday", "next week") against today's date before calling a tool.

What you can reach:
- Shared Google Calendar — read upcoming events, add, change, and delete them.
- Shared checklists ("Lists") — e.g. House repair, Amazon, Short term. Chores are
  just list items here; an item's optional tag is usually who it's assigned to.
- Household Info — the reference hub: contacts, manuals, medical info, wifi.
- Grocery list and meal plan — including ingredients for planned meals.
- Notes — freeform notes.

How to behave:
- Whoever is typing is Matt or Lucy. Don't ask which unless it actually matters.
- Read before you write. To change or complete something, look it up first so you
  are acting on the right record.
- Small additions (a grocery item, a list item, a note) — just do them and say what
  you did. No need to ask permission first.
- Deleting an event, or any change that overwrites or removes something that
  already exists, needs confirmation: say exactly what you're about to change or
  remove and wait for a clear yes before calling the tool.
- If a tool returns an error, say plainly what failed and what you'd need to retry.
  Don't invent data or pretend an action succeeded.
- Keep replies short — this is read on a phone. A sentence or two, or a tight list.
  No preamble, no restating the question back."""


# --- Agentic loop ---

def run_turn(messages: list):
    """Run one assistant turn to completion, executing tools as Claude asks for them.

    `messages` is the running Claude conversation and is appended to in place, so
    the caller can persist it in session state. Yields display events as they
    happen so the UI can show progress:
        ("text",  str)                       — prose from the assistant
        ("tool",  tool_name, ok: bool)       — a tool ran (or failed)
        ("error", str)                       — the turn could not continue
    """
    client = get_client()

    for _ in range(MAX_TOOL_ROUNDS):
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                output_config={"effort": EFFORT},
                system=system_prompt(),
                tools=TOOLS,
                messages=messages,
            )
        except anthropic.APIStatusError as exc:
            yield ("error", f"The assistant API returned an error ({exc.status_code}): {exc.message}")
            return
        except anthropic.APIConnectionError:
            yield ("error", "Couldn't reach the assistant API — check the network and try again.")
            return
        except Exception as exc:  # noqa: BLE001 — surface anything else rather than crash the page
            yield ("error", f"The assistant failed: {exc}")
            return

        messages.append({"role": "assistant", "content": response.content})

        for block in response.content:
            if block.type == "text" and block.text.strip():
                yield ("text", block.text)

        tool_uses = [b for b in response.content if b.type == "tool_use"]
        if not tool_uses:
            return

        results = []
        for block in tool_uses:
            try:
                result = execute_tool(block.name, block.input or {})
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": _dump(result),
                    }
                )
                yield ("tool", block.name, True)
            except Exception as exc:  # noqa: BLE001 — tool errors go back to Claude, not the traceback
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": f"{type(exc).__name__}: {exc}",
                        "is_error": True,
                    }
                )
                yield ("tool", block.name, False)

        messages.append({"role": "user", "content": results})

    yield ("error", "Stopped after too many steps without finishing. Try asking more specifically.")
