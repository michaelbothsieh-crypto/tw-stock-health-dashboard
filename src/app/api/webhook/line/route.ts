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

                // 立即過濾非指令訊息，不留 Log
                if (!userText.startsWith("/")) {
                    continue;
                }

                console.log(`[LINE Webhook] Command detected: ${userText}`);

                // --- [ 新增：LazyTube 整合邏輯 - 僅限 /nlm 指令 ] ---
                if (userText.startsWith("/nlm")) {
                    const parts = userText.split(/\s+/); // 分割指令、網址、[prompt]
                    const videoUrl = parts[1];
                    const customPrompt = parts.slice(2).join(" ");
                    
                    // 修正：支援群組與個人 ID 提取
                    let chat_id = "";
                    if (event.source.type === 'group') chat_id = event.source.groupId;
                    else if (event.source.type === 'room') chat_id = event.source.roomId;
                    else if (event.source.type === 'user') chat_id = event.source.userId;

                    if (videoUrl && (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be"))) {
                        // 1. 啟動 LINE 讀取中動畫 (僅提供動態回饋，不發送文字氣泡以達成零殘留)
                        try {
                            await fetch(`https://api.line.me/v2/bot/chat/loading/start`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${config.channelAccessToken}`
                                },
                                body: JSON.stringify({ chatId: chat_id, loadingSeconds: 60 })
                            });
                        } catch (e) { console.error("Loading animation failed", e); }

                        // 2. 轉發至 LazyTube Vercel API
                        const LAZYTUBE_URL = "https://lazy-tube-assistant.vercel.app/api/external-dispatch";
                        const SECRET = process.env.TG_WEBHOOK_SECRET || "G8jadcqb";

                        try {
                            console.log(`[LINE] Forwarding to: ${LAZYTUBE_URL} with Secret: ${SECRET.substring(0, 3)}...`);
                            const response = await fetch(LAZYTUBE_URL, {
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
                            
                            const resData = await response.json();
                            console.log("[LINE] LazyTube Response:", response.status, resData);
                            
                            if (response.status !== 200) {
                                console.error("[LINE] Forwarding failed with status:", response.status);
                            }
                        } catch (forwardErr) {
                            console.error("[LINE] Forwarding to LazyTube failed:", forwardErr);
                        }
                        continue; 
                    } else {
                        await client.replyMessage({
                            replyToken: event.replyToken,
                            messages: [{
                                type: "text",
                                text: "❌ <b>格式錯誤</b>\n請使用：<code>/nlm &lt;YouTube網址&gt; [指令]</code>"
                            }]
                        });
                        continue;
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
