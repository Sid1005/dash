# Three

Three is a focused clone of Dash for the only three workflows used day to day:

- spending
- tasks
- workout sessions

The original Dash codebase and Vercel project are unchanged. Three uses the same Supabase project, so existing spending, task, and workout data is visible in both apps.

Production: [dash-focused.vercel.app](https://dash-focused.vercel.app)

The dashboard and Shortcut endpoint open directly without a login or API key.

## What changed

- Telegram, food tracking, calendar/events, tickets, agent runs, and Groq are absent from this clone.
- Natural-language routing uses OpenCode Go at `https://opencode.ai/zen/go/v1` with `deepseek-v4-flash`.
- Workout queries filter canonical session categories (`Chest`, `Back`, `Shoulders`, `Leg`, `Bicep`) instead of searching exercise names.
- Workout logs within three hours of a session's first log append to that session.
- The first log in a new session returns a title follow-up for the iOS Shortcut.
- Spending has useful categories including Travel, Food, Family, Shopping, and Transport.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## iOS Shortcut

See [docs/ios-shortcut.md](docs/ios-shortcut.md) for the exact Action Button flow and workout-title follow-up.
