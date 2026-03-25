import { fetchLatestReport } from "./reportFetcher";
import { getAllChatIds } from "./chatStore";
import { getTacticalPlaybook } from "../ai/playbookAgent";
import { getStockWhatIs } from "../ai/whatisAgent";
import { getFilteredInsiderTransfers } from "../providers/twseInsiderFetch";
import { twStockNames } from "../../data/twStockNames";
import { renderStockChart, ChartDataPoint, renderRankChart, renderProfitChart } from "../ux/chartRenderer";
import { yf as yahooFinance } from "@/lib/providers/yahooFinanceClient";
import { fetchFugleQuote } from "@/lib/providers/fugleQuote";
import { recordStockSearch, getTopRankedStocks } from "./rankStore";
import { subMonths, subYears, parseISO, startOfDay, endOfDay } from "date-fns";

// 建立反向查詢表加速名稱解析
const reverseStockNames: Record<string, string> = {};
if (twStockNames) {
   Object.entries(twStockNames).forEach(([code, name]) => {
      reverseStockNames[name] = code;
   });
}
import {
   buildNewsLine,
   buildStanceText,
   calcSupportResistance,
   calcVolumeVs5d,
   formatPct,
   formatPrice,
   formatSignedPct,
   humanizeNumber,
   parseSignedNumberLoose,
   syncLevel,
} from "./formatters";
import { isMarketOpen } from "@/lib/market";

type TelegramStockRow = {
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
   majorNews: Array<{ title: string; date?: string; impact?: string; link?: string }>;
   majorNewsSummary?: string;
   predText?: string;
   probText?: string;
   h3Text?: string;
   h5Text?: string;
};

type LatestReport = {
   date: string;
   watchlist: TelegramStockRow[];
};

type OverseasLine = {
   symbol: string;
   price: number | null;
   chgPct: number | null;
   corr60: number | null;
};

type OverseasCandidate = {
   symbol: string;
   corr60: number | null;
};

type StockCard = {
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
   overseas: OverseasLine[];
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
   // 從 snapshot 帶出，避免重複呼叫 AI
   snapshotPlaybookCaption?: string;
   snapshotVerdict?: string;
   flowScore?: number;
   macroRisk?: number;
   isPriceRealTime?: boolean;
   yahooSymbol?: string;
};

type TelegramHandleOptions = {
   baseUrl?: string;
   chatId?: number | string;
};

type SnapshotLike = {
   news?: {
      topBullishNews?: Array<{ title?: string; sentiment?: string; date?: string }>;
      topBearishNews?: Array<{ title?: string; sentiment?: string; date?: string }>;
      topNews?: Array<{ title?: string; sentiment?: string; date?: string }>;
      timeline?: Array<{ title?: string; sentiment?: string; date?: string }>;
      items?: Array<{ title?: string; sentiment?: string; date?: string }>;
      error?: string | null;
   };
   newsMeta?: {
      count?: number;
      sentiment?: string;
   };
   globalLinkage?: {
      drivers?: {
         sector?: { id?: string; corr60?: number | null };
         peers?: Array<{ symbol?: string; corr60?: number | null }>;
      };
   };
};

let commandsSynced = false;

async function sendMessage(chatId: string | number, text: string): Promise<number | null> {
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token) return null;
   const url = `https://api.telegram.org/bot${token}/sendMessage`;
   try {
      const res = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
         }),
      });
      const payload = await res.json().catch(() => null);
      return payload?.result?.message_id || null;
   } catch (error) { return null; }
}

async function sendPhoto(chatId: string | number, imageBuffer: Buffer, caption: string): Promise<number | null> {
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token) return null;
   const url = `https://api.telegram.org/bot${token}/sendPhoto`;
   try {
      const uint8Array = new Uint8Array(imageBuffer);
      const imageBlob = new Blob([uint8Array], { type: "image/png" });
      const formData = new FormData();
      formData.append("chat_id", String(chatId));
      formData.append("photo", imageBlob, "chart.png");
      formData.append("caption", caption);
      formData.append("parse_mode", "HTML");

      const res = await fetch(url, { method: "POST", body: formData });
      const payload = await res.json().catch(() => null);
      return payload?.result?.message_id || null;
   } catch (error) { return null; }
}

async function deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token) return false;
   const url = `https://api.telegram.org/bot${token}/deleteMessage`;
   try {
      const res = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      });
      return res.ok;
   } catch (error) { return false; }
}

