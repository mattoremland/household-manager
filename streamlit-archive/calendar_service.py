"""Google Calendar access layer — shared by the Calendar page and, later, the AI assistant's tools.

Uses the OAuth "installed app" flow: the first call opens a browser for consent and
caches the result in token.json; subsequent calls refresh silently. Both users share
this single authorization (the app has one Google login), so every write goes out as
whichever account authorized it — see CLAUDE.md / project memory for the rationale.

Deployed, there is no browser and no durable disk, so the token comes from the
GOOGLE_OAUTH_TOKEN secret instead of token.json. To (re)generate it, run this
module directly on a local machine:

    python calendar_service.py

It authorizes if needed and prints the exact line to paste into Streamlit Secrets.
The OAuth consent screen must also be published to "In production" — in "Testing"
Google expires the refresh token after 7 days.

Every function returns/accepts plain dicts and datetime/date objects, no Google
resource wrappers leak out.
"""

import json
import os
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

load_dotenv()

_HERE = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(_HERE, "credentials.json")
TOKEN_PATH = os.path.join(_HERE, "token.json")

# calendar.events is all we need — create/read/update/delete events on an existing
# calendar. We don't create or manage calendars themselves.
SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

CALENDAR_ID = os.environ.get("GOOGLE_CALENDAR_ID", "primary")

# Deployment: Streamlit Cloud has no browser to run the consent flow in and an
# ephemeral, sometimes read-only filesystem, so token.json can't be the source of
# truth there. Instead the whole token.json payload is pasted into Streamlit
# Secrets as GOOGLE_OAUTH_TOKEN. It already carries client_id, client_secret,
# refresh_token and token_uri, so it can refresh itself without credentials.json.
# Locally the env var is unset and the file is used exactly as before.
TOKEN_ENV = "GOOGLE_OAUTH_TOKEN"

_service = None
_calendar_tz = None
_creds: Credentials | None = None


# --- Auth / service plumbing ---

def auth_source() -> str | None:
    """Where the token is coming from: 'secret', 'file', or None if there isn't one."""
    if os.environ.get(TOKEN_ENV):
        return "secret"
    if os.path.exists(TOKEN_PATH):
        return "file"
    return None


def _token_info() -> dict | None:
    raw = os.environ.get(TOKEN_ENV)
    if raw:
        return json.loads(raw)
    if os.path.exists(TOKEN_PATH):
        with open(TOKEN_PATH) as f:
            return json.load(f)
    return None


def _load_credentials() -> Credentials | None:
    """Usable credentials from the secret or token.json, refreshing if expired.

    The result is cached for the life of the process. Without that cache every
    page render would re-read a stale token and hit Google for a fresh refresh,
    since a refresh under GOOGLE_OAUTH_TOKEN has nowhere durable to write back to.
    """
    global _creds
    if _creds is None:
        info = _token_info()
        if info is None:
            return None
        _creds = Credentials.from_authorized_user_info(info, SCOPES)
    if _creds.expired and _creds.refresh_token:
        _creds.refresh(Request())
        _write_token(_creds)
    return _creds


def _write_token(creds: Credentials) -> None:
    """Cache the token to disk — best effort only.

    When the token came from GOOGLE_OAUTH_TOKEN we're deployed: there's nothing
    durable to write to, and the in-memory refresh above is enough. A failed write
    is never an error.
    """
    if os.environ.get(TOKEN_ENV):
        return
    try:
        with open(TOKEN_PATH, "w") as f:
            f.write(creds.to_json())
    except OSError:
        pass


def is_authorized() -> bool:
    """True if we have usable credentials without needing a browser consent step."""
    try:
        creds = _load_credentials()
    except Exception:
        return False
    return bool(creds and creds.valid)


def authorize() -> None:
    """Run the interactive OAuth consent flow (opens a browser) and cache the token.

    Local machine only — it starts a loopback web server and opens a browser, so it
    can never work on Streamlit Cloud. To authorize the deployed app, run this
    locally (`python calendar_service.py`) and paste the printed value into the
    app's Streamlit Secrets as GOOGLE_OAUTH_TOKEN.
    """
    if os.environ.get(TOKEN_ENV):
        raise RuntimeError(
            "This app is using the GOOGLE_OAUTH_TOKEN secret, which can't be "
            "re-created here — the consent flow needs a browser on the machine "
            "running the app. Run `python calendar_service.py` locally and paste "
            "the new value into Streamlit Secrets."
        )
    if not os.path.exists(CREDENTIALS_PATH):
        raise FileNotFoundError(
            "credentials.json not found in the project folder. Download the OAuth "
            "'Desktop app' client from Google Cloud Console and save it there."
        )
    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent")
    _write_token(creds)
    global _service, _calendar_tz, _creds
    _service = None
    _calendar_tz = None
    _creds = creds


def token_as_secret() -> str:
    """The current token as the TOML line to paste into Streamlit Secrets."""
    info = _token_info()
    if info is None:
        raise RuntimeError("No token yet — run authorize() first.")
    return f"GOOGLE_OAUTH_TOKEN = '{json.dumps(info)}'"


def _get_service():
    global _service
    if _service is None:
        creds = _load_credentials()
        if not creds or not creds.valid:
            raise RuntimeError("Google Calendar is not authorized yet — call authorize() first.")
        _service = build("calendar", "v3", credentials=creds, cache_discovery=False)
    return _service


# --- Event helpers ---

def _parse_dt(value: str) -> datetime | date:
    """Parse a Google event start/end into a date (all-day) or aware datetime (timed)."""
    if len(value) == 10:  # 'YYYY-MM-DD'
        return date.fromisoformat(value)
    return datetime.fromisoformat(value)


