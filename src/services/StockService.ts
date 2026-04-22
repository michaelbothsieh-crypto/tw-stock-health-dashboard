
import { subMonths } from "date-fns";
import { twStockNames } from "@/data/twStockNames";
import { yf as yahooFinance } from "@/infrastructure/providers/yahooFinanceClient";
import { fetchFugleQuote } from "@/infrastructure/providers/fugleQuote";
import { getTvLatestNewsHeadline } from "@/infrastructure/providers/tradingViewFetch";
import { renderStockChart, ChartDataPoint } from "@/shared/utils/chartRenderer";
import { fetchTradingViewRating, TV_RATING_ZH } from "@/infrastructure/providers/tradingViewRating";
import { isMarketOpen } from "@/shared/utils/market";
import { resolveCodeFromInputLocal } from "@/shared/utils/ticker";
import { buildNewsLine, calcVolumeVs5d, calcSupportResistance, humanizeNumber } from "@/shared/utils/formatters";

export interface StockCard {
   symbol: string;
   nameZh: string;
   close: number | null;
   chgPct: number | null;
   chgAbs: number | null;
   volume: number | null;
   volumeVs5dPct: number | null;
   flowNet: number | null;
   flowUnit: string;
   shortDir: string;
   strategySignal: string;
   confidence: number | null;
   p1d: number | null;
   p3d: number | null;
   p5d: number | null;
   support: number | null;
   resistance: number | null;
   bullTarget: number | null;
   bearTarget: number | null;
   overseas: any[];
   syncLevel: string;
   newsLine: string;
   sourceLabel: string;
   insiderSells: any[];
   recentNews?: string[];
   industry?: string;
   trustLots?: number;
   marginLots?: number;
   shortLots?: number;
   institutionalLots?: number;
   chartBuffer: Buffer | null;
   snapshotPlaybookCaption?: string;
   snapshotVerdict?: string;
   flowScore?: number;
   macroRisk?: number;
   isPriceRealTime?: boolean;
   yahooSymbol?: string;
   tvRating?: string;
   marketStatusLabel?: string;
   historyBars?: any[];
}

export class StockService {
   static getSnapshotBaseUrl(override?: string): string {
      return override || process.env.BOT_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";
   }

   private static getFirstNewsTitle(news: any, symbol?: string, isUS = false): string | null {
      if (!news || !Array.isArray(news) || news.length === 0) return null;
      const cleanSymbol = symbol?.toUpperCase();
      for (const item of news) {
         const title = typeof item === 'string' ? item : (item?.title || item?.headline);
         if (!title) continue;
         const hasChinese = /[\u4e00-\u9fa5]/.test(title);
         const upperTitle = title.toUpperCase();
         if (!isUS) {
            if (hasChinese || (cleanSymbol && upperTitle.includes(cleanSymbol))) return title;
         } else {
            if (cleanSymbol && upperTitle.includes(cleanSymbol)) return title;
            if (hasChinese) return title;
         }
      }
      return null;
   }

   private static getRichNewsList(news: any, symbol?: string, isUS = false): string[] {
      if (!news || !Array.isArray(news) || news.length === 0) return [];
      const cleanSymbol = symbol?.toUpperCase();
      const results: string[] = [];
      for (const item of news) {
         const title = typeof item === 'string' ? item : (item?.title || item?.headline);
         const summary = item?.summary || item?.description || "";
         if (!title) continue;
         const content = summary ? `${title} | 摘要: ${summary}` : title;
         
         // 增加更寬鬆的相關性判斷
         const isRelevant = !cleanSymbol || 
                           title.toUpperCase().includes(cleanSymbol) || 
                           (isUS && cleanSymbol.split('.')[0] && title.toUpperCase().includes(cleanSymbol.split('.')[0]));

         if (isRelevant) {
            results.push(content);
         } else if (!isUS && /[\u4e00-\u9fa5]/.test(title)) {
            // 台股環境下，如果有中文字通常也是相關的
            results.push(content);
         }

         if (results.length >= 10) break;
      }
      return results;
   }

   private static isWithinDays(dateInput: any, days: number): boolean {
      if (!dateInput) return true; // 若無日期則預設通過，由後續過濾
      try {
         let ts: number;
         if (dateInput instanceof Date) {
            ts = dateInput.getTime();
         } else if (typeof dateInput === 'number') {
            // Yahoo Finance 有時返回秒數 (10位) 或毫秒 (13位)
            ts = dateInput > 10000000000 ? dateInput : dateInput * 1000;
         } else {
            ts = new Date(dateInput).getTime();
         }
         if (isNaN(ts)) return true;
         return (Date.now() - ts) <= days * 24 * 60 * 60 * 1000;
      } catch { return true; }
   }