async function editMessage(chatId: string | number, messageId: number, text: string): Promise<boolean> {
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token) return false;
   const url = `https://api.telegram.org/bot${token}/editMessageText`;
   try {
      const res = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      });
      return res.ok;
   } catch (error) { return false; }
}

async function replyOrEdit(chatId: number, progressMessageId: number | null, text: string) {
   if (progressMessageId !== null) {
      const ok = await editMessage(chatId, progressMessageId, text);
      if (ok) return;
   }
   await sendMessage(chatId, text);
}

async function replyWithCard(chatId: number, progressMessageId: number | null, text: string, imageBuffer: Buffer | null) {
   if (imageBuffer) {
      if (progressMessageId !== null) await deleteMessage(chatId, progressMessageId);
      if (text.length <= 1024) {
         await sendPhoto(chatId, imageBuffer, text);
      } else {
         const firstLine = (text.split('\n')[0] || "Stock Chart").replace(/<b>/g, "").replace(/<\/b>/g, "").trim();
         await sendPhoto(chatId, imageBuffer, firstLine);
         await sendMessage(chatId, text);
      }
   } else {
      await replyOrEdit(chatId, progressMessageId, text);
   }
}

function escapeHtml(input: string): string {
   return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getSnapshotBaseUrl(overrideBaseUrl?: string): string | null {
   if (overrideBaseUrl) return overrideBaseUrl.replace(/\/+$/, "");
   const explicit = process.env.BOT_BASE_URL || process.env.APP_BASE_URL;
   if (explicit) return explicit.replace(/\/+$/, "");
   return null;
}

async function ensureTelegramCommandsSynced() {
   if (commandsSynced) return;
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token || token === "TEST_TOKEN") return;
   try {
      const base = `https://api.telegram.org/bot${token}`;
      await fetch(`${base}/setMyCommands`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            commands: [
               { command: "tw", description: "查詢台股個股（例：/tw 2330）" },
               { command: "us", description: "查詢美股個股（例：/us NVDA）" },
               { command: "whatis", description: "分析公司做什麼及近期新聞（例：/whatis 2330）" },
               { command: "rank", description: "列出本群熱門股票及查詢至今報酬率" },
               { command: "roi", description: "計算指定時間段報酬率（例：/roi 2330 1m）" },
            ],
         }),
      });
      commandsSynced = true;
   } catch (error) { }
}

export function resolveCodeFromInputLocal(input: string): string | null {
   const query = input.trim().toUpperCase();
   if (!query) return null;

   // 1. 優先直接匹配 Key (代號)
   if (twStockNames[query]) return query;

   // 2. 正規表示式匹配 (台股代號可能是 4-6 碼，包含字母如 00984B)
   const codeMatch = query.match(/^([A-Z0-9]{4,6})(\.TW|\.TWO)?$/i);
   if (codeMatch) return codeMatch[1];

   // 3. 匹配 Value (中文名稱) - 完全匹配優先
   if (reverseStockNames[query]) return reverseStockNames[query];

   // 4. 模糊匹配 (至少輸入兩個字才進行模糊匹配，避免 "台" 匹配到 "台泥")
   if (query.length >= 2) {
      for (const [code, name] of Object.entries(twStockNames)) {
         if (name.includes(query)) return code;
      }
   }

   return null;
}
function buildTrendByProb(upProb1D: number | null): string {
   if (upProb1D === null) return "中立";
   if (upProb1D >= 58) return "偏多";
   if (upProb1D <= 42) return "偏空";
   return "中立";
}

function extractNewsLineFromSnapshot(snapshot: SnapshotLike): string {
   const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 天前
   const allNews = [
      ...(Array.isArray(snapshot?.news?.topBullishNews) ? snapshot.news.topBullishNews : []),
      ...(Array.isArray(snapshot?.news?.topBearishNews) ? snapshot.news.topBearishNews : []),
      ...(Array.isArray(snapshot?.news?.topNews) ? snapshot.news.topNews : []),
      ...(Array.isArray(snapshot?.news?.timeline) ? snapshot.news.timeline : []),
      ...(Array.isArray(snapshot?.news?.items) ? snapshot.news.items : []),
   ];
   for (const item of allNews) {
      const title = item?.title?.trim();
      if (!title || title.length === 0 || title.startsWith("近")) continue;
      // 有日期就過濾掉 2 天以上的舊聞
      if (item.date) {
         const newsTime = new Date(item.date).getTime();
         if (!isNaN(newsTime) && newsTime < cutoff) continue;
      }
      return buildNewsLine(title, 96);
   }
   return "—（近期無重大新聞）";
}

