import fs from "fs";
import path from "path";
import { format, subDays } from "date-fns";
import { getWatchlist } from "../src/lib/config/watchlistParser";
import { fetchRecentBars } from "../src/lib/range";
import {
  getInstitutionalInvestors,
  getMarginShort,
  getMonthlyRevenue,
  getTaiwanStockNews,
  InstitutionalInvestor,
  MarginShort,
  MonthlyRevenue,
  TaiwanStockNews,
} from "../src/lib/providers/finmind";
import { getCompanyNameZh } from "../src/lib/companyName";
import { calculateTrend } from "../src/lib/signals/trend";
import { calculateFlow } from "../src/lib/signals/flow";
import { calculateFundamental } from "../src/lib/signals/fundamental";
import { calculateCatalystScore } from "../src/lib/news/catalystScore";
import { calculateShortTermVolatility } from "../src/lib/signals/shortTermVolatility";
import { calculateShortTermSignals } from "../src/lib/signals/shortTerm";
import { predictProbabilities } from "../src/lib/predict/probability";
import { getCalibrationModel } from "../src/lib/predict/calibration";
import { generateStrategy } from "../src/lib/strategy/strategyEngine";
import { calculateConsistency } from "../src/lib/consistency";
import {
  buildNewsFlag,
  buildStanceText,
  formatPct,
  formatPrice,
  humanizeNumber,
  parseSignedNumberLoose,
} from "../src/lib/telegram/formatters";

type ReportNews = {
  title: string;
  date: string;
  impact: "BULLISH" | "BEARISH" | "NEUTRAL";
  link?: string;
};

