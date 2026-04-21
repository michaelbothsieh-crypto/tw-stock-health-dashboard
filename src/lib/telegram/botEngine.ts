
import { commandRouter } from "./CommandRouter";
import { BotReply } from "./types";

let commandsSynced = false;

async function sendMessage(chatId: string | number, text: string): Promise<number | null> {
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token) return null;
   const url = `https://api.telegram.org/bot${token}/sendMessage`;
   try {
      const res = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      });
      const data = await res.json();
      return data?.result?.message_id || null;
   } catch { return null; }
}

async function editMessage(chatId: string | number, messageId: number, text: string) {
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token) return;
   const url = `https://api.telegram.org/bot${token}/editMessageText`;
   try {
      await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      });
   } catch { }
}

async function deleteMessage(chatId: string | number, messageId: number) {
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token) return;
   const url = `https://api.telegram.org/bot${token}/deleteMessage`;
   try {
      await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      });
   } catch { }
}

async function replyWithCard(chatId: number, progressMessageId: number | null, text: string, chartBuffer: Buffer | null, chartBuffers?: Buffer[]) {
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token) return;

   const sendPhoto = async (buf: Buffer, caption?: string) => {
      const formData = new FormData();
      formData.append("chat_id", String(chatId));
      const uint8 = new Uint8Array(buf);
      formData.append("photo", new Blob([uint8], { type: "image/png" }), "chart.png");
      if (caption) {
         formData.append("caption", caption);
         formData.append("parse_mode", "HTML");
      }
      return fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: formData });
   };

   try {
      if (chartBuffers && chartBuffers.length > 0) {
         if (progressMessageId) await deleteMessage(chatId, progressMessageId);
         for (let i = 0; i < chartBuffers.length; i++) {
            await sendPhoto(chartBuffers[i], i === 0 ? text : undefined);
         }
      } else if (chartBuffer) {
         if (progressMessageId) await deleteMessage(chatId, progressMessageId);
         await sendPhoto(chartBuffer, text);
      } else {
         if (progressMessageId) {
            await editMessage(chatId, progressMessageId, text);
         } else {
            await sendMessage(chatId, text);
         }
      }
   } catch (error) {
      console.error("[BotEngine] Reply failed:", error);
   }
}

async function ensureTelegramCommandsSynced() {
   if (commandsSynced) return;
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token || token === "TEST_TOKEN") return;
   try {
      const base = `https://api.telegram.org/bot${token}`;
      await fetch(`${base}/setMyCommands`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            commands: [
               { command: "stock", description: "🔍 股號/股名：個股健檢與即時數據 (台/美股通用)" },
               { command: "hot", description: "🔥 爆紅榜：Yahoo 社群熱門瀏覽 (etf/stock)" },
               { command: "etf", description: "📊 ETF 分析：持股內容與績效表現" },
               { command: "twrank", description: "🏆 台股排行：昨日漲幅前 10 名" },
               { command: "usrank", description: "🏅 美股排行：昨日漲幅前 10 名" },
               { command: "whatis", description: "🤔 股票分析：公司簡介與近期新聞摘要" },
               { command: "roi", description: "📈 報酬計算：自訂時間段績效 (例: /roi 2330 1y)" },
               { command: "rank", description: "👑 本群熱門：群組內最受關注的股票" },
               { command: "help", description: "💡 使用幫助：顯示完整指令說明" },
            ],
         }),
      });
      commandsSynced = true;
   } catch (error) { }
}

export async function handleTelegramMessage(chatId: number, text: string, isBackgroundPush = false, options?: TelegramHandleOptions) {
   if (isBackgroundPush) return;
   const [commandRaw] = text.trim().split(/\s+/);
   const command = commandRaw.toLowerCase().split("@")[0];

   const ALLOWED_CORE = ["/stock", "/whatis", "/rank", "/roi", "/etf", "/twrank", "/usrank", "/hot"];
   if (ALLOWED_CORE.includes(command)) {
      await sendMessage(chatId, "正在搜尋資料中...");
   }

   try {
      const reply = await generateBotReply(text, { ...options, chatId: String(chatId) });
      if (reply) {
         await replyWithCard(chatId, null, reply.text, reply.chartBuffer || null, reply.chartBuffers);
      }
   } catch (error) {
      console.error("[BotEngine] handleTelegramMessage Error:", error);
      await sendMessage(chatId, "抱歉，處理資料時發生錯誤。");
   }
}

/**
 * 核心回覆生成邏輯 - 供多平台共用 (Telegram/LINE)
 */
export async function generateBotReply(text: string, options?: TelegramHandleOptions): Promise<BotReply | null> {
   const [commandRaw, ...queryParts] = text.trim().split(/\s+/);
   const command = commandRaw.toLowerCase().split("@")[0];
   const query = queryParts.join(" ").trim();

   await ensureTelegramCommandsSynced();

   // 1. 優先交由 CommandRouter 處理 (重構後的指令)
   const routedReply = await commandRouter.route(command, { command, query, chatId: options?.chatId, baseUrl: options?.baseUrl });
   if (routedReply) return routedReply;

   return null;
}

// 相容性導出 (若其他地方有用到)
export { resolveCodeFromInputLocal } from "./utils";
export type TelegramHandleOptions = { baseUrl?: string; chatId?: string | number; };
