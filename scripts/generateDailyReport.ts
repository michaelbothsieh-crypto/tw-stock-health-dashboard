
import fs from "fs";
import path from "path";
import { getWatchlist } from "@/infrastructure/config/watchlistParser";
import { SnapshotService } from "@/services/SnapshotService";
import {
  buildStanceText,
  formatPrice,
  humanizeNumber,
} from "@/shared/utils/formatters";

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
  majorNews: string;
  detailStr: string;
};

async function buildRow(symbol: string): Promise<WatchRow | null> {
  try {
    const snap = await SnapshotService.getSnapshot(symbol, { mode: "full" });
    if (!snap) return null;

    const s = snap.signals;
    const p = snap.predictions;
    
    // 取得法人淨額
    const instNet = snap.insiderTransfers?.length || 0; // 暫時以此代替，或從 signals 取
    const flowVal = snap.signals?.flow?.flowScore || 0;

    const row: WatchRow = {
      symbol: snap.normalizedTicker.symbol,
      nameZh: snap.normalizedTicker.companyNameZh || snap.normalizedTicker.symbol,
      price: snap.realTimeQuote.price,
      changePct: `${snap.realTimeQuote.changePct >= 0 ? "+" : ""}${snap.realTimeQuote.changePct.toFixed(2)}%`,
      flowTotal: flowVal.toString(),
      tomorrowTrend: snap.playbook?.technicalTrend || "中立",
      upProb1D: snap.predictions.upProb1D,
      upProb3D: snap.predictions.upProb3D,
      upProb5D: snap.predictions.upProb5D,
      strategySignal: snap.strategy.signal,
      strategyConfidence: snap.strategy.confidence,
      majorNews: snap.news.topBullishNews?.[0]?.title || snap.news.timeline?.[0]?.title || "無重大新聞",
      detailStr: snap.playbook?.shortSummary || ""
    };

    return row;
  } catch (error) {
    console.warn(`[DailyReport] ${symbol} failed:`, error);
    return null;
  }
}

function buildMarkdown(dateText: string, rows: WatchRow[]): string {
  let md = `# 每日收盤總覽 (${dateText})\n\n`;
  md += "| 股票 | 收盤 | 漲跌幅 | 結論 | 1D | 3D | 5D | 新聞 |\n";
  md += "|---|---:|---:|---|---:|---:|---:|---|\n";

  for (const row of rows) {
    md += `| ${row.nameZh}(${row.symbol}) | ${row.price?.toFixed(2)} | ${row.changePct} | ${buildStanceText(row.tomorrowTrend, row.strategySignal, row.strategyConfidence)} | ${row.upProb1D?.toFixed(1)}% | ${row.upProb3D?.toFixed(1)}% | ${row.upProb5D?.toFixed(1)}% | ${row.majorNews} |\n`;
  }

  md += "\n---\n\n";
  for (const row of rows) {
    md += `### ${row.nameZh} (${row.symbol})\n- ${row.detailStr}\n\n`;
  }
  return md;
}

async function generateReport() {
  const watchlist = getWatchlist();
  if (watchlist.length === 0) throw new Error("WATCHLIST_TW is empty.");

  const rows: WatchRow[] = [];
  for (const symbol of watchlist) {
    const row = await buildRow(symbol);
    if (row) rows.push(row);
  }

  const dateText = new Date().toLocaleString("en-CA", { timeZone: "Asia/Taipei" }).split(",")[0];
  const markdown = buildMarkdown(dateText, rows);
  
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, `${dateText}.md`), markdown, "utf-8");

  if (process.env.TELEGRAM_BOT_TOKEN) {
     const { handleTelegramMessage } = await import("@/features/telegram/botEngine");
     await handleTelegramMessage(0, `📝 每日盤後報告已生成 (${dateText})，請至儀表板查看詳情。`, true);
  }
}

generateReport().catch(console.error);