   static async fetchLiveStockCard(query: string, overrideBaseUrl?: string, skipHeavy = false, skipQuote = false): Promise<StockCard | null> {
// ... (fetchLiveStockCard 邏輯保持不變，已在先前更新)
      const symbol = resolveCodeFromInputLocal(query);
      if (!symbol) return null;
      
      const isUS = /^[A-Z]{1,5}$/.test(symbol.toUpperCase());
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
            card.chartBuffer = await renderStockChart(processedBars as ChartDataPoint[], card.support, card.resistance, card.symbol, 180).catch(() => null);
         }

         card.flowNet = typeof snapshot?.signals?.flow?.foreign5D === "number" ? Math.round(snapshot.signals.flow.foreign5D / 1000) : null;
         card.p1d = snapshot?.predictions?.upProb1D;
         card.shortDir = snapshot?.predictions?.upProb1D ? (snapshot.predictions.upProb1D >= 58 ? "偏多" : snapshot.predictions.upProb1D <= 42 ? "偏空" : "中立") : "中立";
         card.strategySignal = snapshot?.strategy?.signal || "觀察";
         card.confidence = snapshot?.strategy?.confidence;
         
         const [yahooSearchRes, yahooSearchByName, fmRes] = await Promise.all([
            yahooFinance.search(yahooSymbol).catch(() => null),
            card.nameZh && card.nameZh !== symbol ? yahooFinance.search(card.nameZh).catch(() => null) : Promise.resolve(null),
            !isUS ? (async () => {
               const { getTaiwanStockNews } = await import("@/infrastructure/providers/finmind");
               const today = new Date().toISOString().split('T')[0];
               const lastWeek = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
               return getTaiwanStockNews(symbol, lastWeek, today).catch(() => null);
            })() : Promise.resolve(null)
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
            this.isWithinDays(item.pubdate || item.pubDate || item.date || item.providerPublishTime, 3)
         );

         card.recentNews = this.getRichNewsList(recentCombined, card.nameZh || symbol, isUS).slice(0, 10);
         
         // 確保 TradingView 新聞也被納入
         if (tvNews && !card.recentNews.some(n => n.includes(tvNews))) {
            card.recentNews.unshift(tvNews);
         }

         const fallbackNews = this.getFirstNewsTitle(recentCombined, card.nameZh || symbol, isUS);
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

   static async fetchLiveUsStockCard(ticker: string, overrideBaseUrl?: string, skipHeavy = false, skipQuote = false): Promise<StockCard | null> {
      const cleanTicker = ticker.includes(":") ? ticker.split(":")[1] : ticker;
      if (!/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/i.test(cleanTicker)) return null;
      const symbol = cleanTicker.toUpperCase();
      
      try {
         const sixMonthsAgo = subMonths(new Date(), 6);
         const [rtQuoteRaw, tvNews, assetProfile, history] = await Promise.all([
            yahooFinance.quote(symbol).catch(() => null),
            getTvLatestNewsHeadline(symbol),
            yahooFinance.quoteSummary(symbol, { modules: ["assetProfile"] }).catch(() => null),
            yahooFinance.historical(symbol, { period1: sixMonthsAgo }).catch(() => [])
         ]);

         const rtQuote: any = Array.isArray(rtQuoteRaw) ? rtQuoteRaw[0] : rtQuoteRaw;
         if (!rtQuote || rtQuote.regularMarketPrice === undefined) return null;

         const bars = history.map((b: any) => ({
            date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : String(b.date),
            open: b.open || b.close,
            high: b.high || b.close,
            low: b.low || b.close,
            close: b.close,
            volume: b.volume || 0
         }));

         let finalPrice = rtQuote.regularMarketPrice;
         let finalChgPct = rtQuote.regularMarketChangePercent || null;
         let statusLabel = "";

         const state = rtQuote.marketState;
         if (state === "PRE" && rtQuote.preMarketPrice) {
            finalPrice = rtQuote.preMarketPrice;
            finalChgPct = rtQuote.preMarketChangePercent;
            statusLabel = " (盤前)";
         } else if ((state === "POST" || state === "CLOSED") && rtQuote.postMarketPrice) {
            finalPrice = rtQuote.postMarketPrice;
            finalChgPct = rtQuote.postMarketChangePercent;
            statusLabel = " (盤後)";
         }

         const card: StockCard = {
            symbol,
            nameZh: String(rtQuote?.longName || rtQuote?.shortName || symbol),
            close: finalPrice,
            chgPct: finalChgPct,
            chgAbs: rtQuote?.regularMarketChange || null,
            volume: rtQuote?.regularMarketVolume || null,
            volumeVs5dPct: null, flowNet: null, flowUnit: "股", shortDir: "中立", strategySignal: "觀察", confidence: null,
            p1d: null, p3d: null, p5d: null, 
            support: null, resistance: null,
            bullTarget: null, bearTarget: null, overseas: [], syncLevel: "—", newsLine: "—", sourceLabel: "yahoo", insiderSells: [], chartBuffer: null,
            industry: assetProfile?.assetProfile?.sector || "—",
            marketStatusLabel: statusLabel,
            historyBars: bars
         };

         const key = calcSupportResistance(bars);
         card.support = key.support;
         card.resistance = key.resistance;

         // 美股優先嘗試使用 Finviz (視覺效果較好)
         try {
            const finvizUrl = `https://finviz.com/chart.ashx?t=${symbol}&ty=c&ta=1&p=d`;
            const chartRes = await fetch(finvizUrl, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://finviz.com/" } });
            if (chartRes.ok) {
               const buf = Buffer.from(await chartRes.arrayBuffer());
               if (buf.length > 2000) { // 確保不是太小的錯誤佔位圖
                  card.chartBuffer = buf;
               }
            }
         } catch {}

         // 若 Finviz 失敗，則嘗試自定義渲染作為備援
         if (!card.chartBuffer && card.close !== null) {
            const todayStr = new Date().toLocaleDateString('en-CA');
            const plotBars = [...bars];
            if (plotBars.length > 0) {
               const last = plotBars[plotBars.length - 1];
               if (last.date === todayStr) last.close = card.close;
               else plotBars.push({ date: todayStr, open: card.close, high: card.close, low: card.close, close: card.close, volume: card.volume || 0 });
            }
            if (plotBars.length >= 2) {
               card.chartBuffer = await renderStockChart(plotBars as ChartDataPoint[], card.support, card.resistance, card.symbol, 180).catch(() => null);
            }
         }

         const yahooSearchRes = await yahooFinance.search(symbol).catch(() => null);
         const combinedNews = [
            ...(Array.isArray((yahooSearchRes as any)?.news) ? (yahooSearchRes as any).news : [])
         ];

         const recentNewsRaw = combinedNews.filter(item => 
            this.isWithinDays(item.pubdate || item.pubDate || item.date || item.providerPublishTime, 3)
         );

         card.recentNews = this.getRichNewsList(recentNewsRaw, symbol, true).slice(0, 8);
         if (tvNews && !card.recentNews.some(n => n.includes(tvNews))) {
            card.recentNews.unshift(tvNews);
         }

         const fallbackNews = this.getFirstNewsTitle(recentNewsRaw, symbol, true);
         card.newsLine = buildNewsLine(tvNews || fallbackNews, 96);
         if (card.newsLine === "—" || !card.newsLine) card.newsLine = "無三天內新聞";
         if (card.newsLine === "無三天內新聞" && card.tvRating?.includes("買入")) card.newsLine = `技術面呈現多頭熱度 (${card.tvRating})`;

         if (!skipQuote) {
            const rating = await fetchTradingViewRating(symbol, 'america');
            card.tvRating = TV_RATING_ZH[rating];
         }

         return card;
      } catch { return null; }
   }

   static async fetchLiveJpStockCard(ticker: string, overrideBaseUrl?: string, skipHeavy = false, skipQuote = false): Promise<StockCard | null> {
      const cleanTicker = ticker.toUpperCase().includes(".T") ? ticker.toUpperCase() : `${ticker.toUpperCase()}.T`;
      const symbol = cleanTicker;
      
      try {
         const sixMonthsAgo = subMonths(new Date(), 6);
         const [rtQuoteRaw, tvNews, assetProfile, history] = await Promise.all([
            yahooFinance.quote(symbol).catch(() => null),
            getTvLatestNewsHeadline(symbol),
            yahooFinance.quoteSummary(symbol, { modules: ["assetProfile"] }).catch(() => null),
            yahooFinance.historical(symbol, { period1: sixMonthsAgo }).catch(() => [])
         ]);

         const rtQuote: any = Array.isArray(rtQuoteRaw) ? rtQuoteRaw[0] : rtQuoteRaw;
         if (!rtQuote || rtQuote.regularMarketPrice === undefined) return null;

         const bars = history.map((b: any) => ({
            date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : String(b.date),
            open: b.open || b.close,
            high: b.high || b.close,
            low: b.low || b.close,
            close: b.close,
            volume: b.volume || 0
         }));

         const card: StockCard = {
            symbol,
            nameZh: String(rtQuote?.longName || rtQuote?.shortName || symbol),
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
            this.isWithinDays(item.pubdate || item.pubDate || item.date || item.providerPublishTime, 3)
         );

         card.recentNews = this.getRichNewsList(recentNewsRaw, symbol, true).slice(0, 8);
         
         // 確保 TradingView 新聞也被納入
         if (tvNews && !card.recentNews.some(n => n.includes(tvNews))) {
            card.recentNews.unshift(tvNews);
         }

         const fallbackNews = this.getFirstNewsTitle(recentNewsRaw, symbol, true);
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
