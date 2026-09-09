# Household Manager

Private, no-login app for two users (Matt + wife) to manage household info, calendar, shared checklists, groceries, and notes, with an AI assistant.

## Active build: React/Netlify migration

The app was originally built in Streamlit (Python). Matt decided to migrate to React + Netlify for full control (branding, PWA, mobile UX). The migration plan is in [netlify-migration-plan.md](netlify-migration-plan.md). The original Streamlit build plan is in [household-app-build-plan.md](household-app-build-plan.md) (all stages complete, for reference only).

**Current stage: M7 (Grocery & Meals).** M0–M6 are done. See memory `project_status.md` for detailed per-stage status.

## Tech stack (migration target)

- **Frontend:** React (Vite) in `web/` directory
- **Database:** Supabase (Postgres) — same tables, same schema, accessed via `@supabase/supabase-js` directly from the browser
- **Calendar:** Google Calendar API via Netlify Function (`web/netlify/functions/calendar.js`), uses `googleapis` npm package
- **AI:** Anthropic API (Claude) via Netlify Function (not yet built — M8)
- **Recipe scraping:** Netlify Function (not yet built — M7)
- **Grocery ordering:** Instacart via remote MCP server, driven by AI assistant (M10)
- **Hosting:** Netlify — `oremland.tidalwavegames.net` (currently points at old static redirect site; will point at React app after M9)
- **Secrets:** local `web/.env` (gitignored) locally; Netlify environment variables once deployed
- **Routing:** React Router with 6 routes (Dashboard, Calendar, Lists, Household Info, Grocery & Meals, Notes)
- **Navigation:** Fixed bottom tab bar on mobile, top nav on desktop (768px+)
- **Styling:** CSS custom properties matching the Cool Minimal dark theme (--bg-primary: #10161A, etc.)

## Key files (web/)

- `src/App.jsx` — Router + layout shell
- `src/lib/supabase.js` — Supabase client init
- `src/lib/db.js` — All CRUD functions (mirrors Python db.py)
- `src/lib/calendar.js` — Client-side fetch wrappers for calendar Netlify Function
- `src/styles/theme.css` — CSS variables + utility classes
- `src/components/` — Nav, PageHeader, ConfirmDialog, Badge, Linkify, etc.
- `src/pages/` — Route-level page components (Calendar.jsx, Lists.jsx, etc.)
- `netlify/functions/calendar.js` — Google Calendar API Netlify Function
- `netlify.toml` — Build config + SPA redirect + dev proxy settings

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

- **Netlify Functions can't be tested locally via Vite dev server** — requests to `/.netlify/functions/*` return HTML. The Calendar page UI is built and verified but CRUD operations against Google Calendar are untested until deployment (M9) or `netlify dev` is working. `netlify-cli` is installed as a dev dependency; `netlify.toml` has a `[dev]` section configured, but `netlify dev` didn't work via launch.json (blank page). May need CLI auth or manual terminal usage.
- **FullCalendar must use v6** — all `@fullcalendar/*` packages pinned to v6. v7 of `@fullcalendar/react` is incompatible with v6 plugins ("Class constructor DayTableView cannot be invoked without 'new'").

## M9 deployment plan (Matt's request)

M9 should set up a **GitHub repo connected to Netlify for auto-deploy** so Matt doesn't have to `npm run build` and drag `dist/` folders. Claude Code should be able to push changes directly. Walk Matt through the GitHub + Netlify connection setup.

## Progress tracking

Current stage and decisions are tracked in memory — see `memory/project_status.md`. Check it first each session.
