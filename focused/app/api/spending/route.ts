import { NextResponse } from "next/server";
import { deleteSpending, insertSpending, listSpending, updateSpending } from "../../../lib/spending-data";
import { ensureSpendingCategory } from "../../../lib/spending-category-data";
import { cleanSpendingCategory } from "../../../lib/spending-categories";
import { currentIstDate, currentIstTime } from "../../../lib/time";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  try {
    const rows = await listSpending({
      startDate: url.searchParams.get("start") ?? undefined,
      endDate: url.searchParams.get("end") ?? undefined,
      category: cleanSpendingCategory(category),
      limit: Number(url.searchParams.get("limit")) || 500,
    });
    return NextResponse.json({ spending: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const category = await ensureSpendingCategory(body.category);
    const row = await insertSpending({
      item: String(body.item ?? ""),
      amount: Number(body.amount),
      category,
      date: typeof body.date === "string" ? body.date : currentIstDate(),
      time: typeof body.time === "string" ? body.time : currentIstTime(),
    });
    return NextResponse.json({ spending: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 });
    const category = await ensureSpendingCategory(body.category);
    const row = await updateSpending(body.id, {
      item: String(body.item ?? ""),
      amount: Number(body.amount),
      category,
      date: typeof body.date === "string" ? body.date : currentIstDate(),
      time: typeof body.time === "string" ? body.time : currentIstTime(),
    });
    return NextResponse.json({ spending: row });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 });
    await deleteSpending(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
