import html

import streamlit as st

import db
from style import badge, extract_phone, linkify, page_header

st.set_page_config(page_title="Household Info — Household Manager", page_icon="🏠", layout="wide")

page_header("Household Info", "Manuals, contacts, wifi, and other reference info")

CATEGORIES = ["Contacts", "Manuals", "Medical", "Notes"]


def _render_entry(entry: dict, show_category: bool) -> None:
    editing = st.session_state.get("editing_info_id") == entry["id"]
    with st.container(border=True):
        if editing:
            with st.form(f"edit_form_{entry['id']}"):
                edit_options = CATEGORIES if entry["category"] in CATEGORIES else CATEGORIES + [entry["category"]]
                cat = st.selectbox("Category", edit_options, index=edit_options.index(entry["category"]))
                title = st.text_input("Title", value=entry["title"])
                content = st.text_area("Content", value=entry["content"] or "")
                col1, col2 = st.columns(2)
                save = col1.form_submit_button("Save", use_container_width=True)
                cancel = col2.form_submit_button("Cancel", use_container_width=True)
                if save:
                    if title.strip():
                        db.update_household_info(
                            entry["id"], category=cat, title=title.strip(), content=content.strip()
                        )
                        st.session_state["editing_info_id"] = None
                        st.rerun()
                    else:
                        st.error("Title is required.")
                if cancel:
                    st.session_state["editing_info_id"] = None
                    st.rerun()
        else:
            if show_category:
                title_col, badge_col, menu_col = st.columns([3, 1, 1])
            else:
                title_col, menu_col = st.columns([4, 1])

            phone = extract_phone(entry["content"] or "")
            safe_title = html.escape(entry["title"])
            if phone:
                title_col.markdown(
                    f'<a href="sms:{phone}" style="font-weight:600; text-decoration:none;" '
                    f'title="Text {safe_title}">{safe_title}</a>',
                    unsafe_allow_html=True,
                )
            else:
                title_col.markdown(f"**{safe_title}**")
            if show_category:
                badge_col.markdown(badge(entry["category"]), unsafe_allow_html=True)

            confirming_delete = st.session_state.get("confirm_delete_info_id") == entry["id"]
            with menu_col.popover(":material/more_vert:", use_container_width=True):
                if confirming_delete:
                    st.write(f"Delete \"{entry['title']}\"?")
                    if st.button("Delete", key=f"confirm_delete_{entry['id']}", type="primary", use_container_width=True):
                        db.delete_household_info(entry["id"])
                        st.session_state["confirm_delete_info_id"] = None
                        st.rerun()
                    if st.button("Cancel", key=f"cancel_delete_{entry['id']}", use_container_width=True):
                        st.session_state["confirm_delete_info_id"] = None
                        st.rerun()
                else:
                    if st.button("Edit", key=f"edit_{entry['id']}", use_container_width=True):
                        st.session_state["editing_info_id"] = entry["id"]
                        st.rerun()
                    if st.button("Delete", key=f"delete_{entry['id']}", use_container_width=True):
                        st.session_state["confirm_delete_info_id"] = entry["id"]
                        st.rerun()

            if entry["content"]:
                st.markdown(linkify(entry["content"]), unsafe_allow_html=True)


search = st.text_input("Search", placeholder="Search title or content...", label_visibility="collapsed")

all_entries = db.list_household_info()
categories = sorted({e["category"] for e in all_entries})

if search:
    entries = db.search_household_info(search)
    grouped = False
elif categories:
    category_choice = st.selectbox("Category", ["All"] + categories, label_visibility="collapsed")
    entries = db.list_household_info(None if category_choice == "All" else category_choice)
    grouped = category_choice == "All"
else:
    entries = []
    grouped = False

st.divider()

with st.expander("Add new entry"):
    with st.form("add_entry_form", clear_on_submit=True):
        new_category = st.selectbox("Category", CATEGORIES)
        new_title = st.text_input("Title")
        new_content = st.text_area("Content")
        submitted = st.form_submit_button("Add", use_container_width=True)
        if submitted:
            if new_title.strip():
                db.add_household_info(new_category, new_title.strip(), new_content.strip())
                st.rerun()
            else:
                st.error("Title is required.")

st.divider()

entries = sorted(entries, key=lambda e: e["title"].casefold())

if not entries:
    st.caption("No matches found." if search else "No entries yet — add one above.")
elif grouped:
    by_category: dict[str, list[dict]] = {}
    for e in entries:
        by_category.setdefault(e["category"], []).append(e)
    for cat in sorted(by_category):
        st.markdown(f"#### {cat}")
        for entry in by_category[cat]:
            _render_entry(entry, show_category=False)
else:
    for entry in entries:
        _render_entry(entry, show_category=bool(search))
