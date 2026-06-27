# Cool Concepts

## Server-side LLM parser with local fallback

The cockpit ticket composer feels like it parses inline, but the LLM never runs in the browser.

Flow:

```text
typing -> local parser instantly fills chips
       -> debounce
       -> POST /api/tickets/parse
       -> server calls the LLM
       -> structured JSON returns
       -> UI merges the better parse over the local draft
```

Why this is useful:

- The UI stays fast because the local parser responds immediately.
- API keys stay server-side.
- The LLM call is debounced, so every keystroke does not become a paid network request.
- If the LLM fails, the local parser still gives a usable draft.
- The server can normalize messy language into structured fields like `title`, `dueAt`, `importance`, `subtasks`, and `agent`.

In this repo:

- UI fallback and merge: `components/dashfinal/DashFinal.tsx`
- Server parser route: `app/api/tickets/parse/route.ts`
- LLM client: `lib/groq.ts`
