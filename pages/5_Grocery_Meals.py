import html
import json
from datetime import date
from string import Template

import streamlit as st
import streamlit.components.v1 as components

import db
import recipe_service
from style import MUTED_TEXT, linkify, page_header

st.set_page_config(page_title="Grocery & Meals — Household Manager", page_icon="🛒", layout="wide")

page_header("Grocery & Meals", "Shared grocery list and meal plan")


def _split_lines(text: str) -> list[str]:
    return [ln.strip() for ln in (text or "").splitlines() if ln.strip()]


# Copy-the-list box that works on iPhone. Streamlit's st.code copy icon uses
# navigator.clipboard, which iOS Safari disables on non-HTTPS origins (e.g. a
# phone hitting the dev server by LAN IP) — the icon just silently does nothing.
# navigator.clipboard is also blocked inside Streamlit's component iframe (no
# clipboard-write permission on the frame). So the reliable path on iOS is:
# tap the box -> it selects all its text -> iOS's own "Copy" callout appears.
# The button is a bonus for browsers where the clipboard API / execCommand works.
_COPY_BOX = Template(
    """
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
      <textarea id="cp" readonly
        onclick="this.focus();this.setSelectionRange(0,this.value.length);"
        style="width:100%;height:${boxh}px;box-sizing:border-box;
        background:#1b2227;color:#E7ECEE;border:1px solid #2f3a40;border-radius:8px;
        padding:10px;font-size:15px;line-height:1.4;resize:none;-webkit-user-select:all;user-select:all;">${escaped}</textarea>
      <div style="margin-top:6px;color:#9fb0b5;font-size:13px;">
        Tap the list above to select it, then tap <b>Copy</b>.</div>
      <button id="cpbtn" style="margin-top:8px;width:100%;padding:12px;font-size:16px;
        background:#2E8B90;color:#fff;border:none;border-radius:8px;">Copy to clipboard</button>
      <div id="cpmsg" style="margin-top:6px;color:#9fb0b5;font-size:13px;min-height:1em;"></div>
    </div>
    <script>
      const t=document.getElementById('cp'),b=document.getElementById('cpbtn'),m=document.getElementById('cpmsg');
      b.addEventListener('click',async()=>{
        const val=${payload};let ok=false;
        try{await navigator.clipboard.writeText(val);ok=true;}
        catch(e){try{t.focus();t.setSelectionRange(0,val.length);ok=document.execCommand('copy');}catch(e2){ok=false;}}
        m.textContent=ok?'Copied.':'Use the tap-to-select method above instead.';
        b.style.background=ok?'#3a9aa0':'#2E8B90';b.textContent=ok?'Copied':'Copy to clipboard';
      });
    </script>
    """
)


def _copy_box(text: str) -> None:
    n_lines = text.count("\n") + 1
    box_h = min(300, 40 + 22 * n_lines)
    components.html(
        _COPY_BOX.substitute(
            escaped=html.escape(text),
            payload=json.dumps(text),
            boxh=box_h,
        ),
        height=box_h + 110,
    )


# Apply a pending ingredient/title prefill from the "Fetch from URL" button
# before the add-meal widgets are instantiated (see feedback_streamlit_widget_state).
if "_prefill" in st.session_state:
    prefill = st.session_state.pop("_prefill")
    st.session_state["new_meal_ingredients"] = prefill["ingredients"]
    if prefill.get("title"):
        st.session_state["new_meal_name"] = prefill["title"]
    st.session_state["_prefill_url"] = prefill.get("url", "")

# ---------------------------------------------------------------- Grocery list

st.markdown("### Grocery list")

items = db.list_grocery_items()
# Unchecked first, checked sink to the bottom; order within each group preserved.
items.sort(key=lambda i: i["is_checked"])
checked_count = sum(1 for i in items if i["is_checked"])

