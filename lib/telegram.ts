const TELEGRAM_API = "https://api.telegram.org";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_MESSAGE_CHUNK_LIMIT = 3900;

export function getAllowedUserIds(): Set<number> {
  const raw = process.env.TELEGRAM_ALLOWED_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter(Boolean)
  );
}

export async function sendTelegramMessage(chatId: number, text: string) {
  if (!BOT_TOKEN) return;
  for (const chunk of splitTelegramMessage(text)) {
    await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "Markdown" }),
    });
  }
}

export function splitTelegramMessage(text: string, limit = TELEGRAM_MESSAGE_CHUNK_LIMIT): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [""];
  if (trimmed.length <= limit) return [trimmed];

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit + 1);
    const paragraphBreak = window.lastIndexOf("\n\n");
    const lineBreak = window.lastIndexOf("\n");
    const sentenceBreak = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
    const spaceBreak = window.lastIndexOf(" ");
    const splitAt = [paragraphBreak, lineBreak, sentenceBreak, spaceBreak]
      .find((index) => index > Math.floor(limit * 0.6)) ?? limit;

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function sendTelegramMessageWithButtons(
  chatId: number,
  text: string
) {
  if (!BOT_TOKEN) return;
  await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Yes, note it", callback_data: "confirm_yes" },
            { text: "No", callback_data: "confirm_no" },
          ],
        ],
      },
    }),
  });
}

export async function answerCallbackQuery(callbackQueryId: string) {
  if (!BOT_TOKEN) return;
  await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

export async function setWebhook(url: string, secret?: string) {
  const body: Record<string, string> = { url };
  if (secret) body.secret_token = secret;
  const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getTelegramFilePath(fileId: string): Promise<string | null> {
  if (!BOT_TOKEN) return null;
  const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { ok: boolean; result?: { file_path?: string } };
  return json.ok && json.result?.file_path ? json.result.file_path : null;
}

export async function downloadTelegramFile(filePath: string): Promise<Buffer | null> {
  if (!BOT_TOKEN) return null;
  const res = await fetch(`${TELEGRAM_API}/file/bot${BOT_TOKEN}/${filePath}`);
  if (!res.ok) return null;
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