function buildVolumeState(volume: number | null, volumeVs5dPct: number | null, unit: string = "股"): string {
   let volText = "—";
   if (volume !== null) {
      if (unit === "張") {
         // 台股從各個 provider (FinMind, Fugle) 拿到的 volume 通常都已經是「張數」了，不需要再除以 1000
         volText = `${humanizeNumber(volume)}張`;
      } else {
         volText = `${humanizeNumber(volume)}股`;
      }
   }
   if (volumeVs5dPct === null) return `${volText}（平量）`;
   if (volumeVs5dPct >= 80) return `${volText}（爆量）`;
   if (volumeVs5dPct >= 15) return `${volText}（放量）`;
   if (volumeVs5dPct <= -20) return `${volText}（縮量）`;
   return `${volText}（平量）`;
}

function buildStockCardLines(card: StockCard, verdict: string = "數據整理中"): string {
   const stanceText = buildStanceText(card.shortDir, card.strategySignal, card.confidence);
   const volumeState = buildVolumeState(card.volume, card.volumeVs5dPct, card.flowUnit);
   const support = formatPrice(card.support, 2);
   const resistance = formatPrice(card.resistance, 2);
   const lines = [
      `${card.symbol} ${card.nameZh} [${verdict}]`,
      `【現價】 ${formatPrice(card.close, 2)}（${formatSignedPct(card.chgPct, 2)}）${card.isPriceRealTime === false ? "　⚠️延遲報價" : ""}`,
      `【量能】 ${volumeState}`,
      `【趨勢】 ${stanceText}（勝率 ${formatPct(card.confidence, 1)}）`,
      `【關鍵價】 支撐 ${support} ｜ 壓力 ${resistance}`,
      "",
      `【新聞】 ${card.newsLine || "—"}`,
   ];

   if (card.insiderSells && card.insiderSells.length > 0) {
      lines.push("");
      lines.push(`🚨 【內部人警訊】 近期高層申讓 ${card.insiderSells.length} 筆：`);
      card.insiderSells.slice(0, 2).forEach(sell => {
         const modeStr = sell.humanMode || "拋售";
         lines.push(`  - ${sell.declarer}(${sell.role}) ${modeStr} ${sell.lots}張`);
      });
   }

   return lines.map((line) => escapeHtml(line)).join("\n");
}

async function buildStockCardWithAI(card: StockCard): Promise<string> {
   try {
      // 優先使用 snapshot 已計算好的 playbook（節省 LLM 呼叫）
      if (card.snapshotPlaybookCaption) {
         const structuredPart = buildStockCardLines(card, card.snapshotVerdict || "觀察中");
         return `${structuredPart}\n\n💬 ${escapeHtml(card.snapshotPlaybookCaption)}`;
      }
      // Fallback：snapshot 沒有 playbook 時才重新呼叫 AI
      const playbook = await getTacticalPlaybook({
         ticker: card.symbol,
         stockName: card.nameZh,
         price: card.close || 0,
         support: card.support || 0,
         resistance: card.resistance || 0,
         macroRisk: card.macroRisk ?? 0,
         technicalTrend: card.shortDir,
         flowScore: card.flowScore ?? 50,
         flowVerdict: card.shortDir,
         recentTrend: `目前現價 ${card.close}，今日漲跌幅 ${card.chgPct?.toFixed(2)}%，成交量 ${card.volume}。`,
         trustLots: card.trustLots || 0,
         shortLots: card.shortLots || 0,
         marginLots: card.marginLots || 0,
         institutionalLots: card.institutionalLots || 0,
         insiderTransfers: card.insiderSells,
      });
      const structuredPart = buildStockCardLines(card, playbook?.verdict || "觀察中");
      if (playbook) {
         const tgText = playbook.telegramCaption || playbook.tacticalScript;
         return `${structuredPart}\n\n💬 ${escapeHtml(tgText)}`;
      }
      return structuredPart;
   } catch (e) { return buildStockCardLines(card); }
}