with st.form("add_grocery_form", clear_on_submit=True):
    name = st.text_input("Item", placeholder="Item name...", label_visibility="collapsed")
    qty_col, add_col = st.columns([2, 1])
    quantity = qty_col.text_input(
        "Quantity", placeholder="Qty (optional)", label_visibility="collapsed"
    )
    if add_col.form_submit_button("Add", use_container_width=True):
        if name.strip():
            db.add_grocery_item(name.strip(), quantity.strip())
            st.rerun()
        else:
            st.error("Item name is required.")

if not items:
    st.caption("Grocery list is empty — add something above.")

for item in items:
    text_col, del_col = st.columns([5, 1], vertical_alignment="center")
    # Item name is the checkbox label so tapping the text toggles it too.
    label = item["name"]
    if item.get("quantity"):
        label += f"  ({item['quantity']})"
    checked = text_col.checkbox(label, value=item["is_checked"], key=f"grocery_{item['id']}")
    if checked != item["is_checked"]:
        db.set_grocery_item_checked(item["id"], checked)
        st.rerun()
    if del_col.button(":material/delete:", key=f"del_grocery_{item['id']}", use_container_width=True):
        db.delete_grocery_item(item["id"])
        st.rerun()

if checked_count:
    if st.button(f"Clear {checked_count} checked", use_container_width=True):
        db.clear_checked_grocery_items()
        st.rerun()

# Copy the unchecked list as plain text — for pasting into Instacart, ChatGPT,
# Claude, a text to someone, etc. (Instacart Developer Platform signups are
# closed, so there's no in-app "send to Instacart" button — see the build plan
# Stage 9 re-scope; a real Instacart cart will come via the Stage 11 assistant.)
unchecked = [i for i in items if not i["is_checked"]]
if unchecked:
    if st.toggle("Copy list", value=False, key="show_copy_list"):
        lines = [
            f"{i['name']} ({i['quantity']})" if i.get("quantity") else i["name"]
            for i in unchecked
        ]
        _copy_box("\n".join(lines))

st.divider()

# ------------------------------------------------------------------ Meal plan

st.markdown("### Meal plan")

entries = db.list_meal_plan()
today_iso = date.today().isoformat()

meal_form_open = st.session_state.pop("_keep_meal_form_open", False)
with st.expander("Add a planned meal", expanded=meal_form_open):
    # URL scrape lives outside the form so the button works without submitting.
    url_col, fetch_col = st.columns([3, 1])
    recipe_url = url_col.text_input(
        "Recipe URL", key="new_meal_url", placeholder="Paste a recipe link...",
        label_visibility="collapsed",
    )
    if fetch_col.button("Fetch", use_container_width=True):
        if recipe_url.strip():
            try:
                result = recipe_service.scrape_recipe(recipe_url.strip())
                st.session_state["_prefill"] = {
                    "ingredients": "\n".join(result["ingredients"]),
                    "title": result["title"],
                    "url": recipe_url.strip(),
                }
                st.session_state["_keep_meal_form_open"] = True
                st.rerun()
            except recipe_service.RecipeScrapeError as exc:
                st.warning(str(exc))
        else:
            st.warning("Paste a recipe URL first.")

    with st.form("add_meal_form", clear_on_submit=True):
        meal_date = st.date_input("Date", value=date.today())
        meal_name = st.text_input("Meal", key="new_meal_name")
        meal_notes = st.text_area("Notes (optional)", height=80)
        meal_ingredients = st.text_area(
            "Ingredients (one per line)", height=140, key="new_meal_ingredients",
            placeholder="2 chicken breasts\n1 bag rice\nBroccoli",
        )
        if st.form_submit_button("Add meal", use_container_width=True):
            if meal_name.strip():
                db.add_meal_plan_entry(
                    meal_date.isoformat(),
                    meal_name.strip(),
                    meal_notes.strip() or None,
                    meal_ingredients.strip() or None,
                    st.session_state.get("_prefill_url") or None,
                )
                st.session_state.pop("_prefill_url", None)
                st.rerun()
            else:
                st.error("Meal name is required.")

show_past = st.toggle("Show past meals", value=False)
visible = [e for e in entries if show_past or e["date"] >= today_iso]

