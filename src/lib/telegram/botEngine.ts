import { fetchLatestReport } from "./reportFetcher";
import { getAllChatIds } from "./chatStore";
import { getTacticalPlaybook } from "../ai/playbookAgent";
import { getFilteredInsiderTransfers } from "../providers/twseInsiderFetch";
import { twStockNames } from "../../data/twStockNames";
import { fetchYahooFinanceBars } from "../global/yahooFinance";
import { fetchRecentBars } from "../range";
import { renderStockChart, ChartDataPoint } from "../ux/chartRenderer";
import YahooFinance from 'yahoo-finance2';
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
   insiderSells: Array<{ date: string; declarer: string; role: string; humanMode: string; lots: number; valueText: string; transferRatio: number }>;
   chartBuffer: Buffer | null;
};

type TelegramHandleOptions = {
   baseUrl?: string;
};

type SnapshotLike = {
   news?: {
      topBullishNews?: Array<{ title?: string; sentiment?: string }>;
      topBearishNews?: Array<{ title?: string; sentiment?: string }>;
      topNews?: Array<{ title?: string; sentiment?: string }>;
      timeline?: Array<{ title?: string; sentiment?: string }>;
      items?: Array<{ title?: string; sentiment?: string }>;
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
      // Convert Buffer to Uint8Array for Blob compatibility
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
      
      // Telegram Caption 上限為 1024 字
      if (text.length <= 1024) {
         await sendPhoto(chatId, imageBuffer, text);
      } else {
         // 若超過則發送圖片 + 標題，再發送完整內文
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

function toNumberPercent(value: unknown): number | null {
   if (typeof value === "number" && Number.isFinite(value)) return value;
   if (typeof value === "string") {
      const parsed = Number(value.replace("%", "").trim());
      if (Number.isFinite(parsed)) return parsed;
   }
   return null;
}

function getSnapshotBaseUrl(overrideBaseUrl?: string): string | null {
   if (overrideBaseUrl) return overrideBaseUrl.replace(/\/+$/, "");
   const explicit = process.env.BOT_BASE_URL || process.env.APP_BASE_URL;
   if (explicit) return explicit.replace(/\/+$/, "");
   const vercelUrl = process.env.VERCEL_URL;
   if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;
   return null;
}

async function ensureTelegramCommandsSynced() {
   if (commandsSynced) return;
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token || token === "TEST_TOKEN") return;
   const base = `https://api.telegram.org/bot${token}`;
   try {
      await fetch(`${base}/deleteMyCommands`, { method: "POST" });
      await fetch(`${base}/setMyCommands`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            commands: [{ command: "tw", description: "查詢台股個股（例：/tw 2330）" }],
         }),
      });
      commandsSynced = true;
   } catch (error) {}
}

function resolveCodeFromInputLocal(input: string): string | null {
   const query = input.trim();
   const codeMatch = query.match(/^(\d{4,})(\.TW|\.TWO)?$/i);
   if (codeMatch) return codeMatch[1];
   for (const [code, name] of Object.entries(twStockNames)) { if (name === query) return code; }
   for (const [code, name] of Object.entries(twStockNames)) { if (name.includes(query) || query.includes(name)) return code; }
   return null;
}

function buildTrendByProb(upProb1D: number | null): string {
   if (upProb1D === null) return "中立";
   if (upProb1D >= 58) return "偏多";
   if (upProb1D <= 42) return "偏空";
   return "中立";
}

function extractNewsLineFromSnapshot(snapshot: SnapshotLike): string {
   const allNews: Array<{ title?: string }> = [
      ...(Array.isArray(snapshot?.news?.topBullishNews) ? snapshot.news.topBullishNews : []),
      ...(Array.isArray(snapshot?.news?.topBearishNews) ? snapshot.news.topBearishNews : []),
      ...(Array.isArray(snapshot?.news?.topNews) ? snapshot.news.topNews : []),
      ...(Array.isArray(snapshot?.news?.timeline) ? snapshot.news.timeline : []),
      ...(Array.isArray(snapshot?.news?.items) ? snapshot.news.items : []),
   ];
   for (const item of allNews) {
      const title = item?.title?.trim();
      if (title && title.length > 0 && !title.startsWith("近")) return buildNewsLine(title, 96);
   }
   return "—（近期無重大新聞）";
}

