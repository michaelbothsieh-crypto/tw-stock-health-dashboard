import { NextRequest, NextResponse } from "next/server";
import * as line from "@line/bot-sdk";

import { generateBotReply, resolveCodeFromInputLocal, triggerDeepResearchGHAction } from "@/lib/telegram/botEngine";

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

function getSecureBaseUrl(origin: string): string {
  const envBase = process.env.APP_BASE_URL || process.env.BOT_BASE_URL;
  const base = envBase ? envBase.replace(/\/+$/, "") : origin.replace(/\/+$/, "");
  // LINE 強制要求 https，確保開頭是 https
  return base.replace(/^http:\/\//i, "https://");
}

const LAZYTUBE_URL =
  process.env.LAZYTUBE_EXTERNAL_DISPATCH_URL ||
  "https://lazy-tube-assistant.vercel.app/api/external-dispatch";
const LAZYTUBE_SECRET = process.env.TG_WEBHOOK_SECRET || "G8jadcqb";
const DEFAULT_LAZYTUBE_PROMPT = "請用繁體中文列出這支影片的 5 個核心重點。";

function getChatId(source: line.WebhookEvent["source"]): string {
  if (source.type === "group") {
    return source.groupId;
  }
  if (source.type === "room") {
    return source.roomId;
  }
  if (source.type === "user") {
    return source.userId;
  }
  return "";
}

async function startLoadingAnimation(userId?: string) {
  if (!userId) {
    return;
  }

  try {
    await fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.channelAccessToken}`,
      },
      body: JSON.stringify({ chatId: userId, loadingSeconds: 60 }),
    });
  } catch (error) {
    console.error("[LINE] Loading animation failed:", error);
  }
}

async function forwardToLazyTube(params: {
  chatId: string;
  command: "help" | "nlm" | "pic" | "note" | "slide";
  url?: string;
  prompt?: string;
}) {
  const response = await fetch(LAZYTUBE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: LAZYTUBE_SECRET,
    },
    body: JSON.stringify({
      chat_id: params.chatId,
      command: params.command,
      url: params.url,
      prompt: params.prompt,
    }),
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { response, data };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-line-signature") || "";
    const origin = new URL(req.url).origin;

    if (!line.validateSignature(rawBody, config.channelSecret, signature)) {
      console.error(
        "[LINE Webhook] Invalid signature. Secret length:",
        config.channelSecret?.length,
      );
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const body = JSON.parse(rawBody);
    const events: line.WebhookEvent[] = body.events;

    if (!events || events.length === 0) {
      return NextResponse.json({ status: "success" }, { status: 200 });
    }

    for (const event of events) {
      try {
        if (event.type === "follow") {
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text:
                  "👋 歡迎使用 LazyTube & Stock 助手！\n\n" +
                  "您可以透過以下指令與我互動：\n\n" +
                  "📊 股票查詢：\n" +
                  "輸入 /tw <代號> (例：/tw 2330)\n" +
                  "輸入 /etf <代號> (例：/etf 0050)\n" +
                  "輸入 /research <代號> (深入研調)\n" +
                  "輸入 /rank (熱門排行)\n" +
                  "輸入 /roi <代號> <時間> (績效分析)\n\n" +
                  "🎥 影片工具：\n" +
                  "輸入 /nlm <YouTube網址>\n" +
                  "輸入 /pic <YouTube網址>\n" +
                  "輸入 /note <YouTube網址>\n" +
                  "輸入 /slide <YouTube網址>\n\n" +
                  "輸入 /help 可隨時查看完整說明。",
              },
            ],
          });
          continue;
        }

        if (event.type !== "message" || event.message.type !== "text") {
          continue;
        }

        const userText = event.message.text.trim();
        if (!userText.startsWith("/")) {
          continue;
        }

// 移除 console.log("[LINE Webhook] Command detected: ${userText}");

        const chatId = getChatId(event.source);

        if (userText === "/help" || userText.toLowerCase() === "help") {
          const { response } = await forwardToLazyTube({
            chatId,
            command: "help",
          });

          if (response.status !== 200) {
            await client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: "text",
                  text: "目前無法取得 help 說明，請稍後再試。",
                },
              ],
            });
          }
          continue;
        }

        if (userText === "/my_id") {
          const userId = event.source.userId || "無法取得 ID";
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: `您的 LINE User ID 是：\n${userId}`,
              },
            ],
          });
          continue;
        }

        const lazyTubeMatch = userText.match(/^\/(nlm|pic|note|slide)\b/i);
        if (lazyTubeMatch) {
          const command = lazyTubeMatch[1].toLowerCase() as
            | "nlm"
            | "pic"
            | "note"
            | "slide";
          const parts = userText.split(/\s+/);
          const videoUrl = parts[1];
          const customPrompt = parts.slice(2).join(" ");

          if (!videoUrl || !videoUrl.startsWith("http")) {
            await client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: "text",
                  text: `格式錯誤\n請使用：${command === "nlm" ? "/nlm" : `/${command}`} <網址>`,
                },
              ],
            });
            continue;
          }

          await startLoadingAnimation(event.source.type === "user" ? event.source.userId : undefined);

          try {
            const { response } = await forwardToLazyTube({
              chatId,
              command,
              url: videoUrl,
              prompt: customPrompt || DEFAULT_LAZYTUBE_PROMPT,
            });

            if (response.status === 403) {
              await client.pushMessage({
                to: chatId,
                messages: [
                  {
                    type: "text",
                    text:
                      "權限不足\n" +
                      "請先輸入 /my_id 取得您的 LINE ID，並交給管理員加入白名單後再使用。\n\n" +
                      `目前 chat_id: ${chatId}`,
                  },
                ],
              });
            } else if (response.status !== 200) {
              await client.pushMessage({
                to: chatId,
                messages: [
                  {
                    type: "text",
                    text: "轉發到 LazyTube 失敗，請稍後再試。",
                  },
                ],
              });
            }
          } catch (error) {
            console.error("[LINE] Forwarding to LazyTube failed:", error);
            await client.pushMessage({
              to: chatId,
              messages: [
                {
                  type: "text",
                  text: "轉發到 LazyTube 時發生錯誤，請稍後再試。",
                },
              ],
            });
          }
continue;
}

const reply = await generateBotReply(userText, { baseUrl: origin, chatId });
        if (!reply) {
          continue;
        }

        const cleanReply = reply.text
          .replace(/<b>(.*?)<\/b>/gi, "$1") // 移除 <b> 標籤並保留內容
          .replace(/<br\s*\/?>/gi, "\n")    // <br> → 換行
          .replace(/<[^>]+>/g, "")          // 移除其餘 HTML 標籤
          .replace(/&amp;/g, "&")           // 解 HTML entities
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\*/g, "");
        const messages: line.messagingApi.Message[] = [];
        
        const isRoiOrRank = userText.startsWith("/roi") || userText.startsWith("/rank");
        const secureBase = getSecureBaseUrl(origin);

        // 處理動態圖表 (Buffer)
        if (reply.chartBuffer) {
          const { setCache } = await import("@/lib/providers/redisCache");
          const cacheId = Math.random().toString(36).substring(2, 15);
          // 快取 10 分鐘，將 Buffer 轉為 Base64 存入 Redis
          await setCache(`line:chart:${cacheId}`, reply.chartBuffer.toString("base64"), 600);
          
          const chartUrl = `${secureBase}/api/telegram/chart-proxy?id=${cacheId}`;
          messages.push({
            type: "image",
            originalContentUrl: chartUrl,
            previewImageUrl: chartUrl,
          } as line.messagingApi.ImageMessage);
        }

        // 總是發送文字訊息
        messages.push({
          type: "text",
          text: cleanReply,
        });

        // 特殊處理 /research：觸發 GitHub Action
        if (userText.startsWith("/research")) {
          const query = userText.split(/\s+/).slice(1).join(" ").trim();
          const symbol = resolveCodeFromInputLocal(query) || query.toUpperCase();
          await triggerDeepResearchGHAction(symbol, chatId, "LINE");
        }

        if (messages.length > 0) {
          await client.replyMessage({
            replyToken: event.replyToken,
            messages,
          });
        }
// 移除 console.log("[LINE Webhook] Successfully replied to ${userText}");
      } catch (eventErr) {
        console.error("[LINE Webhook] Error processing specific event:", eventErr);
      }
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error) {
    console.error("[LINE Webhook] Error processing event:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
