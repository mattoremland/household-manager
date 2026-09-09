"""Shared visual identity for the Household Manager app (Stage 1: Cool Minimal, dark theme).

Every page should call page_header() instead of st.title() so headers stay
consistent, and use badge() for small status labels (e.g. overdue, expiring soon).
"""

import hashlib
import html
import re
import urllib.parse

import streamlit as st

ACCENT = "#F0836A"       # coral — highlights/badges not covered by the Streamlit theme
MUTED_TEXT = "#8CA0A8"   # secondary text: captions, timestamps, subtitles

_FONT_CSS = """
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
html, body, .stApp, .stApp *:not([data-testid="stIconMaterial"]):not([role="img"]) {
    font-family: 'Inter', sans-serif !important;
}
/* Keep st.columns() side-by-side even on narrow/mobile widths instead of
   wrapping onto separate lines — used for compact row layouts like a
   title + corner menu button. */
[data-testid="stHorizontalBlock"] {
    flex-wrap: nowrap !important;
}
[data-testid="stColumn"] {
    min-width: 0 !important;
}
/* Compact icon-only popover triggers (nav menu, per-entry kebab menus) still
   need a comfortable minimum tap target — otherwise a narrow flex column can
   squeeze the button so much the icon clips against its edge. */
[data-testid="stPopoverButton"] {
    min-width: 2.75rem !important;
}
/* Nav lives in a top-right menu (see render_nav_menu); the sidebar is the AI
   assistant chat and nothing else (Stage 11), so hide Streamlit's own multipage
   nav list at the top of it. The sidebar itself and its show/hide toggles stay
   visible — on a phone it opens as a slide-over drawer. */
[data-testid="stSidebarNav"] {
    display: none !important;
}
/* Hide Streamlit Community Cloud branding (bottom-left profile + crown icons). */
[data-testid="stMainMenu"],
._profileContainer_gzau3_53,
#stStreamlitMainMenu {
    display: none !important;
}
footer { visibility: hidden !important; }
/* Give the chat some breathing room on desktop. Deliberately NOT applied at phone
   widths — there the sidebar is a slide-over drawer and a min-width wider than the
   viewport pushes its left edge off screen. */
@media (min-width: 768px) {
    [data-testid="stSidebar"] { min-width: 20rem; }
}
/* Streamlit's default chat avatars are large bright squares — they clash with the
   palette and eat scarce width in a sidebar that's already narrow on a phone.
   Hide them and mark the user's own messages with a subtle tinted bubble instead. */
[data-testid="stChatMessageAvatarUser"],
[data-testid="stChatMessageAvatarAssistant"] {
    display: none !important;
}
[data-testid="stChatMessage"] {
    padding: 0.15rem 0 !important;
    gap: 0 !important;
    background: transparent !important;
}
[data-testid="stChatMessage"]:has([data-testid="stChatMessageAvatarUser"]) [data-testid="stChatMessageContent"] {
    background: rgba(240, 131, 106, 0.13);
    border-radius: 12px;
    padding: 0.45rem 0.7rem;
}
</style>
"""

NAV_PAGES = [
    ("Household_Manager.py", "Dashboard"),
    ("pages/1_Calendar.py", "Calendar"),
    ("pages/2_Lists.py", "Lists"),
    ("pages/4_Household_Info.py", "Household Info"),
    ("pages/5_Grocery_Meals.py", "Grocery & Meals"),
    ("pages/7_Notes.py", "Notes"),
]


def inject_global_style() -> None:
    st.markdown(_FONT_CSS, unsafe_allow_html=True)


def render_nav_menu() -> None:
    """Top-right '...' menu linking to every page, replacing the default left sidebar nav."""
    _, menu_col = st.columns([10, 1])
    with menu_col.popover(":material/more_vert:", use_container_width=True):
        for path, label in NAV_PAGES:
            st.page_link(path, label=label)


def page_header(title: str, subtitle: str | None = None) -> None:
    """Consistent page header: nav menu, title, optional muted subtitle, divider.

    Also draws the assistant chat sidebar, so every page that uses this header
    gets the same persistent conversation.
    """
    import chat_ui  # imported here to avoid a circular import at module load

    inject_global_style()
    chat_ui.render_chat_sidebar()
    render_nav_menu()
    st.markdown(f"## {title}")
    if subtitle:
        st.markdown(
            f"<span style='color:{MUTED_TEXT}; font-size:0.9rem;'>{subtitle}</span>",
            unsafe_allow_html=True,
        )
    st.divider()


def badge(text: str, tone: str = "accent") -> str:
    """HTML for a small status pill. Render with st.markdown(badge(...), unsafe_allow_html=True).

    text is HTML-escaped since it's often user-entered data (e.g. a category name).
    """
    color = ACCENT if tone == "accent" else MUTED_TEXT
    safe_text = html.escape(text)
    return (
        f"<span style='background:{color}22; color:{color}; padding:2px 8px; "
        f"border-radius:999px; font-size:0.8rem; font-weight:600;'>{safe_text}</span>"
    )


# Fixed colors for known people; anyone else's tag gets a stable color hashed
# from their name so the same tag always renders the same color.
_TAG_OVERRIDES = {
    "lucy": "#7FD858",  # green
    "matt": "#5B9DF0",  # blue
}
_TAG_PALETTE = [
    "#F0836A",  # coral
    "#C792EA",  # purple
    "#FFCB6B",  # amber
    "#89DDFF",  # cyan
    "#F78C6C",  # orange
    "#C3E88D",  # light green
    "#F07178",  # red
    "#82AAFF",  # light blue
]


