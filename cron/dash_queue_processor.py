"""Poll Dash API for tasks: due-now reminders, overdue checks, and deferred-task morning reminders."""
import json, os, sys, urllib.request
from datetime import datetime, timezone, timedelta

DASH_API = "https://dash-five-blush.vercel.app/api/tasks"
ACTIVITIES_API = "https://dash-five-blush.vercel.app/api/activities"
STATE_FILE = "/home/opc/.hermes/dash_task_state.json"

# Morning window (UTC). 1-4 UTC = 6:30-9:30 IST.
MORNING_START_UTC = 1
MORNING_END_UTC = 4

# Specific time for deferred-task morning reminder (7:00 AM IST = 1:30 UTC).
# We use a 5-minute window so the once-per-minute cron catches it reliably.
DEFERRED_REMINDER_UTC = 1  # 6:30 AM IST — first minute of morning window is enough

def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"overdue_reminded": {}, "deferred_reminded": {}}

def save_state(state):
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)

def parse_due(due_str):
    try:
        due_str = due_str.replace("Z", "+00:00")
        return datetime.fromisoformat(due_str)
    except:
        return None

def ist_date(now_utc):
    """Return today's date in IST (UTC+5:30)."""
    ist = now_utc + timedelta(hours=5, minutes=30)
    return ist.strftime("%Y-%m-%d")

def fetch_json(url, label="API"):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Hermes-Dash-Reminder/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"[dash-reminder] {label} fetch error: {e}", file=sys.stderr)
        return None

def main():
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    today_ist = ist_date(now)
    current_hour = now.hour
    in_morning_window = MORNING_START_UTC <= current_hour < MORNING_END_UTC

    # Fetch tasks
    data = fetch_json(DASH_API, "tasks")
    if data is None:
        return
    tasks = data.get("tasks", [])

    state = load_state()
    reminded_overdue = state.get("overdue_reminded", {})
    reminded_deferred = state.get("deferred_reminded", {})
    reminders = []

    # --- 1. Tasks due within 60 seconds ---
    for task in tasks:
        if task.get("done"):
            continue
        due_str = task.get("due_at", "")
        if not due_str:
            continue
        due = parse_due(due_str)
        if due is None:
            continue

        seconds_left = (due - now).total_seconds()
        if 0 <= seconds_left <= 60:
            reminders.append(f"⏰ {task['title']} — due now!")

    # --- 2. Morning window: overdue tasks (once per day) ---
    if in_morning_window:
        for task in tasks:
            if task.get("done"):
                continue
            due_str = task.get("due_at", "")
            if not due_str:
                continue
            due = parse_due(due_str)
            if due is None:
                continue

            seconds_left = (due - now).total_seconds()
            if seconds_left >= 0:
                continue  # not overdue

            task_id = task.get("id", task.get("title", str(due)))
            if reminded_overdue.get(task_id) == today_str:
                continue  # already reminded today

            hours_overdue = abs(seconds_left) / 3600
            if hours_overdue < 24:
                label = f"{hours_overdue:.0f}h overdue"
            else:
                label = f"{hours_overdue / 24:.0f}d overdue"
            reminders.append(f"🔔 {task['title']} — still pending ({label})")
            reminded_overdue[task_id] = today_str

        state["overdue_reminded"] = reminded_overdue

    # --- 3. Morning window: tasks deferred yesterday (7am ~ 1:30 UTC) ---
    if in_morning_window:
        # Yesterday's date in IST
        yesterday_ist = (now + timedelta(hours=5, minutes=30) - timedelta(days=1)).strftime("%Y-%m-%d")

        # Only fetch deferral data if we haven't already reminded today
        if reminded_deferred.get("_checked_date") != today_str:
            activities_data = fetch_json(f"{ACTIVITIES_API}?date={yesterday_ist}", "activities")
            if activities_data:
                activities = activities_data.get("activities", [])
                # Find all task IDs that were deferred yesterday
                deferred_task_ids = set()
                for act in activities:
                    if act.get("verb") == "deferred" and act.get("actor") == "system":
                        meta = act.get("metadata", {})
                        tid = meta.get("taskId")
                        if tid:
                            deferred_task_ids.add(tid)

                # Cross-reference with today's incomplete tasks
                task_map = {t["id"]: t for t in tasks if t.get("id")}
                for tid in deferred_task_ids:
                    task = task_map.get(tid)
                    if task and not task.get("done"):
                        reminders.append(f"📋 {task['title']} — you deferred this yesterday, due today")
                        reminded_deferred[tid] = today_str

                reminded_deferred["_checked_date"] = today_str
                state["deferred_reminded"] = reminded_deferred

    # Save state
    if in_morning_window:
        save_state(state)

    if reminders:
        print("\n".join(reminders))

if __name__ == "__main__":
    main()