async function fetchLiveUsStockCard(ticker: string, overrideBaseUrl?: string): Promise<StockCard | null> {
   if (!/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/i.test(ticker)) return null;
   const symbol = ticker.toUpperCase();
   const baseUrl = getSnapshotBaseUrl(overrideBaseUrl);
   if (!baseUrl) return null;
   try {
      const controller = new AbortController();
      const snapTimer = setTimeout(() => controller.abort(), 30000);
      const snapRes = await fetch(`${baseUrl}/api/stock/${symbol}/snapshot`, { signal: controller.signal }).finally(() => clearTimeout(snapTimer));
      if (!snapRes.ok) return null;
      const snapshot = await snapRes.json();

      const rtQuoteRaw = await yahooFinance.quote(symbol).catch(() => null);
      const rtQuote: any = Array.isArray(rtQuoteRaw) ? rtQuoteRaw[0] : rtQuoteRaw;

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
         symbol,
         nameZh: String(snapshot?.normalizedTicker?.companyNameZh || snapshot?.normalizedTicker?.name || symbol),
         close: null, chgPct: null, chgAbs: null, volume: null, volumeVs5dPct: null, flowNet: null, flowUnit: "股",
         shortDir: "中立", strategySignal: "觀察", confidence: null, p1d: null, p3d: null, p5d: null,
         support: null, resistance: null, bullTarget: null, bearTarget: null, overseas: [], syncLevel: "—", newsLine: "—", sourceLabel: "snapshot", insiderSells: [],
         chartBuffer: null,
      };

      const todayStr = new Date().toLocaleDateString('en-CA');

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
         card.chgPct = typeof rtQuote.regularMarketChangePercent === "number" ? rtQuote.regularMarketChangePercent : card.chgPct;
         card.chgAbs = typeof rtQuote.regularMarketChange === "number" ? rtQuote.regularMarketChange : card.chgAbs;
         card.volume = rtQuote.regularMarketVolume || card.volume;

         if (card.close !== null) {
            const lastBar = processedBars[processedBars.length - 1];
            const rtHigh = typeof rtQuote.regularMarketDayHigh === "number" ? rtQuote.regularMarketDayHigh : card.close;
            const rtLow = typeof rtQuote.regularMarketDayLow === "number" ? rtQuote.regularMarketDayLow : card.close;
            const rtOpen = typeof rtQuote.regularMarketOpen === "number" ? rtQuote.regularMarketOpen : card.close;
            if (lastBar && lastBar.date === todayStr) {
               processedBars[processedBars.length - 1] = { ...lastBar, close: card.close, high: Math.max(lastBar.high, rtHigh), low: Math.min(lastBar.low, rtLow), volume: card.volume || lastBar.volume };
            } else {
               processedBars = [...processedBars, { date: todayStr, open: rtOpen, high: rtHigh, low: rtLow, close: card.close, volume: card.volume || 0 }];
            }
         }
         const volInfo = calcVolumeVs5d([...processedBars.slice(0, -1), { volume: card.volume }]);
         card.volumeVs5dPct = volInfo.volumeVs5dPct;
      }

      const key = calcSupportResistance(processedBars);
      card.support = snapshot?.keyLevels?.supportLevel || key.support;
      card.resistance = snapshot?.keyLevels?.breakoutLevel || key.resistance;

      // 美股直接用 Finviz 圖片
      try {
         const finvizUrl = `https://finviz.com/chart.ashx?t=${symbol}&ty=c&ta=1&p=d`;
         const chartRes = await fetch(finvizUrl, {
            headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://finviz.com/" },
         });
         if (chartRes.ok) {
            const ab = await chartRes.arrayBuffer();
            card.chartBuffer = Buffer.from(ab);
         }
      } catch {
         card.chartBuffer = null;
      }
card.p1d = snapshot?.predictions?.upProb1D;
card.shortDir = buildTrendByProb(card.p1d);
card.strategySignal = snapshot?.strategy?.signal || "觀察";
card.confidence = snapshot?.strategy?.confidence;
card.newsLine = extractNewsLineFromSnapshot(snapshot);
card.industry = snapshot?.normalizedTicker?.industry || snapshot?.normalizedTicker?.sector || "";
card.recentNews = [
  ...(Array.isArray(snapshot?.news?.topBullishNews) ? snapshot.news.topBullishNews : []),
  ...(Array.isArray(snapshot?.news?.topBearishNews) ? snapshot.news.topBearishNews : []),
  ...(Array.isArray(snapshot?.news?.topNews) ? snapshot.news.topNews : []),
  ...(Array.isArray(snapshot?.news?.timeline) ? snapshot.news.timeline : []),
  ...(Array.isArray(snapshot?.news?.items) ? snapshot.news.items : []),
].map(n => n?.title || "").filter(Boolean).slice(0, 10);

card.snapshotPlaybookCaption = snapshot?.playbook?.telegramCaption || snapshot?.playbook?.tacticalScript || undefined;
card.snapshotVerdict = snapshot?.playbook?.shortSummary || undefined;
card.flowScore = snapshot?.signals?.flow?.flowScore ?? undefined;
card.macroRisk = snapshot?.crashWarning?.score ?? undefined;
card.yahooSymbol = symbol;

