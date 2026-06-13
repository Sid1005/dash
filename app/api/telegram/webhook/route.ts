import { NextRequest, NextResponse, after } from "next/server";
import {
  applyParsedAction,
  formatActionPreview,
  parseNaturalLanguage,
} from "@/lib/actions";
import {
  answerCallbackQuery,
  getAllowedUserIds,
  sendTelegramMessage,
  sendTelegramMessageWithButtons,
  getTelegramFilePath,
  downloadTelegramFile,
} from "@/lib/telegram";
import { clearPending, getPending, setPending } from "@/lib/telegram-pending";
import { currentIstDate, currentIstTime, currentIstWeekday } from "@/lib/time";
import { getDefaultOwnerDb } from "@/lib/owner-scope";

/** Extend invocation until `after()` tasks finish (LLM + Telegram API). */
export const maxDuration = 60;

function isDirectSlashCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized.startsWith("/") || normalized.startsWith("slash ");
}

function isConfirmYes(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "yes, note it down" ||
    normalized === "note it down"
  );
}

function isConfirmNo(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === "no" || normalized === "n" || normalized === "cancel";
}

async function processCallbackQuery(body: Record<string, unknown>) {
  const callback = body.callback_query as Record<string, unknown> | undefined;
  const callbackQueryId = callback?.id as string | undefined;
  const data = (callback?.data as string | undefined)?.trim();
  const messageObj = callback?.message as Record<string, unknown> | undefined;
  const chatObj = messageObj?.chat as Record<string, unknown> | undefined;
  const chatId = chatObj?.id as number | undefined;

  if (!chatId || !data) return;

  if (callbackQueryId) await answerCallbackQuery(callbackQueryId);

  try {
    if (data === "confirm_no") {
      await clearPending(chatId);
      await sendTelegramMessage(chatId, "Okay, not saved.");
      return;
    }

    if (data === "confirm_yes") {
      const pending = await getPending(chatId);
      if (!pending) {
        await sendTelegramMessage(chatId, "No pending item to save. Send a new message first.");
        return;
      }
      const message = await applyParsedAction(pending.action, pending.date, await getDefaultOwnerDb());
      await clearPending(chatId);
      await sendTelegramMessage(chatId, `✓ ${message}`);
    }
  } catch (e) {
    await sendTelegramMessage(chatId, `Error: ${String(e)}`);
  }
}

async function processMessage(
  chatId: number,
  text: string,
  today: string,
  now: string,
  weekday: string,
  base64Image?: string
) {
  try {
    if (!base64Image) {
      if (isConfirmNo(text)) {
        await clearPending(chatId);
        await sendTelegramMessage(chatId, "Okay, not saved.");
        return;
      }

      if (isConfirmYes(text)) {
        const pending = await getPending(chatId);
        if (!pending) {
          await sendTelegramMessage(chatId, "No pending item to save. Send a food line or /food command.");
          return;
        }
        const message = await applyParsedAction(pending.action, pending.date, await getDefaultOwnerDb());
        await clearPending(chatId);
        await sendTelegramMessage(chatId, `✓ ${message}`);
        return;
      }

      if (isDirectSlashCommand(text)) {
        const action = await parseNaturalLanguage(text, `${today} ${now} (${weekday})`);
        const message = await applyParsedAction(action, today, await getDefaultOwnerDb());
        await clearPending(chatId);
        await sendTelegramMessage(chatId, `✓ ${message}`);
        return;
      }
    }

    const pending = await getPending(chatId);
    const pendingAction = pending && pending.action.type !== "chat" ? pending.action : undefined;

    let history: string[] = [];
    if (pending?.action?.type === "chat" && Array.isArray((pending.action.data as Record<string, unknown>)?.history)) {
      history = (pending.action.data as Record<string, unknown>).history as string[];
    }
    if (text) {
      history.push(`User: ${text}`);
    }

    const parseInputString = pendingAction ? text : history.join("\n");
    const action = await parseNaturalLanguage(
      parseInputString,
      `${today} ${now} (${weekday})`,
      pendingAction,
      base64Image
    );

    if (action.type === "chat") {
      if (pendingAction) {
        // If there was a pending action, keep it active and just output the chat response
        await sendTelegramMessage(chatId, action.data.response as string);
        return;
      }
      history.push(`AI: ${action.data.response}`);
      // Cast to any to bypass strict type check for now since we added history
      await setPending(chatId, { type: "chat", data: { history, response: action.data.response } } as any, today);
      await sendTelegramMessage(chatId, action.data.response as string);
      return;
    }

    const targetDate = (action.data?.date as string) || today;
    await setPending(chatId, action, targetDate);
    await sendTelegramMessageWithButtons(chatId, formatActionPreview(action));
  } catch (e) {
    await sendTelegramMessage(chatId, `Error: ${String(e)}`);
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (
    process.env.TELEGRAM_WEBHOOK_SECRET &&
    secret !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowed = getAllowedUserIds();

  if (body?.callback_query) {
    const callback = body.callback_query as Record<string, unknown>;
    const from = callback.from as Record<string, unknown> | undefined;
    const userId = from?.id as number | undefined;
    if (userId && allowed.size > 0 && !allowed.has(userId)) {
      return NextResponse.json({ ok: true });
    }
    after(async () => {
      await processCallbackQuery(body as Record<string, unknown>);
    });
    return NextResponse.json({ ok: true });
  }

  const msg = body?.message;
  if (!msg) return NextResponse.json({ ok: true });

  const hasText = typeof msg.text === "string" && msg.text.trim().length > 0;
  const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;

  if (!hasText && !hasPhoto) {
    return NextResponse.json({ ok: true });
  }

  const userId: number = msg.from?.id;
  const chatId: number = msg.chat?.id;
  if (allowed.size > 0 && !allowed.has(userId)) {
    return NextResponse.json({ ok: true });
  }

  const today = currentIstDate();
  const now = currentIstTime();

  after(async () => {
    let base64Image: string | undefined;
    const textToParse = msg.text || msg.caption || "";

    if (hasPhoto) {
      try {
        const photo = msg.photo[msg.photo.length - 1];
        const filePath = await getTelegramFilePath(photo.file_id);
        if (filePath) {
          const buffer = await downloadTelegramFile(filePath);
          if (buffer) {
            base64Image = buffer.toString("base64");
          }
        }
      } catch (e) {
        console.error("Failed to download Telegram photo:", e);
      }
    }

    const weekday = currentIstWeekday();
    await processMessage(chatId, textToParse, today, now, weekday, base64Image);
  });

  return NextResponse.json({ ok: true });
}