type WatchRow = {
  symbol: string;
  nameZh: string;
  price: number | null;
  changePct: string;
  flowTotal: string;
  tomorrowTrend: string;
  upProb1D: number | null;
  upProb3D: number | null;
  upProb5D: number | null;
  strategySignal: string;
  strategyConfidence: number | null;
  majorNews: ReportNews[];
  majorNewsSummary: string;
  predText: string;
  probText: string;
  h3Text: string;
  h5Text: string;
  detailStr: string;
  dataReady: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatChangePct(current: number, prev: number): string {
  if (!Number.isFinite(current) || !Number.isFinite(prev) || prev === 0) return "N/A";
  const pct = ((current - prev) / prev) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function formatSignedNumber(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${Math.round(value).toLocaleString("zh-TW")}`;
}

function decideTomorrowTrend(upProb1D: number): string {
  if (upProb1D >= 58) return "偏多";
  if (upProb1D <= 42) return "偏空";
  return "中立";
}

function extractInstitutionNetToday(today: string, investors: InstitutionalInvestor[]): number {
  return investors
    .filter((item) => item.date === today)
    .reduce((acc, item) => acc + (item.buy - item.sell), 0);
}

function pickMajorNews(newsItems: TaiwanStockNews[], latestDate: string): ReportNews[] {
  const catalyst = calculateCatalystScore(newsItems, new Date(latestDate), 7);
  const merged = [...catalyst.topBullishNews, ...catalyst.topBearishNews]
    .sort((a, b) => Math.abs(b.weightedScore) - Math.abs(a.weightedScore))
    .slice(0, 2)
    .map((item) => ({
      title: item.title,
      date: item.date,
      impact: item.impact,
      link: item.link,
    }));

  if (merged.length > 0) return merged;

  return catalyst.timeline.slice(0, 2).map((item) => ({
    title: item.title,
    date: item.date,
    impact: item.impact,
    link: item.link,
  }));
}

async function buildRow(symbol: string): Promise<WatchRow> {
  const nameZh = (await getCompanyNameZh(symbol)) || symbol;

  const fallback: WatchRow = {
    symbol,
    nameZh,
    price: null,
    changePct: "N/A",
    flowTotal: "N/A",
    tomorrowTrend: "中立",
    upProb1D: null,
    upProb3D: null,
    upProb5D: null,
    strategySignal: "觀察",
    strategyConfidence: null,
    majorNews: [],
    majorNewsSummary: "無重大新聞",
    predText: "中立",
    probText: "N/A",
    h3Text: "N/A",
    h5Text: "N/A",
    detailStr: "",
    dataReady: false,
  };

  try {
    const bars = await fetchRecentBars(symbol, 180);
    const prices = bars.data;
    if (prices.length < 2) return fallback;

    const latest = prices[prices.length - 1];
    const prev = prices[prices.length - 2];
    const latestDate = latest.date;

    const flowStartDate = format(subDays(new Date(latestDate), 120), "yyyy-MM-dd");
    const fundamentalStartDate = format(subDays(new Date(latestDate), 540), "yyyy-MM-dd");
    const newsStartDate = format(subDays(new Date(latestDate), 7), "yyyy-MM-dd");

    const [investorsRes, marginRes, revenueRes, newsRes] = await Promise.all([
      getInstitutionalInvestors(symbol, flowStartDate, latestDate).catch(() => ({ data: [] as InstitutionalInvestor[] })),
      getMarginShort(symbol, flowStartDate, latestDate).catch(() => ({ data: [] as MarginShort[] })),
      getMonthlyRevenue(symbol, fundamentalStartDate, latestDate).catch(() => ({ data: [] as MonthlyRevenue[] })),
      getTaiwanStockNews(symbol, newsStartDate, latestDate).catch(() => ({ data: [] as TaiwanStockNews[] })),
    ]);

    const investors = investorsRes.data;
    const margin = marginRes.data;
    const revenue = revenueRes.data;
    const news = newsRes.data;

    const trend = calculateTrend(prices);
    const flow = calculateFlow(prices.map((p) => p.date), investors, margin);
    const fundamental = calculateFundamental(revenue);
    const catalyst = calculateCatalystScore(news, new Date(latestDate), 7);
    const shortVol = calculateShortTermVolatility(prices);
    const shortTerm = calculateShortTermSignals(prices, trend, shortVol);
    const calibration = await getCalibrationModel(["2330", "2317", "2454", "3231"]);

    const predictions = predictProbabilities({
      trendScore: trend.trendScore,
      flowScore: flow.flowScore,
      fundamentalScore: fundamental.fundamentalScore,
      catalystScore: catalyst.catalystScore,
      volatilityScore: shortVol.volatilityScore,
      shortTermOpportunityScore: shortTerm.shortTermOpportunityScore,
      pullbackRiskScore: shortTerm.pullbackRiskScore,
      volumeSpike: shortVol.volumeSpike,
      gap: shortVol.gap,
      calibration,
    });

    const consistency = calculateConsistency({
      trendScore: trend.trendScore,
      flowScore: flow.flowScore,
      fundamentalScore: fundamental.fundamentalScore,
      catalystScore: catalyst.catalystScore,
      shortTermOpportunityScore: shortTerm.shortTermOpportunityScore,
      upProb5D: predictions.upProb5D,
    });

    const riskFlags = [
      ...trend.risks,
      ...flow.risks,
      ...fundamental.risks,
      ...shortTerm.breakdown.riskFlags,
    ];

    const strategy = generateStrategy({
      trendScore: trend.trendScore,
      flowScore: flow.flowScore,
      fundamentalScore: fundamental.fundamentalScore,
      catalystScore: catalyst.catalystScore,
      volatilityScore: shortVol.volatilityScore,
      shortTermOpportunityScore: shortTerm.shortTermOpportunityScore,
      pullbackRiskScore: shortTerm.pullbackRiskScore,
      breakoutScore: shortTerm.breakoutScore,
      upProb1D: predictions.upProb1D,
      upProb3D: predictions.upProb3D,
      upProb5D: predictions.upProb5D,
      bigMoveProb3D: predictions.bigMoveProb3D,
      consistencyScore: consistency.score,
      riskFlags,
    });

    const upProb1D = clamp(predictions.upProb1D, 0, 100);
    const upProb3D = clamp(predictions.upProb3D, 0, 100);
    const upProb5D = clamp(predictions.upProb5D, 0, 100);
    const tomorrowTrend = decideTomorrowTrend(upProb1D);

    const instNetToday = extractInstitutionNetToday(latestDate, investors);
    const flowTotal = formatSignedNumber(instNetToday);

    const majorNews = pickMajorNews(news, latestDate);
    const majorNewsSummary = majorNews.length > 0 ? majorNews.map((n) => n.title).join(" | ") : "無重大新聞";

    const detailStr = [
      `### ${nameZh} (${symbol})`,
      `- 收盤：${latest.close.toFixed(2)} (${formatChangePct(latest.close, prev.close)})`,
      `- 法人淨買賣：${flowTotal}`,
      `- 短線方向：${tomorrowTrend} (1D 上漲機率 ${upProb1D.toFixed(1)}%)`,
      `- 3D/5D：${upProb3D.toFixed(1)}% / ${upProb5D.toFixed(1)}%`,
      `- 策略訊號：${strategy.signal} (信心 ${strategy.confidence.toFixed(1)}%)`,
      `- 新聞：${majorNews.length > 0 ? majorNews[0].title : "無"}`,
    ].join("\n");

    return {
      symbol,
      nameZh,
      price: latest.close,
      changePct: formatChangePct(latest.close, prev.close),
      flowTotal,
      tomorrowTrend,
      upProb1D,
      upProb3D,
      upProb5D,
      strategySignal: strategy.signal,
      strategyConfidence: strategy.confidence,
      majorNews,
      majorNewsSummary,
      predText: tomorrowTrend,
      probText: `${upProb1D.toFixed(1)}%`,
      h3Text: `${upProb3D.toFixed(1)}%`,
      h5Text: `${upProb5D.toFixed(1)}%`,
      detailStr,
      dataReady: true,
    };
  } catch (error) {
    console.warn(`[DailyReport] ${symbol} failed:`, error);
    return fallback;
  }
}