return card;
} catch (error) { return null; }
}
async function fetchLiveStockCard(query: string, overrideBaseUrl?: string): Promise<StockCard | null> {
   const symbol = resolveCodeFromInputLocal(query);
   if (!symbol) {
      console.warn(`[BotEngine] resolveCodeFromInputLocal failed for query: ${query}`);
      return null;
   }
   const baseUrl = getSnapshotBaseUrl(overrideBaseUrl);
   if (!baseUrl) {
      console.error("[BotEngine] baseUrl is missing. Set BOT_BASE_URL or APP_BASE_URL.");
      return null;
   }
   try {
      const snapUrl = `${baseUrl}/api/stock/${symbol}/snapshot?mode=lite`;
      const controller = new AbortController();
      const snapTimer = setTimeout(() => controller.abort(), 20000);
      
      // 1. 並行發送 Snapshot 與 Fugle 請求 (節省等待時間)
      const [snapRes, fugleQuote] = await Promise.all([
         fetch(snapUrl, { signal: controller.signal }).finally(() => clearTimeout(snapTimer)),
         fetchFugleQuote(symbol)
      ]);
      
      if (!snapRes.ok) {
         console.error(`[BotEngine] Snapshot API failed: ${snapUrl}, Status: ${snapRes.status}`);
         return null;
      }
      const snapshot = await snapRes.json();

      let yahooSymbol = snapshot?.normalizedTicker?.yahoo;
      if (symbol === "8299") yahooSymbol = "8299.TWO";
      if (!yahooSymbol || yahooSymbol === symbol) {
         // 修正推算邏輯：5、6、8 開頭，或是以 B 結尾（債券 ETF）通常是在 TPEX (.TWO)
         const isTPEX = symbol.startsWith("8") || symbol.startsWith("6") || symbol.startsWith("5") || symbol.toUpperCase().endsWith("B");
         yahooSymbol = isTPEX ? `${symbol}.TWO` : `${symbol}.TW`;
      }

      // 2. 如果 Fugle 沒抓到，Fallback 到 Yahoo Finance（15-20 分鐘延遲）
      const rtQuoteRaw = fugleQuote ? null : await yahooFinance.quote(yahooSymbol).catch(() => null);
      const rtQuote: any = fugleQuote
        ? {
            regularMarketPrice: fugleQuote.price,
            regularMarketChangePercent: fugleQuote.changePct,
            regularMarketChange: fugleQuote.changeAbs,
            regularMarketVolume: fugleQuote.volume,
            regularMarketDayHigh: fugleQuote.high,
            regularMarketDayLow: fugleQuote.low,
            regularMarketOpen: fugleQuote.open,
          }
        : Array.isArray(rtQuoteRaw) ? rtQuoteRaw[0] : rtQuoteRaw;

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
         nameZh: String(snapshot?.normalizedTicker?.companyNameZh || symbol),
         close: null, chgPct: null, chgAbs: null, volume: null, volumeVs5dPct: null, flowNet: null, flowUnit: "張",
         shortDir: "中立", strategySignal: "觀察", confidence: null, p1d: null, p3d: null, p5d: null,
         support: null, resistance: null, bullTarget: null, bearTarget: null, overseas: [], syncLevel: "—", newsLine: "—", sourceLabel: "snapshot", insiderSells: [],
         chartBuffer: null
      };

      const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

      // 1. 先處理基礎數據
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

      // 2. 注入 Yahoo 即時報價 (最高優先權)
      const marketOpen = isMarketOpen(symbol);
      if (rtQuote && typeof rtQuote.regularMarketPrice === "number") {
         // 在盤後如果 Yahoo 給了一個相差很大的價格 (例如 > 5%)，則傾向相信 Snapshot (來自 FinMind)
         // 這能防止有些 Yahoo Quote 在盤後誤傳盤後撮合價或 (bid+ask)/2
         const mismatch = !marketOpen && card.close !== null && Math.abs(rtQuote.regularMarketPrice - card.close) / card.close > 0.05;

         if (!mismatch) {
            card.close = rtQuote.regularMarketPrice;
            card.chgPct = typeof rtQuote.regularMarketChangePercent === "number" ? rtQuote.regularMarketChangePercent : card.chgPct;
            card.chgAbs = typeof rtQuote.regularMarketChange === "number" ? rtQuote.regularMarketChange : card.chgAbs;
            card.volume = rtQuote.regularMarketVolume || card.volume;
         }

         // 將今日即時報價合併進 Bars 陣列
         if (card.close !== null) {
            const lastBar = processedBars[processedBars.length - 1];
            const rtHigh = typeof rtQuote.regularMarketDayHigh === "number" ? rtQuote.regularMarketDayHigh : card.close;
            const rtLow = typeof rtQuote.regularMarketDayLow === "number" ? rtQuote.regularMarketDayLow : card.close;
            const rtOpen = typeof rtQuote.regularMarketOpen === "number" ? rtQuote.regularMarketOpen : card.close;

            if (lastBar && lastBar.date === todayStr) {
               // 歷史資料已有今日 bar：用 Yahoo 即時 high/low 更新，保留歷史 open
               processedBars[processedBars.length - 1] = {
                  ...lastBar,
                  close: card.close,
                  high: Math.max(lastBar.high, rtHigh),
                  low: Math.min(lastBar.low, rtLow),
                  volume: card.volume || lastBar.volume,
               };
            } else {
               // 歷史資料尚未包含今日：用 Yahoo 的 open/high/low 補上完整 bar
               processedBars = [
                  ...processedBars,
                  { date: todayStr, open: rtOpen, high: rtHigh, low: rtLow, close: card.close, volume: card.volume || 0 },
               ];
            }
         }

         const volInfo = calcVolumeVs5d([...processedBars.slice(0, -1), { volume: card.volume }]);
         card.volumeVs5dPct = volInfo.volumeVs5dPct;
      }

      const key = calcSupportResistance(processedBars);
      // snapshot 用 supportLevel / breakoutLevel，與本地計算結果互補
      card.support = snapshot?.keyLevels?.supportLevel || key.support;
      card.resistance = snapshot?.keyLevels?.breakoutLevel || key.resistance;

      if (processedBars.length >= 2) {
         try {
            card.chartBuffer = await renderStockChart(processedBars as ChartDataPoint[], card.support, card.resistance, card.symbol, 180);
         } catch {
            // 圖表渲染失敗不影響文字卡片
            card.chartBuffer = null;
         }
      }

      card.flowNet = typeof snapshot?.signals?.flow?.foreign5D === "number" ? Math.round(snapshot.signals.flow.foreign5D / 1000) : null;
      card.p1d = snapshot?.predictions?.upProb1D;
      card.shortDir = buildTrendByProb(card.p1d);
      card.strategySignal = snapshot?.strategy?.signal || "觀察";
      card.confidence = snapshot?.strategy?.confidence;
      card.newsLine = extractNewsLineFromSnapshot(snapshot);
      card.insiderSells = Array.isArray(snapshot?.insiderTransfers) ? snapshot.insiderTransfers : [];
      card.trustLots = snapshot?.signals?.flow?.trustLots || 0;
      card.shortLots = snapshot?.signals?.flow?.shortLots || 0;
      card.marginLots = snapshot?.signals?.flow?.marginLots || 0;
      card.institutionalLots = snapshot?.signals?.flow?.institutionalLots || 0;
      // 帶出 snapshot 已計算好的 playbook，避免重複呼叫 LLM
      card.snapshotPlaybookCaption = snapshot?.playbook?.telegramCaption || snapshot?.playbook?.tacticalScript || undefined;
      card.snapshotVerdict = snapshot?.playbook?.shortSummary || undefined;
      card.flowScore = snapshot?.signals?.flow?.flowScore ?? undefined;
      card.macroRisk = snapshot?.crashWarning?.score ?? undefined;
      card.yahooSymbol = yahooSymbol;
      // 只有台股才能用 Fugle，非台股（美股）不標示延遲
      const isTWStock = /[0-9]/.test(symbol);
      card.isPriceRealTime = isTWStock ? fugleQuote !== null : undefined;

      return card;
      } catch (error) { 
      console.error("[BotEngine] fetchLiveStockCard Error:", error);
      return null; 
      }
      }
