# Household Manager

Private, no-login Streamlit app for two users to manage household info, calendar, shared checklists, groceries, and notes, with an AI assistant sidebar.

Full stage-by-stage build plan: [household-app-build-plan.md](household-app-build-plan.md)

## Hosting & architecture (Stage 2 — decided)

- **Hosting:** Streamlit Community Cloud
- **Database:** Supabase (Postgres) — chosen over SQLite since Community Cloud's filesystem isn't guaranteed persistent across restarts/redeploys
- **Custom domain:** Streamlit Community Cloud does not support connecting a custom domain/subdomain directly (no CNAME/A record support, SSL limitation on their end). The app lives at `<something>.streamlit.app`. A small Netlify redirect page is deployed at a subdomain of the existing domain to forward to it. Full setup steps are in Stage 13 of the build plan.
- **Subdomain:** `oremland.tidalwavegames.net` (DNS managed via Cloudflare)
- **GitHub repo:** created, public

## Running locally

This project uses its own virtual environment (`venv/`) — don't install its dependencies into a shared/global Python environment (e.g. an Anaconda base env used by other projects), since past deps (like `supabase`) have pulled in version pins that conflicted with unrelated projects.

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
streamlit run Household_Manager.py
```

(Note: the entry-point script is `Household_Manager.py`, not `app.py` — renamed during Stage 1 so the sidebar nav reads "Household Manager".)

## Setup

More detailed environment/setup instructions land in Stage 14 (Polish pass) once all integrations are built.
