"""Poll Dash API for tasks: remind when due within 60s, or overdue in morning window."""
import json, os, sys, urllib.request
from datetime import datetime, timezone, timedelta

DASH_API = "https://dash-five-blush.vercel.app/api/tasks"
STATE_FILE = "/home/opc/.hermes/dash_task_state.json"

# Morning window (UTC). 1-4 UTC = 6:30-9:30 IST — catches you when you wake up.
# Overdue tasks are only reported once per day during this window.
MORNING_START_UTC = 1   # 6:30 AM IST
MORNING_END_UTC = 4     # 9:30 AM IST

def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"overdue_reminded": {}}

def save_state(state):
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)

def parse_due(due_str):
    """Parse ISO datetime string, handling various formats."""
    try:
        due_str = due_str.replace("Z", "+00:00")
        return datetime.fromisoformat(due_str)
    except:
        return None

def main():
    # Fetch tasks from Dash API
    try:
        req = urllib.request.Request(DASH_API, headers={"User-Agent": "Hermes-Dash-Reminder/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        tasks = data.get("tasks", [])
    except Exception as e:
        print(f"[dash-reminder] API fetch error: {e}", file=sys.stderr)
        return

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    current_hour = now.hour
    in_morning_window = MORNING_START_UTC <= current_hour < MORNING_END_UTC

    state = load_state()
    reminded_today = state.get("overdue_reminded", {})
    reminders = []

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
        task_id = task.get("id", task.get("title", str(due)))

        # 1. Task is due right now (within 60s)
        if 0 <= seconds_left <= 60:
            reminders.append(f"⏰ {task['title']} — due now!")

        # 2. Task is overdue AND we're in the morning window AND not reminded today
        elif seconds_left < 0 and in_morning_window:
            last_reminded = reminded_today.get(task_id)
            if last_reminded != today_str:
                # How overdue? Show hours/days
                hours_overdue = abs(seconds_left) / 3600
                if hours_overdue < 24:
                    label = f"{hours_overdue:.0f}h overdue"
                else:
                    days = hours_overdue / 24
                    label = f"{days:.0f}d overdue"
                reminders.append(f"🔔 {task['title']} — still pending ({label})")
                reminded_today[task_id] = today_str

    # Save state
    if in_morning_window:
        state["overdue_reminded"] = reminded_today
        save_state(state)

    if reminders:
        print("\n".join(reminders))

if __name__ == "__main__":
    main()