export async function generateBotReply(text: string, options?: TelegramHandleOptions): Promise<{ text: string, chartBuffer?: Buffer | null } | null> {
   const trimmedText = text.trim();
   if (!trimmedText.startsWith("/")) return null;

   const [commandRaw, ...argParts] = trimmedText.split(/\s+/);
   const command = commandRaw.toLowerCase().split("@")[0];
   const query = argParts.join(" ").trim();

   if (command === "/tw") {
      if (!query) return { text: "請輸入股票代號，例如: /tw 2330" };
      const liveCard = await fetchLiveStockCard(query, options?.baseUrl);
      if (liveCard) {
         if (options?.chatId) {
            await recordStockSearch(options.chatId, liveCard.symbol, liveCard.close).catch(() => null);
         }
         const finalMsg = await buildStockCardWithAI(liveCard);
         return { text: finalMsg, chartBuffer: liveCard.chartBuffer };
      }
      return { text: "找不到該股票資料。" };
   }

   if (command === "/whatis") {
      if (!query) return { text: "請輸入公司名稱或代號，例如:\n/whatis 2330\n/whatis 台積電\n/whatis OpenAI" };
      
      try {
         // 1. 嘗試解析代號（優先尋找已知代號）
         const isUs = /^[A-Z]{1,5}$/i.test(query);
         const liveCard = isUs 
            ? await fetchLiveUsStockCard(query, options?.baseUrl)
            : await fetchLiveStockCard(query, options?.baseUrl);

         // 2. 呼叫 AI 進行分析
         const result = await getStockWhatIs({
            ticker: liveCard?.symbol,
            stockName: liveCard?.nameZh || query, // 若找不到代號，就用使用者輸入的名稱
            recentNews: liveCard?.recentNews,
            companyProfile: liveCard?.industry ? `該公司所屬產業為：${liveCard.industry}` : undefined,
         });
         return { text: result.telegramReply, chartBuffer: liveCard?.chartBuffer || null };
      } catch (err) {
         console.error("[BotEngine] /whatis Error:", err);
         return { text: `抱歉，分析「${query}」時發生錯誤，請稍後再試。`, chartBuffer: null };
      }
   }

   if (command === "/us") {
      if (!query) return { text: "請輸入美股代號，例如:\n/us NVDA\n/us NVDA,AAPL,TSLA" };

      const tickers = query.split(/[,，\s]+/).map(t => t.trim().toUpperCase()).filter(Boolean).slice(0, 5);

      if (tickers.length === 1) {
         const liveCard = await fetchLiveUsStockCard(tickers[0], options?.baseUrl);
         if (liveCard) {
            if (options?.chatId) {
               await recordStockSearch(options.chatId, liveCard.symbol, liveCard.close).catch(() => null);
            }
            const finalMsg = await buildStockCardWithAI(liveCard);
            return { text: finalMsg, chartBuffer: liveCard.chartBuffer };
         }
         return { text: "找不到該股票資料，請確認代號是否正確（例：AAPL、NVDA）。" };
      }

      // 多檔並行查詢（最多 5 檔），不附圖
      const cards = await Promise.all(tickers.map(t => fetchLiveUsStockCard(t, options?.baseUrl)));
      const parts: string[] = [];
      for (let i = 0; i < tickers.length; i++) {
         const card = cards[i];
         if (!card) {
            parts.push(escapeHtml(`❌ ${tickers[i]}：找不到資料`));
         } else {
            if (options?.chatId && card.close) {
               await recordStockSearch(options.chatId, card.symbol, card.close).catch(() => null);
            }
            parts.push(buildStockCardLines(card, card.snapshotVerdict || "觀察中"));
         }
      }
      return { text: parts.join("\n\n" + escapeHtml("──────────") + "\n\n"), chartBuffer: null };
   }

   if (command === "/rank") {
      if (!options?.chatId) return { text: "無法辨識群組 ID，請在群組中使用。" };
      const ranks = await getTopRankedStocks(options.chatId);
      if (ranks.length === 0) return { text: "目前尚未有股票查詢紀錄。" };

      const lines: string[] = ["🏆 <b>本群熱門股票表現 (Top 10)</b>", ""];
      
      const chartData: { symbol: string; pct: number; count: number }[] = [];
      const results = await Promise.all(ranks.map(async (r, index) => {
         const isUs = /^[A-Z]{1,5}$/.test(r.symbol);
         const live = isUs 
            ? await fetchLiveUsStockCard(r.symbol, options.baseUrl)
            : await fetchLiveStockCard(r.symbol, options.baseUrl);
         
         const currentPrice = live?.close || 0;
         const diff = currentPrice - r.initialPrice;
         const pct = r.initialPrice !== 0 ? (diff / r.initialPrice) * 100 : 0;
         const dateStr = new Date(r.initialTimestamp).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
         
         chartData.push({ symbol: r.symbol, pct, count: r.count });
         return `${index + 1}. <b>${r.symbol}</b> (查 ${r.count} 次)\n   ${dateStr}: ${formatPrice(r.initialPrice, 2)} → 現價: ${formatPrice(currentPrice, 2)} (${formatSignedPct(pct, 2)})`;
      }));

      // 按報酬率排序圖表數據 (從高到低)
      chartData.sort((a, b) => b.pct - a.pct);
      const chartBuffer = await renderRankChart(chartData).catch(() => null);

      lines.push(...results);
      return { text: lines.join("\n"), chartBuffer };
   }

   if (command === "/roi") {
      const [tickerRaw, periodRaw] = query.split(/\s+/);
      if (!tickerRaw || !periodRaw) return { text: "用法: /roi 股票代號 時間(1m, 3m, 6m, 1y, ytd, 或 YYYY-MM-DD)\n例如: /roi 2330 1m" };

      const symbol = resolveCodeFromInputLocal(tickerRaw) || tickerRaw.toUpperCase();
      const isUs = /^[A-Z]{1,5}$/.test(symbol);
      
      const live = isUs 
         ? await fetchLiveUsStockCard(symbol, options?.baseUrl)
         : await fetchLiveStockCard(symbol, options?.baseUrl);
      
      if (!live || !live.close || !live.yahooSymbol) return { text: `找不到 ${symbol} 的當前報價或 Yahoo 代號。` };

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
         } catch {
            return { text: "時間格式錯誤。請使用 1m, 1y 或 2025-01-01。" };
         }
      }

      const yahooSymbol = live.yahooSymbol;
      
      try {
         // 使用 chart API 代替 historical，通常對缺失數據更強健
         const chartResult = await yahooFinance.chart(yahooSymbol, {
            period1: startDate,
            period2: new Date(),
            interval: '1d',
         });

         const historyRaw = chartResult.quotes || [];
         // 過濾掉價格缺失的資料點
         const history = historyRaw
            .filter(h => h.date && (h.adjclose !== null || h.close !== null))
            .map(h => ({
               date: h.date,
               close: h.adjclose ?? h.close ?? 0
            }))
            .filter(h => h.close > 0);

         if (!history || history.length === 0) return { text: `找不到 ${yahooSymbol} 在 ${periodRaw} 的有效歷史資料。` };
         
         const initial = history[0];
         const initialPrice = initial.close;
         const currentPrice = live.close;
         const diff = currentPrice - initialPrice;
         const pct = (diff / initialPrice) * 100;
         
         const startStr = initial.date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
         const chartBuffer = await renderProfitChart(symbol, history, initialPrice, currentPrice).catch(() => null);
         
         return {
            text: `📈 <b>${symbol} 報酬率分析</b>\n\n` +
                  `起點: ${startStr}\n` +
                  `當時收盤: ${formatPrice(initialPrice, 2)}\n` +
                  `現在價格: ${formatPrice(currentPrice, 2)}\n\n` +
                  `總報酬率: <b>${formatSignedPct(pct, 2)}</b>`,
            chartBuffer
         };
      } catch (err: any) {
         console.error(`[BotEngine] /profit Error for ${yahooSymbol}:`, err);
         return { text: `抓取歷史資料失敗: ${err.message}` };
      }
   }

   // 如果不是正確指令，回傳 null 以保持沉默
   return null;
}

