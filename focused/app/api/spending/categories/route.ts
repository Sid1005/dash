import { NextResponse } from "next/server";
import {
  createSpendingCategory,
  listSpendingCategories,
  mergeSpendingCategories,
  renameSpendingCategory,
} from "@/lib/spending-category-data";

export async function GET() {
  try {
    return NextResponse.json({ categories: await listSpendingCategories() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const category = await createSpendingCategory(body.name);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const sourceId = typeof body.source_id === "string" ? body.source_id : "";
    const targetId = typeof body.target_id === "string" ? body.target_id : "";
    await mergeSpendingCategories(sourceId, targetId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const category = await renameSpendingCategory(id, body.name);
    return NextResponse.json({ category });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
