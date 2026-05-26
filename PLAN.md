# Personal Dashboard — Build Plan

## What We're Building

A dark-mode personal operating system. The app is **deployed to a public URL** (not limited to localhost). It reads and writes directly to your Obsidian vault. You add data from a **dedicated Telegram bot** (phone) or the **command bar** on the site (laptop). Natural language is parsed with **OpenCode (opencode-go)** using your API key; food entries get **calories and protein (grams)** filled, with **estimates** when you do not provide them. **Scheduling and day tracking** use **Google Calendar** and **Google Sheets** via **Composio** (you will connect accounts there). Everything that lands in the vault is still markdown files — no app-specific database; external tools are for calendar/sheets only.

---

## Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 App Router | Server components + API routes in one repo |
| Hosting | Public HTTPS URL (e.g. Vercel) | Telegram webhooks require HTTPS; same URL for daily use |
| Styling | Tailwind CSS v4 + shadcn/ui | Dark mode, composable components |
| Storage | Direct filesystem I/O to Obsidian vault | No plugin needed, vault is local to the machine running the app |
| NL parsing | **OpenCode (opencode-go)** + your API key | Route free-text to the right data bucket |
| LLM models | **Kimi 2.6**, **DeepSeek V4 Pro**, **DeepSeek Flash** | Configure in OpenCode; use faster/cheaper model for simple parses, stronger model for ambiguous food or multi-intent |
| Food macros | Same NL pipeline + estimation step | When calories and/or protein are missing, infer sensible **calories** and **`protein_g`** (grams); set `estimated: true` if anything was inferred (not fully user-supplied) |
| Calendar & Sheets | **Composio** (Google Calendar + Google Sheets) | OAuth and tools centralized; scheduling + day tracking in Sheets as decided during implementation |
| Telegram | **New dedicated bot** (BotFather) | Single-purpose bot for this dashboard; webhook points at `POST /api/telegram/webhook` on the deployed host |
| Markdown I/O | `gray-matter` | Parse + write YAML frontmatter in .md files |

**Note:** If direct Google OAuth was planned only for Calendar, prefer **Composio-connected Calendar** first and drop duplicate OAuth unless something still needs raw API access.

---

## Obsidian Vault Structure (new folders)

Vault path: `/Users/siddharthceri/Documents/My First Vault/`

```
Dashboard/
  Daily/
    2026-05-03.md        ← YAML frontmatter: food (calories + protein_g), spending, time_blocks
  Life's Work/
    Anti-Vision.md
    Vision.md
    Mission.md
    Standards.md
    Goals.md
    Projects/
    Constraints.md
    Levers.md
  Learnings/
    2026-05-03.md        ← bullet list of learnings per day
```

### Daily Note Schema (YAML frontmatter)

```yaml
---
date: 2026-05-03
food:
  - { name: "Oatmeal", calories: 350, protein_g: 12, estimated: false, cost: 0, time: "08:00", meal: "breakfast" }
  - { name: "Chicken rice at hawker", calories: 550, protein_g: 38, estimated: true, cost: 5.00, time: "12:30", meal: "lunch" }
spending:
  - { item: "Coffee", amount: 4.50, category: "Food", time: "09:00" }
time_blocks:
  - { start: "09:00", end: "09:15", activity: "Email triage", category: "Admin" }
  - { start: "09:15", end: "09:30", activity: "Dashboard build", category: "Deep Work" }
---
```

(Below the frontmatter, the file body is free-form journal text.)

---

## 5 Views (Sidebar Navigation)

| Nav | Route | What's on the page |
|---|---|---|
| **Today** | `/` | Date · Calendar (Composio) · 15-min Hormozi time-block grid · Food log · Spend log |
| **Life's Work** | `/lifeswork` | Tabs: Anti-Vision · Vision · Mission · Standards · Goals · Projects · Constraints · Levers |
| **Food** | `/food` | Daily food log table, weekly calorie + protein totals/charts |
| **Spending** | `/spending` | Daily/weekly/monthly breakdown, category pie |
| **Learnings** | `/learnings` | Chronological log, searchable |

---

## Natural Language Command Bar (⌘K)

Fixed palette at the top of every page. You type anything; **OpenCode** parses it and routes it (same pipeline as Telegram):

### Food macros (calories + protein)

When you omit details (e.g. `"two eggs and toast breakfast"`), the parse step returns a `food` action; a **macro estimation** sub-step fills **`calories`** and **`protein_g`** (grams). Set `estimated: true` if either value was inferred. If you supply explicit numbers (e.g. `"600 cal 45g protein"`), store them and set `estimated: false`.

| You type | What happens |
|---|---|
| `"ate chicken rice 600 cal 40g protein $8 lunch"` | Food entry + spending entry added (macros explicit) |
| `"chicken rice $8 lunch"` | Food + spend; **calories and protein estimated** |
| `"9-915 email triage"` | Time block 09:00–09:15 added |
| `"spent $50 groceries"` | Spending entry added |
| `"learned: obsidian uses gray-matter"` | Appended to today's Learnings note |
| `"goal: ship dashboard by May 10"` | Appended to Goals.md |

Parser returns structured JSON (`food` actions include `calories`, `protein_g`, `estimated`):
```json
{ "type": "food", "data": { "name": "Chicken rice", "calories": 550, "protein_g": 38, "estimated": true } }
```
(Other `type` values use different `data` shapes.)

---

## API Routes

