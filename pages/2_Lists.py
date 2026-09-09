import html

import streamlit as st

import db
from style import MUTED_TEXT, page_header, tag_badge

st.set_page_config(page_title="Lists — Household Manager", page_icon="✅", layout="wide")

page_header("Lists", "Shared checklists")


lists = sorted(db.list_todo_lists(), key=lambda l: l["name"].casefold())

with st.expander("New list"):
    with st.form("new_list_form", clear_on_submit=True):
        new_list_name = st.text_input("List name")
        if st.form_submit_button("Create", use_container_width=True):
            if new_list_name.strip():
                db.add_todo_list(new_list_name.strip())
                st.rerun()
            else:
                st.error("Name is required.")

st.divider()

if not lists:
    st.caption("No lists yet — create one above.")

for todo_list in lists:
    list_id = todo_list["id"]

    all_items = db.list_todo_items(list_id)
    active_items = [i for i in all_items if not i["is_done"]]
    completed_items = [i for i in all_items if i["is_done"]]

    title_col, menu_col = st.columns([4, 1])
    title_col.markdown(f"### {todo_list['name']}")

    renaming = st.session_state.get("renaming_list_id") == list_id
    confirming_delete_list = st.session_state.get("confirm_delete_list_id") == list_id
    with menu_col.popover(":material/more_vert:", use_container_width=True):
        if confirming_delete_list:
            st.write(f"Delete list \"{todo_list['name']}\"? This removes all its items.")
            if st.button("Delete", key=f"confirm_delete_list_{list_id}", type="primary", use_container_width=True):
                db.delete_todo_list(list_id)
                st.session_state["confirm_delete_list_id"] = None
                st.rerun()
            if st.button("Cancel", key=f"cancel_delete_list_{list_id}", use_container_width=True):
                st.session_state["confirm_delete_list_id"] = None
                st.rerun()
        else:
            if st.button("Rename", key=f"start_rename_list_{list_id}", use_container_width=True):
                st.session_state["renaming_list_id"] = list_id
                st.rerun()
            if st.button("Delete list", key=f"start_delete_list_{list_id}", use_container_width=True):
                st.session_state["confirm_delete_list_id"] = list_id
                st.rerun()

            if completed_items:
                st.divider()
                st.caption(f"Completed ({len(completed_items)})")
                for citem in completed_items:
                    text_col, restore_col, delete_col = st.columns([3, 1, 1])
                    label_html = f"<span style='color:{MUTED_TEXT};'>{html.escape(citem['text'])}</span>"
                    if citem.get("tag"):
                        label_html += " " + tag_badge(citem["tag"])
                    text_col.markdown(label_html, unsafe_allow_html=True)
                    if restore_col.button(
                        ":material/undo:", key=f"restore_{citem['id']}", use_container_width=True
                    ):
                        db.set_todo_item_done(citem["id"], False)
                        st.rerun()
                    if delete_col.button(
                        ":material/delete:", key=f"delete_completed_{citem['id']}", use_container_width=True
                    ):
                        db.delete_todo_item(citem["id"])
                        st.rerun()

    if renaming:
        with st.form(f"rename_list_form_{list_id}"):
            new_name = st.text_input("Rename list", value=todo_list["name"])
            c1, c2 = st.columns(2)
            save = c1.form_submit_button("Save", use_container_width=True)
            cancel = c2.form_submit_button("Cancel", use_container_width=True)
            if save:
                if new_name.strip():
                    db.rename_todo_list(list_id, new_name.strip())
                    st.session_state["renaming_list_id"] = None
                    st.rerun()
                else:
                    st.error("Name is required.")
            if cancel:
                st.session_state["renaming_list_id"] = None
                st.rerun()

    with st.form(f"add_item_form_{list_id}", clear_on_submit=True):
        new_item_text = st.text_input(
            "Add item", label_visibility="collapsed", placeholder="Add an item...", key=f"add_item_input_{list_id}"
        )
        col1, col2 = st.columns([3, 1])
        new_item_tag = col1.text_input(
            "Tag", label_visibility="collapsed", placeholder="Tag (optional)", key=f"add_item_tag_{list_id}"
        )
        submitted = col2.form_submit_button("Add", use_container_width=True)
        if submitted:
            if new_item_text.strip():
                db.add_todo_item(list_id, new_item_text.strip(), tag=new_item_tag.strip() or None)
                st.rerun()
            else:
                st.error("Item text is required.")

    if not active_items and not completed_items:
        st.caption("No items yet — add one above.")
    elif not active_items:
        st.caption("All done! Checked items are in this list's ⋮ menu.")
    else:
        for item in active_items:
            if st.session_state.get("editing_todo_item_id") == item["id"]:
                with st.form(f"edit_item_form_{item['id']}"):
                    new_text = st.text_input("Item text", value=item["text"], label_visibility="collapsed")
                    new_tag = st.text_input(
                        "Tag",
                        value=item.get("tag") or "",
                        label_visibility="collapsed",
                        placeholder="Tag (optional)",
                    )
                    c1, c2 = st.columns(2)
                    save = c1.form_submit_button("Save", use_container_width=True)
                    cancel = c2.form_submit_button("Cancel", use_container_width=True)
                    if save:
                        if new_text.strip():
                            db.update_todo_item(
                                item["id"], text=new_text.strip(), tag=new_tag.strip() or None
                            )
                            st.session_state["editing_todo_item_id"] = None
                            st.rerun()
                        else:
                            st.error("Item text is required.")
                    if cancel:
                        st.session_state["editing_todo_item_id"] = None
                        st.rerun()
            else:
                checkbox_col, text_col, edit_col, delete_col = st.columns([0.5, 3.5, 1, 1])
                checked = checkbox_col.checkbox(
                    item["text"], value=item["is_done"], key=f"todo_item_{item['id']}", label_visibility="collapsed"
                )
                if checked != item["is_done"]:
                    db.set_todo_item_done(item["id"], checked)
                    st.rerun()
                tag_html = f" {tag_badge(item['tag'])}" if item.get("tag") else ""
                text_col.markdown(
                    f"<div style='padding-top:0.3rem;'>{html.escape(item['text'])}{tag_html}</div>",
                    unsafe_allow_html=True,
                )
                if edit_col.button(":material/edit:", key=f"edit_item_{item['id']}", use_container_width=True):
                    st.session_state["editing_todo_item_id"] = item["id"]
                    st.rerun()
                if delete_col.button(":material/delete:", key=f"delete_item_{item['id']}", use_container_width=True):
                    db.delete_todo_item(item["id"])
                    st.rerun()

    st.divider()
