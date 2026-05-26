import { NextRequest, NextResponse } from "next/server";
import { type FoodEntry } from "@/lib/types";
import {
  deleteFoodEntry,
  insertFoodEntry,
  listFoodEntriesForDate,
} from "@/lib/food-supabase";
import { insertActivity, listActivitiesForDate } from "@/lib/activities-supabase";
import {
  deleteTimeBlock,
  insertTimeBlock,
  listTimeBlocksForDate,
} from "@/lib/time-blocks-supabase";
import {
  deleteSpending,
  insertSpending,
  listSpendingForDate,
} from "@/lib/spending-supabase";
import { currentIstDate } from "@/lib/time";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? currentIstDate();
  const [food, activities, time_blocks, spending] = await Promise.all([
    listFoodEntriesForDate(date),
    listActivitiesForDate(date),
    listTimeBlocksForDate(date),
    listSpendingForDate(date),
  ]);
  const spendingMapped = spending.map((s) => ({
    id: s.id,
    item: s.item,
    amount: Number(s.amount),
    category: s.category,
    time: s.time_local,
  }));
  return NextResponse.json({ date, food, activities, time_blocks, spending: spendingMapped });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, type, data } = body;
  const d = date ?? currentIstDate();

  if (type === "food") {
    const row = await insertFoodEntry(d, data as FoodEntry);
    return NextResponse.json({ ok: true, food: row });
  }
  if (type === "spending") {
    const row = await insertSpending(d, data as { item: string; amount: number; category: string; time: string });
    return NextResponse.json({ ok: true, spending: row });
  }
  if (type === "time_block") {
    const block = await insertTimeBlock(d, data);
    return NextResponse.json({ ok: true, time_block: block });
  }
  if (type === "activity") {
    const activity = await insertActivity(d, data);
    return NextResponse.json({ ok: true, activity });
  }
  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { date, type, id, index } = body;
  const d = date ?? currentIstDate();

  if (type === "food") {
    const foodId = typeof id === "string" ? id.trim() : "";
    if (!foodId) {
      return NextResponse.json(
        { error: "food delete requires id (uuid)" },
        { status: 400 }
      );
    }
    await deleteFoodEntry(foodId);
    return NextResponse.json({ ok: true });
  }

  if (type === "time_block") {
    const blockId = typeof id === "string" ? id.trim() : "";
    if (!blockId) {
      return NextResponse.json(
        { error: "time_block delete requires id (uuid)" },
        { status: 400 }
      );
    }
    await deleteTimeBlock(blockId);
    return NextResponse.json({ ok: true });
  }

  if (type === "spending") {
    const spendId = typeof id === "string" ? id.trim() : "";
    if (!spendId) {
      return NextResponse.json({ error: "spending delete requires id (uuid)" }, { status: 400 });
    }
    await deleteSpending(spendId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}