```
POST /api/parse                 ← NL input → OpenCode → structured action (+ macro fill: calories + protein_g when needed)
POST /api/telegram/webhook      ← Telegram updates → same internal handler as /api/parse → vault
GET  /api/daily                 ← read today's daily note (frontmatter + body)
POST /api/daily                 ← append/update food, spending, or time_block
GET  /api/lifeswork/[section]   ← read a Life's Work markdown file
PUT  /api/lifeswork/[section]   ← write/append to a Life's Work markdown file
GET  /api/learnings             ← read all learnings or filter by date
POST /api/learnings             ← append a learning entry
GET  /api/calendar              ← today's events (via Composio Calendar tools or proxy route)
...                             ← optional: thin routes that invoke Composio for Sheets read/write for day tracking
```

**Composio:** Use Composio SDK or HTTP from server routes to list/read/write Calendar and Sheets after the user connects accounts in Composio. Keep secrets in env (`COMPOSIO_API_KEY` or as per Composio docs).

---

## File Layout

```
/Users/siddharthceri/dash/
  app/
    page.tsx                    ← Today view
    lifeswork/page.tsx
    food/page.tsx
    spending/page.tsx
    learnings/page.tsx
    layout.tsx                  ← Sidebar nav wrapper
    globals.css
  app/api/
    parse/route.ts
    telegram/webhook/route.ts
    daily/route.ts
    lifeswork/[section]/route.ts
    learnings/route.ts
    calendar/route.ts           ← may wrap Composio Calendar
  components/
    Sidebar.tsx
    CommandBar.tsx              ← ⌘K palette
    TimeBlockGrid.tsx           ← 15-min Hormozi tracker
    CalendarPanel.tsx
    FoodLog.tsx
    SpendLog.tsx
    LifeWorkEditor.tsx          ← Markdown editor per section
    LearningsLog.tsx
  lib/
    vault.ts                    ← read/write helpers using gray-matter
    calendar.ts                 ← Calendar via Composio (or helper)
    composio.ts                 ← Composio client + Calendar / Sheets actions
    parse.ts                    ← OpenCode / opencode-go NL parser + macro estimation (calories + protein_g)
    telegram.ts                 ← verify webhook, send reply messages
  .env.local                    ← OPENCODE_API_KEY (or provider key as required), COMPOSIO_*, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET (optional), VAULT_PATH, ...
```

---

## Design Tokens

```
bg-base:    #0a0a0f   (body)
bg-surface: #111118   (cards, sidebar)
bg-subtle:  #1a1a24   (hover states, inputs)
border:     #1e1e2e
text:       #f0f0ff
text-muted: #6b7280
blue:       #3b82f6   (primary accent)
blue-light: #60a5fa   (hover)
```

---

## Google Calendar & Sheets (Composio)

1. Create/configure Composio app connection for **Google Calendar** and **Google Sheets** (user connects Google account in Composio UI or flow).
2. Store Composio API key and entity/user identifiers in `.env.local` as required by the Composio SDK.
3. Implement server-side calls for: **calendar** (today’s events, create/update if needed) and **sheets** (day-tracking layout TBD — e.g. one sheet per month or a rolling log).
4. Optional legacy path: direct Google OAuth in-app **only if** something cannot be done via Composio; otherwise avoid duplicate OAuth.

## Telegram Bot (one-time)

1. BotFather → **new bot** dedicated to this dashboard → save **bot token**.
2. Deploy the Next app to HTTPS → set webhook URL to `https://<your-domain>/api/telegram/webhook` (Telegram Bot API `setWebhook`).
3. Restrict handling to your **Telegram user id** (allowlist) so random users cannot write to your vault.
4. Same NL → vault pipeline as `POST /api/parse`; reply with short confirmations/errors.

## OpenCode (opencode-go)

1. Provide **API key** via env (exact variable name per OpenCode docs).
2. Register models: **Kimi 2.6**, **DeepSeek V4 Pro**, **DeepSeek Flash** — map roles (e.g. Flash for cheap/fast routing, Pro for hard multi-intent, Kimi per preference).
3. Parser output schema unchanged; implementation lives in `lib/parse.ts`.

---

## Build Order

1. Scaffold Next.js 15 + Tailwind + shadcn
2. `lib/vault.ts` — read/write daily note + Life's Work files (food: `calories`, `protein_g`, `estimated`)
3. `lib/parse.ts` — OpenCode (opencode-go) NL parser + **macro estimation** (calories + protein) when missing
4. Shared **`applyParsedAction`** (or equivalent) used by `/api/parse` and Telegram
5. Core API routes (`/api/daily`, lifeswork, learnings, `/api/parse`)
6. **`lib/composio.ts`** + Calendar read path for Today view; then Sheets for day-tracking schema you choose
7. Sidebar layout + design tokens
8. **Today** page: CalendarPanel + TimeBlockGrid + FoodLog + SpendLog
9. **Life's Work** page: tabs with markdown editor
10. **Food**, **Spending**, **Learnings** pages
11. CommandBar (⌘K) wired to `/api/parse`
12. **`POST /api/telegram/webhook`** + deploy + set Telegram webhook
13. Polish: model routing (Flash vs Pro vs Kimi), Composio Sheets writes if needed for automation

---

## Verification Checklist

- [ ] `npm run dev` opens on `localhost:3000` with no errors
- [ ] Type `"ate oatmeal 350 cal 12g protein"` → Food log + vault updated (`estimated: false`)
- [ ] Type food **without** calories/protein → entry has **calories + `protein_g`** + `estimated: true`
- [ ] Type `"9-915 email"` → block appears in time grid
- [ ] Life's Work > Vision tab → edit + save → vault file updated
- [ ] Calendar (via Composio) shows today’s events on deployed app
- [ ] Sheets (via Composio) read/write matches chosen day-tracking layout
- [ ] Telegram message performs same logging as command bar; bot replies OK
- [ ] All 5 nav views load without errors on production URL