def _normalize_event(raw: dict) -> dict:
    start_raw = raw.get("start", {})
    end_raw = raw.get("end", {})
    all_day = "date" in start_raw
    start = _parse_dt(start_raw.get("date") or start_raw.get("dateTime"))
    end = _parse_dt(end_raw.get("date") or end_raw.get("dateTime"))
    if all_day:
        # Google stores the end of an all-day event as the day *after* the last day.
        end = end - timedelta(days=1)
    return {
        "id": raw["id"],
        "summary": raw.get("summary", "(no title)"),
        "all_day": all_day,
        "start": start,
        "end": end,
        "location": raw.get("location", ""),
        "description": raw.get("description", ""),
        "html_link": raw.get("htmlLink", ""),
    }


def _to_api_times(start, end, all_day: bool) -> tuple[dict, dict]:
    if all_day:
        s = start if isinstance(start, date) else start.date()
        e = end if isinstance(end, date) else end.date()
        return {"date": s.isoformat()}, {"date": (e + timedelta(days=1)).isoformat()}
    return {"dateTime": start.isoformat()}, {"dateTime": end.isoformat()}


# --- Public API ---

def get_calendar_timezone() -> str:
    """The target calendar's configured time zone (e.g. 'America/New_York'). Cached.

    Read from an events.list response rather than calendars.get so it works with
    just the calendar.events scope.
    """
    global _calendar_tz
    if _calendar_tz is None:
        result = (
            _get_service()
            .events()
            .list(calendarId=CALENDAR_ID, maxResults=1, singleEvents=True, orderBy="startTime")
            .execute()
        )
        _calendar_tz = result.get("timeZone", "UTC")
    return _calendar_tz


def get_events_between(start: datetime, end: datetime, max_results: int = 2500) -> list[dict]:
    """Events overlapping the [start, end] window (both aware datetimes), ordered by start time."""
    result = (
        _get_service()
        .events()
        .list(
            calendarId=CALENDAR_ID,
            timeMin=start.astimezone(timezone.utc).isoformat(),
            timeMax=end.astimezone(timezone.utc).isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=max_results,
        )
        .execute()
    )
    global _calendar_tz
    if _calendar_tz is None and result.get("timeZone"):
        _calendar_tz = result["timeZone"]
    return [_normalize_event(e) for e in result.get("items", [])]


def get_upcoming_events(days: int = 14, max_results: int = 100) -> list[dict]:
    """Events from now through `days` days ahead, ordered by start time."""
    now = datetime.now(timezone.utc)
    time_min = now.isoformat()
    time_max = (now + timedelta(days=days)).isoformat()
    result = (
        _get_service()
        .events()
        .list(
            calendarId=CALENDAR_ID,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
            maxResults=max_results,
        )
        .execute()
    )
    global _calendar_tz
    if _calendar_tz is None and result.get("timeZone"):
        _calendar_tz = result["timeZone"]
    return [_normalize_event(e) for e in result.get("items", [])]


def get_event(event_id: str) -> dict:
    raw = _get_service().events().get(calendarId=CALENDAR_ID, eventId=event_id).execute()
    return _normalize_event(raw)


def create_event(
    summary: str,
    start,
    end,
    all_day: bool = False,
    location: str | None = None,
    description: str | None = None,
) -> dict:
    """Create an event. For all-day pass date objects; for timed pass aware datetimes."""
    start_field, end_field = _to_api_times(start, end, all_day)
    if not all_day:
        tz = get_calendar_timezone()
        start_field["timeZone"] = tz
        end_field["timeZone"] = tz
    body = {"summary": summary, "start": start_field, "end": end_field}
    if location:
        body["location"] = location
    if description:
        body["description"] = description
    raw = _get_service().events().insert(calendarId=CALENDAR_ID, body=body).execute()
    return _normalize_event(raw)


def update_event(
    event_id: str,
    summary: str | None = None,
    start=None,
    end=None,
    all_day: bool | None = None,
    location: str | None = None,
    description: str | None = None,
) -> dict:
    """Patch the given fields on an existing event. Omitted args are left unchanged.

    If start/end/all_day are being changed, pass all three so the times are
    rebuilt consistently.
    """
    body: dict = {}
    if summary is not None:
        body["summary"] = summary
    if location is not None:
        body["location"] = location
    if description is not None:
        body["description"] = description
    if start is not None and end is not None and all_day is not None:
        start_field, end_field = _to_api_times(start, end, all_day)
        if not all_day:
            tz = get_calendar_timezone()
            start_field["timeZone"] = tz
            end_field["timeZone"] = tz
        body["start"] = start_field
        body["end"] = end_field
    raw = (
        _get_service()
        .events()
        .patch(calendarId=CALENDAR_ID, eventId=event_id, body=body)
        .execute()
    )
    return _normalize_event(raw)


def delete_event(event_id: str) -> None:
    _get_service().events().delete(calendarId=CALENDAR_ID, eventId=event_id).execute()


if __name__ == "__main__":
    # Deployment helper: authorize on this machine (browser opens) if needed, then
    # print the line to paste into the deployed app's Streamlit Secrets.
    if not is_authorized():
        print("Not authorized yet — opening a browser for Google sign-in…")
        authorize()
    print()
    print("Paste this into Streamlit Secrets (Settings -> Secrets), on one line:")
    print()
    print(token_as_secret())
    print()
    print(
        "Reminder: the OAuth consent screen must be published to 'In production'.\n"
        "While it's in 'Testing', Google expires the refresh token after 7 days and\n"
        "the deployed app will silently stop reaching the calendar."
    )
