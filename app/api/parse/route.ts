import { NextRequest, NextResponse } from "next/server";
import { handleNaturalLanguage } from "@/lib/actions";
import { currentIstDate, currentIstTime } from "@/lib/time";

export async function POST(req: NextRequest) {
  const { input, date, now } = await req.json();
  if (!input) return NextResponse.json({ error: "no input" }, { status: 400 });

  const today = date ?? currentIstDate();
  const time = now ?? currentIstTime();

  try {
    const result = await handleNaturalLanguage(input, today, time);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
