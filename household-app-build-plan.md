# Household Management App — Build Plan

**Audience:** Claude Code
**Purpose:** Build a private, no-login Streamlit app for two users (Matt + wife) to manage household info, calendar, chores, groceries, and notes, with an AI assistant sidebar.

## How to work through this document

Work through the stages **in order, one at a time**. Each stage lists:
- **Model** — which Claude Code model to use for this stage (switch with `/model sonnet`, `/model opus`, etc.)
- **Goal** — what this stage delivers
- **Prerequisites** — anything the user (Matt) needs to have ready *before* you start this stage (API keys, credentials, accounts)
- **Build instructions** — what to implement
- **Checkpoint** — what to confirm with Matt before moving to the next stage

**Do not start a stage until Matt has explicitly confirmed the prerequisites for that stage are in place.** If a prerequisite is missing, stop and tell Matt exactly what you need from him.

**Do not move on to the next stage until Matt has tested the current stage and explicitly says to proceed.**

### Model quick reference

| Stage type | Model | Why |
|---|---|---|
| Routine CRUD pages, scaffolding, config | **Sonnet 5** | Fast, balanced, plenty for well-specified implementation work |
| Judgment calls: OAuth flow, agentic tool design, hosting architecture | **Opus 5** | Stronger at ambiguous problems and root-cause debugging |
| Stuck after a couple of tries with Opus | **Fable 5.1** | Reserve for genuinely hard, stuck-in-a-loop problems — burns usage limits ~2x faster |

---

## Tech stack (fixed for all stages)

