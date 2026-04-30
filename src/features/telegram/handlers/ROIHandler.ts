
import { CommandHandler, CommandContext, BotReply } from "@/features/telegram/types";
import { StockService } from "@/services/StockService";
import { twStockNames } from "@/data/twStockNames";
import { formatSignedPct } from "@/shared/utils/formatters";
import { renderMultiRoiChart } from "@/shared/utils/chartRenderer";
import { subMonths, subYears, parseISO } from "date-fns";
import { yf as yahooFinance } from "@/infrastructure/providers/yahooFinanceClient";
import { resolveCodeFromInputLocal, normalizeTicker } from "@/shared/utils/ticker";

function dateKey(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

function normalizeRoiHistory(
  quotes: { date: Date; close: number }[],
  liveClose: number,
): { date: Date; close: number }[] {
  const validQuotes = quotes
    .filter(q => q.date instanceof Date && !isNaN(q.date.getTime()))
    .filter(q => Number.isFinite(q.close) && q.close > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (!Number.isFinite(liveClose) || liveClose <= 0) return validQuotes;

  const todayKey = dateKey(new Date());
  const last = validQuotes[validQuotes.length - 1];
  if (last && dateKey(last.date) === todayKey) {
    validQuotes[validQuotes.length - 1] = { ...last, close: liveClose };
  } else {
    validQuotes.push({ date: new Date(), close: liveClose });
  }

  return validQuotes;
}

export class ROIHandler implements CommandHandler {
  canHandle(command: string): boolean {
    return command === "/roi";
  }

  async handle(ctx: CommandContext): Promise<BotReply | null> {
    const { query } = ctx;
    let [tickerRaw, periodRaw] = query.split(/\s+/);
    if (!tickerRaw || !periodRaw) return { text: "用法: /roi 股票代號 時間(1m, 3m, 6m, 1y, ytd, 或 YYYY-MM-DD)" };

    tickerRaw = tickerRaw.replace(/[,，]+$/, "").trim();
    periodRaw = periodRaw.replace(/[,，]+$/, "").trim();
    const rawTickers = tickerRaw.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean).slice(0, 10);
    const tickers = rawTickers.map(t => {
      const resolved = /^[0-9A-Z]{2,6}(\.TW|\.TWO)?$/i.test(t) ? t : resolveCodeFromInputLocal(t);
      return (resolved || t).toUpperCase();
    });
    
    let startDate: Date;
    const period = periodRaw.toLowerCase();
    if (period === "1m") startDate = subMonths(new Date(), 1);
    else if (period === "3m") startDate = subMonths(new Date(), 3);
    else if (period === "6m") startDate = subMonths(new Date(), 6);
    else if (period === "1y") startDate = subYears(new Date(), 1);
    else if (period === "ytd") startDate = new Date(new Date().getFullYear(), 0, 1);
    else {
       try {
          startDate = parseISO(periodRaw);
          if (isNaN(startDate.getTime())) throw new Error();
       } catch { return { text: "日期格式錯誤，請使用 1m, 3m, 6m, 1y, ytd 或 YYYY-MM-DD" }; }
    }

    const results = await Promise.all(tickers.map(async (ticker) => {
       const isUs = /^[A-Z]{1,5}$/.test(ticker);
       const live = isUs ? await StockService.fetchLiveUsStockCard(ticker) : await StockService.fetchLiveStockCard(ticker);
       if (!live || live.close === null) return null;

       const targetYahooSymbol = live.yahooSymbol || normalizeTicker(ticker).yahoo;
       const history = await yahooFinance.chart(targetYahooSymbol, { period1: startDate, interval: "1d" }).catch(() => null);
       let historyQuotes = normalizeRoiHistory(
          (history?.quotes || []).map((q: any) => ({ date: new Date(q.date), close: Number(q.close) })),
          live.close
       );
       
       // Fallback to historyBars from snapshot if Yahoo fails
       if (historyQuotes.length === 0 && live.historyBars && live.historyBars.length > 0) {
          const startStr = startDate.toISOString().split('T')[0];
          // Find the first bar that is on or after the start date
          const fallbackData = live.historyBars
            .map((b: any) => ({ date: new Date(b.date), close: Number(b.close) }))
            .filter((b: any) => b.date >= startDate)
            .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
          
          if (fallbackData.length > 0) {
             historyQuotes = normalizeRoiHistory(fallbackData, live.close);
          }
       }

       const firstPrice = historyQuotes[0]?.close;
       if (!firstPrice) return null;

       const pct = ((live.close - firstPrice) / firstPrice) * 100;
       return { 
          symbol: ticker, 
          pct, 
          live,
          data: historyQuotes,
          initialPrice: firstPrice
       };
       }));

       const validResults = results.filter((r): r is any => r !== null && r.data.length > 0);
       if (validResults.length === 0) return { text: "找不到指定的股票歷史資料。" };

       const chartBuffer = await renderMultiRoiChart(
       validResults.map(r => ({ symbol: r.symbol, data: r.data, initialPrice: r.initialPrice })), 
       periodRaw
       ).catch(() => null);    const textLines = validResults.map(r => {
       const isTW = /^[0-9]+$/.test(r.symbol);
       const name = twStockNames[r.symbol] || (r.live.nameZh && r.live.nameZh !== r.symbol ? r.live.nameZh : "");
       const label = (isTW && name) ? `${name}(${r.symbol})` : r.symbol;
       return `${label}: <b>${formatSignedPct(r.pct, 2)}</b>`;
    });

    return { text: `📊 <b>多檔股票報酬率對比 (${periodRaw})</b>\n\n` + textLines.join("\n"), chartBuffer };
  }
}