if not visible:
    st.caption("No upcoming meals planned — add one above.")


def _render_meal(entry: dict) -> None:
    eid = entry["id"]
    editing = st.session_state.get("editing_meal_id") == eid
    with st.container(border=True):
        if editing:
            with st.form(f"edit_meal_form_{eid}"):
                d = st.date_input("Date", value=date.fromisoformat(entry["date"]))
                nm = st.text_input("Meal", value=entry["meal_name"])
                nt = st.text_area("Notes (optional)", value=entry.get("notes") or "", height=80)
                ing = st.text_area(
                    "Ingredients (one per line)",
                    value=entry.get("ingredients") or "", height=140,
                )
                su = st.text_input("Recipe URL (optional)", value=entry.get("source_url") or "")
                c1, c2 = st.columns(2)
                if c1.form_submit_button("Save", use_container_width=True):
                    if nm.strip():
                        db.update_meal_plan_entry(
                            eid,
                            date=d.isoformat(),
                            meal_name=nm.strip(),
                            notes=nt.strip() or None,
                            ingredients=ing.strip() or None,
                            source_url=su.strip() or None,
                        )
                        st.session_state["editing_meal_id"] = None
                        st.rerun()
                    else:
                        st.error("Meal name is required.")
                if c2.form_submit_button("Cancel", use_container_width=True):
                    st.session_state["editing_meal_id"] = None
                    st.rerun()
            return

        title_col, menu_col = st.columns([4, 1])
        try:
            pretty = date.fromisoformat(entry["date"]).strftime("%a, %b %d")
        except ValueError:
            pretty = entry["date"]
        title_col.markdown(
            f"<span style='color:{MUTED_TEXT}; font-size:0.85rem;'>{pretty}</span><br>"
            f"**{html.escape(entry['meal_name'])}**",
            unsafe_allow_html=True,
        )

        confirming = st.session_state.get("confirm_delete_meal_id") == eid
        with menu_col.popover(":material/more_vert:", use_container_width=True):
            if confirming:
                st.write(f"Delete \"{entry['meal_name']}\"?")
                if st.button("Delete", key=f"confirm_del_meal_{eid}", type="primary", use_container_width=True):
                    db.delete_meal_plan_entry(eid)
                    st.session_state["confirm_delete_meal_id"] = None
                    st.rerun()
                if st.button("Cancel", key=f"cancel_del_meal_{eid}", use_container_width=True):
                    st.session_state["confirm_delete_meal_id"] = None
                    st.rerun()
            else:
                if st.button("Edit", key=f"edit_meal_{eid}", use_container_width=True):
                    st.session_state["editing_meal_id"] = eid
                    st.rerun()
                if st.button("Delete", key=f"del_meal_{eid}", use_container_width=True):
                    st.session_state["confirm_delete_meal_id"] = eid
                    st.rerun()

        if entry.get("notes"):
            st.markdown(linkify(entry["notes"]), unsafe_allow_html=True)

        if entry.get("source_url"):
            url = entry["source_url"]
            st.markdown(
                f"<a href='{html.escape(url, quote=True)}' target='_blank' "
                f"rel='noopener noreferrer'>View recipe</a>",
                unsafe_allow_html=True,
            )

        ingredients = _split_lines(entry.get("ingredients") or "")
        if ingredients:
            st.markdown(
                "<div style='margin:0.3em 0;'>"
                + "".join(f"<div style='color:{MUTED_TEXT};'>• {html.escape(x)}</div>" for x in ingredients)
                + "</div>",
                unsafe_allow_html=True,
            )
            if st.button(
                f"Add {len(ingredients)} ingredient{'s' if len(ingredients) != 1 else ''} to grocery list",
                key=f"add_ing_{eid}",
                use_container_width=True,
            ):
                added = db.add_ingredients_to_grocery_list(ingredients)
                if added:
                    st.toast(f"Added {len(added)} item(s) to the grocery list.")
                else:
                    st.toast("Those are already on the grocery list.")
                st.rerun()


for entry in visible:
    _render_meal(entry)
