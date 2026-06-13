import { type DbScope, getDefaultOwnerDb } from "./owner-scope";
import { currentIstDate, currentIstTime } from "./time";

export async function rolloverOverdueTasks(scope?: DbScope) {
  const { supabase, ownerUserId } = scope ?? await getDefaultOwnerDb();
  const todayStr = currentIstDate();
  const todayStartIst = `${todayStr}T00:00:00+05:30`;
  const today12PmIst = `${todayStr}T12:00:00+05:30`;

  // Fetch incomplete tasks due before today (strictly before start of today in IST)
  const { data: overdueTasks, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("done", false)
    .lt("due_at", todayStartIst);

  if (fetchError) {
    console.error("[rollover] Error fetching overdue tasks:", fetchError.message);
    return;
  }

  if (!overdueTasks || overdueTasks.length === 0) {
    return;
  }

  console.log(`[rollover] Found ${overdueTasks.length} overdue tasks to rollover to ${today12PmIst}`);

  // Fetch all deferral logs for today to check for duplicates in one query
  const { data: existingLogs, error: checkError } = await supabase
    .from("activities")
    .select("metadata")
    .eq("owner_user_id", ownerUserId)
    .eq("occurred_date", todayStr)
    .eq("actor", "system")
    .eq("verb", "deferred");

  if (checkError) {
    console.error("[rollover] Error checking existing logs:", checkError.message);
  }

  const loggedTaskIds = new Set<string>();
  if (existingLogs) {
    for (const log of existingLogs) {
      const meta = log.metadata as Record<string, any>;
      if (meta && typeof meta.taskId === "string") {
        loggedTaskIds.add(meta.taskId);
      }
    }
  }

  const idsToUpdate: string[] = [];
  const activitiesToInsert: any[] = [];
  const currentTime = currentIstTime();

  for (const task of overdueTasks) {
    idsToUpdate.push(task.id);

    if (!loggedTaskIds.has(task.id)) {
      activitiesToInsert.push({
        owner_user_id: ownerUserId,
        occurred_date: todayStr,
        time_local: currentTime,
        actor: "system",
        kind: "agent_event",
        verb: "deferred",
        body: `Deferred task "${task.title}" to today at 12 PM`,
        metadata: {
          taskId: task.id,
          originalDueAt: task.due_at,
          rolloverDate: todayStr,
        },
      });
    }
  }

  // Batch update tasks
  const { error: updateError } = await supabase
    .from("tasks")
    .update({ due_at: today12PmIst, updated_at: new Date().toISOString() })
    .eq("owner_user_id", ownerUserId)
    .in("id", idsToUpdate);

  if (updateError) {
    console.error("[rollover] Error updating tasks:", updateError.message);
    return;
  }

  // Batch insert activities
  if (activitiesToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("activities")
      .insert(activitiesToInsert);

    if (insertError) {
      console.error("[rollover] Error inserting activities:", insertError.message);
    }
  }
}
