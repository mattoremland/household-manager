from datetime import date, datetime, time, timedelta, timezone

import streamlit as st
from streamlit_calendar import calendar

import calendar_service
from style import page_header

st.set_page_config(page_title="Calendar — Household Manager", page_icon="📅", layout="wide")

page_header("Calendar")

WINDOW_BACK = 45     # days of history to load
WINDOW_FWD = 210     # days ahead to load


# --- Authorization gate ---

def _reconnect_help() -> None:
    """How to fix a broken connection, which differs local vs. deployed."""
    if calendar_service.auth_source() == "secret":
        st.caption(
            "This app is using the `GOOGLE_OAUTH_TOKEN` secret, so it can't sign in "
            "from here — the Google consent flow needs a browser on the machine "
            "running the app. Run `python calendar_service.py` locally and paste the "
            "value it prints into Settings → Secrets."
        )
    else:
        st.caption(
            "Connecting opens a Google sign-in page in a browser **on the machine "
            "running this app**. Sign in as the account with edit access to the "
            "shared calendar. One-time step."
        )


if not calendar_service.is_authorized():
    st.warning("Google Calendar isn't connected yet.")
    _reconnect_help()
    if calendar_service.auth_source() != "secret":
        if st.button("Connect Google Calendar", type="primary"):
            try:
                with st.spinner("Waiting for Google sign-in to finish in the browser…"):
                    calendar_service.authorize()
                st.success("Connected.")
                st.rerun()
            except Exception as e:  # noqa: BLE001
                st.error(f"Couldn't connect: {e}")
    st.stop()


# --- Data ---

@st.cache_data(ttl=60)
def _load_events() -> list[dict]:
    now = datetime.now(timezone.utc)
    return calendar_service.get_events_between(
        now - timedelta(days=WINDOW_BACK), now + timedelta(days=WINDOW_FWD)
    )


def _refresh():
    _load_events.clear()
    st.rerun()


def _to_fc_event(e: dict) -> dict:
    if e["all_day"]:
        start = e["start"].isoformat()
        end = (e["end"] + timedelta(days=1)).isoformat()  # FullCalendar end is exclusive
    else:
        start = e["start"].isoformat()
        end = e["end"].isoformat()
    return {
        "id": e["id"],
        "title": e["summary"],
        "start": start,
        "end": end,
        "allDay": e["all_day"],
    }


try:
    events = _load_events()
except Exception as e:  # noqa: BLE001
    st.error(f"Couldn't load calendar: {e}")
    _reconnect_help()
    if calendar_service.auth_source() != "secret":
        if st.button("Reconnect Google Calendar"):
            try:
                calendar_service.authorize()
                _refresh()
            except Exception as ee:  # noqa: BLE001
                st.error(f"Couldn't reconnect: {ee}")
    st.stop()

events_by_id = {e["id"]: e for e in events}


# --- Calendar widget ---

calendar_options = {
    "initialView": "dayGridMonth",
    "headerToolbar": {"left": "title", "center": "", "right": "prev,next"},
    "footerToolbar": {"left": "today", "center": "", "right": "dayGridMonth,timeGrid3Day,listMonth"},
    "views": {
        "timeGrid3Day": {"type": "timeGrid", "duration": {"days": 3}, "buttonText": "3-day"},
        "dayGridMonth": {"titleFormat": {"year": "numeric", "month": "short"}},
    },
    "buttonText": {
        "today": "Today",
        "dayGridMonth": "Month",
        "listMonth": "List",
    },
    "titleFormat": {"year": "numeric", "month": "short", "day": "numeric"},
    "scrollTime": "07:00:00",
    "height": 640,
    "editable": True,        # drag / resize to reschedule
    "selectable": True,
    "navLinks": True,
    "nowIndicator": True,
    "dayMaxEvents": True,
    "firstDay": 0,
}

custom_css = """
.fc {
    --fc-border-color: #2A343B;
    --fc-page-bg-color: transparent;
    --fc-neutral-bg-color: #1B2328;
    --fc-today-bg-color: rgba(46,139,144,0.18);
    --fc-list-event-hover-bg-color: #1B2328;
    color: #E7ECEE;
}
.fc a { color: inherit !important; text-decoration: none; }
.fc .fc-col-header-cell-cushion,
.fc .fc-daygrid-day-number,
.fc .fc-toolbar-title,
.fc .fc-list-day-text,
.fc .fc-list-day-side-text { color: #E7ECEE !important; }
.fc .fc-button-primary {
    background-color: #1B2328;
    border-color: #2A343B;
    color: #E7ECEE;
}
.fc .fc-button-primary:not(:disabled).fc-button-active,
.fc .fc-button-primary:not(:disabled):hover {
    background-color: #2E8B90;
    border-color: #2E8B90;
}
.fc-event { border: none; padding: 1px 3px; font-size: 0.8rem; }
.fc .fc-daygrid-event,
.fc .fc-timegrid-event,
.fc .fc-list-event-dot { background-color: #2E8B90; border-color: #2E8B90; }
"""

state = calendar(
    events=[_to_fc_event(e) for e in events],
    options=calendar_options,
    custom_css=custom_css,
    key="household_calendar",
)


# --- Drag / resize -> reschedule ---

def _parse_fc(value: str):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


