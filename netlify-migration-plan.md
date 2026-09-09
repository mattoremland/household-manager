# Household Manager — Netlify Migration Plan

**Audience:** Claude Code
**Purpose:** Migrate the Household Manager app from Streamlit (Python) to a React frontend hosted directly on Netlify, with Netlify Functions for server-side operations. This gives full control over styling, branding, PWA icons, and mobile UX — no more Streamlit Community Cloud limitations.

## How to work through this document

Same rules as the original build plan: **work through stages in order, one at a time.** Each stage has a model recommendation, goal, prerequisites, build instructions, and checkpoint. Don't start a stage until Matt confirms prerequisites. Don't move on until Matt tests and signs off.

### Model quick reference

| Stage type | Model | Why |
|---|---|---|
| Scaffolding, routine pages, styling | **Sonnet 5** | Fast, well-specified work |
| Architecture decisions, API integration, AI assistant | **Opus 5** | Complex/ambiguous problems |
| Stuck after a couple tries with Opus | **Fable 5.1** | Reserve for genuinely hard problems |

---

## Architecture overview

### What stays the same
- **Supabase** database — same tables, same schema, no migration needed
- **Google Calendar API** — same OAuth token, same calendar
- **Anthropic API** — same AI assistant logic and tool definitions
- **Netlify** — already used for the redirect site; now hosts the entire app
- **Custom domain** — `oremland.tidalwavegames.net` already points at Netlify

### What changes

