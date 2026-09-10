"""The assistant chat sidebar (Stage 11).

The left sidebar is the assistant and nothing else — page navigation lives in the
top-right "..." menu (see style.render_nav_menu). style.page_header() calls
render_chat_sidebar(), so every page gets the same persistent chat.

Two things live in session state and so survive navigating between pages:
  chat_messages — the real Claude conversation (content blocks and tool results),
                  fed straight back to the API each turn.
  chat_display  — what to redraw on screen: user text, assistant text, and a line
                  per tool call. Kept separate so the transcript stays readable
                  without having to reverse-engineer it from the API messages.
"""

import streamlit as st

import ai_assistant

# Tool name -> what to show while/after it runs. Keeps the transcript in plain
# English instead of leaking function names at Matt and Lucy.
_TOOL_LABELS = {
    "get_upcoming_events": "Checked the calendar",
    "create_event": "Added a calendar event",
    "update_event": "Updated a calendar event",
    "delete_event": "Deleted a calendar event",
    "list_todo_lists": "Looked up the lists",
    "list_todo_items": "Read a list",
    "add_todo_item": "Added a list item",
    "check_todo_item": "Checked off a list item",
    "search_household_info": "Searched household info",
    "add_household_info": "Saved household info",
    "list_grocery_items": "Read the grocery list",
    "add_grocery_item": "Added a grocery item",
    "list_meal_plan": "Read the meal plan",
    "add_meal_plan_entry": "Added a planned meal",
    "search_notes": "Searched the notes",
    "add_note": "Saved a note",
}


def _tool_caption(name: str, ok: bool) -> str:
    label = _TOOL_LABELS.get(name, name)
    return f":material/check: {label}" if ok else f":material/error: {label} — failed"


def _render_entry(entry: dict) -> None:
    if entry["kind"] == "text":
        st.markdown(entry["text"])
    elif entry["kind"] == "tool":
        st.caption(_tool_caption(entry["name"], entry["ok"]))
    elif entry["kind"] == "error":
        st.error(entry["text"], icon=":material/error:")


def render_chat_sidebar() -> None:
    with st.sidebar:
        head, clear = st.columns([3, 1], vertical_alignment="center")
        head.markdown("### Assistant")

        if not ai_assistant.is_configured():
            st.warning("No ANTHROPIC_API_KEY set — the assistant is unavailable.")
            return

        messages = st.session_state.setdefault("chat_messages", [])
        display = st.session_state.setdefault("chat_display", [])

        if clear.button(
            ":material/delete:",
            help="Clear this conversation",
            use_container_width=True,
            disabled=not display,
        ):
            st.session_state["chat_messages"] = []
            st.session_state["chat_display"] = []
            st.rerun()

        if not display:
            st.caption(
                "Ask about the calendar, lists, groceries, meals, notes or household "
                "info — or tell me to add something."
            )

        # Replay the transcript. Consecutive assistant entries share one bubble so a
        # turn that used tools doesn't fragment into several avatars.
        for entry in display:
            if entry["role"] == "user":
                with st.chat_message("user"):
                    st.markdown(entry["text"])
            else:
                with st.chat_message("assistant"):
                    _render_entry(entry)

        prompt = st.chat_input("Ask or tell me something")
        if not prompt:
            return

        messages.append({"role": "user", "content": prompt})
        display.append({"role": "user", "kind": "text", "text": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            status = st.empty()
            status.caption("Thinking…")
            for event in ai_assistant.run_turn(messages):
                if event[0] == "text":
                    entry = {"role": "assistant", "kind": "text", "text": event[1]}
                elif event[0] == "tool":
                    status.caption("Working…")
                    entry = {
                        "role": "assistant",
                        "kind": "tool",
                        "name": event[1],
                        "ok": event[2],
                    }
                else:
                    entry = {"role": "assistant", "kind": "error", "text": event[1]}
                display.append(entry)
                _render_entry(entry)
            status.empty()

        # The page body rendered before this turn ran, so anything the assistant
        # just changed is stale on screen — redraw the whole page.
        st.rerun()