- **Frontend/app framework:** Streamlit
- **Database:** Supabase (Postgres)
- **Calendar:** Google Calendar API (OAuth installed-app flow), single shared calendar
- **AI:** Anthropic API (Claude) with tool use
- **Grocery ordering:** Instacart Developer Platform API (Shopping List Page endpoint)
- **Hosting:** Streamlit Community Cloud, reachable via a Netlify redirect page at a subdomain of the existing domain (details in Stage 12 — Community Cloud can't accept a custom domain directly)
- **Secrets:** local `.env` file (gitignored), never hardcoded

---

## Stage 0: Project scaffolding

**Model: Sonnet 5**

**Goal:** Repo structure, dependencies, empty multi-page Streamlit app that runs.

**Prerequisites:** None — Matt just needs Python installed locally.

**Build instructions:**
- Set up project folder with `requirements.txt` (streamlit, python-dotenv, and placeholders for later: google-api-python-client, google-auth-oauthlib, anthropic, requests)
- Create a multi-page Streamlit app structure:
  - `app.py` (entry point / Dashboard)
  - `pages/1_Calendar.py`
  - `pages/2_Chores.py`
  - `pages/3_ToDo.py`
  - `pages/4_Household_Info.py`
  - `pages/5_Grocery_Meals.py`
  - `pages/6_Inventory.py`  *(later cut — see Stage 10)*
  - `pages/7_Notes.py`
- Create empty `.env.example` listing every env var that will eventually be needed
- Create `.gitignore` (`.env`, `*.db`, `token.json`, `__pycache__`)
- Each page can just show a placeholder heading for now

**Checkpoint:** Matt runs `streamlit run app.py`, confirms the app launches and all pages are navigable (even if empty). Confirm before proceeding.

---

## Stage 1: Design & style planning

**Model: Sonnet 5**

**Goal:** A visual identity for the app — colors, fonts, spacing conventions — applied as a reusable theme, before building out individual pages.

**Prerequisites:** None. Matt should have a rough sense of any preferences (light/dark, color mood) but this stage is where those get nailed down.

**Build instructions:**
- Propose 2-3 color palette options (primary/secondary/background/accent) and font pairings suited to a clean household-utility app (not a game — legible, calm, not flashy)
- Once Matt picks a direction, implement it via:
  - `.streamlit/config.toml` theme settings (primaryColor, backgroundColor, secondaryBackgroundColor, textColor, font)
  - A small shared style module/snippet (e.g., consistent header formatting, spacing conventions, icon usage per page) that every page imports
- Apply the theme to the Stage 0 placeholder pages so the direction is visible immediately

**Checkpoint:** Matt reviews the themed placeholder pages in the browser and confirms the look before any real feature pages get built. Confirm before proceeding.

---

## Stage 2: Hosting & architecture decision — DECIDED

**Model: Opus 5**

**Goal:** Confirm and document the hosting/database decision so later stages are built against the right target.

**Decision made:**
- **Hosting:** Streamlit Community Cloud
- **Database:** Supabase (Postgres) — not SQLite, since Community Cloud's filesystem isn't guaranteed persistent across restarts/redeploys
- **Custom domain:** Streamlit Community Cloud does **not** support connecting a real custom domain/subdomain via DNS (CNAME/A records won't work — SSL and platform limitation on Streamlit's end). The app will live at `<something>.streamlit.app`. To make it reachable at a subdomain of the existing domain, a small **redirect page** will be deployed on Netlify at that subdomain, forwarding to the real Streamlit URL. Full setup instructions are in Stage 12.

**Prerequisites (Matt must have ready before this stage completes):**
1. A Supabase account and a new Supabase project created for this app
2. The Supabase project's connection details (project URL + API key, or direct Postgres connection string) saved somewhere Matt can share for the `.env`/Secrets setup
3. A GitHub repo for this project (Streamlit Community Cloud deploys from GitHub)
4. Decide the subdomain to use (e.g. `home.yourdomain.com`) and confirm access to that domain's DNS settings

**Build instructions:**
- No feature code here — just confirm the above in a short README section: hosting = Streamlit Community Cloud, database = Supabase, subdomain = whatever Matt picked
- Update `requirements.txt` (added in Stage 0) to include `supabase` (or `psycopg2-binary` if connecting directly to Postgres)

**Checkpoint:** Matt confirms the Supabase project exists and connection details are ready before Stage 3 begins.

---

## Stage 3: Database layer

**Model: Sonnet 5**

**Goal:** Database schema and a data-access module used by all future features, on Supabase (Postgres).

**Prerequisites:** Supabase project URL and API key (or connection string) in `.env` locally.

**Build instructions:**
- Create `db.py` using the `supabase-py` client (or `psycopg2` for a direct connection — pick whichever is simpler for the CRUD helper pattern) to initialize and create these tables in the Supabase project (via the Supabase SQL editor or a migration script run once):
  - `household_info` (id, category, title, content, updated_at)
  - `chores` (id, name, frequency_days, assigned_to)
  - `chore_log` (id, chore_id, completed_date, completed_by)
  - `todo_lists` (id, name)
  - `todo_items` (id, list_id, text, is_done, created_at)
  - `grocery_items` (id, name, quantity, added_by, is_checked)
  - `meal_plan` (id, date, meal_name, notes)
  - `inventory` (id, item_name, purchase_date, warranty_expiry, serial_number, notes)  *(table kept, but the Inventory feature was cut — see Stage 10)*
  - `notes` (id, title, body, created_at, updated_at)
- Write basic CRUD helper functions for each table (used later by both the UI and the AI assistant's tools)
- Add a small script or button to seed the DB with a couple of sample rows for testing

**Checkpoint:** Matt confirms tables exist and sample data shows up correctly. Confirm before proceeding.

---

## Stage 4: Household Info Hub

**Model: Sonnet 5**

**Goal:** Working CRUD page for reference info (manuals, contacts, wifi, etc.).

**Prerequisites:** None.

**Build instructions:**
- Build out `pages/4_Household_Info.py`:
  - List entries grouped/filterable by category
  - Add/edit/delete entry form
  - Simple search box (text match on title/content)

**Checkpoint:** Matt adds a few real entries and confirms add/edit/delete/search all work. Confirm before proceeding.

---

## Stage 5: Lists

**Model: Sonnet 5**

**Goal:** Multiple named checkable lists (originally "To-Do Lists," then renamed to "Lists"). Also absorbs what was originally planned as a separate Stage 6 ("Chores") — a dedicated recurring-chore tracker with its own frequency/due-date/history model was judged overkill for two people; chores are just regular Lists items instead (e.g. a "Chores" list, optionally tagging who it's assigned to). `pages/2_Chores.py` was never built; the `chores`/`chore_log` tables from Stage 3 are unused and can be dropped (see `migration_001_add_todo_tag.sql`). Everything from the old Stage 7 onward is renumbered down by one as of 2026-09-06 to close that gap.

**Prerequisites:** None.

**Build instructions:**
- Build out `pages/2_Lists.py`:
  - Create/rename/delete a list
  - Add item to a list, check/uncheck, delete item, edit/rephrase item text
  - Optional free-text "tag" per item (e.g. a person's name) so items can be assigned to whoever's appropriate
  - Checked items move into that list's "..." menu as a "Completed" archive (restore or permanently delete from there) rather than being deleted outright by a bulk "clear checked" action

**Checkpoint:** Matt tests creating a list, adding/checking/editing/deleting items, tagging an item, and restoring a completed item. Confirmed and in active use as of 2026-09-06.

---

## Stage 6: Notes

**Model: Sonnet 5**

**Goal:** Freeform notes page.

**Prerequisites:** None.

**Build instructions:**
- Build out `pages/7_Notes.py`:
  - Add/edit/delete note (title + body)
  - List sorted by most recently updated
  - Simple search box

**Checkpoint:** Matt tests add/edit/delete/search. Confirm before proceeding.

---

## Stage 7: Google Calendar integration

**Model: Opus 5**

**Goal:** Read/write access to the single shared Google Calendar.

**Prerequisites (Matt must complete before this stage starts):**
1. Create a Google Cloud project and enable the Google Calendar API
2. Create OAuth 2.0 credentials (Desktop app type), download the `credentials.json` file
3. Confirm which Google account owns the shared calendar to be used
4. Place `credentials.json` in the project folder (gitignored)

**Do not begin this stage until Matt confirms all four items above are done.**

**Build instructions:**
- Implement OAuth installed-app flow (opens browser once for consent, caches `token.json` for future runs)
- Build `calendar_service.py` with functions: `get_upcoming_events`, `create_event`, `update_event`, `delete_event`
- Build out `pages/1_Calendar.py`:
  - List upcoming events (e.g., next 14 days)
  - Form to create a new event
  - Edit/delete existing events

**Checkpoint:** Matt authorizes the app in the browser, confirms events display correctly, and tests creating/editing/deleting an event that shows up in actual Google Calendar. Confirm before proceeding.

---

## Stage 8: Grocery & Meal Planning

**Model: Sonnet 5**

**Goal:** Shared grocery list + simple meal plan, no external ordering yet.

**Prerequisites:** None.

**Build instructions:**
- Build out `pages/5_Grocery_Meals.py`:
  - Grocery list: add item (name, quantity), check off, clear checked items
  - Meal plan: simple calendar-style or list view by date, add/edit/delete a planned meal
  - Button/action: "Add ingredients to grocery list" from a meal plan entry

**Checkpoint:** Matt tests grocery add/check/clear and meal plan add/edit/delete. Confirm before proceeding.

---

## Stage 9: Grocery list export / Instacart — RE-SCOPED 2026-09-08

**Model: Sonnet 5**

**Goal:** Get the grocery list out of the app and into a shopping flow.

**Why re-scoped:** The original plan was a "Send list to Instacart" button using the **Instacart Developer Platform API** (`create_shopping_list_page` endpoint). That API requires a Developer Platform account, and **Instacart has closed new developer signups** ("not currently accepting new applications") — hard external blocker, no ETA.

There is a *second*, separate Instacart integration that is **not** gated: the official **Instacart remote MCP server** at `https://fig-mcp.instacart.com/mcp` (the same one behind the `claude.com/connectors/instacart` connector). It authenticates via **consumer OAuth** — you log in with a normal Instacart account, no developer key — and can build lists, search products, manage a cart, and place delivery orders. But it needs an **MCP client** to drive it, which a plain Streamlit app is not. The natural home for it is the **Stage 11 AI Assistant** (the Anthropic Messages API supports remote MCP connectors directly).

**New plan, in two parts:**

**Part A — now (this stage): "Copy list" button.** DONE 2026-09-08.
- On the Grocery page, a **"Copy list" toggle** reveals the unchecked items as plain text in an `st.code` block (which has a built-in copy-to-clipboard icon). Format: `name (quantity)` per line. For pasting into Instacart's own site, ChatGPT/Claude, or a text to someone.
- No API, no key, no `instacart_service.py`.

**Part B — deferred into Stage 11:** Instacart cart/order management via the `fig-mcp.instacart.com` remote MCP connector, exposed through the AI assistant. Each user does a one-time Instacart OAuth login. Gated on the Anthropic API key (already a Stage 11 prerequisite). Revisit the standalone Developer Platform button only if Instacart reopens developer signups.

**Prerequisites:** None for Part A. Part B inherits Stage 11's prerequisites.

**Checkpoint:** Matt tests the "Copy list" button on his phone — toggles it on, copies, confirms the pasted text is the current unchecked list. Confirm before proceeding.

---

## Stage 10: Home Inventory — CUT 2026-09-08

**Matt decided this feature isn't needed.** Skip it. Not renumbering the later stages — Stage 10 is just a tombstone.

**What was removed:** `pages/6_Inventory.py` (was only a placeholder — never built out), the "Inventory" entry in `style.py`'s `NAV_PAGES`, the inventory seed row in `seed.py`, the Inventory tool group from the Stage 11 assistant.

**What was kept (so it can be re-added later with no migration):** the `inventory` table in `schema.sql` / the live Supabase DB, and the `list_inventory` / `add_inventory_item` / `update_inventory_item` / `delete_inventory_item` helpers in `db.py` (unused, commented as such).

**If re-adding later:** rebuild `pages/6_Inventory.py` (add/edit/delete: name, purchase date, warranty expiry, serial number, notes; sort/filter by upcoming warranty expiry — a highlighted "expiring soon / expired" section was the preferred design), re-add the `NAV_PAGES` entry, and add the assistant tools back.

---

## Stage 11: AI Assistant (sidebar chat)

**Model: Opus 5**

**Goal:** Persistent sidebar chat, available on every page, with tool use across all modules.

**Prerequisites (Matt must complete before this stage starts):**
1. Provide an Anthropic API key for the `.env` file
2. Confirm scope: assistant can both answer questions and take actions (already agreed) — flag if that's changed

**Do not begin this stage until Matt confirms the API key is in place.**

**Build instructions:**
- Build a shared sidebar component (using Streamlit session state to persist chat history across page navigation)
- Define Claude API tools mapping to the CRUD functions already built in prior stages:
  - Calendar: `get_upcoming_events`, `create_event`, `update_event`, `delete_event`
  - Lists: `add_todo_item`, `check_todo_item`, `list_todo_items` (no separate Chores tool group — chores are just Lists items, per Stage 5)
  - Household Info: `search_household_info`, `add_household_info`
  - Grocery/Meals: `add_grocery_item`, `list_grocery_items`, `add_meal_plan_entry`
  - Notes: `add_note`, `search_notes`
  - (No Inventory tool group — Stage 10 was cut.)
- **Instacart — MOVED to Stage 11b** (after deployment, see below). Its consumer OAuth flow needs a real HTTPS redirect URL, which the LAN-IP dev server can't provide.
- System prompt should include: today's date, both users' names, and a short description of what each tool does
- Confirm-before-destructive-action pattern: for deletes, have the assistant ask for confirmation in chat before calling the delete tool
- Add basic error handling so a failed tool call surfaces a clear message in chat rather than crashing the page

**Checkpoint:** Matt tests a range of Q&A and actions across modules. Confirm before proceeding.

**Decisions made while building (2026-09-08):**
- The chat lives in the **left sidebar, which is now the assistant and nothing else** — Streamlit's own multipage nav list stays hidden there, and page navigation stays in the top-right "..." menu. On a phone the sidebar is a slide-over drawer, opened with the `»` control at top-left; on desktop it's a persistent 20rem column.
- Files: `ai_assistant.py` (tool schemas + dispatch + agentic loop), `chat_ui.py` (the sidebar chat), wired in via `style.page_header()` so every page gets it.
- Model `claude-opus-5`, effort `medium` (both constants at the top of `ai_assistant.py`).

---

## Stage 11b: Instacart ordering via the assistant

**Model: Opus 5**

**Runs AFTER Stage 12 (Deployment)** — folded out of Stage 11 on 2026-09-08 because the OAuth redirect needs the real HTTPS domain.

**Goal:** connect the assistant to the official Instacart remote MCP server at `https://fig-mcp.instacart.com/mcp` via the Anthropic Messages API's remote-MCP-connector support (`mcp_servers=[{type:"url", ...}]` **plus** `tools=[{type:"mcp_toolset", mcp_server_name: ...}]`, beta header `mcp-client-2025-11-20`). Consumer OAuth — each user does a one-time Instacart login (browser flow), token cached. Lets the assistant turn the grocery list into an Instacart cart / delivery order. **Purchases/orders are "explicit permission required" — the assistant must always confirm items + total in chat before placing anything.** No Instacart Developer Platform key involved.

**Prerequisite:** Stage 12 done, app reachable over HTTPS at its real subdomain.

---

## Stage 12: Deployment

**Model: Opus 5** (initial setup), then **Sonnet 5** for routine redeploys after this stage

**Goal:** App live on Streamlit Community Cloud, reachable at the chosen subdomain via a Netlify redirect.

**⚠️ Real execution order (revised 2026-09-08 — Parts below are NOT in order):** Google now requires a **homepage URL and privacy policy URL** to publish an OAuth consent screen using a sensitive scope, and both must sit on a domain you own and have verified. So **Part B (Netlify + subdomain) must happen FIRST**, before Part C's consent-screen publish, before Part A. Actual order: Part B → Part C (Search Console verify → Branding → publish → mint token) → Part A → back to Part B to swap `index.html` to the redirect → Part D.

The Netlify site therefore serves three files (in `netlify_site/`): `about.html` (the homepage Google points at), `privacy.html` (the policy), and `index.html` (the redirect to the Streamlit app). **`about.html` and `privacy.html` must stay reachable permanently** — the published consent screen references them.

**Prerequisites:**
1. Project pushed to a GitHub repo (public, or private if Matt has a paid Community Cloud tier — free tier requires public repos)
2. Supabase, Google OAuth, and Anthropic secrets ready to paste into Streamlit's Secrets manager (no Instacart key — the Developer Platform API is dead; Instacart is Stage 11b via consumer OAuth)
3. Netlify account (already have this) and access to the domain's DNS settings

**Build instructions — Part A: Deploy the Streamlit app**
1. Push the repo to GitHub if not already there
2. Go to share.streamlit.io, sign in with GitHub, click "New app"
3. Select the repo, branch, and main file path (`Household_Manager.py`)
4. Before/after first deploy, open the app's Settings → Secrets and paste in all required secrets as TOML (Supabase URL/key, Google OAuth client details, Anthropic API key) — this is equivalent to the local `.env` file
5. Deploy — note the resulting `https://<something>.streamlit.app` URL

**Build instructions — Part B: Redirect from the custom subdomain (Netlify)**
1. Create a new, separate Netlify site (not related to the game sites) containing a single `index.html` with a JS/meta-refresh redirect to the real Streamlit URL from Part A, e.g.:
   ```html
   <!DOCTYPE html>
   <html>
     <head>
       <meta http-equiv="refresh" content="0; url=https://<something>.streamlit.app" />
       <script>window.location.replace("https://<something>.streamlit.app");</script>
     </head>
     <body>Redirecting to the household app…</body>
   </html>
   ```
2. Deploy this as its own Netlify site (drag-and-drop the single file, or connect a tiny repo — whichever is faster)
3. In that Netlify site's settings, add the custom subdomain (e.g. `home.yourdomain.com`) under Domain management — Netlify will show the exact DNS record to add
4. In the domain's DNS settings, add that record (typically a CNAME pointing at Netlify) — this does not touch the records used by the existing game sites
5. Wait for DNS propagation and SSL certificate issuance (Netlify handles this automatically, usually within minutes to a couple hours)

**Build instructions — Part C: Google Calendar auth + verify**

The code side of this was done ahead of the stage (2026-09-08): `calendar_service.py`
now reads its token from a `GOOGLE_OAUTH_TOKEN` secret when one is set, refreshing it
in memory and never writing to disk; locally, with the var unset, it behaves exactly
as before via `credentials.json` + `token.json`. What's left is operational:

1. **Publish the OAuth consent screen** in Google Cloud Console: OAuth consent screen → "Publish app" → In production. **This is not optional.** While it's in Testing, Google expires the refresh token after 7 days and the deployed app silently loses the calendar. The app stays unverified, so the one-time consent shows a "Google hasn't verified this app" interstitial — click Advanced → Go to (unsafe). Fine for a two-person app; it appears only during authorization, never to day-to-day users.
2. Run `python calendar_service.py` locally. It authorizes if needed and prints the exact `GOOGLE_OAUTH_TOKEN = '...'` line to paste into Settings → Secrets.
3. Redo steps 1–2 in that order — a token minted while the app was still in Testing keeps the 7-day expiry. Publish first, then mint.
4. Verify from the deployed app that the Calendar page loads and an event can be created. If it can't sign in, the page now says so and points at this flow rather than offering a Connect button that can't work on a server.
5. Confirm no secrets are committed anywhere in the repo — only in Streamlit's Secrets manager. `.gitignore` already covers `.env`, `token.json`, `credentials.json`, and `.streamlit/secrets.toml`.

**Build instructions — Part D: Custom "Add to Home Screen" icon (iOS)**
- Custom icon artwork is already saved at the project root: `OremlandHouseIcon.png`
- iOS Safari's "Add to Home Screen" uses an `apple-touch-icon` link tag, which Streamlit doesn't set by default — needs a small static-file setup (Streamlit's `enableStaticServing` config + a `static/` folder) plus an injected `<link rel="apple-touch-icon" href="...">` tag (similar mechanism to the Inter font `<link>` injection already in `style.py`)
- Once wired up, Matt and his wife re-add the app to their home screens (existing home screen shortcuts won't retroactively pick up a new icon)

**Checkpoint:** Matt visits the subdomain from both his and his wife's devices, confirms the redirect lands on a working app, tests core features end to end remotely, and confirms the home screen icon shows the custom house artwork. Confirm before proceeding.

---

## Stage 13: Polish pass

**Model: Sonnet 5**

**Goal:** Final cleanup.

**Prerequisites:** None.

**Build instructions:**
- Dashboard page now pulls a real summary: today's events, list items due, grocery list count, unread notes
- Consistent styling/layout pass across pages (per Stage 1 theme)
- Basic README with setup instructions (env vars needed, how to run, how to re-authorize Google if token expires, how to redeploy)

**Checkpoint:** Matt does a full walkthrough of the app end to end and signs off.

---

## General rules for every stage

- Never hardcode secrets — always read from `.env`
- Keep each module's functions reusable by both the Streamlit UI and the AI assistant's tools (single source of truth for logic)
- After finishing each stage, stop and report back rather than continuing automatically into the next stage
- If stuck after a couple of attempts at the recommended model tier, flag to Matt that escalating to Fable 5.1 may help, rather than switching silently