| Component | Streamlit (current) | React/Netlify (target) |
|---|---|---|
| Frontend | Streamlit widgets (Python) | React (JSX) with Vite |
| Hosting | Streamlit Community Cloud | Netlify (Matt's paid tier) |
| Styling | `st.markdown` + config.toml | Full CSS — same Cool Minimal palette |
| Navigation | Custom popover menu hack | React Router, proper mobile nav |
| AI chat | Sidebar via `st.chat_message` | Custom chat component, streaming |
| Calendar API | Python `calendar_service.py` | Netlify Function (Node.js) |
| AI assistant | Python `ai_assistant.py` | Netlify Function (Node.js) |
| Recipe scraping | Python `recipe-scrapers` lib | Netlify Function (Node.js) |
| DB access | Python `supabase-py` in server | `@supabase/supabase-js` in browser |
| Auth/secrets | Streamlit Secrets (env vars) | Netlify environment variables |
| PWA / icon | Not possible (iframe) | Full PWA manifest, apple-touch-icon |

### Key architecture decisions

1. **Supabase calls go directly from the browser** via `@supabase/supabase-js`. The anon key is safe to expose client-side — same as now (RLS is off, the key itself is the access boundary; it's already in a public GitHub repo via the Streamlit deployment). No serverless function needed for CRUD.

2. **Server-side Netlify Functions (Node.js) are needed for:**
   - Google Calendar API — holds the OAuth token, can't expose it in the browser
   - Anthropic API — holds the API key, runs the agentic tool loop server-side
   - Recipe scraping — needs server-side fetch to avoid CORS issues
   - (Future) Instacart MCP — holds OAuth tokens, drives the MCP protocol

3. **Vite + React** — fast dev server, HMR, optimized builds. Matt already has JSX experience from his game projects.

4. **No authentication system** — same as the current app. Two-user household, access controlled by keeping the URL private.

5. **PWA manifest** — proper `manifest.json` with `OremlandHouseIcon.png` so "Add to Home Screen" works natively with the custom icon. No more workarounds.

---

## Stage M0: Project scaffolding

**Model: Sonnet 5**

**Goal:** New React project alongside the existing Streamlit app, building and running locally. Existing Streamlit app stays live on Community Cloud throughout the migration.

**Prerequisites:** Node.js installed (Matt likely already has this from game projects — confirm).

**Build instructions:**
- Create a new directory `web/` inside the project (keeps both apps in the same repo during migration)
- Initialize with Vite: `npm create vite@latest . -- --template react` inside `web/`
- Install dependencies:
  - `@supabase/supabase-js` — database client
  - `react-router-dom` — client-side routing
- Set up project structure:
  ```
  web/
    src/
      components/     # Shared components (Nav, ChatSidebar, etc.)
      pages/          # Route-level page components
      lib/            # Supabase client, API helpers
      styles/         # Global CSS, theme variables
      App.jsx         # Router + layout shell
      main.jsx        # Entry point
    netlify/
      functions/      # Netlify Functions (server-side)
    public/
      OremlandHouseIcon.png
      manifest.json
    netlify.toml      # Build + redirect config
    .env.example
    index.html
    vite.config.js
  ```
- Set up `netlify.toml`:
  - Build command: `npm run build`
  - Publish directory: `dist`
  - Redirect: `/*` → `/index.html` (SPA fallback)
  - Functions directory: `netlify/functions`
- Create `.env.example` listing all needed vars:
  ```
  VITE_SUPABASE_URL=
  VITE_SUPABASE_KEY=
  GOOGLE_OAUTH_TOKEN=
  GOOGLE_CALENDAR_ID=
  ANTHROPIC_API_KEY=
  ```
  (Variables prefixed `VITE_` are exposed to the browser; the others are server-side only, available to Netlify Functions.)
- Create a local `.env` with real values (gitignored)
- Placeholder pages for each route: Dashboard, Calendar, Lists, Household Info, Grocery & Meals, Notes
- Basic app shell with a mobile-first layout placeholder

**Checkpoint:** Matt runs `npm run dev` inside `web/`, confirms the dev server starts and all placeholder pages are navigable via React Router.

---

## Stage M1: Design system & layout

**Model: Sonnet 5**

**Goal:** Recreate the Cool Minimal dark theme in CSS, mobile-first responsive layout, and navigation — with full control this time.

**Prerequisites:** None.

**Build instructions:**
- Define CSS custom properties (variables) matching the current palette:
  ```css
  --bg-primary: #10161A;
  --bg-secondary: #1B2328;
  --text-primary: #E7ECEE;
  --text-muted: #8CA0A8;
  --accent-teal: #2E8B90;
  --accent-coral: #F0836A;
  ```
- Import Inter font from Google Fonts
- Build the app shell layout:
  - **Mobile (default):** Full-width content, bottom tab bar or hamburger menu for navigation, slide-over panel for the AI chat
  - **Desktop (768px+):** Content area with persistent AI chat sidebar (like the current Streamlit layout but better)
- Build shared components:
  - `PageHeader` — title, optional subtitle, consistent styling
  - `Nav` — mobile-friendly navigation (bottom tabs, or a slide-out menu — Matt's preference)
  - `Badge` / `TagBadge` — same pill-style badges as current, with the same color logic (Lucy=green, Matt=blue, others hashed)
  - `Linkify` — auto-link URLs, phone numbers, addresses (same logic as `style.linkify()`)
- Apply to all placeholder pages

**Checkpoint:** Matt reviews the themed layout on both desktop and mobile-width (390px). Confirm the navigation pattern and overall feel before building real pages.

---

## Stage M2: Database layer (Supabase JS)

**Model: Sonnet 5**

**Goal:** Supabase client and all CRUD helper functions, mirroring everything in `db.py`.

**Prerequisites:** None (same Supabase project, same tables, same anon key).

**Build instructions:**
- Create `src/lib/supabase.js` — initialize the Supabase client with `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`
- Create `src/lib/db.js` — all CRUD functions, same API surface as the Python `db.py`:
  - Household info: `listHouseholdInfo`, `searchHouseholdInfo`, `addHouseholdInfo`, `updateHouseholdInfo`, `deleteHouseholdInfo`
  - Lists: `listTodoLists`, `addTodoList`, `renameTodoList`, `deleteTodoList`, `listTodoItems`, `addTodoItem`, `updateTodoItem`, `checkTodoItem`, `deleteTodoItem`, `clearCheckedTodoItems`
  - Grocery: `listGroceryItems`, `addGroceryItem`, `checkGroceryItem`, `deleteGroceryItem`, `clearCheckedGroceryItems`, `addIngredientsToGroceryList`
  - Meal plan: `listMealPlan`, `addMealPlanEntry`, `updateMealPlanEntry`, `deleteMealPlanEntry`
  - Notes: `listNotes`, `searchNotes`, `addNote`, `updateNote`, `deleteNote`
- These functions are used by both the React UI and the server-side AI assistant (via import in the Netlify Function)

**Checkpoint:** Matt confirms a quick test page can list/add/delete data against the live Supabase DB.

---

## Stage M3: Household Info page

**Model: Sonnet 5**

**Goal:** First real CRUD page — establishes the patterns all other pages follow.

**Prerequisites:** None.

**Build instructions:**
- Build `src/pages/HouseholdInfo.jsx`:
  - List entries grouped by category, sorted alphabetically
  - Search box (title/content)
  - Add/edit/delete with inline forms
  - Kebab menu (⋮) per entry for Edit/Delete
  - Auto-linking in content (URLs, phone numbers, addresses → Apple Maps) via the `Linkify` component
  - Phone number in title becomes an SMS link
- Mobile-first: stacked layout, full-width inputs, comfortable touch targets

**Checkpoint:** Matt tests add/edit/delete/search, confirms existing data from Supabase displays correctly. Tests on iPhone.

---

## Stage M4: Lists page

**Model: Sonnet 5**

**Goal:** Multiple named checklists with tags, completed-item archive — same features as current.

**Prerequisites:** None.

**Build instructions:**
- Build `src/pages/Lists.jsx`:
  - All lists displayed at once, each with its own heading + kebab menu
  - Add/edit/delete items, check/uncheck
  - Optional free-text tag per item with color-coded pill badges
  - Completed items live in the list's menu as a "Completed (N)" archive (restore or permanently delete)
  - Create/rename/delete lists
- Touch-friendly: checkbox + text as the tap target, comfortable spacing

**Checkpoint:** Matt tests with his existing real lists. Confirms all CRUD + tag + completed archive work. Tests on iPhone.

---

## Stage M5: Notes page

**Model: Sonnet 5**

**Goal:** Freeform notes with search, same features as current.

**Prerequisites:** None.

**Build instructions:**
- Build `src/pages/Notes.jsx`:
  - Add/edit/delete note (title + body)
  - Sorted by most recently updated
  - Search box
  - Body rendered with `Linkify` (including bulleted/numbered list support)
  - Kebab menu per note for Edit/Delete

**Checkpoint:** Matt tests add/edit/delete/search with existing notes data. Tests on iPhone.

---

## Stage M6: Google Calendar integration

**Model: Opus 5**

**Goal:** Calendar page with full read/write access, powered by a Netlify Function backend.

**Prerequisites:** None new — same Google OAuth token from the Streamlit deployment.

**Build instructions:**
- **Netlify Function** `netlify/functions/calendar.js`:
  - Reads `GOOGLE_OAUTH_TOKEN` and `GOOGLE_CALENDAR_ID` from environment
  - Endpoints (via query params or path): `GET /events` (date range), `POST /events`, `PUT /events/:id`, `DELETE /events/:id`
  - Handles token refresh in memory (same logic as the Python version)
  - Uses `googleapis` npm package
- **React page** `src/pages/Calendar.jsx`:
  - Use FullCalendar React component (`@fullcalendar/react` + plugins: `daygrid`, `timegrid`, `list`, `interaction`)
  - Views: Month / 3-day / List (same as current)
  - Dark-themed with teal event color
  - Drag/resize to reschedule, click to edit
  - Add/edit/delete event forms
- **API helper** `src/lib/calendar.js` — fetch wrappers for the Netlify Function endpoints

**Checkpoint:** Matt confirms events display, drag-to-reschedule works, and add/edit/delete sync to Google Calendar. Tests on iPhone.

---

## Stage M7: Grocery & Meal Planning page

**Model: Sonnet 5**

**Goal:** Shared grocery list + meal plan, same features as current including recipe scraping.

**Prerequisites:** None.

**Build instructions:**
- **Netlify Function** `netlify/functions/recipe.js`:
  - Accepts a URL, fetches it server-side, extracts recipe data (title + ingredients)
  - Use a JS recipe parsing approach (parse JSON-LD `schema.org/Recipe` from the HTML, fall back to meta tags)
- **React page** `src/pages/GroceryMeals.jsx`:
  - Grocery list: add name + optional qty, check off (sinks to bottom), "Clear N checked" button, delete
  - "Copy list" toggle: shows unchecked items as plain text, tap-to-select (same UX as current `_copy_box`)
  - Meal plan: add/edit/delete (date, name, notes, ingredients, source URL), "Show past meals" toggle
  - "Fetch" button on recipe URL → calls the Netlify Function → prefills ingredients + title
  - "Add N ingredients to grocery list" per meal (dedupes vs unchecked items)

**Checkpoint:** Matt tests grocery CRUD, meal plan CRUD, recipe scraping, and the copy-list feature. Tests on iPhone.

---

## Stage M8: AI Assistant (chat sidebar)

**Model: Opus 5**

**Goal:** Persistent chat panel with Claude, tool use across all modules — same capabilities as current, better UI.

**Prerequisites:** None new — same Anthropic API key.

**Build instructions:**
- **Netlify Function** `netlify/functions/assistant.js`:
  - Accepts the conversation history, runs the agentic tool loop server-side
  - Same tool definitions as current `ai_assistant.py` (calendar, lists, household info, grocery, meals, notes)
  - Tool execution calls Supabase directly (server-side supabase-js with the service role key for writes, or the anon key) and the calendar Netlify Function internally
  - **Streaming** — use Netlify Functions' streaming response support so chat replies appear token-by-token instead of all-at-once
  - Same system prompt: today's date, "Matt and Lucy", confirm-before-destructive
  - Same safety: tool errors returned as `is_error` results, max 12 tool rounds
- **React component** `src/components/ChatSidebar.jsx`:
  - Slide-over panel on mobile (triggered by a floating button or tab), persistent sidebar on desktop
  - Chat messages with streaming text display
  - Tool calls rendered as plain-English captions (same `_TOOL_LABELS` idea)
  - User's messages get the coral-tinted bubble
  - Clear conversation button
  - Conversation persisted in `localStorage` (survives page navigation and refreshes — better than Streamlit's session state which resets on refresh)
- Wire into the app shell so it's available on every page

**Checkpoint:** Matt tests Q&A and actions across all modules. Tests streaming, tool calls, error handling. Tests on iPhone (slide-over panel, keyboard interaction).

---

## Stage M9: PWA & deployment

**Model: Opus 5**

**Goal:** App live on Netlify with full PWA support, custom home-screen icon, and the custom domain.

**Prerequisites:** None new — Netlify account and domain already configured.

**Build instructions:**
- **PWA manifest** `public/manifest.json`:
  ```json
  {
    "name": "Household Manager",
    "short_name": "Home",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#10161A",
    "theme_color": "#2E8B90",
    "icons": [
      { "src": "/OremlandHouseIcon.png", "sizes": "512x512", "type": "image/png" }
    ]
  }
  ```
  (May need multiple icon sizes — generate 192x192 and 512x512 from the source PNG)
- **`index.html`**: `<link rel="manifest">`, `<link rel="apple-touch-icon">`, `<meta name="theme-color">`
- **Netlify config**:
  - Point `oremland.tidalwavegames.net` at this new Netlify project (or update the existing one)
  - Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `GOOGLE_OAUTH_TOKEN`, `GOOGLE_CALENDAR_ID`, `ANTHROPIC_API_KEY`
  - `about.html` and `privacy.html` must still be served (Google's consent screen references them) — copy them into `public/` so they're served as static files
- **Deploy** — push to GitHub, Netlify auto-builds
- **Retire Streamlit Community Cloud** — once the Netlify version is confirmed working, the Streamlit app can be deleted

**Checkpoint:** Matt visits `oremland.tidalwavegames.net` from both iPhones. Confirms: custom home-screen icon works natively, no Streamlit branding, all features work end-to-end. Lucy adds the shortcut too. Both sign off.

---

## Stage M10: Instacart via AI assistant (formerly Stage 11b)

**Model: Opus 5**

**Goal:** Connect the assistant to the Instacart remote MCP server so it can build carts and place orders.

**Prerequisites:** Matt and Lucy each have an Instacart account. App is live on HTTPS (Stage M9).

**Build instructions:**
- Extend `netlify/functions/assistant.js` to include the Instacart MCP connector:
  - `mcp_servers: [{type: "url", url: "https://fig-mcp.instacart.com/mcp", ...}]`
  - Consumer OAuth flow: one-time Instacart login per user, token cached in Supabase (new `instacart_tokens` table or a row in a `user_settings` table)
  - Tools exposed via `{type: "mcp_toolset", mcp_server_name: ...}`
- **Order safety:** assistant must confirm items + total in chat before placing any order. This is a hard rule in the system prompt, same as delete-confirmation.
- UI: if the user hasn't linked Instacart yet, the chat shows a "Connect Instacart" button/flow

**Checkpoint:** Matt tests: link Instacart account, ask the assistant to add grocery list items to an Instacart cart, review the cart, confirm or cancel. Tests on iPhone.

---

## Stage M11: Dashboard & polish pass

**Model: Sonnet 5**

**Goal:** Real dashboard content and final cleanup.

**Prerequisites:** None.

**Build instructions:**
- **Dashboard** pulls a real summary:
  - Today's calendar events (next 3-5)
  - Lists with unchecked item counts
  - Grocery list count
  - Recent notes
- Consistent styling pass across all pages
- Performance check: bundle size, lazy loading routes
- Responsive check: all pages at 390px, 430px, 768px, and desktop
- Update README with new setup instructions
- Clean up or archive the old Streamlit files (or move to a `streamlit-archive/` branch)

**Checkpoint:** Matt does a full end-to-end walkthrough on both iPhones and desktop. Signs off on the migration.

---

## Migration strategy

The migration runs **in parallel** with the existing Streamlit app:
1. The Streamlit app stays live on Community Cloud throughout, so there's no downtime.
2. The React app is built and tested on a separate Netlify deploy URL (or `localhost`) until it's ready.
3. When Matt signs off on Stage M9, the custom domain switches from redirecting to Streamlit → serving the React app directly.
4. The Streamlit Community Cloud app is retired.

The Supabase database is shared between both apps during migration — same tables, same data, no conflicts (both apps use the same anon key, same CRUD operations).

---

## General rules (same as the original plan)

- Never hardcode secrets — use environment variables (Netlify env vars for deployed, `.env` for local)
- Keep logic in shared modules (`src/lib/db.js`, `src/lib/calendar.js`) reusable by both the UI and the AI assistant's server-side tools
- After finishing each stage, stop and report back
- If stuck after a couple tries, flag to Matt before escalating models
- **Mobile-first:** design at 390px width first, then scale up to desktop
