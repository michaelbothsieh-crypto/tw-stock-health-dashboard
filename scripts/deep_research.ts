import { renderResearchImage } from "../src/lib/ux/researchRenderer";
import { callLLMWithFallback } from "../src/lib/ai/base";

/**
 * 深入研調腳本 (由 GitHub Actions 執行)
 * 命令列參數: node scripts/deep_research.ts <ticker> <chatId> <platform> <msgIdToDel?>
 */

const ticker = process.argv[2];
const chatId = process.argv[3];
const platform = process.argv[4] || "TG";
const msgIdToDel = process.argv[5]; // 僅 TG 使用，完成後刪除「研調中」訊息

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function tavilySearch(query: string) {
  if (!TAVILY_API_KEY) {
    console.error("Missing TAVILY_API_KEY");
    return [];
  }
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        include_domains: ["reddit.com", "x.com", "twitter.com", "news.ycombinator.com", "youtube.com", "bloomberg.com", "reuters.com", "wsj.com", "cnbc.com", "finance.yahoo.com"],
        max_results: 10,
        days: 30
      })
    });
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.error("Tavily search failed:", e);
    return [];
  }
}

async function aiSummarize(ticker: string, searchResults: any[]) {
  const context = searchResults.map((r, i) => `[Source ${i+1}]: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join("\n\n");

  const prompt = `你是一位專業的財經分析師。請針對股票「${ticker}」過去 30 天在社群平台 (Reddit, X, YouTube, HN) 及財經新聞上的討論進行深度研調總結。

資料來源內容如下：
${context}

請提供一份繁體中文報告，包含以下結構：
1. 📈 **整體社群情緒** (看多/看空/中立，並說明原因)
2. 🔥 **熱議焦點 (Top 3)** (列出過去 30 天討論度最高的三個技術點、利多或利空訊息)
3. 💬 **社群精選觀點** (摘錄 3-5 個代表性的社群論點，並標註來源類型如 Reddit 或 X)
4. 💡 **分析師總結** (結合社群風向與已知訊息的最後綜合建議)

請直接輸出內容，不要包含額外的對話。`;

  // 使用具有容錯與動態切換模型能力的新元件
  return await callLLMWithFallback<string>(prompt, { temperature: 0.2, timeout: 30000 });
}

async function sendTelegramPhoto(chatId: string, imageBuffer: Buffer, caption: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  
  const uint8Array = new Uint8Array(imageBuffer);
  const imageBlob = new Blob([uint8Array], { type: "image/png" });
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("photo", imageBlob, "research_report.png");
  formData.append("caption", caption);
  formData.append("parse_mode", "HTML");

  await fetch(url, { method: "POST", body: formData });
}

async function deleteTelegramMessage(chatId: string, messageId: string) {
  if (!TELEGRAM_BOT_TOKEN || !messageId) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
  });
}

async function sendLine(to: string, text: string) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return;
  const url = "https://api.line.me/v2/bot/message/push";
  const cleanText = text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text: cleanText }]
    })
  });
}

async function main() {
  if (!ticker || !chatId) {
    console.error("Usage: node deep_research.ts <ticker> <chatId> <platform> [msgIdToDel]");
    return;
  }

  console.log(`Starting deep research for ${ticker}...`);
  
  try {
    const results = await tavilySearch(`${ticker} stock social media sentiment reddit x youtube last 30 days`);
    const reportText = await aiSummarize(ticker, results);
    
    if (platform === "TG") {
      const imageBuffer = await renderResearchImage(ticker, reportText || "");
      const caption = `📊 <b>${ticker} 深度研調報告已完成</b>\n掃描範圍：Reddit, X, 財經新聞 (30天)`;
      await sendTelegramPhoto(chatId, imageBuffer, caption);
      if (msgIdToDel) {
        await deleteTelegramMessage(chatId, msgIdToDel);
      }
    } else if (platform === "LINE") {
      const finalReport = `🔍 ${ticker} 深度研調報告 (Last 30 Days)\n\n${reportText}`;
      await sendLine(chatId, finalReport);
    }
    
    console.log("Research completed and sent.");
  } catch (err: any) {
    console.error("Research failed:", err);
  }
}

main();

