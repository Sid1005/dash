import { NextResponse } from "next/server";
import { updateIdea, deleteIdea } from "@/lib/ideas-supabase";
import { getUserScopedDb } from "@/lib/owner-scope";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json();
    const patch: Record<string, unknown> = {};

    if (typeof body.archived === "boolean") {
      patch.archived = body.archived;
    }
    if (typeof body.text === "string") {
      const t = body.text.trim();
      if (t) patch.text = t;
    }
    if (typeof body.category === "string") {
      const cat = body.category.trim();
      if (cat) patch.category = cat;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Provide archived status, text, or category to update" },
        { status: 400 }
      );
    }

    const updated = await updateIdea(id, patch, await getUserScopedDb());
    return NextResponse.json({ idea: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await deleteIdea(id, await getUserScopedDb());
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
