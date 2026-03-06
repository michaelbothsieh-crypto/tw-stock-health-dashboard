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
                // --- [ 處理加入好友事件 ] ---
                if (event.type === "follow") {
                    await client.replyMessage({
                        replyToken: event.replyToken,
                        messages: [{
                            type: "text",
                            text: "👋 歡迎使用 LazyTube & Stock 助手！\n\n您可以透過以下指令與我互動：\n\n📊 股票查詢：\n輸入 /tw <代號> (例：/tw 2330)\n\n🎥 影片摘要：\n輸入 /nlm <YouTube網址>\n\n輸入 /help 可隨時查看此說明。"
                        }]
                    });
                    continue;
                }

                if (event.type !== "message" || event.message.type !== "text") {
                    continue;
                }

                const userText = event.message.text.trim();

                // 立即過濾非指令訊息，不留 Log
                if (!userText.startsWith("/")) {
                    continue;
                }

                console.log(`[LINE Webhook] Command detected: ${userText}`);

                // --- [ 處理 /help 指令 ] ---
                if (userText === "/help" || userText.toLowerCase() === "help") {
                    await client.replyMessage({
                        replyToken: event.replyToken,
                        messages: [{
                            type: "text",
                            text: "🤖 助手指令手冊\n\n1️⃣ 查詢台股資訊\n格式：/tw <股票代號>\n範例：/tw 2330\n\n2️⃣ AI 影片摘要 (需開通)\n格式：/nlm <YouTube網址>\n⚠️ 注意：使用前請先輸入 /my_id 取得您的 ID，並傳送給管理員開通權限後方可使用。\n\n💡 提示：隨選摘要通常需要 1-2 分鐘處理時間。"
                        }]
                    });
                    continue;
                }

                // --- [ 處理 /my_id 指令 ] ---
                if (userText === "/my_id") {
                    const userId = event.source.userId || "無法取得 ID";
                    await client.replyMessage({
                        replyToken: event.replyToken,
                        messages: [{
                            type: "text",
                            text: `您的 LINE User ID 為：\n${userId}`
                        }]
                    });
                    continue;
                }

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
                        // 1. 啟動 LINE 讀取中動畫 (注意：此 API 僅支援 userId，不支援 groupId)
                        try {
                            const targetUserId = event.source.userId;
                            if (targetUserId) {
                                await fetch(`https://api.line.me/v2/bot/chat/loading/start`, {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                        "Authorization": `Bearer ${config.channelAccessToken}`
                                    },
                                    body: JSON.stringify({ chatId: targetUserId, loadingSeconds: 60 })
                                });
                            }
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
                            
                            // 修正：處理白名單被拒絕的情況
                            if (response.status === 403) {
                                await client.pushMessage({
                                    to: chat_id,
                                    messages: [{
                                        type: "text",
                                        text: "⚠️ <b>權限不足</b>\n您尚未被授權使用 AI 摘要功能。請聯繫管理員提供您的 ID：\n" + chat_id
                                    }]
                                });
                            }
                            
                            if (response.status !== 200 && response.status !== 403) {
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