function buildOverseasCandidates(snapshot: SnapshotLike): OverseasCandidate[] {
   const candidates: OverseasCandidate[] = [];
   const sector = snapshot?.globalLinkage?.drivers?.sector;
   if (sector?.id) candidates.push({ symbol: String(sector.id), corr60: typeof sector.corr60 === "number" ? sector.corr60 : null });
   const peers = Array.isArray(snapshot?.globalLinkage?.drivers?.peers) ? snapshot.globalLinkage.drivers.peers : [];
   for (const p of peers) { if (p?.symbol) candidates.push({ symbol: String(p.symbol), corr60: typeof p.corr60 === "number" ? p.corr60 : null }); }
   const deduped = new Map<string, OverseasCandidate>();
   for (const c of candidates) { if (!deduped.has(c.symbol)) deduped.set(c.symbol, c); }
   const sorted = Array.from(deduped.values()).sort((a, b) => Math.abs(b.corr60 ?? 0) - Math.abs(a.corr60 ?? 0));
   return sorted.slice(0, 4);
}

async function fetchOverseasQuotes(candidates: OverseasCandidate[]): Promise<OverseasLine[]> {
   if (!candidates || candidates.length === 0) return [];
   return Promise.all(candidates.map(async (c) => {
      try {
         const bars = await fetchYahooFinanceBars(c.symbol, 7);
         if (!bars || bars.length < 2) return { symbol: c.symbol, price: null, chgPct: null, corr60: c.corr60 };
         const latest = bars[bars.length - 1].close;
         const prev = bars[bars.length - 2].close;
         return { symbol: c.symbol, price: latest, chgPct: ((latest - prev) / prev) * 100, corr60: c.corr60 };
      } catch { return { symbol: c.symbol, price: null, chgPct: null, corr60: c.corr60 }; }
   }));
}

function buildSyncLevel(overseas: OverseasLine[]): string {
   const corr = overseas.map((x) => x.corr60).filter((x): x is number => typeof x === "number");
   if (corr.length === 0) return "—";
   return syncLevel(corr.reduce((a, b) => a + Math.abs(b), 0) / corr.length);
}

function formatSignedHumanNumber(value: number | null): string {
   if (value === null) return "—";
   const absHuman = humanizeNumber(Math.abs(value));
   return `${value >= 0 ? "+" : "-"}${absHuman}`;
}

function buildVolumeState(volume: number | null, volumeVs5dPct: number | null): string {
   const volumeText = humanizeNumber(volume);
   if (volumeVs5dPct === null) return `${volumeText}（平量）`;
   if (volumeVs5dPct >= 80) return `${volumeText}（爆量）`;
   if (volumeVs5dPct >= 15) return `${volumeText}（放量）`;
   if (volumeVs5dPct <= -20) return `${volumeText}（縮量）`;
   return `${volumeText}（平量）`;
}

function buildOverseasSummary(overseas: OverseasLine[]): string {
   if (overseas.length === 0) return "N/A";
   return overseas.slice(0, 4).map((item) => `${item.symbol} ${formatPrice(item.price, 2)}(${formatSignedPct(item.chgPct, 2)})`).join("｜");
}

function buildStockCardLines(card: StockCard, verdict: string = "數據整理中"): string {
   const stanceText = buildStanceText(card.shortDir, card.strategySignal, card.confidence);
   const volumeState = buildVolumeState(card.volume, card.volumeVs5dPct);
   const support = formatPrice(card.support, 2);
   const resistance = formatPrice(card.resistance, 2);
   const lines = [
      `${card.symbol} ${card.nameZh} [${verdict}]`,
      `【現價】 ${formatPrice(card.close, 2)}（${formatSignedPct(card.chgPct, 2)}）`,
      `【量能】 ${volumeState}`,
      `【趨勢】 ${stanceText}（勝率 ${formatPct(card.confidence, 1)}）`,
      `【關鍵價】 支撐 ${support} ｜ 壓力 ${resistance}`,
      "",
      `【新聞】 ${card.newsLine || "—"}`,
   ];
   return lines.map((line) => escapeHtml(line)).join("\n");
}

async function buildStockCardWithAI(card: StockCard): Promise<string> {
   try {
      const playbook = await getTacticalPlaybook({
         ticker: card.symbol,
         stockName: card.nameZh,
         price: card.close || 0, // 確保這是最新即時價
         support: card.support || 0,
         resistance: card.resistance || 0,
         macroRisk: 0,
         technicalTrend: card.shortDir,
         flowScore: 50,
         flowVerdict: card.shortDir,
         recentTrend: `目前現價 ${card.close}，今日漲跌幅 ${card.chgPct?.toFixed(2)}%，成交量 ${card.volume}。`, // 強制傳入最新動態
         trustLots: 0,
         shortLots: 0,
         insiderTransfers: card.insiderSells.map(s => ({ ...s, transferMode: "一般交易", estimatedValue: 0, currentHoldings: 0, type: "市場拋售" } as any)),
      });
      
      const structuredPart = buildStockCardLines(card, playbook?.verdict || "觀察中");
      
      if (playbook) {
         return `${structuredPart}\n\n分析師建議：\n${escapeHtml(playbook.tacticalScript)}`;
      }
      return structuredPart;
   } catch (e) {
      return buildStockCardLines(card);
   }
}

