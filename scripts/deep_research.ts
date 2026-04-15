import { renderResearchHtml } from "../src/lib/ux/researchHtmlBuilder";
import { renderResearchImage } from "../src/lib/ux/researchRenderer";
import { setCache } from "../src/lib/providers/redisCache";
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
const APP_BASE_URL = process.env.APP_BASE_URL || "https://tw-stock-health-dashboard.vercel.app";

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
  const prompt = `你是一位專業的財經分析師。請針對股票「${ticker}」過去 30 天在各大社群與網路的深度討論進行總結。

以下是剛抓取回來的精華資訊（也可能包含 Tavily 的新聞備援資料）：
<BEGIN_DATA>
${researchContent}
</END_DATA>

【⚠️ 絕對防捏造禁令】：
1. 你的分析「必須完全且僅能」依據上方 <BEGIN_DATA> 內的資訊。
2. 若上方的資料為空、全部都是錯誤，或者只包含 "*To be synthesized by assistant*"，請停止猜測！你必須直接在報告中表明：「由於社群平台目前沒有針對此股票近期有意義的討論，或遭到網路爬蟲阻擋，因此本次無法提供可靠的社群情緒與論點分析。」
3. 嚴禁憑空捏造不存在的 Reddit 用戶 (例如 stockanalyst2020) 或 X 用戶 (例如 finance_insider)，也嚴禁猜測最新的財報發布。請保持 100% 誠實，沒資料就說沒資料。

請提供一份客觀且專業的繁體中文報告，建議包含以下結構（若沒有資料，請直接回答無資料的免責聲明）：
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

async function sendLine(to: string, text: string, imageBuffer?: Buffer) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return;
  const url = "https://api.line.me/v2/bot/message/push";
  const cleanText = text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  
  const messages: any[] = [{ type: "text", text: cleanText }];

  if (imageBuffer) {
    const cacheId = Math.random().toString(36).substring(2, 15);
    // 快取 10 分鐘，將 Buffer 轉為 Base64 存入 Redis
    await setCache(`line:chart:${cacheId}`, imageBuffer.toString("base64"), 600);
    const chartUrl = `${APP_BASE_URL.replace(/\/+$/, "")}/api/telegram/chart-proxy?id=${cacheId}`;
    messages.push({
      type: "image",
      originalContentUrl: chartUrl,
      previewImageUrl: chartUrl,
    });
  }

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ to, messages })
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
    
    // 如果抓出來的文本極短，或根本沒有網址，代表 100% 被擋了或沒有資料
    const isEmptyData = researchMarkdown.length < 300 || !researchMarkdown.includes("http");
    
    if (isEmptyData) {
      console.log("last30days-skill returned virtually empty results (likely 403 Blocked). Triggering Tavily fallback...");
      const fallbackResults = await tavilySearch(`${ticker} 股票 社群討論 最新消息`);
      const fallbackContext = fallbackResults.map((r: any, i: number) => `[Fallback ${i+1}]: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join("\n\n");
      researchMarkdown += `\n\n[Tavily 備援擴充資料]\n${fallbackContext}`;
    }

    // 2. 透過內建 Fallback AI 進行最終總結
    const reportText = await aiSummarize(ticker, researchMarkdown);
    
    if (platform === "TG" || platform === "LINE") {
      const htmlBuffer = await renderResearchHtml(ticker, reportText || "");
      const caption = `📊 <b>${ticker} 深度研調報告已完成</b>`;
      
      if (platform === "TG") {
        await sendTelegramDocument(chatId, htmlBuffer, caption);
        if (msgIdToDel) {
          await deleteTelegramMessage(chatId, msgIdToDel);
        }
      } else {
        // Line 使用類似 TG 的方式發送，但 API 限制需注意
        // 由於 Line 不支援直接傳送檔案訊息給一般用戶 (除非用 Flex/網頁連結)，
        // 為了確保一定收得到，我們先改為傳送 HTML 內容網址或檔案連結
        await sendLine(chatId, `🔍 <b>${ticker} 深度研調報告已完成</b>\n點擊下方連結閱讀報告：\n${APP_BASE_URL}/api/report/research?ticker=${ticker}`);
      }
    }
    
    console.log("Research completed and sent.");
  } catch (err: any) {
    console.error("Research failed:", err);
  }
}

main();
