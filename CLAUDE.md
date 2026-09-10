# Household Manager

Private, no-login app for two users (Matt + wife) to manage household info, calendar, shared checklists, groceries, meal plans, and notes, with an AI assistant sidebar.

## Architecture

The app is built with React + Netlify. The original Streamlit (Python) version is archived in `streamlit-archive/`. The migration plan is in [netlify-migration-plan.md](netlify-migration-plan.md).

**Current status:** M0–M9 done, M10 parked (Instacart API locked), M11 in progress. See memory `project_status.md` for detailed per-stage status.

## Tech stack

- **Frontend:** React (Vite) in `web/` directory
- **Database:** Supabase (Postgres) — accessed via `@supabase/supabase-js` directly from the browser
- **Calendar:** Google Calendar API via Netlify Function (`web/netlify/functions/calendar.js`)
- **AI:** Anthropic API (Claude) via Netlify Function (`web/netlify/functions/assistant.js`) — 16-tool agentic loop
- **Recipe scraping:** Netlify Function (`web/netlify/functions/recipe.js`)
- **Hosting:** Netlify — `oremland.tidalwavegames.net`, auto-deploy from GitHub repo `mattoremland/household-manager`
- **Secrets:** local `web/.env` (gitignored) locally; Netlify environment variables in production
- **Routing:** React Router with 6 routes (Dashboard, Calendar, Lists, Household Info, Grocery & Meals, Notes)
- **Navigation:** Fixed bottom tab bar on mobile, top nav on desktop (768px+)
- **Styling:** CSS custom properties matching the Cool Minimal dark theme (--bg-primary: #10161A, etc.)

## Key files (web/)

- `src/App.jsx` — Router + layout shell (lazy-loaded routes except Dashboard)
- `src/lib/supabase.js` — Supabase client init
- `src/lib/db.js` — All CRUD functions
- `src/lib/calendar.js` — Client-side fetch wrappers for calendar Netlify Function
- `src/styles/theme.css` — CSS variables + shared utility classes
- `src/components/` — Nav, PageHeader, ChatSidebar, ConfirmDialog, Badge, Linkify, etc.
- `src/pages/` — Route-level page components (Dashboard, Calendar, Lists, HouseholdInfo, GroceryMeals, Notes)
- `netlify/functions/calendar.js` — Google Calendar API proxy
- `netlify/functions/recipe.js` — Recipe URL scraper
- `netlify/functions/assistant.js` — AI assistant (Claude agentic loop)
- `netlify.toml` — Build config + SPA redirect

## Device target

App is used almost exclusively on iPhones (Matt: iPhone 17 Max, wife: iPhone 17) — **design and test every stage mobile-first**.
- Favor stacked/vertical layouts, full-width buttons/inputs, comfortable touch targets
- Verify at both mobile (~390px) and desktop widths before calling a stage done

## Working rules

- Work through migration stages **M0–M11 in order, one at a time**
- Each stage has a **Model** recommendation (Sonnet 5 for routine, Opus 5 for complex). Flag to Matt when escalation seems warranted.
- **Do not start a stage until Matt confirms prerequisites are in place**
- **Do not move to the next stage until Matt tests and explicitly says to proceed**
- After finishing a stage, stop and report back
- Never hardcode secrets — use environment variables
- Keep logic in shared modules (`src/lib/db.js`, `src/lib/calendar.js`) reusable by both UI and AI assistant's server-side tools

## Known issues

- **Netlify Functions can't be tested locally via Vite dev server** — requests to `/.netlify/functions/*` return HTML. Test on deployed site or via `netlify dev`.
- **FullCalendar must use v6** — all `@fullcalendar/*` packages pinned to v6. v7 of `@fullcalendar/react` is incompatible with v6 plugins.

## Progress tracking

Current stage and decisions are tracked in memory — see `memory/project_status.md`. Check it first each session.
