
import { twStockNames } from "@/data/twStockNames";
import { yf as yahooFinance } from "@/infrastructure/providers/yahooFinanceClient";
import { fetchFugleQuote } from "@/infrastructure/providers/fugleQuote";
import { getTvLatestNewsHeadline } from "@/infrastructure/providers/tradingViewFetch";
import { renderStockChart, ChartDataPoint } from "@/shared/utils/chartRenderer";
import { fetchTradingViewRating, TV_RATING_ZH } from "@/infrastructure/providers/tradingViewRating";
import { resolveCodeFromInputLocal } from "@/shared/utils/ticker";
import { buildNewsLine, calcVolumeVs5d, calcSupportResistance } from "@/shared/utils/formatters";
import { getFirstNewsTitle, getRichNewsList, getRichNewsLinks, isWithinDays } from "@/shared/utils/news";
import { StockCard } from "./types";

export class TaiwanStockService {
   static getSnapshotBaseUrl(override?: string): string {
      return override || process.env.BOT_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";
   }

   static async fetchLiveCard(query: string, overrideBaseUrl?: string, skipHeavy = false, skipQuote = false): Promise<StockCard | null> {
      const symbol = resolveCodeFromInputLocal(query);
      if (!symbol) return null;
      
      const baseUrl = this.getSnapshotBaseUrl(overrideBaseUrl);
      try {
         const snapUrl = `${baseUrl}/api/stock/${symbol}/snapshot?mode=lite`;
         const controller = new AbortController();
         const snapTimer = setTimeout(() => controller.abort(), 20000);

         const [snapRes, fugleQuote, tvNews] = await Promise.all([
            fetch(snapUrl, { signal: controller.signal }).finally(() => clearTimeout(snapTimer)),
            skipQuote ? Promise.resolve(null) : fetchFugleQuote(symbol),
            getTvLatestNewsHeadline(symbol)
         ]);
         
         if (!snapRes.ok) return null;
         const snapshot = await snapRes.json();

         let yahooSymbol = snapshot?.normalizedTicker?.yahoo;
         if (symbol === "8299") yahooSymbol = "8299.TWO";
         if (!yahooSymbol || yahooSymbol === symbol) {
            const isProbablyTPEX = /^[34568]/.test(symbol) && symbol !== "3008";
            yahooSymbol = isProbablyTPEX ? `${symbol}.TWO` : `${symbol}.TW`;
         }

         let rtQuote: any = null;
         if (!skipQuote) {
            let rtQuoteRaw = fugleQuote ? null : await yahooFinance.quote(yahooSymbol).catch(() => null);
            rtQuote = fugleQuote ? {
               regularMarketPrice: fugleQuote.price,
               regularMarketChangePercent: fugleQuote.changePct,
               regularMarketChange: fugleQuote.changeAbs,
               regularMarketVolume: fugleQuote.volume,
               regularMarketDayHigh: fugleQuote.high,
               regularMarketDayLow: fugleQuote.low,
               regularMarketOpen: fugleQuote.open,
            } : (Array.isArray(rtQuoteRaw) ? rtQuoteRaw[0] : rtQuoteRaw);
         }

         let bars = Array.isArray(snapshot?.data?.prices) ? snapshot.data.prices : [];
         let processedBars = bars.map((b: any) => ({
            date: b.date || "",
            open: Number(b.open || b.close || 0),
            high: Number(b.high || b.close || 0),
            low: Number(b.low || b.close || 0),
            close: Number(b.close || 0),
            volume: Number(b.volume || b.Trading_Volume || 0)
         }));

         const card: StockCard = {
            symbol: String(snapshot?.normalizedTicker?.symbol || symbol),
            nameZh: twStockNames[symbol] || String(snapshot?.normalizedTicker?.companyNameZh || symbol),
            close: null, chgPct: null, chgAbs: null, volume: null, volumeVs5dPct: null, flowNet: null, flowUnit: "張",
            shortDir: "中立", strategySignal: "觀察", confidence: null, p1d: null, p3d: null, p5d: null,
            support: null, resistance: null, bullTarget: null, bearTarget: null, overseas: [], syncLevel: "—", newsLine: "—", sourceLabel: "snapshot", insiderSells: [],
            chartBuffer: null, yahooSymbol, historyBars: processedBars
         };

         if (processedBars.length >= 2) {
            const latest = processedBars[processedBars.length - 1];
            const prev = processedBars[processedBars.length - 2];
            card.close = latest.close;
            card.chgAbs = latest.close - prev.close;
            card.chgPct = prev.close !== 0 ? (card.chgAbs / prev.close) * 100 : 0;
            const volInfo = calcVolumeVs5d(processedBars);
            card.volume = volInfo.volume;
            card.volumeVs5dPct = volInfo.volumeVs5dPct;
         }

         if (rtQuote && typeof rtQuote.regularMarketPrice === "number") {
            card.close = rtQuote.regularMarketPrice;
            card.chgPct = rtQuote.regularMarketChangePercent ?? card.chgPct;
            card.chgAbs = rtQuote.regularMarketChange ?? card.chgAbs;
            card.volume = rtQuote.regularMarketVolume || card.volume;
         }

         if (card.close !== null && processedBars.length > 0) {
            const lastBar = processedBars[processedBars.length - 1];
            const todayStr = new Date().toLocaleDateString('en-CA');
            if (lastBar.date === todayStr) {
               lastBar.close = card.close;
               if (card.volume) lastBar.volume = card.volume;
            } else {
               processedBars.push({ date: todayStr, open: card.close, high: card.close, low: card.close, close: card.close, volume: card.volume || 0 });
            }
         }

         const key = calcSupportResistance(processedBars);
         card.support = snapshot?.keyLevels?.supportLevel || key.support;
         card.resistance = snapshot?.keyLevels?.breakoutLevel || key.resistance;

         if (processedBars.length >= 2) {
            card.chartBuffer = await renderStockChart(processedBars as ChartDataPoint[], card.support, card.resistance, card.symbol, 180, { chgPct: card.chgPct }).catch(() => null);
         }

         card.flowNet = typeof snapshot?.signals?.flow?.foreign5D === "number" ? Math.round(snapshot.signals.flow.foreign5D / 1000) : null;
         card.p1d = snapshot?.predictions?.upProb1D;
         card.shortDir = snapshot?.predictions?.upProb1D ? (snapshot.predictions.upProb1D >= 58 ? "偏多" : snapshot.predictions.upProb1D <= 42 ? "偏空" : "中立") : "中立";
         card.strategySignal = snapshot?.strategy?.signal || "觀察";
         card.confidence = snapshot?.strategy?.confidence;
         
         const [yahooSearchRes, yahooSearchByName, fmRes] = await Promise.all([
            yahooFinance.search(yahooSymbol).catch(() => null),
            card.nameZh && card.nameZh !== symbol ? yahooFinance.search(card.nameZh).catch(() => null) : Promise.resolve(null),
            (async () => {
               const { getTaiwanStockNews } = await import("@/infrastructure/providers/finmind");
               const lastWeek = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
               return getTaiwanStockNews(symbol, lastWeek).catch(() => null);
            })()
         ]);

         const snapshotNewsRaw = snapshot?.news?.timeline || (Array.isArray(snapshot?.news) ? snapshot.news : []);
         const fmNews = (fmRes && (fmRes as any).data) ? (fmRes as any).data : [];

         const combinedNewsRaw = [
            ...snapshotNewsRaw,
            ...(Array.isArray((yahooSearchRes as any)?.news) ? (yahooSearchRes as any).news : []),
            ...(Array.isArray((yahooSearchByName as any)?.news) ? (yahooSearchByName as any).news : []),
            ...fmNews
         ];

         // 過濾出 3 天內的新聞
         const recentCombined = combinedNewsRaw.filter(item => 
            isWithinDays(item.pubdate || item.pubDate || item.date || item.providerPublishTime, 3)
         );

         const newsAliases = [symbol, card.nameZh].filter(Boolean);
         card.recentNews = getRichNewsList(recentCombined, newsAliases, false).slice(0, 10);
         card.newsLinks = getRichNewsLinks(recentCombined, 1, newsAliases, false);
         
         // 確保 TradingView 新聞也被納入
         if (tvNews && !card.recentNews.some(n => n.includes(tvNews))) {
            card.recentNews.unshift(tvNews);
         }

         const fallbackNews = getFirstNewsTitle(recentCombined, newsAliases, false);
         card.newsLine = buildNewsLine(tvNews || fallbackNews, 96);
         
         if (card.newsLine === "—" || !card.newsLine) {
            card.newsLine = "無三天內新聞";
         }
         
         if (card.newsLine === "無三天內新聞" && card.tvRating?.includes("買入")) {
            card.newsLine = `技術面動能強勁 (${card.tvRating})`;
         }
         
         card.insiderSells = snapshot?.insiderTransfers || [];
         card.flowScore = snapshot?.signals?.flow?.flowScore;
         card.macroRisk = snapshot?.crashWarning?.score;
         
         // 產業類別 (多元對位)
         const snapshotIndustry = snapshot?.globalLinkage?.profile?.sectorZh || 
                                snapshot?.industry || 
                                snapshot?.stockProfile?.sectorZh;

         const { resolveStockProfile } = await import("@/domain/industry/stockProfileResolver");
         const localProfile = await resolveStockProfile(symbol, card.nameZh).catch(() => null);
         card.industry = snapshotIndustry || localProfile?.sectorZh || "—";
         
         if (!skipQuote) {
            const rating = await fetchTradingViewRating(symbol, 'taiwan');
            card.tvRating = TV_RATING_ZH[rating];
         }
         return card;
      } catch (error) { return null; }
   }
}
