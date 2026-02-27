import fs from "fs";
import path from "path";
import { getWatchlist } from "../src/lib/config/watchlistParser";
import { runBacktest } from "../src/lib/predict/backtest";
import { fetchRecentBars } from "../src/lib/range";
import { getInstitutionalInvestors } from "../src/lib/providers/finmind";
import { getCompanyNameZh } from "../src/lib/companyName";
import { calculateTrend } from "../src/lib/signals/trend";
import { calculateFlow } from "../src/lib/signals/flow";
import { calculateConsistency } from "../src/lib/consistency";
import { calculateShortTermVolatility } from "../src/lib/signals/shortTermVolatility";
import { calculateShortTermSignals } from "../src/lib/signals/shortTerm";
import { generateStrategy } from "../src/lib/strategy/strategyEngine";

function interpretSignalScore(score: number): { text: string; risk: string } {
  if (score >= 4) return { text: "偏多", risk: "乖離率若過高，提防近期洗盤。" };
  if (score >= 1) return { text: "微多", risk: "訊號偏弱，提防反轉風險。" };
  if (score <= -2) return { text: "偏空", risk: "空方成形，注意下行風險。" };
  return { text: "中立", risk: "缺乏明確方向，觀望為主。" };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatHitRate(hits: number, total: number): string {
  if (total < 10) return "樣本不足";
  const pct = Math.round((hits / total) * 100);
  return `${pct}% (${hits}/${total})`;
}

async function generateReport() {
  const watchlist = getWatchlist();
  console.log(`[DailyReport] Loaded watchlist with ${watchlist.length} symbols:`, watchlist);

  const windowDays = Number(process.env.BACKTEST_WINDOW) || 120;

  type RowData = {
    symbol: string;
    nameZh: string;
    price: number | null;
    changePct: string;
    flowTotal: string;
    predText: string;
    probText: string;
    h3Text: string;
    h5Text: string;
    detailStr: string;
  };

  const results: RowData[] = [];

  for (const sym of watchlist) {
    console.log(`[DailyReport] Processing ${sym}...`);
    const nameZh = await getCompanyNameZh(sym);

    // Default placeholders
    let price: number | null = null;
    let changePct = "—";
    let flowTotal = "—";
    let predText = "—";
    let probText = "—";
    let h3Text = "—";
    let h5Text = "—";
    let detailStr = "";

    try {
      // 1. Fetch recent bars (need enough to calculate signals)
      const barsRes = await fetchRecentBars(sym, 60);
      const prices = barsRes.data;
      if (prices.length >= 2) {
        price = prices[prices.length - 1].close;
        const prevClose = prices[prices.length - 2].close;
        const pctObj = ((price - prevClose) / prevClose) * 100;
        changePct = (pctObj >= 0 ? "+" : "") + pctObj.toFixed(1) + "%";
      }

      // 2. Fetch Institutional Flow
      let foreignScore = 0;
      let trustScore = 0;
      let dealerScore = 0;
      let volumeScore = 0;

      let flowReady = false;
      let foreignVal = 0;
      let trustVal = 0;
      let dealerVal = 0;

      if (prices.length >= 5) {
        const startDate = prices[prices.length - 5].date;
        const endDate = prices[prices.length - 1].date;
        const flowRes = await getInstitutionalInvestors(sym, startDate, endDate);

        const todayDate = endDate;
        const flowToday = flowRes.data.filter((t: any) => t.date === todayDate);

        const foreign = flowToday.find((t: any) => t.name.includes("外資及陸資"));
        const trust = flowToday.find((t: any) => t.name === "投信");
        const dealer = flowToday.find((t: any) => t.name.includes("自營商"));

        if (foreign) { foreignVal = (foreign.buy - foreign.sell) / 1000; foreignScore = foreignVal > 0 ? 2 : (foreignVal < 0 ? -2 : 0); }
        if (trust) { trustVal = (trust.buy - trust.sell) / 1000; trustScore = trustVal > 0 ? 2 : (trustVal < 0 ? -2 : 0); }
        if (dealer) { dealerVal = (dealer.buy - dealer.sell) / 1000; dealerScore = dealerVal > 0 ? 1 : (dealerVal < 0 ? -1 : 0); }

        const last5Foreign = flowRes.data.filter((t: any) => t.name.includes("外資及陸資"));
        const sum5D = last5Foreign.reduce((acc: number, f: any) => acc + (f.buy - f.sell), 0);
        const fNet5DScore = sum5D > 0 ? 1 : (sum5D < 0 ? -1 : 0);

        const tVol = prices[prices.length - 1].Trading_Volume || 0;
        const yVol = prices[prices.length - 2].Trading_Volume || 0;
        if (price !== null && prices[prices.length - 2].close) {
          const tClose = price;
          const yClose = prices[prices.length - 2].close;
          if (tClose > yClose && tVol > yVol) volumeScore = 1;
          if (tClose < yClose && tVol > yVol) volumeScore = -1;
        }

        const totalScore = foreignScore + trustScore + dealerScore + fNet5DScore + volumeScore;
        const { text: direction, risk } = interpretSignalScore(totalScore);
        const probability = clamp(50 + totalScore * 8, 35, 85);

        const totalVolK = Math.round(foreignVal + trustVal + dealerVal);
        flowTotal = (totalVolK > 0 ? "+" : "") + totalVolK.toLocaleString();

        if (flowToday.length > 0) {
          flowReady = true;
          predText = direction;
          probText = `${probability}%`;

          // Calculate Consistency briefly
          const tr = calculateTrend(prices);
          const fl = calculateFlow(prices.map(p => p.date), flowRes.data, []);
          const cn = calculateConsistency({
            trendScore: tr.trendScore,
            flowScore: fl.flowScore,
            fundamentalScore: 50,
            catalystScore: 0,
            shortTermOpportunityScore: 50,
            upProb5D: probability
          });

          const bt = await runBacktest(sym, windowDays);
          h3Text = formatHitRate(bt.h3.hits, bt.h3.total);
          h5Text = formatHitRate(bt.h5.hits, bt.h5.total);

          detailStr = `> **[${sym}] ${nameZh || "未知"}** 收盤 ${price} (${changePct})
> 三大法人：外資 ${(foreignVal).toFixed(0)}k / 投信 ${(trustVal).toFixed(0)}k / 自營 ${dealerVal.toFixed(0)}k
> 一致性：${cn.level} (${cn.consensusDirection})
> 預測方向：${direction === "微多" ? "偏多" : direction} (${probText})
> 回測：3日命中 ${h3Text} | 5日命中 ${h5Text}
> ⚠️ 風險：${risk}`;

        }
      }

      if (!flowReady && price !== null) {
        predText = "—";
        probText = "—";
        detailStr = `> **[${sym}] ${nameZh || "未知"}** 收盤 ${price} (${changePct})
> 資料不足（法人未完整更新），暫無預測`;
      }

    } catch (e: any) {
      console.warn(`[DailyReport] Error on ${sym}:`, e.message);
      detailStr = `> **[${sym}] ${nameZh || "未知"}**
> 資料提取失敗，暫無預測`;
    }

    results.push({
      symbol: sym,
      nameZh: nameZh || "未知",
      price,
      changePct,
      flowTotal,
      predText,
      probText,
      h3Text,
      h5Text,
      detailStr
    });
  }

  // --- Compile Markdown & JSON ---
  const todayStr = new Date().toLocaleString("en-CA", { timeZone: process.env.REPORT_TIMEZONE || "Asia/Taipei" }).split(",")[0];
  let md = `# 每日台股健康診斷 - ${todayStr}\n\n`;

  // Overview Table
  md += `| 代號 | 股名 | 今日% | 法人合計(張) | 預測 | 機率 | 3D勝率 | 5D勝率 |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;
  for (const r of results) {
    md += `| ${r.symbol} | ${r.nameZh} | ${r.changePct} | ${r.flowTotal} | ${r.predText === "微多" ? "偏多" : r.predText} | ${r.probText} | ${r.h3Text} | ${r.h5Text} |\n`;
  }
  md += `\n---\n\n## 標的詳情\n\n`;

  for (const r of results) {
    md += `${r.detailStr}\n\n`;
  }

  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Write MD
  const outFile = path.join(reportsDir, `${todayStr}.md`);
  fs.writeFileSync(outFile, md, "utf-8");

  // Write JSON
  const outJsonFile = path.join(reportsDir, `${todayStr}-watchlist.json`);
  const jsonPayload = {
    date: todayStr,
    watchlist: results
  };
  fs.writeFileSync(outJsonFile, JSON.stringify(jsonPayload, null, 2), "utf-8");

  console.log(`[DailyReport] Report generated successfully at ${outFile} and ${outJsonFile}!`);

  // --- Push to Telegram ---
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const { handleTelegramMessage } = require("../src/lib/telegram/botEngine");
    console.log(`[DailyReport] Pushing overview to Telegram via unified handleTelegramMessage...`);
    let tgMsg = `📊 *每日收盤極簡總覽* (${todayStr})\n\n`;
    for (const r of results) {
      if (r.predText === "—") {
        tgMsg += `• ${r.nameZh}(${r.symbol}) ${r.changePct} ⚠️ 資料不足(法人不完整)\n`;
      } else {
        const dirText = r.predText === "微多" ? "偏多" : r.predText;
        tgMsg += `• ${r.nameZh}(${r.symbol}) ${r.changePct}｜法人${r.flowTotal}｜${dirText} ${r.probText}｜3D ${r.h3Text.split(" ")[0]}｜5D ${r.h5Text.split(" ")[0]}\n`;
      }
    }

    try {
      // Use the common engine. In this mode, chatId passed (0) is ignored because isBackgroundPush is true
      await handleTelegramMessage(0, tgMsg, true);
      console.log(`[DailyReport] Successfully pushed to Telegram!`);
    } catch (e: any) {
      console.warn(`[DailyReport] Telegram push error:`, e.message);
    }
  } else {
    console.log(`[DailyReport] No Telegram credentials found, skipping push.`);
  }
}

generateReport().catch(console.error);
