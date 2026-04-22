
import { subMonths } from "date-fns";
import { yf as yahooFinance } from "@/infrastructure/providers/yahooFinanceClient";
import { getTvLatestNewsHeadline } from "@/infrastructure/providers/tradingViewFetch";
import { renderStockChart, ChartDataPoint } from "@/shared/utils/chartRenderer";
import { fetchTradingViewRating, TV_RATING_ZH } from "@/infrastructure/providers/tradingViewRating";
import { buildNewsLine, calcSupportResistance } from "@/shared/utils/formatters";
import { getFirstNewsTitle, getRichNewsList, isWithinDays } from "@/shared/utils/news";
import { StockCard } from "./types";

export class JapanStockService {
   static async fetchLiveCard(ticker: string, _baseUrl?: string, _skipHeavy = false, skipQuote = false): Promise<StockCard | null> {
      const cleanTicker = ticker.toUpperCase().includes(".T") ? ticker.toUpperCase() : `${ticker.toUpperCase()}.T`;
      const symbol = cleanTicker;
      
      try {
         const sixMonthsAgo = subMonths(new Date(), 6);
         const [rtQuoteRaw, tvNews, assetProfile, chartRes] = await Promise.all([
            yahooFinance.quote(symbol).catch(() => null),
            getTvLatestNewsHeadline(symbol),
            yahooFinance.quoteSummary(symbol, { modules: ["assetProfile"] }).catch(() => null),
            yahooFinance.chart(symbol, { period1: sixMonthsAgo }).catch(() => null)
         ]);

         const rtQuote: any = Array.isArray(rtQuoteRaw) ? rtQuoteRaw[0] : rtQuoteRaw;
         if (!rtQuote || rtQuote.regularMarketPrice === undefined) return null;

         const history = chartRes?.quotes || [];
         const bars = history.map((b: any) => ({
            date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : String(b.date).split('T')[0],
            open: b.open ?? b.close,
            high: b.high ?? b.close,
            low: b.low ?? b.close,
            close: b.close,
            volume: b.volume || 0
         })).filter((b: any) => b.close !== undefined && b.close !== null);

         // 日股名稱處理：保持極簡，避免長全名
         let displayName = symbol;
         const rawName = rtQuote?.longName || rtQuote?.shortName || "";
         if (rawName && rawName.length < 15 && rawName.toUpperCase() !== symbol) {
            displayName = `${symbol} ${rawName}`;
         }

         const card: StockCard = {
            symbol,
            nameZh: displayName,
            close: rtQuote.regularMarketPrice,
            chgPct: rtQuote.regularMarketChangePercent || null,
            chgAbs: rtQuote.regularMarketChange || null,
            volume: rtQuote.regularMarketVolume || null,
            volumeVs5dPct: null, flowNet: null, flowUnit: "股", shortDir: "中立", strategySignal: "觀察", confidence: null,
            p1d: null, p3d: null, p5d: null, 
            support: null, resistance: null,
            bullTarget: null, bearTarget: null, overseas: [], syncLevel: "—", newsLine: "—", sourceLabel: "yahoo", insiderSells: [], chartBuffer: null,
            industry: assetProfile?.assetProfile?.sector || "—",
            historyBars: bars
         };

         const key = calcSupportResistance(bars);
         card.support = key.support;
         card.resistance = key.resistance;

         if (card.close !== null) {
            const todayStr = new Date().toLocaleDateString('en-CA');
            const plotBars = [...bars];
            if (plotBars.length > 0) {
               const last = plotBars[plotBars.length - 1];
               if (last.date === todayStr) last.close = card.close;
               else plotBars.push({ date: todayStr, open: card.close, high: card.close, low: card.close, close: card.close, volume: card.volume || 0 });
            } else {
               plotBars.push({ date: todayStr, open: card.close, high: card.close, low: card.close, close: card.close, volume: card.volume || 0 });
            }
            if (plotBars.length >= 2) {
               card.chartBuffer = await renderStockChart(plotBars as ChartDataPoint[], card.support, card.resistance, card.symbol, 180).catch(() => null);
            }
         }

         const [yahooSearchRes, yahooSearchByName] = await Promise.all([
            yahooFinance.search(symbol).catch(() => null),
            card.nameZh && card.nameZh !== symbol ? yahooFinance.search(card.nameZh).catch(() => null) : Promise.resolve(null)
         ]);

         const combinedNewsRaw = [
            ...(Array.isArray((yahooSearchRes as any)?.news) ? (yahooSearchRes as any).news : []),
            ...(Array.isArray((yahooSearchByName as any)?.news) ? (yahooSearchByName as any).news : [])
         ];

         const recentNewsRaw = combinedNewsRaw.filter(item => 
            isWithinDays(item.pubdate || item.pubDate || item.date || item.providerPublishTime, 3)
         );

         card.recentNews = getRichNewsList(recentNewsRaw, symbol, true).slice(0, 8);
         
         if (tvNews && !card.recentNews.some(n => n.includes(tvNews))) {
            card.recentNews.unshift(tvNews);
         }

         const fallbackNews = getFirstNewsTitle(recentNewsRaw, symbol, true);
         card.newsLine = buildNewsLine(tvNews || fallbackNews, 96);
         if (card.newsLine === "—" || !card.newsLine) card.newsLine = "無三天內新聞";

         if (!skipQuote) {
            const rating = await fetchTradingViewRating(symbol, 'japan');
            card.tvRating = TV_RATING_ZH[rating];
         }

         return card;
      } catch { return null; }
   }
}
