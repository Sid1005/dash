"""Poll Dash API for tasks, remind when due within 60s. No webhook needed."""
import json, os, sys, urllib.request
from datetime import datetime, timezone

DASH_API = "https://dash-five-blush.vercel.app/api/tasks"
STATE_FILE = "/home/opc/.hermes/dash_task_state.json"

def main():
    # Fetch current tasks
    try:
        req = urllib.request.Request(DASH_API, headers={"User-Agent": "Hermes-Dash-Reminder/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        tasks = data.get("tasks", [])
    except Exception as e:
        print(f"[dash-reminder] API fetch error: {e}", file=sys.stderr)
        return
    
    now = datetime.now(timezone.utc)
    reminders = []
    
    for task in tasks:
        if task.get("done"):
            continue
        
        due_str = task.get("due_at", "")
        if not due_str:
            continue
        
        try:
            due_str = due_str.replace("Z", "+00:00")
            due = datetime.fromisoformat(due_str)
        except:
            continue
        
        seconds_left = (due - now).total_seconds()
        
        if 0 <= seconds_left <= 60:
            reminders.append(f"⏰ {task['title']} — due now!")
    
    if reminders:
        print("\n".join(reminders))

if __name__ == "__main__":
    main()
