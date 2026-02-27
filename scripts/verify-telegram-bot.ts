import * as botEngine from "../src/lib/telegram/botEngine";

let sentMessages: string[] = [];
const originalFetch = global.fetch;

const mockReportData = {
  date: "2026-02-27",
  watchlist: [
    {
      symbol: "2330",
      nameZh: "台積電",
      price: 1020.5,
      changePct: "+1.20%",
      flowTotal: "+12,345",
      tomorrowTrend: "偏多",
      upProb1D: 61.2,
      upProb3D: 58.4,
      upProb5D: 63.1,
      strategySignal: "偏多",
      strategyConfidence: 71.5,
      majorNews: [
        {
          title: "先進製程需求回溫，外資調高目標價",
          impact: "BULLISH",
        },
      ],
    },
    {
      symbol: "8299",
      nameZh: "群聯",
      price: 525.0,
      changePct: "-1.80%",
      flowTotal: "-1,200",
      tomorrowTrend: "中立",
      upProb1D: 49.3,
      upProb3D: 52.1,
      upProb5D: 50.4,
      strategySignal: "觀察",
      strategyConfidence: 56.2,
      majorNews: [],
      majorNewsSummary: "無重大新聞",
    },
  ],
};

function getLastMessage() {
  return sentMessages[sentMessages.length - 1] || "";
}

global.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = url.toString();

  if (urlStr.includes("api.telegram.org") && urlStr.includes("/sendMessage")) {
    const body = JSON.parse((init?.body as string) || "{}");
    sentMessages.push(String(body.text || ""));
    return new Response(JSON.stringify({ ok: true, result: { message_id: sentMessages.length } }), {
      status: 200,
    }) as unknown as Response;
  }

  if (urlStr.includes("api.telegram.org") && urlStr.includes("/editMessageText")) {
    const body = JSON.parse((init?.body as string) || "{}");
    if (sentMessages.length > 0) {
      sentMessages[sentMessages.length - 1] = String(body.text || "");
    } else {
      sentMessages.push(String(body.text || ""));
    }
    return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 }) as unknown as Response;
  }

  if (urlStr.includes("api.github.com/repos/")) {
    return new Response(
      JSON.stringify([{ name: "2026-02-27-watchlist.json", download_url: "mock_url" }]),
      { status: 200 },
    ) as unknown as Response;
  }

  if (urlStr === "mock_url") {
    return new Response(JSON.stringify(mockReportData), { status: 200 }) as unknown as Response;
  }

  return originalFetch(url, init);
}) as typeof global.fetch;

process.env.GITHUB_OWNER = "test";
process.env.GITHUB_REPO = "test";
process.env.TELEGRAM_BOT_TOKEN = "TEST_TOKEN";

async function runTests() {
  console.log("=== Telegram Bot Engine 驗證 ===");

  sentMessages = [];
  await botEngine.handleTelegramMessage(12345, "/help");
  const helpOutput = getLastMessage();
  if (!helpOutput.includes("目前僅支援 /stock")) {
    throw new Error(`/help should be disabled. Output: ${helpOutput}`);
  }
  console.log("✅ /help disabled");

  sentMessages = [];
  await botEngine.handleTelegramMessage(12345, "/daily");
  const dailyOutput = getLastMessage();
  if (!dailyOutput.includes("目前僅支援 /stock")) {
    throw new Error(`/daily should be disabled. Output: ${dailyOutput}`);
  }
  console.log("✅ /daily disabled");

  sentMessages = [];
  await botEngine.handleTelegramMessage(12345, "/stock 2330");
  const stockOutput = getLastMessage();
  if (
    !stockOutput.includes("2330 台積電") ||
    !stockOutput.includes("收盤：") ||
    !stockOutput.includes("結論：") ||
    !stockOutput.includes("新聞：")
  ) {
    throw new Error(`/stock by symbol failed. Output: ${stockOutput}`);
  }
  console.log("✅ /stock 2330");

  sentMessages = [];
  await botEngine.handleTelegramMessage(12345, "/stock 台積電");
  const stockByNameOutput = getLastMessage();
  if (!stockByNameOutput.includes("2330 台積電")) {
    throw new Error(`/stock by name failed. Output: ${stockByNameOutput}`);
  }
  console.log("✅ /stock 台積電");

  sentMessages = [];
  await botEngine.handleTelegramMessage(12345, "/watchlist");
  const watchlistOutput = getLastMessage();
  if (!watchlistOutput.includes("目前僅支援 /stock")) {
    throw new Error(`/watchlist should be disabled. Output: ${watchlistOutput}`);
  }
  console.log("✅ /watchlist disabled");

  console.log("✅ All bot checks passed");
}

runTests()
  .catch((error) => {
    console.error("❌ 驗證失敗:", error);
    process.exit(1);
  })
  .finally(() => {
    global.fetch = originalFetch;
  });
