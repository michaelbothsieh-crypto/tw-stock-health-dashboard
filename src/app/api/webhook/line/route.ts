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

                // --- [ 新增：LazyTube 整合邏輯 ] ---
                const ytRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+)/i;
                const ytMatch = userText.match(ytRegex);

                if (ytMatch || userText.startsWith("/nlm")) {
                    const videoUrl = ytMatch ? ytMatch[1] : userText.split(" ")[1];
                    const customPrompt = userText.startsWith("/nlm") ? userText.split(" ").slice(2).join(" ") : "";
                    const chat_id = event.source.userId || "";

                    if (videoUrl) {
                        // 1. 立即回覆 LINE 使用者
                        await client.replyMessage({
                            replyToken: event.replyToken,
                            messages: [{
                                type: "text",
                                text: `⏳ 已收到 YouTube 任務，正在透過 NotebookLM 進行分析...\n\n🔗 URL: ${videoUrl}\n\n完成後將自動在此回傳結果。`
                            }]
                        });

                        // 2. 轉發至 LazyTube Vercel API
                        // 注意：請確保 LAZYTUBE_API_URL 與 TG_WEBHOOK_SECRET 已設定在環境變數
                        const LAZYTUBE_URL = "https://lazy-tube-assistant.vercel.app/api/external-dispatch";
                        const SECRET = process.env.TG_WEBHOOK_SECRET || "G8jadcqb";

                        try {
                            await fetch(LAZYTUBE_URL, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": SECRET
                                },
                                body: JSON.stringify({
                                    url: videoUrl,
                                    prompt: customPrompt || "請用繁體中文列出這部影片的 5 個核心重點，並加上影片標題。",
                                    chat_id: chat_id
                                })
                            });
                            console.log("[LINE] Forwarded to LazyTube successfully");
                        } catch (forwardErr) {
                            console.error("[LINE] Forwarding to LazyTube failed:", forwardErr);
                        }
                        continue; // 處理完 YouTube 任務後跳過後續股票邏輯
                    }
                }

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
                    const isStockCmd = userText.startsWith("/tw");
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
