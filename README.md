# Dash

A personal mission control dashboard built with Next.js and Supabase. It integrates tasks, calendars, workouts, activities, finances, and food tracking into one command center.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local` based on `.env.example`.

3. Run the development server:
   ```bash
   npm run dev
   ```

## Key Tabs and Features

### Cockpit

The main dashboard tab. It aggregates key metrics and provides a quick status overview of your day. It displays recent logs, active tasks, timeblock summaries, and quick statistics.

### Activities

Logs physical activity and events. Track start time, end time, intensity, and description. Displays a chronological feed of logged actions.

### Calendar

A day planner showing calendar events. It integrates with a custom timeblock grid. Use this to schedule tasks and visualize your day.

### Life's Work

A project and goal workspace. It includes nested sections and a markdown-based text editor. Save ideas, track career progress, and write documentation.

### Scratchpad

A lightweight scratchpad for text and quick thoughts. Auto-saves content as you write.

### Tasks & Learning

A unified tab for task management and education. Track tasks with completion status, categories, and due dates. Note down learning topics and study sessions.

### Workouts

A workout tracker for logging exercise routines. Track exercises, weights, reps, sets, and notes. Displays past session history.

## Integrations

### Hermes Cron Reminders

A [Hermes Agent](https://hermes-agent.nousresearch.com/docs) cron job polls the Dash API every minute for tasks due within 60 seconds and delivers reminders to Telegram.

- **Script**: `cron/dash_queue_processor.py` — fetches `GET /api/tasks`, filters non-done tasks with `due_at` within the next 60s, prints `⏰ Task Title — due now!` to stdout
- **Cron mode**: `no_agent` (deterministic, no LLM involved) — stdout is delivered verbatim to Telegram
- **Schedule**: every 1 minute

Setup:
```bash
cp cron/dash_queue_processor.py ~/.hermes/scripts/
hermes cron create --name dash-reminder --schedule "every 1m" \
  --script dash_queue_processor.py --no-agent --deliver telegram
```

### Telegram Bot

Integrates a Telegram bot endpoint. Parse natural language messages using an LLM. Create database entries for spending, workouts, food, and calendar items directly through chat messages.
