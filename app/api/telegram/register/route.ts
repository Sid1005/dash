import { NextRequest, NextResponse } from "next/server";
import { setWebhook } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  const { webhookUrl } = await req.json();
  if (!webhookUrl) return NextResponse.json({ error: "webhookUrl required" }, { status: 400 });
  const result = await setWebhook(webhookUrl, process.env.TELEGRAM_WEBHOOK_SECRET);
  return NextResponse.json(result);
}
