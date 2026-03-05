import { NextResponse } from "next/server";
import { handleTelegramMessage } from "@/lib/telegram/botEngine";
import { registerChatId } from "@/lib/telegram/chatStore";

export async function POST(req: Request) {
  try {
    const origin = new URL(req.url).origin;

    // Security check: Validate secret token if configured
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const token = req.headers.get("x-telegram-bot-api-secret-token");
      if (token !== secret) {
        console.warn("[TelegramWebhook] Unauthorized access attempt blocked.");
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();

    // Validate the typical Telegram Webhook shape
    if (!body || !body.message) {
      return NextResponse.json({ ok: true, reason: "No message present" });
    }

    const { chat, text } = body.message;

    if (!chat || !chat.id || !text) {
      return NextResponse.json({ ok: true, reason: "No text or chat id missing" });
    }

    // 自動把 chat_id 存入 Redis，實現動態廣播更新
    await registerChatId(chat.id);

    // Process asynchronously (Vercel Serverless allows short execution background tasks or awaiting here if it's within 10s)
    // We will await it directly to ensure we reply before lambda freezing.
    await handleTelegramMessage(chat.id, text.trim(), false, { baseUrl: origin });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[TelegramWebhook] Fatal Error:", error);
    // Always return 200 OK so Telegram stops retrying the bad payload
    return NextResponse.json({ ok: true, error: error.message });
  }
}
