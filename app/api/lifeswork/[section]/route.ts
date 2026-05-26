import { NextRequest, NextResponse } from "next/server";
import { readLifeworkSection, writeLifeworkSection } from "@/lib/lifeswork-supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ section: string }> }
) {
  const { section } = await params;
  const content = await readLifeworkSection(section);
  return NextResponse.json({ section, content });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ section: string }> }
) {
  const { section } = await params;
  const { content } = await req.json();
  await writeLifeworkSection(section, content);
  return NextResponse.json({ ok: true });
}
