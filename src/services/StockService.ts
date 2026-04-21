
import { subMonths } from "date-fns";
import { twStockNames } from "@/data/twStockNames";
import { yf as yahooFinance } from "@/infrastructure/providers/yahooFinanceClient";
import { fetchFugleQuote } from "@/infrastructure/providers/fugleQuote";
import { getTvLatestNewsHeadline } from "@/infrastructure/providers/tradingViewFetch";
import { renderStockChart, ChartDataPoint } from "@/shared/utils/chartRenderer";
import { fetchTradingViewRating, TV_RATING_ZH } from "@/infrastructure/providers/tradingViewRating";
import { isMarketOpen } from "@/shared/utils/market";
import { resolveCodeFromInputLocal } from "@/features/telegram/botEngine"; // 暫時保留，後續可移入 Utils
import { buildNewsLine, calcVolumeVs5d, calcSupportResistance } from "@/shared/utils/formatters";

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
}

export class StockService {
   static getSnapshotBaseUrl(override?: string): string {
      return override || process.env.BOT_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";
   }

   static async fetchLiveStockCard(query: string, overrideBaseUrl?: string, skipHeavy = false, skipQuote = false): Promise<StockCard | null> {
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
            const isProbablyTPEX = symbol.startsWith("8") || symbol.startsWith("5") || symbol.startsWith("4") || (symbol.startsWith("3") && symbol !== "3008") || symbol.toUpperCase().endsWith("B");
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
            chartBuffer: null, yahooSymbol
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
            const marketOpen = isMarketOpen(symbol);
            const diffPct = card.close !== null ? Math.abs(rtQuote.regularMarketPrice - card.close) / card.close : 0;
            const isSplitDetected = diffPct > 0.8;
            const mismatch = !marketOpen && card.close !== null && diffPct > 0.05 && !isSplitDetected;

            if (!mismatch) {
               const oldClose = card.close;
               card.close = rtQuote.regularMarketPrice;
               card.chgPct = rtQuote.regularMarketChangePercent ?? card.chgPct;
               card.chgAbs = rtQuote.regularMarketChange ?? card.chgAbs;
               card.volume = rtQuote.regularMarketVolume || card.volume;

               // 如果偵測到分割，且舊收盤價存在，則需要調整所有歷史 Bar 以符合新比例
               if (isSplitDetected && oldClose !== null && oldClose !== 0 && card.close !== null) {
                  const ratio = card.close / oldClose;
                  processedBars = processedBars.map((b: any) => ({
                     ...b,
                     open: (Number(b.open) || 0) * ratio,
                     high: (Number(b.high) || 0) * ratio,
                     low: (Number(b.low) || 0) * ratio,
                     close: (Number(b.close) || 0) * ratio
                  }));
               }
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
         
         // 抓取 Yahoo 備援新聞 (透過 Search API)
         const yahooSearchRes = await yahooFinance.search(yahooSymbol).catch(() => null);

         const getFirstNewsTitle = (news: any): string | null => {
            if (!news || !Array.isArray(news) || news.length === 0) return null;
            
            // 優先找尋中文新聞或具備代號標籤的新聞
            for (const item of news) {
               const title = typeof item === 'string' ? item : (item?.title || item?.headline);
               if (!title) continue;

               // 過濾掉不相關的廣告或極其無關的英文新聞 (例如 First Mold...)
               const isChinese = /[\u4e00-\u9fa5]/.test(title);
               const mentionsTicker = symbol && title.includes(symbol);
               
               if (isChinese || mentionsTicker) return title;
            }

            // 若都沒中文，且第一條新聞至少不是亂碼，才考慮回傳
            const first = news[0];
            const firstTitle = typeof first === 'string' ? first : (first?.title || first?.headline);
            return firstTitle || null;
         };

         card.recentNews = snapshot?.news || [];
         // 優先順序: TV即時 > Snapshot歷史 > Yahoo搜尋
         const yahooNews = (yahooSearchRes as any)?.news;
         const fallbackNews = getFirstNewsTitle(card.recentNews) || getFirstNewsTitle(yahooNews);
         card.newsLine = buildNewsLine(tvNews || fallbackNews, 96);
         card.insiderSells = snapshot?.insiderTransfers || [];
         card.flowScore = snapshot?.signals?.flow?.flowScore;
         card.macroRisk = snapshot?.crashWarning?.score;
         
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
      const baseUrl = this.getSnapshotBaseUrl(overrideBaseUrl);
      
      try {
         const snapUrl = `${baseUrl}/api/stock/${symbol}/snapshot?mode=lite`;
         
         const [snapRes, rtQuoteRaw, tvNews] = await Promise.all([
            fetch(snapUrl).catch(() => null),
            yahooFinance.quote(symbol).catch(() => null),
            getTvLatestNewsHeadline(symbol)
         ]);

         const snapshot = snapRes && snapRes.ok ? await snapRes.json() : null;
         const rtQuote: any = Array.isArray(rtQuoteRaw) ? rtQuoteRaw[0] : rtQuoteRaw;

         // 嚴格檢查：如果沒有即時報價且沒有 Snapshot 資料，視為查無此股
         if (!snapshot && (!rtQuote || rtQuote.regularMarketPrice === undefined)) {
            return null;
         }

         if (snapshot || rtQuote) {
            const card: StockCard = {
               symbol,
               nameZh: String(snapshot?.normalizedTicker?.companyNameZh || rtQuote?.longName || rtQuote?.shortName || symbol),
               close: rtQuote?.regularMarketPrice || (snapshot?.data?.prices?.length ? snapshot.data.prices[snapshot.data.prices.length-1].close : null),
               chgPct: rtQuote?.regularMarketChangePercent || null,
               chgAbs: rtQuote?.regularMarketChange || null,
               volume: rtQuote?.regularMarketVolume || null,
               volumeVs5dPct: null, flowNet: null, flowUnit: "股", shortDir: "中立", strategySignal: "觀察", confidence: null,
               p1d: snapshot?.predictions?.upProb1D, 
               p3d: snapshot?.predictions?.upProb3D, 
               p5d: snapshot?.predictions?.upProb5D, 
               support: snapshot?.keyLevels?.supportLevel, resistance: snapshot?.keyLevels?.breakoutLevel,
               bullTarget: null, bearTarget: null, overseas: [], syncLevel: "—", newsLine: "—", sourceLabel: snapshot ? "snapshot" : "yahoo", insiderSells: [], chartBuffer: null
            };
            
            const getFirstNewsTitle = (news: any): string | null => {
               if (!news || !Array.isArray(news) || news.length === 0) return null;
               
               for (const item of news) {
                  const title = typeof item === 'string' ? item : (item?.title || item?.headline);
                  if (!title) continue;

                  const isChinese = /[\u4e00-\u9fa5]/.test(title);
                  const mentionsTicker = symbol && title.toUpperCase().includes(symbol);
                  if (isChinese || mentionsTicker) return title;
               }

               const first = news[0];
               return typeof first === 'string' ? first : (first?.title || first?.headline || null);
            };

            card.recentNews = snapshot?.news || [];
            card.newsLine = buildNewsLine(tvNews || getFirstNewsTitle(card.recentNews), 96);

            if (!skipQuote) {
               const rating = await fetchTradingViewRating(symbol, 'america');
               card.tvRating = TV_RATING_ZH[rating];
            }

            // 3. 處理圖表 (美股優先用 Finviz)
            try {
               const finvizUrl = `https://finviz.com/chart.ashx?t=${symbol}&ty=c&ta=1&p=d`;
               const chartRes = await fetch(finvizUrl, {
                  headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://finviz.com/" },
               });
               if (chartRes.ok) {
                  const ab = await chartRes.arrayBuffer();
                  card.chartBuffer = Buffer.from(ab);
               }
            } catch (e) {
               console.warn(`[StockService] Finviz fetch failed for ${symbol}`, e);
            }

            return card;
         }
         return null;
      } catch { return null; }
   }
}
