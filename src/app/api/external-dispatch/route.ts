import { NextRequest, NextResponse } from "next/server";
import { generateBotReply } from "@/features/telegram/botEngine";
import { setCache } from "@/infrastructure/providers/redisCache";

type DispatchBody = {
  platform?: "telegram" | "line";
  chat_id?: string | number;
  user_id?: string | number;
  text?: string;
  reply_token?: string;
  base_url?: string;
};

function authOk(req: NextRequest): boolean {
  const expected = process.env.STOCK_EXTERNAL_DISPATCH_SECRET || process.env.TG_WEBHOOK_SECRET;
  if (!expected) return true;
  return req.headers.get("authorization") === expected;
}

function cleanLineText(text: string): string {
  return text
    .replace(/<b>(.*?)<\/b>/gi, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\*/g, "");
}

async function sendTelegram(chatId: string | number, text: string, chartBuffer?: Buffer | null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  if (chartBuffer) {
    const formData = new FormData();
    formData.append("chat_id", String(chatId));
    formData.append("photo", new Blob([new Uint8Array(chartBuffer)], { type: "image/png" }), "chart.png");
    formData.append("caption", text);
    formData.append("parse_mode", "HTML");
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: formData });
    return;
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
}

async function sendLine(params: {
  chatId: string;
  replyToken?: string;
  text: string;
  chartBuffer?: Buffer | null;
  baseUrl: string;
}) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;

  const messages: Array<Record<string, unknown>> = [];
  if (params.chartBuffer) {
    const cacheId = Math.random().toString(36).slice(2, 15);
    await setCache(`line:chart:${cacheId}`, params.chartBuffer.toString("base64"), 600);
    const chartUrl = `${params.baseUrl.replace(/\/+$/, "")}/api/telegram/chart-proxy?id=${cacheId}`;
    messages.push({
      type: "image",
      originalContentUrl: chartUrl,
      previewImageUrl: chartUrl,
    });
  }
  messages.push({ type: "text", text: cleanLineText(params.text) });

  const endpoint = params.replyToken
    ? "https://api.line.me/v2/bot/message/reply"
    : "https://api.line.me/v2/bot/message/push";
  const payload = params.replyToken
    ? { replyToken: params.replyToken, messages }
    : { to: params.chatId, messages };

  await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as DispatchBody;
  const text = body.text?.trim();
  const chatId = body.chat_id;

  if (!text || !chatId) {
    return NextResponse.json({ ok: false, error: "Missing text or chat_id" }, { status: 400 });
  }

  const origin = body.base_url || new URL(req.url).origin;
  const reply = await generateBotReply(text, { baseUrl: origin, chatId });
  if (!reply) {
    return NextResponse.json({ ok: true, handled: false });
  }

  if (body.platform === "line") {
    await sendLine({
      chatId: String(chatId),
      replyToken: body.reply_token,
      text: reply.text,
      chartBuffer: reply.chartBuffer || null,
      baseUrl: origin,
    });
  } else {
    await sendTelegram(chatId, reply.text, reply.chartBuffer || null);
  }

  return NextResponse.json({ ok: true, handled: true });
}
