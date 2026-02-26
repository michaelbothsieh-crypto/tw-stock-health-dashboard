import { getWatchlist } from "../src/lib/config/watchlistParser";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

async function verifyDailyReportEngine() {
  console.log("=== 每日報告產生器 & 回測引擎自動驗收 ===");

  // 1. 驗證 ENV Watchlist 解析 (CSV)
  process.env.WATCHLIST_TW = "2330, 0050, 2317, 999999 "; // Includes spaces and garbage
  let parsed = getWatchlist();
  if (parsed.length !== 4) {
    throw new Error(`CSV Parsing failed, expected 4 items, got: ${parsed.length} => ${parsed}`);
  }
  if (!parsed.includes("0050") || !parsed.includes("999999")) throw new Error("Missing items in CSV parse");
  console.log("✅ CSV 環境變數解析正常");

  // 2. 驗證 ENV Watchlist 解析 (JSON)
  process.env.WATCHLIST_TW = '["1101", "2881"]';
  parsed = getWatchlist();
  if (parsed[0] !== "1101" || parsed[1] !== "2881") {
    throw new Error("JSON Parsing failed");
  }
  console.log("✅ JSON 環境變數解析正常");

  // 3. 測試產生報表
  // Set ENV and run process
  const testDateStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Taipei" }).split(",")[0];
  const testReportPath = path.join(process.cwd(), "reports", `${testDateStr}.md`);
  
  // Clean up previous runs if any
  if (fs.existsSync(testReportPath)) fs.unlinkSync(testReportPath);

  console.log("⏳ 執行報告產生器 (測試單筆 2330 + 120 Days)...");
  
  execSync('export WATCHLIST_TW="2330" && export BACKTEST_WINDOW="120" && npx tsx scripts/generateDailyReport.ts', {
    stdio: 'inherit'
  });

  if (!fs.existsSync(testReportPath)) {
     throw new Error("Markdown 報告未生成於 reports/");
  }

  const content = fs.readFileSync(testReportPath, "utf-8");
  
  if (!content.includes("2330")) throw new Error("報告未包含 2330 股票代號");
  if (!content.includes("三大法人：外資")) throw new Error("報告缺少三大法人欄位");
  if (!content.includes("3D勝率")) throw new Error("總覽表缺少勝率預測欄位");
  if (!content.includes("回測：3日命中") && !content.includes("資料不足")) {
     throw new Error("回測命中率字串未產生");
  }

  // Check language (Ensure No Simplified Chinese common chars)
  if (content.match(/[个这发账]/g)) {
     throw new Error("報告內含有簡體字 (个 这 发 账)");
  }

  console.log("✅ Markdown 報告生成與格式檢查正常，包含回測命中率！");
  console.log("🎉 All Tests Passed!");
}

verifyDailyReportEngine().catch(e => {
  console.error("❌ 驗證失敗:", e);
  process.exit(1);
});
