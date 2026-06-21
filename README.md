# Dash

Dash is a personal mission-control dashboard built with Next.js 16, React 19, and Supabase. It combines a daily cockpit with tasks, time blocks, workouts, activity, food, spending, ideas, and Telegram-based natural-language capture.

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run test:integration` exercises CRUD endpoints against a running local server and database. It creates and removes test records, so do not point it at production.

## Repository map

```text
app/                    Next.js pages and API route handlers
components/dashfinal/   Active dashboard pages, shared UI, and view models
lib/                    Domain logic, integrations, and Supabase data access
cron/                   Hermes reminder receiver for the companion VM
supabase/migrations/    Versioned database schema and RLS history
tests/                  Unit and opt-in integration tests
docs/                   Maintained operational documentation
```

Generated experiments, local Supabase state, build artifacts, and explanation HTML files are intentionally excluded from Git.

## Main routes

- `/` — cockpit and idea board
- `/tasks` — tasks and learnings
- `/calendar` — time-block calendar
- `/food` — food and spending
- `/workouts` — workout history and logging
- `/activities` — activity log

## Integrations

### Supabase

Supabase provides authentication and user-scoped persistence. Server routes resolve an authenticated owner scope before accessing exposed tables, with RLS migrations stored under `supabase/migrations/`.

### Telegram and Groq

The Telegram webhook classifies questions and logging requests. Groq supplies the OpenAI-compatible language model used for parsing, personal-data questions, and idea classification.

### Hermes task reminders

Task mutations notify the configured Hermes receiver through a short-timeout webhook. The receiver creates, replaces, or cancels one-shot Hermes cron jobs without blocking Dash when the companion VM is unavailable.

Run `cron/dash_event_receiver.py` on the Hermes VM and configure:

```text
HERMES_REMINDER_WEBHOOK_URL=https://your-host/dash/reminder
HERMES_REMINDER_WEBHOOK_SECRET=shared-secret
```

Set the same `HERMES_REMINDER_WEBHOOK_SECRET` on the receiver VM. `DASH_EVENT_SECRET` remains supported as a backward-compatible alias. See the script header for the remaining optional VM settings.

## Deployment

The application deploys to Vercel from GitHub. Pull requests run type-checking, linting, unit tests, and a production build before merge.
