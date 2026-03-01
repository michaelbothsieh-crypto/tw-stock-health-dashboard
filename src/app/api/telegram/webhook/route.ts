import { NextResponse } from "next/server";
import { handleTelegramMessage } from "@/lib/telegram/botEngine";
import { registerChatId } from "@/lib/telegram/chatStore";

export async function POST(req: Request) {
  try {
    const origin = new URL(req.url).origin;
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
