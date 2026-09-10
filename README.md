# Household Manager

Private, no-login app for two users to manage household info, calendar, shared checklists, groceries, meal plans, and notes, with an AI assistant sidebar.

**Live site:** [oremland.tidalwavegames.net](https://oremland.tidalwavegames.net)

## Tech stack

- **Frontend:** React (Vite) — lives in `web/`
- **Backend:** Netlify Functions (serverless) for Google Calendar API, recipe scraping, and AI assistant
- **Database:** Supabase (Postgres) — accessed directly from the browser via `@supabase/supabase-js`
- **AI:** Claude (Anthropic) via Netlify Function — 16-tool agentic loop for calendar, lists, grocery, notes, and household info
- **Hosting:** Netlify with auto-deploy from GitHub
- **Domain:** `oremland.tidalwavegames.net` (DNS via Cloudflare, HTTPS via Netlify)

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project with the schema from `streamlit-archive/schema.sql`
- Google Cloud project with Calendar API enabled + OAuth credentials
- Anthropic API key (for the AI assistant)

### Local development

```bash
cd web
npm install
```

Create `web/.env` with:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GOOGLE_CALENDAR_ID=your-calendar-id
ANTHROPIC_API_KEY=your-anthropic-key
```

Then start the dev server:

```bash
npm run dev
```

The app runs at `http://localhost:5173`. Note: Netlify Functions (calendar, recipe scraping, AI assistant) only work on the deployed site or via `netlify dev`.

### Deployment

The `web/` directory is connected to Netlify via the GitHub repo `mattoremland/household-manager`. Pushing to `main` triggers an auto-deploy. Environment variables are configured in the Netlify dashboard.

## Project structure

```
web/
  src/
    App.jsx              — Router + layout shell
    lib/
      supabase.js        — Supabase client init
      db.js              — All CRUD functions
      calendar.js        — Calendar API fetch wrappers
    styles/
      theme.css          — CSS variables + shared utility classes
    components/          — Nav, PageHeader, ChatSidebar, etc.
    pages/               — Route-level page components
  netlify/
    functions/
      calendar.js        — Google Calendar API proxy
      recipe.js          — Recipe URL scraper
      assistant.js       — AI assistant (Claude agentic loop)
  netlify.toml           — Build config + SPA redirect
```

## History

This app was originally built with Streamlit (Python) and hosted on Streamlit Community Cloud. It was migrated to React + Netlify for full control over branding, PWA support, and mobile UX. The original Streamlit source is preserved in `streamlit-archive/`.
