# Dash

Dash is my personal life OS for the stuff that disappears if I do not pin it somewhere.

## Built with

- `Next.js`
- `React`
- `TypeScript`
- `Python`
- `Supabase`
- `Groq`
- `Hermes`
- `Vercel`

## A Better Place for My Brain

My life used to be scattered.

I tracked some things. I forgot others. A lot of it lived in my head until it fell out.

So I built Dash to hold the moving pieces for me: what I’m doing now, what I need later, what happened before, and what I should not forget again.

## The Story

### The laptop side

When I’m on my laptop, tickets keep track of what I’m currently doing.

I took a little inspiration from team workflows like P0 and P1, because 10 months in the corporate world made me do this. Some tickets are just for me. Some are ideas I do not want to lose. And sometimes I hand a ticket to an agent like Codex.

That happens inside the `/tasks` route and the main dashboard flow, where I can create a Codex task, save it, and watch the agent run in the background.

I run Codex in the background because I want my ideas to have a starting point instead of just sitting there.

Whatever I am actively working on can be dragged into **Now** at the top of `/`. That way Dash always knows what has my attention.

### The phone side

A lot of life happens away from the laptop, and I forget things easily.

So Telegram is one of my main interfaces into Dash, and it feeds into the Next.js app through webhooks.

I can send a task from Telegram. That message goes through a webhook into my Next.js app, gets routed into Dash, and creates a scheduled job on Hermes running on my VM.

That is where `/tasks` comes in, because it keeps the thing I need to do from living only in my head.

The point is simple: one minute before I need to do something, Hermes pings me so I do not forget.

The same flow works for events too. I send it from Telegram, and it shows up in my calendar inside Dash through the same `/calendar` system that keeps the rest of my day visible.

I also track workouts this way.

After the gym, I just message what I did. It is still manual, but it is fast enough that I actually do it.

That workout gets saved into Dash, and because everything I log becomes memory, I can ask questions later.

So before my next chest workout, I can ask, “What was my last chest workout?”

Telegram sends back the answer, and now I know what weight I used last time, which means I can progress instead of guessing.

### Spending and food

I could log spending through Telegram too, but even that felt like too much friction.

So I use the action button on the side of my phone.

It calls the same Next.js routes, but it is faster than opening Telegram. I tap it, choose spending, enter the amount, and it gets logged into Dash through `/food`.

I can track food the same way too, which keeps the spending and food pieces close together instead of scattering them across separate tools.

That means the things I never used to track, like spending and food, are actually easy enough to capture.

### Agent work

And remember the Codex ticket from earlier?

The agent finishes, creates the HTML file and the markdown file, and they come back into the ticket.

So the loop closes: I can create work, send it to an agent, and come back to the result later.

### What ties it together

Supabase is where the memory lives.

Groq helps parse the messy human input, classify ideas, and answer questions from the stuff I have already logged, and I use it because it is fast.

Hermes handles the reminder jobs on the VM so Dash can nudge me before I forget.

Vercel is where the app ships from GitHub, which keeps the whole thing easy to deploy and keep alive.

## Why I Built It

Dash helps me keep track of:

- what I’m doing now
- what I did before
- what I need next
- what I should not forget
- what I can learn from my past

That is the whole thing.

## Repository Map

```text
app/                    Next.js app routes, pages, and API handlers
components/dashfinal/   Main dashboard UI and view models
lib/                    Domain logic, integrations, and Supabase data access
cron/                   Hermes reminder receiver for the companion VM
scripts/                Background utilities, including the agent runner
supabase/migrations/    Versioned database schema and RLS history
tests/                  Unit and integration tests
docs/                   Operational notes and supporting docs
```

Generated experiments, local Supabase state, build artifacts, and explanation HTML files are intentionally excluded from Git.

## Main Routes

- `/` - cockpit and idea board
- `/tasks` - tasks and learnings
- `/calendar` - time-block calendar
- `/food` - food and spending
- `/workouts` - workout history and logging

## Integrations

Supabase handles authentication and persistence. Telegram, Groq, Hermes, and the action button Shortcut are the main ways I get things into Dash and back out again.

Run `cron/dash_event_receiver.py` on the Hermes VM and configure the reminder webhook there.

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

## Deployment

The application deploys to Vercel from GitHub. Pull requests run type-checking, linting, unit tests, and a production build before merge.