function buildMarkdown(dateText: string, rows: WatchRow[]): string {
  let md = `# 每日收盤總覽 (${dateText})\n\n`;
  md += "| 股票 | 收盤 | 漲跌幅 | 法人淨買賣 | 結論 | 1D | 3D | 5D | 新聞 |\n";
  md += "|---|---:|---:|---:|---|---:|---:|---:|---|\n";

  for (const row of rows) {
    md += `| ${row.nameZh}(${row.symbol}) | ${row.price === null ? "N/A" : row.price.toFixed(2)} | ${row.changePct} | ${row.flowTotal} | ${buildStanceText(row.tomorrowTrend, row.strategySignal, row.strategyConfidence)} | ${row.upProb1D === null ? "N/A" : `${row.upProb1D.toFixed(1)}%`} | ${row.upProb3D === null ? "N/A" : `${row.upProb3D.toFixed(1)}%`} | ${row.upProb5D === null ? "N/A" : `${row.upProb5D.toFixed(1)}%`} | ${row.majorNews.length > 0 ? row.majorNews[0].title : "無"} |\n`;
  }

  md += "\n---\n\n";
  for (const row of rows) {
    md += `${row.detailStr || `### ${row.nameZh} (${row.symbol})\n- 資料不足`}\n\n`;
  }

  return md;
}

function buildTelegramSummary(dateText: string, rows: WatchRow[]): string {
  const lines: string[] = [];
  lines.push(`📊 每日收盤總覽 (${dateText})`);
  lines.push("");

  for (const row of rows) {
    const closeText = formatPrice(row.price, 2);
    const chgText = row.changePct || "—";
    const flowValue = parseSignedNumberLoose(row.flowTotal);
    const flowHuman = humanizeNumber(flowValue);
    const stance = buildStanceText(row.tomorrowTrend, row.strategySignal, row.strategyConfidence);
    const confText = formatPct(row.strategyConfidence, 1);
    const firstNews = row.majorNews.length > 0 ? row.majorNews[0].title : "";
    const newsFlag = buildNewsFlag(firstNews);

    lines.push(
      `${row.symbol} ${row.nameZh} 收盤${closeText}(${chgText})｜法人${flowHuman}｜結論${stance}(${confText})｜新聞${newsFlag}`,
    );
  }

  return lines.join("\n");
}

async function generateReport() {
  const watchlist = getWatchlist();
  if (watchlist.length === 0) {
    throw new Error("WATCHLIST_TW is empty. Please set WATCHLIST_TW in Actions variables/secrets.");
  }

  console.log(`[DailyReport] Watchlist (${watchlist.length}): ${watchlist.join(",")}`);

  const rows: WatchRow[] = [];
  for (const symbol of watchlist) {
    console.log(`[DailyReport] Processing ${symbol}`);
    rows.push(await buildRow(symbol));
  }

  const timezone = process.env.REPORT_TIMEZONE || "Asia/Taipei";
  const dateText = new Date().toLocaleString("en-CA", { timeZone: timezone }).split(",")[0];
  const shouldWriteFiles = (process.env.REPORT_WRITE_FILES || "false").toLowerCase() !== "false";

  if (shouldWriteFiles) {
    const markdown = buildMarkdown(dateText, rows);
    const reportsDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const mdPath = path.join(reportsDir, `${dateText}.md`);
    const jsonPath = path.join(reportsDir, `${dateText}-watchlist.json`);

    fs.writeFileSync(mdPath, markdown, "utf-8");
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          date: dateText,
          watchlist: rows,
        },
        null,
        2,
      ),
      "utf-8",
    );

    console.log(`[DailyReport] Generated: ${mdPath}`);
    console.log(`[DailyReport] Generated: ${jsonPath}`);
  } else {
    console.log("[DailyReport] REPORT_WRITE_FILES=false, skipping reports/* output");
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    const { handleTelegramMessage } = await import("../src/lib/telegram/botEngine");
    const tgMessage = buildTelegramSummary(dateText, rows);
    await handleTelegramMessage(0, tgMessage, true);
    console.log("[DailyReport] Telegram push done");
  }
}

generateReport().catch((error) => {
  console.error("[DailyReport] Fatal:", error);
  process.exit(1);
});
