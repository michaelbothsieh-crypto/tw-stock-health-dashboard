import { NextRequest, NextResponse } from "next/server";
import { generateBotReply } from "@/lib/telegram/botEngine";
import * as line from "@line/bot-sdk";

// LINE credentials
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
};

const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken,
});

export async function POST(req: NextRequest) {
    try {
        // 1. Get raw body string for signature validation
        const rawBody = await req.text();
        const signature = req.headers.get("x-line-signature") || "";
        const origin = new URL(req.url).origin;

        // 2. Validate signature
        if (!line.validateSignature(rawBody, config.channelSecret, signature)) {
            console.error("[LINE Webhook] Invalid signature. Secret length:", config.channelSecret?.length);
            return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
        }

        // 3. Parse JSON body
        const body = JSON.parse(rawBody);
        const events: line.WebhookEvent[] = body.events;

        if (!events || events.length === 0) {
            return NextResponse.json({ status: "success" }, { status: 200 });
        }

        // 4. Process each event
        for (const event of events) {
            try {
                if (event.type !== "message" || event.message.type !== "text") {
                    continue;
                }

                const userText = event.message.text.trim();
                console.log(`[LINE Webhook] Processing text from user: ${userText}`);

                // Only respond to recognized commands or text starting with '/'
                if (!userText.startsWith("/")) {
                    continue;
                }

                // Generate reply using the extracted botEngine logic
                const reply = await generateBotReply(userText, { baseUrl: origin });

                if (reply) {
                    // Strip HTML tags for LINE plain text format
                    const cleanReply = reply.text
                        .replace(/<[^>]*>?/gm, "")
                        .replace(/\*/g, "");

                    const messages: line.messagingApi.Message[] = [];

                    // LINE 需要公開 HTTPS URL 才能傳圖，使用 /api/stock/{ticker}/chart 端點
                    const isStockCmd = userText.startsWith("/stock") || userText.startsWith("/tw");
                    if (isStockCmd && reply.chartBuffer) {
                        // 從指令解析 ticker，例如 "/tw 2330" → "2330"
                        const parts = userText.trim().split(/\s+/);
                        const rawTicker = parts[1]?.toUpperCase();
                        if (rawTicker) {
                            const chartUrl = `${origin}/api/stock/${rawTicker}/chart`;
                            messages.push({
                                type: "image",
                                originalContentUrl: chartUrl,
                                previewImageUrl: chartUrl,
                            } as line.messagingApi.ImageMessage);
                        }
                    }

                    messages.push({
                        type: "text",
                        text: cleanReply,
                    });

                    // Send reply to LINE user
                    await client.replyMessage({
                        replyToken: event.replyToken,
                        messages,
                    });
                    console.log(`[LINE Webhook] Successfully replied to ${userText}`);
                }
            } catch (eventErr) {
                console.error("[LINE Webhook] Error processing specific event:", eventErr);
                // Continue to next event
            }
        }

        return NextResponse.json({ status: "success" }, { status: 200 });

    } catch (error) {
        console.error("[LINE Webhook] Error processing event:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
