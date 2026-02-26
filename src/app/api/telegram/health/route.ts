import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: "1.0",
    message: "Telegram Webhook is alive and healthy.",
    webhookConfigured: !!process.env.TELEGRAM_BOT_TOKEN
  });
}
