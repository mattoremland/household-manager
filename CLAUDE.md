# Household Manager

Private, no-login Streamlit app for two users (Matt + wife) to manage household info, calendar, shared checklists, groceries, and notes, with an AI assistant sidebar.

Full stage-by-stage build plan: [household-app-build-plan.md](household-app-build-plan.md)

## Tech stack (fixed)

- **Frontend:** Streamlit (multi-page app)
- **Database:** Supabase (Postgres)
- **Calendar:** Google Calendar API, OAuth installed-app flow, single shared calendar
- **AI:** Anthropic API (Claude) with tool use
- **Grocery ordering:** Instacart via the official remote MCP server (`fig-mcp.instacart.com`, consumer OAuth), driven by the Stage 11 AI assistant — the Developer Platform API is NOT used (new signups are closed). Stage 9 itself is just a "Copy list" plain-text export button. See build plan Stage 9 (re-scoped) + Stage 11.
- **Hosting:** Streamlit Community Cloud, reachable via a Netlify redirect at a subdomain of Matt's existing domain
- **Secrets:** local `.env` (gitignored) locally; Streamlit Secrets manager once deployed — never hardcoded

## Device target

This app will be accessed almost entirely from iPhones (Matt: iPhone 17 Max, wife: iPhone 17) — **design and test every stage mobile-first**, not as an afterthought. Concretely:
- Avoid `st.columns()` layouts with more than 2 columns for anything that needs to be readable on a ~390-430px-wide screen — they don't reflow and will squeeze on mobile.
- Favor stacked/vertical layouts, full-width buttons/inputs, and short labels over wide multi-column dashboards.
- Check touch-target size on buttons/checkboxes in list-heavy pages (Lists, Grocery) — dense CRUD tables are hard to tap accurately on a phone.
- When building or changing a page, verify it in a mobile-width preview (~390-430px) before calling the stage done, in addition to desktop.
- Nav lives in a custom top-right "..." popover menu (`style.render_nav_menu()`), not Streamlit's default sidebar — the sidebar is force-hidden via CSS. See memory `project_navigation` for why and how to add a new page to it.

## Working rules (from the build plan — apply every session)

- Work through the build plan's stages **in order, one at a time**. Do not skip ahead.
- Each stage has a **Model** recommendation (Sonnet 5 for routine work, Opus 5 for judgment calls like OAuth/agentic design/hosting, Fable 5.1 only if stuck after a couple of tries with Opus). Flag to Matt when escalation seems warranted rather than switching silently.
- **Do not start a stage until Matt has explicitly confirmed that stage's prerequisites are in place.** If something's missing, stop and say exactly what's needed.
- **Do not move to the next stage until Matt has tested the current stage and explicitly says to proceed.**
- After finishing a stage, stop and report back — don't continue automatically into the next stage.
- Never hardcode secrets — always read from `.env` (or Streamlit Secrets once deployed).
- Keep each module's functions reusable by both the Streamlit UI and the AI assistant's tools — single source of truth for logic, no duplicate implementations.

## Progress tracking

Current stage and decisions-so-far are tracked in memory (see `memory/project_progress.md` equivalent in the assistant's memory system) — check there for where things left off before resuming work.