const yahooFinance = new YahooFinance();

async function fetchLiveStockCard(query: string, overrideBaseUrl?: string): Promise<StockCard | null> {
   const resolved = resolveCodeFromInputLocal(query);
   const symbol = resolved || query.match(/^(\d{4,})(\.TW|\.TWO)?$/i)?.[1];
   if (!symbol) return null;
   const baseUrl = getSnapshotBaseUrl(overrideBaseUrl);
   if (!baseUrl) return null;
   try {
      const yahooSymbol = symbol.length >= 4 ? `${symbol}.TW` : symbol;
      const [res, rtQuote] = await Promise.all([
         fetch(`${baseUrl}/api/stock/${symbol}/snapshot`),
         yahooFinance.quote(yahooSymbol).catch(() => null)
      ]);
      if (!res.ok) return null;
      const snapshot = await res.json();
      
      let bars = Array.isArray(snapshot?.data?.prices) ? snapshot.data.prices : [];
      // 統一處理 Bars 數據轉換
      const processedBars = bars.map((b: any) => ({
         date: b.date || "",
         open: Number(b.open || b.Price || 0),
         high: Number(b.high || b.max || 0),
         low: Number(b.low || b.min || 0),
         close: Number(b.close || b.Price || 0),
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

      // 1. 先處理基礎數據 (Bars)
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

      // 2. 覆蓋為 Yahoo 實時數據 (如果可用)
      if (rtQuote && typeof rtQuote.regularMarketPrice === "number") {
         card.close = rtQuote.regularMarketPrice;
         card.chgPct = typeof rtQuote.regularMarketChangePercent === "number" ? rtQuote.regularMarketChangePercent : card.chgPct;
         card.chgAbs = typeof rtQuote.regularMarketChange === "number" ? rtQuote.regularMarketChange : card.chgAbs;
         
         if (typeof rtQuote.regularMarketVolume === "number") {
            card.volume = rtQuote.regularMarketVolume;
            // 重新計算 vs5D (包含今日即時量)
            const volInfo = calcVolumeVs5d([...processedBars.slice(0, -1), { volume: card.volume }]);
            card.volumeVs5dPct = volInfo.volumeVs5dPct;
         }
      }
      
      const key = calcSupportResistance(processedBars);
      card.support = snapshot?.keyLevels?.support || key.support;
      card.resistance = snapshot?.keyLevels?.resistance || key.resistance;

      // 繪製專業線圖
      if (processedBars.length >= 2) {
         card.chartBuffer = await renderStockChart(processedBars as ChartDataPoint[], card.support, card.resistance, card.symbol, 180);
      }
      
      card.flowNet = typeof snapshot?.signals?.flow?.foreign5D === "number" ? Math.round(snapshot.signals.flow.foreign5D / 1000) : null;
      card.p1d = snapshot?.predictions?.upProb1D;
      card.shortDir = buildTrendByProb(card.p1d);
      card.strategySignal = snapshot?.strategy?.signal || "觀察";
      card.confidence = snapshot?.strategy?.confidence;
      card.newsLine = extractNewsLineFromSnapshot(snapshot);
      return card;
   } catch (error) { return null; }
}

export async function generateBotReply(text: string, options?: TelegramHandleOptions): Promise<{ text: string, chartBuffer?: Buffer | null } | null> {
   const [commandRaw, ...argParts] = text.trim().split(/\s+/);
   const command = commandRaw.toLowerCase().split("@")[0];
   const query = argParts.join(" ").trim();
   if (command === "/tw" || command === "/stock") {
      if (!query) return { text: "請輸入股票代號，例如: /tw 2330" };
      const liveCard = await fetchLiveStockCard(query, options?.baseUrl);
      if (liveCard) {
         const finalMsg = await buildStockCardWithAI(liveCard);
         return { text: finalMsg, chartBuffer: liveCard.chartBuffer };
      }
      return { text: "找不到該股票資料。" };
   }
   return { text: "請使用 /tw 指令。" };
}

export async function handleTelegramMessage(chatId: number, text: string, isBackgroundPush = false, options?: TelegramHandleOptions) {
   if (isBackgroundPush) return;
   if (!text.startsWith("/")) return;
   await ensureTelegramCommandsSynced();
   const [commandRaw] = text.trim().split(/\s+/);
   const command = commandRaw.toLowerCase().split("@")[0];
   let progressMessageId: number | null = null;
   if (command === "/tw" || command === "/stock") progressMessageId = await sendMessage(chatId, "正在搜尋資料中...");
   const reply = await generateBotReply(text, options);
   if (reply) {
      if (reply.chartBuffer) await replyWithCard(chatId, progressMessageId, reply.text, reply.chartBuffer);
      else await replyOrEdit(chatId, progressMessageId, reply.text);
   }
}
