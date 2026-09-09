import html

import streamlit as st

import db
from style import linkify, page_header

st.set_page_config(page_title="Notes — Household Manager", page_icon="📝", layout="wide")

page_header("Notes", "Freeform notes, sorted by most recently updated")


def _render_note(note: dict) -> None:
    editing = st.session_state.get("editing_note_id") == note["id"]
    with st.container(border=True):
        if editing:
            with st.form(f"edit_note_form_{note['id']}"):
                title = st.text_input("Title", value=note["title"])
                body = st.text_area("Body", value=note["body"] or "", height=150)
                st.caption("Tip: start a line with \"- \" for a bullet or \"1. \" for a numbered list. URLs, phone numbers, and addresses become clickable links automatically.")
                col1, col2 = st.columns(2)
                save = col1.form_submit_button("Save", use_container_width=True)
                cancel = col2.form_submit_button("Cancel", use_container_width=True)
                if save:
                    if title.strip():
                        db.update_note(note["id"], title=title.strip(), body=body.strip())
                        st.session_state["editing_note_id"] = None
                        st.rerun()
                    else:
                        st.error("Title is required.")
                if cancel:
                    st.session_state["editing_note_id"] = None
                    st.rerun()
        else:
            title_col, menu_col = st.columns([4, 1])
            title_col.markdown(f"**{html.escape(note['title'])}**")

            confirming_delete = st.session_state.get("confirm_delete_note_id") == note["id"]
            with menu_col.popover(":material/more_vert:", use_container_width=True):
                if confirming_delete:
                    st.write(f"Delete \"{note['title']}\"?")
                    if st.button("Delete", key=f"confirm_delete_note_{note['id']}", type="primary", use_container_width=True):
                        db.delete_note(note["id"])
                        st.session_state["confirm_delete_note_id"] = None
                        st.rerun()
                    if st.button("Cancel", key=f"cancel_delete_note_{note['id']}", use_container_width=True):
                        st.session_state["confirm_delete_note_id"] = None
                        st.rerun()
                else:
                    if st.button("Edit", key=f"edit_note_{note['id']}", use_container_width=True):
                        st.session_state["editing_note_id"] = note["id"]
                        st.rerun()
                    if st.button("Delete", key=f"delete_note_{note['id']}", use_container_width=True):
                        st.session_state["confirm_delete_note_id"] = note["id"]
                        st.rerun()

            if note["body"]:
                st.markdown(linkify(note["body"]), unsafe_allow_html=True)


search = st.text_input("Search", placeholder="Search title or body...", label_visibility="collapsed")

notes = db.search_notes(search) if search else db.list_notes()
if search:
    notes = sorted(notes, key=lambda n: n["updated_at"], reverse=True)

st.divider()

with st.expander("Add new note"):
    with st.form("add_note_form", clear_on_submit=True):
        new_title = st.text_input("Title")
        new_body = st.text_area("Body", height=150)
        st.caption("Tip: start a line with \"- \" for a bullet or \"1. \" for a numbered list. URLs, phone numbers, and addresses become clickable links automatically.")
        submitted = st.form_submit_button("Add", use_container_width=True)
        if submitted:
            if new_title.strip():
                db.add_note(new_title.strip(), new_body.strip())
                st.rerun()
            else:
                st.error("Title is required.")

st.divider()

if not notes:
    st.caption("No matches found." if search else "No notes yet — add one above.")
else:
    for note in notes:
        _render_note(note)
