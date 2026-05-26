import { NextRequest, NextResponse } from "next/server";
import { updateProblem, deleteProblem } from "@/lib/problems-supabase";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json();
    const patch: Record<string, unknown> = {};

    if (typeof body.solved === "boolean") {
      patch.solved = body.solved;
    }
    if (typeof body.text === "string") {
      const t = body.text.trim();
      if (t) patch.text = t;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Provide solved status or text to update" },
        { status: 400 }
      );
    }

    const updated = await updateProblem(id, patch);
    return NextResponse.json({ problem: updated });
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

    await deleteProblem(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
