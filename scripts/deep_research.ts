import { renderResearchHtml } from "../src/lib/ux/researchHtmlBuilder";
import { callLLMWithFallback } from "../src/lib/ai/base";
import { execSync } from "child_process";

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
    console.warn("Missing TAVILY_API_KEY for fallback");
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
        include_domains: ["reddit.com", "x.com", "news.ycombinator.com", "youtube.com", "bloomberg.com", "cnbc.com", "finance.yahoo.com"],
        max_results: 10,
        days: 30
      })
    });
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.error("Tavily search fallback failed:", e);
    return [];
  }
}

async function runLast30DaysSkill(ticker: string): Promise<string> {
  console.log(`Running last30days-skill for ${ticker}...`);
  try {
    // 呼叫 Github Checkout 下載回來的 last30days 新元件
    const output = execSync(`python3 last30days-skill/scripts/last30days.py "${ticker} 股票" --emit=md --quick`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "inherit"], // 將錯誤與進度直接吐到 GHA 的日誌裡
      env: process.env
    });
    return output;
  } catch (error: any) {
    console.error("last30days-skill failed:", error.message);
    if (error.stdout) console.error("STDOUT:", error.stdout);
    return "無法抓取最近 30 天的資料。";
  }
}

async function aiSummarize(ticker: string, researchContent: string) {
  const prompt = `你是一位專業的財經分析師。請針對股票「${ticker}」過去 30 天在社群平台 (Reddit, X, YouTube) 及財經新聞上的討論進行深度研調總結。

以下是使用專屬 last30days 研調元件抓取回來的最新精華資訊：
${researchContent}

請提供一份繁體中文報告，包含以下結構：
1. 📈 **整體社群情緒** (看多/看空/中立，並說明原因)
2. 🔥 **熱議焦點 (Top 3)** (列出過去 30 天討論度最高的三個技術點、利多或利空訊息)
3. 💬 **社群精選觀點** (摘錄 3-5 個代表性的社群論點，並標註來源類型如 Reddit 或 X)
4. 💡 **分析師總結** (結合社群風向與已知訊息的最後綜合建議)

請直接輸出內容，不要包含額外的對話。`;

  // 使用具有容錯與動態切換模型能力的新元件
  return await callLLMWithFallback<string>(prompt, { temperature: 0.2, timeout: 30000 });
}

async function sendTelegramDocument(chatId: string, documentBuffer: Buffer, caption: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
  
  const uint8Array = new Uint8Array(documentBuffer);
  const docBlob = new Blob([uint8Array], { type: "text/html" });
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("document", docBlob, `DeepResearch_${new Date().toISOString().split('T')[0]}.html`);
  formData.append("caption", caption);
  formData.append("parse_mode", "HTML");

  const res = await fetch(url, { method: "POST", body: formData });
  const response = await res.json();
  if (!res.ok) {
    console.error("Telegram sendDocument failed:", response);
  }
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
    // 1. 使用 last30days-skill 元件爬取並整理 Markdown 格式
    let researchMarkdown = await runLast30DaysSkill(ticker);
    
    // 如果 last30days 因為缺乏 API Key 被 Reddit 阻擋而抓不到東西，自動降級切換到 Tavily 繼續抓！
    if (researchMarkdown.includes("Reddit: 0 threads, X: 0 posts") || researchMarkdown.includes("無法抓取")) {
      console.log("last30days-skill returned empty results due to missing keys or 403 blocks. Falling back to Tavily...");
      const fallbackResults = await tavilySearch(`${ticker} 股票 社群討論 最新消息`);
      const fallbackContext = fallbackResults.map((r: any, i: number) => `[Fallback ${i+1}]: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join("\n\n");
      researchMarkdown += `\n\n[Tavily 備援擴充資料]\n${fallbackContext}`;
    }

    // 2. 透過內建 Fallback AI 進行最終總結
    const reportText = await aiSummarize(ticker, researchMarkdown);
    
    if (platform === "TG") {
      const htmlBuffer = await renderResearchHtml(ticker, reportText || "");
      const caption = `📊 <b>${ticker} 深度研調報告已完成</b>\n備註：點擊上方 HTML 檔案開啟漂亮網頁版報告！`;
      await sendTelegramDocument(chatId, htmlBuffer, caption);
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