export async function handleTelegramMessage(chatId: number, text: string, isBackgroundPush = false, options?: TelegramHandleOptions) {
   if (isBackgroundPush) return;

   const [commandRaw] = text.trim().split(/\s+/);
   const command = commandRaw.toLowerCase().split("@")[0];

   // 先送進度訊息，讓使用者知道已收到指令
   let progressMessageId: number | null = null;
   try {
      if (command === "/tw" || command === "/us" || command === "/whatis" || command === "/rank" || command === "/roi") {
         await ensureTelegramCommandsSynced();
         progressMessageId = await sendMessage(chatId, "正在搜尋資料中...");
      }

      const chatIdStr = String(chatId);
      const reply = await generateBotReply(text, { ...options, chatId: chatIdStr });
      if (!reply) {
         if (progressMessageId) await deleteMessage(chatId, progressMessageId);
         return;
      }

      if (reply.chartBuffer) {
         await replyWithCard(chatId, progressMessageId, reply.text, reply.chartBuffer);
      } else {
         await replyOrEdit(chatId, progressMessageId, reply.text);
      }
   } catch (error) {
      console.error("[BotEngine] handleTelegramMessage Error:", error);
      if (progressMessageId) {
         await editMessage(chatId, progressMessageId, "抱歉，處理資料時發生錯誤。");
      } else {
         await sendMessage(chatId, "抱歉，處理資料時發生錯誤。");
      }
   }
}
