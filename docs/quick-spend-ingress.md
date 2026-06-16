# One-tap spend logging (`POST /api/spend`)

Log a spend into Dash from outside the web app — built for an **iOS Shortcut**
you trigger right after paying with Google Pay (Action Button, Lock Screen
widget, Home Screen, or the Share Sheet).

Google Pay exposes no API/webhook for outgoing payments and iOS can't read
other apps' notifications, so fully-automatic capture isn't possible on iPhone.
This is the next best thing: one tap → type the amount → done.

## Endpoint

```
POST /api/spend
x-api-key: <QUICK_LOG_SECRET>
Content-Type: application/json
```

Auth uses the `x-api-key` header (same convention as the Telegram/cron callers).
The proxy (`proxy.ts`) admits the request when the key matches
`QUICK_LOG_SECRET` or `TELEGRAM_WEBHOOK_SECRET`; the route re-checks the key and
writes as the default owner via `getDefaultOwnerDb()`.

### Body — freeform (LLM-parsed + auto-categorized)

```json
{ "input": "spent 320 on zomato" }
```

Phrase it as **"spent {amount} on {item}"**. The shared parser then logs a
*spend* and picks the category automatically (Food/Transport/…). Do **not** send
bare `"320 zomato"` — without "spent … on" the parser may read it as a food/
calorie entry instead.

### Body — structured (instant, no LLM)

```json
{ "amount": 320, "item": "Zomato", "category": "Food" }
```

`category` is one of `Food | Transport | Health | Entertainment | Shopping |
Other` (defaults to `Other`). `date` (`YYYY-MM-DD`) and `now` (`HH:MM`) are
optional and default to current IST.

### Responses

```json
{ "ok": true, "message": "Logged ₹320 for Zomato" }     // 200
{ "error": "unauthorized" }                              // 401 (bad key at route)
{ "error": "Unauthorized access" }                       // 401 (blocked by proxy)
```

## Setup

1. **Secret** — set `QUICK_LOG_SECRET` in `.env.local` and on Vercel
   (Production/Preview/Development). A strong value:
   `openssl rand -hex 24`.
2. **Deploy** — merge to `main` so the route + proxy change go live at
   `https://dash-five-blush.vercel.app`.

## iOS Shortcut recipe

Shortcuts app → **+** → add these actions:

1. **Ask for Input** → *Number*, prompt **"Amount?"**
2. **Ask for Input** → *Text*, prompt **"On what?"**
3. **Text** action with value: `spent [Amount] on [On what?]`
   (insert the two variables from the steps above)
4. **Get Contents of URL**
   - URL: `https://dash-five-blush.vercel.app/api/spend`
   - Method: **POST**
   - Headers: `x-api-key` = `<your QUICK_LOG_SECRET>`,
     `Content-Type` = `application/json`
   - Request Body: **JSON** → key `input` = the Text from step 3
5. *(optional)* **Get Dictionary Value** `message` from the response →
   **Show Notification** so you see the confirmation.

Rename it "Log Spend", then add it to the **Action Button**, a **Lock Screen
widget**, or the **Home Screen** for true one-tap use after paying.

### Curl smoke test

```bash
curl -X POST https://dash-five-blush.vercel.app/api/spend \
  -H "x-api-key: $QUICK_LOG_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"input":"spent 320 on zomato"}'
```
