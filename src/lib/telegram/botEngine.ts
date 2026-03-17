import { fetchLatestReport } from "./reportFetcher";
import { getAllChatIds } from "./chatStore";
import { getTacticalPlaybook } from "../ai/playbookAgent";
import { getFilteredInsiderTransfers } from "../providers/twseInsiderFetch";
import { twStockNames } from "../../data/twStockNames";
import { renderStockChart, ChartDataPoint } from "../ux/chartRenderer";
import { yf as yahooFinance } from "@/lib/providers/yahooFinanceClient";
import { fetchFugleQuote } from "@/lib/providers/fugleQuote";
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
};

type TelegramHandleOptions = {
   baseUrl?: string;
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
            commands: [{ command: "tw", description: "查詢台股個股（例：/tw 2330）" }],
         }),
      });
      commandsSynced = true;
   } catch (error) { }
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

function buildVolumeState(volume: number | null, volumeVs5dPct: number | null): string {
   const volumeText = humanizeNumber(volume);
   if (volumeVs5dPct === null) return `${volumeText}（平量）`;
   if (volumeVs5dPct >= 80) return `${volumeText}（爆量）`;
   if (volumeVs5dPct >= 15) return `${volumeText}（放量）`;
   if (volumeVs5dPct <= -20) return `${volumeText}（縮量）`;
   return `${volumeText}（平量）`;
}

function buildStockCardLines(card: StockCard, verdict: string = "數據整理中"): string {
   const stanceText = buildStanceText(card.shortDir, card.strategySignal, card.confidence);
   const volumeState = buildVolumeState(card.volume, card.volumeVs5dPct);
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


async function fetchLiveStockCard(query: string, overrideBaseUrl?: string): Promise<StockCard | null> {
   const resolved = resolveCodeFromInputLocal(query);
   const symbol = resolved || query.match(/^(\d{4,})(\.TW|\.TWO)?$/i)?.[1];
   if (!symbol) return null;
   const baseUrl = getSnapshotBaseUrl(overrideBaseUrl);
   if (!baseUrl) return null;
   try {
      // Timeout 20 秒，防止 snapshot API 掛住讓 bot 卡死
      const controller = new AbortController();
      const snapTimer = setTimeout(() => controller.abort(), 20000);
      const snapRes = await fetch(`${baseUrl}/api/stock/${symbol}/snapshot`, { signal: controller.signal }).finally(() => clearTimeout(snapTimer));
      if (!snapRes.ok) return null;
      const snapshot = await snapRes.json();

      let yahooSymbol = snapshot?.normalizedTicker?.yahoo;
      if (symbol === "8299") yahooSymbol = "8299.TWO";
      if (!yahooSymbol || yahooSymbol === symbol) {
         yahooSymbol = (symbol.startsWith("8") || symbol.startsWith("6") || symbol.startsWith("5")) ? `${symbol}.TWO` : `${symbol}.TW`;
      }

      // 1. 優先用 Fugle 即時報價（台股，無延遲）
      // 2. Fallback 到 Yahoo Finance（15-20 分鐘延遲）
      const fugleQuote = await fetchFugleQuote(symbol);
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
      // 只有台股才能用 Fugle，非台股（美股）不標示延遲
      const isTWStock = /^\d{4}$/.test(symbol);
      card.isPriceRealTime = isTWStock ? fugleQuote !== null : undefined;

      return card;
   } catch (error) { return null; }
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
         const finalMsg = await buildStockCardWithAI(liveCard);
         return { text: finalMsg, chartBuffer: liveCard.chartBuffer };
      }
      return { text: "找不到該股票資料。" };
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
   if (command === "/tw") {
      await ensureTelegramCommandsSynced();
      progressMessageId = await sendMessage(chatId, "正在搜尋資料中...");
   }

   const reply = await generateBotReply(text, options);
   if (!reply) {
      if (progressMessageId) await deleteMessage(chatId, progressMessageId);
      return;
   }

   if (reply.chartBuffer) {
      await replyWithCard(chatId, progressMessageId, reply.text, reply.chartBuffer);
   } else {
      await replyOrEdit(chatId, progressMessageId, reply.text);
   }
}