def tag_badge(tag: str) -> str:
    """HTML for a small color-coded pill for a Lists item tag.

    Same tag text always maps to the same color: 'Lucy' is always green and
    'Matt' is always blue (case-insensitive), any other tag gets a stable
    color hashed from its text so it's consistent across renders/sessions.
    Render with st.markdown(tag_badge(...), unsafe_allow_html=True).
    """
    key = tag.strip().lower()
    color = _TAG_OVERRIDES.get(key)
    if not color:
        digest = hashlib.md5(key.encode()).hexdigest()
        color = _TAG_PALETTE[int(digest, 16) % len(_TAG_PALETTE)]
    safe_text = html.escape(tag)
    return (
        f"<span style='background:{color}22; color:{color}; padding:2px 8px; "
        f"border-radius:999px; font-size:0.75rem; font-weight:600;'>{safe_text}</span>"
    )


_URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>\"]+", re.IGNORECASE)
_PHONE_RE = re.compile(r"(?:\(\d{3}\)\s?\d{3}[-.\s]?\d{4})|(?:\d{3}[-.\s]\d{3}[-.\s]\d{4})")
_ZIP_RE = re.compile(r"\b\d{5}(?:-\d{4})?\b")
_BULLET_RE = re.compile(r"^[-*•]\s+(.*)")
_NUMBERED_RE = re.compile(r"^\d+[.)]\s+(.*)")


def _linkify_block(block_text: str) -> str:
    """Escape+linkify a block of text that isn't a standalone phone line.

    If it contains a US ZIP code, the whole block is treated as a postal address
    and wrapped in one Apple Maps directions link. Otherwise URLs and any inline
    phone-number substrings get their own links.
    """
    escaped = html.escape(block_text)
    with_breaks = escaped.replace("\n", "<br>")

    if _ZIP_RE.search(block_text):
        query = urllib.parse.quote(" ".join(block_text.split()))
        href = f"http://maps.apple.com/?daddr={query}"
        return f'<a href="{href}" target="_blank" rel="noopener noreferrer">{with_breaks}</a>'

    def _url_sub(m: re.Match) -> str:
        url = m.group(0)
        href = url if url.lower().startswith("http") else f"https://{url}"
        return f'<a href="{href}" target="_blank" rel="noopener noreferrer">{url}</a>'

    linked = _URL_RE.sub(_url_sub, with_breaks)

    def _phone_sub(m: re.Match) -> str:
        phone = m.group(0)
        digits = re.sub(r"\D", "", phone)
        return f'<a href="tel:{digits}">{phone}</a>'

    return _PHONE_RE.sub(_phone_sub, linked)


def linkify(text: str) -> str:
    """Escape text, preserve line breaks, and wrap URLs/phone numbers/addresses in clickable links.

    Render with st.markdown(linkify(...), unsafe_allow_html=True). Escaping happens
    first so this is safe on arbitrary user-entered text (e.g. a note's content).

    Processed line-by-line: a line that's *only* a phone number always becomes its
    own tel: link. A run of lines starting with "- "/"* "/"• " becomes a bulleted
    list; a run starting with "1. "/"1) " (any number) becomes a numbered list
    (auto-renumbered, so the actual digits typed don't matter). Remaining runs of
    plain lines are grouped into blocks; a block containing a US ZIP code is
    treated as a postal address and wrapped in a single Apple Maps directions link
    (with line breaks preserved inside it), otherwise URLs/inline phone substrings
    within that block get linkified individually. This keeps e.g. a phone number on
    one line and an address on the next two lines independently clickable instead
    of one link swallowing both.
    """
    lines = text.split("\n")

    def _render_phone_line(line: str) -> str:
        stripped = line.strip()
        digits = re.sub(r"\D", "", stripped)
        return f'<a href="tel:{digits}">{html.escape(stripped)}</a>'

    rendered: list[str] = []
    block: list[str] = []
    list_items: list[str] = []
    list_tag: str | None = None

    def flush_block() -> None:
        if block:
            rendered.append(_linkify_block("\n".join(block)))
            block.clear()

    def flush_list() -> None:
        nonlocal list_tag
        if list_items:
            items_html = "".join(f"<li>{_linkify_block(item)}</li>" for item in list_items)
            rendered.append(f"<{list_tag} style='margin:0.3em 0; padding-left:1.4em;'>{items_html}</{list_tag}>")
            list_items.clear()
        list_tag = None

    for line in lines:
        stripped = line.strip()
        bullet_match = _BULLET_RE.match(stripped)
        numbered_match = _NUMBERED_RE.match(stripped)
        if _PHONE_RE.fullmatch(stripped):
            flush_block()
            flush_list()
            rendered.append(_render_phone_line(line))
        elif bullet_match:
            flush_block()
            if list_tag != "ul":
                flush_list()
                list_tag = "ul"
            list_items.append(bullet_match.group(1))
        elif numbered_match:
            flush_block()
            if list_tag != "ol":
                flush_list()
                list_tag = "ol"
            list_items.append(numbered_match.group(1))
        else:
            flush_list()
            block.append(line)
    flush_block()
    flush_list()

    return "<br>".join(rendered)


def extract_phone(text: str) -> str | None:
    """Return the digits of the first phone-number-shaped match in text, or None."""
    match = _PHONE_RE.search(text)
    if not match:
        return None
    return re.sub(r"\D", "", match.group(0))