if isinstance(state, dict) and state.get("eventChange"):
    payload = state["eventChange"].get("event", {})
    sig = ("change", payload.get("id"), payload.get("start"), payload.get("end"))
    if st.session_state.get("cal_last_action") != sig:
        st.session_state["cal_last_action"] = sig
        try:
            all_day = bool(payload.get("allDay"))
            start_dt = _parse_fc(payload["start"])
            end_raw = payload.get("end") or payload["start"]
            end_dt = _parse_fc(end_raw)
            if all_day:
                new_start = start_dt.date()
                new_end = (end_dt - timedelta(days=1)).date()
                if new_end < new_start:
                    new_end = new_start
            else:
                new_start, new_end = start_dt, end_dt
            calendar_service.update_event(
                payload["id"], start=new_start, end=new_end, all_day=all_day
            )
            st.toast("Event rescheduled.")
            _refresh()
        except Exception as e:  # noqa: BLE001
            st.error(f"Couldn't reschedule: {e}")


# --- Tap an event -> preselect it for editing ---

if isinstance(state, dict) and state.get("eventClick"):
    clicked_id = state["eventClick"].get("event", {}).get("id")
    if clicked_id and st.session_state.get("cal_click_seen") != clicked_id:
        st.session_state["cal_click_seen"] = clicked_id
        st.session_state["cal_edit_id"] = clicked_id
        st.session_state["cal_edit_select"] = clicked_id
        st.rerun()

st.caption("Tap an event to edit or delete it. Drag an event to reschedule.")
st.divider()


# --- Add event ---

with st.expander("Add event", expanded=False):
    with st.form("add_event_form", clear_on_submit=True):
        summary = st.text_input("Title")
        ev_date = st.date_input("Date", value=date.today())
        all_day = st.checkbox("All day", value=False)
        c1, c2 = st.columns(2)
        start_time = c1.time_input("Start", value=time(9, 0))
        end_time = c2.time_input("End", value=time(10, 0))
        location = st.text_input("Location (optional)")
        description = st.text_area("Notes (optional)", height=80)
        if st.form_submit_button("Add event", use_container_width=True):
            if not summary.strip():
                st.error("Title is required.")
            elif not all_day and end_time <= start_time:
                st.error("End time must be after start time.")
            else:
                try:
                    if all_day:
                        s = e_ = ev_date
                    else:
                        s = datetime.combine(ev_date, start_time)
                        e_ = datetime.combine(ev_date, end_time)
                    calendar_service.create_event(
                        summary.strip(), s, e_, all_day=all_day,
                        location=location.strip() or None,
                        description=description.strip() or None,
                    )
                    st.success("Event added.")
                    _refresh()
                except Exception as e:  # noqa: BLE001
                    st.error(f"Couldn't add event: {e}")


# --- Edit / delete ---

def _event_choice_label(e: dict) -> str:
    d = e["start"] if isinstance(e["start"], date) and not isinstance(e["start"], datetime) else e["start"].date()
    return f"{d.strftime('%b')} {d.day} — {e['summary']}"


def _sort_key(e: dict) -> datetime:
    s = e["start"]
    if isinstance(s, datetime):
        return s.astimezone(timezone.utc) if s.tzinfo else s.replace(tzinfo=timezone.utc)
    return datetime.combine(s, time(), tzinfo=timezone.utc)


upcoming_sorted = sorted(events, key=_sort_key)

with st.expander("Edit or delete an event", expanded=bool(st.session_state.get("cal_edit_id"))):
    if not upcoming_sorted:
        st.caption("No events loaded.")
    else:
        ids = [e["id"] for e in upcoming_sorted]
        if st.session_state.get("cal_edit_select") not in ids:
            st.session_state["cal_edit_select"] = ids[0]
        chosen_id = st.selectbox(
            "Event",
            ids,
            format_func=lambda i: _event_choice_label(events_by_id[i]),
            key="cal_edit_select",
        )
        st.session_state["cal_edit_id"] = chosen_id
        ev = events_by_id[chosen_id]

        with st.form("edit_event_form"):
            e_summary = st.text_input("Title", value=ev["summary"])
            e_day = ev["start"] if isinstance(ev["start"], date) and not isinstance(ev["start"], datetime) else ev["start"].date()
            e_date = st.date_input("Date", value=e_day)
            e_all_day = st.checkbox("All day", value=ev["all_day"])
            s_def = ev["start"].time() if isinstance(ev["start"], datetime) else time(9, 0)
            en_def = ev["end"].time() if isinstance(ev["end"], datetime) else time(10, 0)
            c1, c2 = st.columns(2)
            e_start = c1.time_input("Start", value=s_def)
            e_end = c2.time_input("End", value=en_def)
            e_location = st.text_input("Location", value=ev["location"])
            e_description = st.text_area("Notes", value=ev["description"], height=80)
            b1, b2 = st.columns(2)
            save = b1.form_submit_button("Save", use_container_width=True)
            delete = b2.form_submit_button("Delete", use_container_width=True)

        if save:
            if not e_summary.strip():
                st.error("Title is required.")
            elif not e_all_day and e_end <= e_start:
                st.error("End time must be after start time.")
            else:
                try:
                    if e_all_day:
                        s = e_ = e_date
                    else:
                        s = datetime.combine(e_date, e_start)
                        e_ = datetime.combine(e_date, e_end)
                    calendar_service.update_event(
                        chosen_id, summary=e_summary.strip(), start=s, end=e_,
                        all_day=e_all_day, location=e_location.strip(),
                        description=e_description.strip(),
                    )
                    st.session_state.pop("cal_edit_id", None)
                    st.success("Saved.")
                    _refresh()
                except Exception as e:  # noqa: BLE001
                    st.error(f"Couldn't save: {e}")

        if delete:
            try:
                calendar_service.delete_event(chosen_id)
                st.session_state.pop("cal_edit_id", None)
                st.success("Deleted.")
                _refresh()
            except Exception as e:  # noqa: BLE001
                st.error(f"Couldn't delete: {e}")

if st.button("Refresh calendar"):
    _refresh()
