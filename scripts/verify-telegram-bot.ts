import * as botEngine from "../src/lib/telegram/botEngine";
import * as fetcher from "../src/lib/telegram/reportFetcher";

// Create a spy/mock out of sendMessage instead of really hitting Telegram
let sentMessages: string[] = [];

// We actually need to intercept sendMessage inside botEngine, since it's not exported
// A cleaner way for the test is to mock fetch globally.
const originalFetch = global.fetch;

global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = url.toString();
  
  if (urlStr.includes("api.telegram.org")) {
    const body = JSON.parse(init?.body as string);
    sentMessages.push(body.text);
    return new Response("ok", { status: 200 }) as unknown as Response;
  }
  
  // Real fetch for other stuff
  return originalFetch(url, init);
};

// Mock fetchLatestReport so we don't hit GitHub API every test run
const mockReportData = {
  date: "2026-02-26",
  watchlist: [
    {
      symbol: "2330",
      nameZh: "台積電",
      price: 685,
      changePct: "+1.78%",
      flowTotal: "+13345",
      predText: "微多",
      probText: "66%",
      h3Text: "58% (11/19)",
      h5Text: "62% (10/16)",
      detailStr: "> **[2330] 台積電** 收盤 685 (+1.78%)\n> 三大法人：外資 +12345k / 投信 +1234k / 自營 -234k\n> 一致性：強 (⬆️)\n> 預測方向：偏多 (66%)\n> 回測：3日命中 58% (11/19) | 5日命中 62% (10/16)\n> ⚠️ 風險：外資買盤強勁，留意投信結帳"
    },
    {
      symbol: "8299",
      nameZh: "群聯",
      price: null,
      changePct: "—",
      flowTotal: "—",
      predText: "—",
      probText: "—",
      h3Text: "—",
      h5Text: "—",
      detailStr: "⚠️ 測試缺失資料"
    }
  ]
};

// Instead of mutating the module export, we will spy on the internal fetch for github api,
// but since `fetchLatestReport` calls global.fetch anyway, we can just intercept github API there too!
global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = url.toString();
  
  if (urlStr.includes("api.telegram.org")) {
    const body = JSON.parse(init?.body as string);
    sentMessages.push(body.text);
    return new Response("ok", { status: 200 }) as unknown as Response;
  }

  // Intercept the github raw JSON fetch
  if (urlStr.includes("api.github.com/repos/")) {
    // Just mock that there is one json
    return new Response(JSON.stringify([{ name: "2026-02-26-watchlist.json", download_url: "mock_url" }]), { status: 200 }) as unknown as Response;
  }

  if (urlStr === "mock_url") {
    return new Response(JSON.stringify(mockReportData), { status: 200 }) as unknown as Response;
  }
  
  // Real fetch for other stuff
  return originalFetch(url, init);
};

// Inject fake env for test
process.env.GITHUB_OWNER = "test";
process.env.GITHUB_REPO = "test";
process.env.TELEGRAM_BOT_TOKEN = "TEST_TOKEN";

async function runTests() {
  console.log("=== Telegram Bot Engine 自動驗收 ===");

  // 1. Test /help
  sentMessages = [];
  await botEngine.handleTelegramMessage(12345, "/help");
  if (!sentMessages[0].includes("診斷 - 小幫手")) throw new Error("/help failed");
  console.log("✅ /help 解析正常");

  // 2. Test /daily
  sentMessages = [];
  await botEngine.handleTelegramMessage(12345, "/daily");
  const dailyOutput = sentMessages[0];
  if (!dailyOutput.includes("極簡總覽") || !dailyOutput.includes("台積電(2330)") || !dailyOutput.includes("偏多 66%")) {
    throw new Error(`/daily failed parsing JSON correctly. Output: ${dailyOutput}`);
  }
  // Check missing data parsing
  if (!dailyOutput.includes("群聯(8299) — ⚠️ 資料不足(法人不完整)")) {
    throw new Error(`/daily failed handling missing data row. Output: ${dailyOutput}`);
  }
  console.log("✅ /daily JSON 遍歷與極簡格式正常");

  // 3. Test /stock 2330
  sentMessages = [];
  await botEngine.handleTelegramMessage(12345, "/stock 2330");
  const sOutput = sentMessages[0];
  if (!sOutput.includes("2330 台積電") || !sOutput.includes("回測：3日 58%") || !sOutput.includes("風險：外資買盤強勁")) {
    throw new Error(`/stock id failed detail card generation. Output: ${sOutput}`);
  }
  console.log("✅ /stock [代碼] 單檔搜尋與明細解析正常");

  // 4. Test /stock 文字搜尋
  sentMessages = [];
  await botEngine.handleTelegramMessage(12345, "/stock 台積");
  const tOutput = sentMessages[0];
  if (!tOutput.includes("2330 台積電")) {
    throw new Error(`/stock name failed detail card generation. Output: ${tOutput}`);
  }
  console.log("✅ /stock [中文名稱] 模糊搜尋正常");

  // 5. Test Simplified Chinese guard in generate reports
  const content = dailyOutput + sOutput;
  if (content.match(/[个这发账]/g)) {
     throw new Error("Bot Output 含有簡體字 (个 这 发 账)");
  }

  console.log("🎉 Bot Webhook All Tests Passed!");
}

runTests().catch(e => {
  console.error("❌ 驗證失敗:", e);
  process.exit(1);
});
