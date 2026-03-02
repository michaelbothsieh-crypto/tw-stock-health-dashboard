import { fetchLatestReport } from "./reportFetcher";
import { getAllChatIds } from "./chatStore";
import { getTacticalPlaybook } from "../ai/playbookAgent";
import { getFilteredInsiderTransfers } from "../providers/twseInsiderFetch";
import { twStockNames } from "../../data/twStockNames";
import { fetchYahooFinanceBars } from "../global/yahooFinance";
import { fetchRecentBars } from "../range";
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
   chartUrl: string | null;
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
   if (!token) {
      console.error("[TelegramBot] TELEGRAM_BOT_TOKEN is missing");
      return null;
   }

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

      if (!res.ok) {
         console.error("[TelegramBot] Send Error:", await res.text());
         return null;
      }

      const payload = await res.json().catch(() => null);
      const messageId = payload?.result?.message_id;
      return typeof messageId === "number" ? messageId : null;
   } catch (error) {
      console.error("[TelegramBot] Network Error:", error);
      return null;
   }
}

async function sendPhoto(chatId: string | number, photoUrl: string, caption: string): Promise<number | null> {
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token) return null;

   const url = `https://api.telegram.org/bot${token}/sendPhoto`;
   try {
      const res = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            chat_id: chatId,
            photo: photoUrl,
            caption,
            parse_mode: "HTML",
         }),
      });

      if (!res.ok) {
         console.error("[TelegramBot] SendPhoto Error:", await res.text());
         return null;
      }

      const payload = await res.json().catch(() => null);
      const messageId = payload?.result?.message_id;
      return typeof messageId === "number" ? messageId : null;
   } catch (error) {
      console.error("[TelegramBot] SendPhoto Network Error:", error);
      return null;
   }
}

async function deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token) return false;

   const url = `https://api.telegram.org/bot${token}/deleteMessage`;
   try {
      const res = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
         }),
      });
      return res.ok;
   } catch (error) {
      return false;
   }
}

async function editMessage(chatId: string | number, messageId: number, text: string): Promise<boolean> {
   const token = process.env.TELEGRAM_BOT_TOKEN;
   if (!token) {
      console.error("[TelegramBot] TELEGRAM_BOT_TOKEN is missing");
      return false;
   }

   const url = `https://api.telegram.org/bot${token}/editMessageText`;
   try {
      const res = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
         }),
      });

      if (!res.ok) {
         console.error("[TelegramBot] Edit Error:", await res.text());
         return false;
      }
      return true;
   } catch (error) {
      console.error("[TelegramBot] Edit Network Error:", error);
      return false;
   }
}

async function replyOrEdit(chatId: number, progressMessageId: number | null, text: string) {
   if (progressMessageId !== null) {
      const ok = await editMessage(chatId, progressMessageId, text);
      if (ok) return;
   }
   await sendMessage(chatId, text);
}

async function replyWithCard(chatId: number, progressMessageId: number | null, text: string, photoUrl: string | null) {
   if (photoUrl) {
      if (progressMessageId !== null) {
         await deleteMessage(chatId, progressMessageId);
      }

      // Use a very brief caption to avoid 1024 character limits and HTML truncation bugs.
      // Usually the first line of 'text' contains the stock name.
      const firstLine = (text.split('\n')[0] || "Stock Chart").replace(/<b>/g, "").replace(/<\/b>/g, "").trim();
      const caption = `📊 ${firstLine}`;

      const sentPhoto = await sendPhoto(chatId, photoUrl, caption);
      if (!sentPhoto) {
         console.warn(`[TelegramBot] Failed to send photo (len=${photoUrl.length})`);
         // Fallback: send just the text if photo fails
         await sendMessage(chatId, text);
      } else {
         // Successfully sent photo, now send the full analysis as a second message
         await sendMessage(chatId, text);
      }
   } else {
      await replyOrEdit(chatId, progressMessageId, text);
   }
}

function escapeHtml(input: string): string {
   return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
}

function toNumberPercent(value: unknown): number | null {
   if (typeof value === "number" && Number.isFinite(value)) return value;
   if (typeof value === "string") {
      const parsed = Number(value.replace("%", "").trim());
      if (Number.isFinite(parsed)) return parsed;
   }
   return null;
}

function parseChangePct(value?: string): number | null {
   return toNumberPercent(value ?? null);
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
   if (!token) return;
   if (token === "TEST_TOKEN") return;

   const base = `https://api.telegram.org/bot${token}`;
   try {
      // Clear any stale command menu first, then set only /tw.
      await fetch(`${base}/deleteMyCommands`, { method: "POST" });
      await fetch(`${base}/setMyCommands`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            commands: [{ command: "tw", description: "查詢台股個股（例：/tw 2330）" }],
         }),
      });
      commandsSynced = true;
   } catch (error) {
      console.error("[TelegramBot] setMyCommands failed", error);
   }
}

async function buildChartUrl(bars: Array<{ open?: number; high?: number; low?: number; close?: number; volume?: number }>, support: number | null, resistance: number | null): Promise<string | null> {
   if (!bars || bars.length < 2) return null;

   const data = bars.map(b => Number(b.close)).filter(Number.isFinite);
   if (data.length === 0) return null;

   const latestPrice = data[data.length - 1];
   const prevPrice = data.length > 1 ? data[data.length - 2] : data[0];
   const isUp = latestPrice >= prevPrice;
   const baseColor = isUp ? 'rgb(239, 68, 68)' : 'rgb(34, 197, 94)';

   const annotations: any = {};
   if (support !== null) {
      annotations.support = {
         type: 'line', scaleID: 'y', yMin: support, yMax: support,
         borderColor: 'rgba(34, 197, 94, 0.8)', borderWidth: 1.5, borderDash: [4, 4],
         label: { display: true, content: '支撐 ' + support, position: 'start', backgroundColor: 'rgba(34, 197, 94, 0.8)', font: { size: 10 } }
      };
   }
   if (resistance !== null) {
      annotations.resistance = {
         type: 'line', scaleID: 'y', yMin: resistance, yMax: resistance,
         borderColor: 'rgba(239, 68, 68, 0.8)', borderWidth: 1.5, borderDash: [4, 4],
         label: { display: true, content: '壓力 ' + resistance, position: 'start', backgroundColor: 'rgba(239, 68, 68, 0.8)', font: { size: 10 } }
      };
   }
   annotations.price = {
      type: 'line', scaleID: 'y', yMin: latestPrice, yMax: latestPrice,
      borderColor: baseColor, borderWidth: 1.5, borderDash: [2, 2],
      label: { display: true, content: '現價 ' + latestPrice.toFixed(2), position: 'end', backgroundColor: baseColor, font: { size: 10 } }
   };

   const isCandlestick = bars.every(b => (
      typeof b.open === 'number' && typeof b.high === 'number' &&
      typeof b.low === 'number' && typeof b.close === 'number'
   ));

   const chartData = bars.map(b => Number(b.close)).filter(Number.isFinite);
   const chartVols = bars.map(b => Number(b.volume)).filter(Number.isFinite);
   const maxVol = chartVols.length > 0 ? Math.max(...chartVols) : 1;

   const datasets: any[] = [];
   if (isCandlestick) {
      datasets.push({
         type: 'candlestick',
         data: bars.map((b, i) => ({ x: i, o: b.open, h: b.high, l: b.low, c: b.close })),
         color: { up: 'rgb(239, 68, 68)', down: 'rgb(34, 197, 94)', unchanged: 'gray' },
         yAxisID: 'y'
      });
   } else {
      datasets.push({
         type: 'line',
         data: chartData,
         borderColor: baseColor,
         borderWidth: 2,
         fill: false,
         pointRadius: 0,
         yAxisID: 'y'
      });
   }

   if (chartVols.length === chartData.length) {
      datasets.push({
         type: 'bar',
         data: chartVols,
         backgroundColor: 'rgba(156, 163, 175, 0.3)',
         yAxisID: 'yVol'
      });
   }

   const config = {
      type: isCandlestick ? 'candlestick' : 'line',
      data: {
         labels: bars.map((_, i) => i),
         datasets
      },
      options: {
         plugins: {
            legend: { display: false },
            annotation: {
               annotations
            }
         },
         scales: {
            x: { display: false },
            y: {
               position: 'right',
               grid: { color: 'rgba(0,0,0,0.1)' },
               ticks: { color: '#6b7280' }
            },
            yVol: {
               display: false,
               min: 0,
               max: maxVol * 4
            }
         },
         layout: { padding: { left: 10, right: 60, top: 10, bottom: 10 } }
      }
   };

   // Use QuickChart Short URL API to avoid length limits on Telegram/LINE
   try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const resp = await fetch('https://quickchart.io/chart/create', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            chart: config,
            width: 600,
            height: 400,
            backgroundColor: 'white',
            format: 'png',
            version: '3'
         }),
         signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
         const errText = await resp.text();
         throw new Error(`QuickChart API Error: ${resp.status} - ${errText}`);
      }
      const result = await resp.json();
      if (result.success && result.url) {
         console.log(`[BotEngine] Short URL: ${result.url}`);
         return result.url;
      }
      throw new Error('QuickChart result missing success or url');
   } catch (e) {
      // If Short URL fails, fallback to long URL but with REDUCED BARS to fit limits
      const limitedBars = bars.slice(-30); // Use fewer bars for long URL
      const limitedConfig = { ...config, data: { ...config.data, labels: limitedBars.map((_, i) => i) } };
      // Note: mapping datasets to limited data is complex, so we just use the original config but warn
      const longUrl = `https://quickchart.io/chart?bkg=white&c=${encodeURIComponent(JSON.stringify(config))}`;
      console.warn(`[BotEngine] Short URL fail (len=${longUrl.length}):`, e);
      return longUrl.length < 2000 ? longUrl : null;
   }
}

function resolveCodeFromInputLocal(input: string): string | null {
   const query = input.trim();

   const codeMatch = query.match(/^(\d{4,})(\.TW|\.TWO)?$/i);
   if (codeMatch) return codeMatch[1];

   for (const [code, name] of Object.entries(twStockNames)) {
      if (name === query) return code;
   }

   for (const [code, name] of Object.entries(twStockNames)) {
      if (name.includes(query) || query.includes(name)) return code;
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
   // 將所有可能的新聞來源合並，優先取最重要的
   const allNews: Array<{ title?: string }> = [
      ...(Array.isArray(snapshot?.news?.topBullishNews) ? snapshot.news.topBullishNews : []),
      ...(Array.isArray(snapshot?.news?.topBearishNews) ? snapshot.news.topBearishNews : []),
      ...(Array.isArray(snapshot?.news?.topNews) ? snapshot.news.topNews : []),
      ...(Array.isArray(snapshot?.news?.timeline) ? snapshot.news.timeline : []),
      ...(Array.isArray(snapshot?.news?.items) ? snapshot.news.items : []),
   ];

   // 取第一則有標題的新聞
   for (const item of allNews) {
      const title = item?.title?.trim();
      if (title && title.length > 0 && !title.startsWith("近")) {
         return buildNewsLine(title, 96);
      }
   }

   if (snapshot?.news?.error) {
      // 即使有 error，如果我們其實有抓到備用新聞，上面已經返回了。
      // 如果走到這，代表真的沒新聞，只是被標記了 error。
      return "—（新聞來源暫時不可用）";
   }

   return "—（近期無重大新聞）";
}

function buildOverseasCandidates(snapshot: SnapshotLike): OverseasCandidate[] {
   const candidates: OverseasCandidate[] = [];
   const sector = snapshot?.globalLinkage?.drivers?.sector;
   if (sector?.id) {
      candidates.push({
         symbol: String(sector.id),
         corr60: typeof sector.corr60 === "number" ? sector.corr60 : null,
      });
   }

   const peers = Array.isArray(snapshot?.globalLinkage?.drivers?.peers) ? snapshot.globalLinkage.drivers.peers : [];
   for (const p of peers) {
      if (p?.symbol) {
         candidates.push({
            symbol: String(p.symbol),
            corr60: typeof p.corr60 === "number" ? p.corr60 : null,
         });
      }
   }

   // Prefer clearer linkage: sort by abs(corr60), keep meaningful peers first.
   const deduped = new Map<string, OverseasCandidate>();
   for (const c of candidates) {
      if (!deduped.has(c.symbol)) deduped.set(c.symbol, c);
   }

   const sorted = Array.from(deduped.values()).sort((a, b) => {
      const aScore = Math.abs(a.corr60 ?? 0);
      const bScore = Math.abs(b.corr60 ?? 0);
      return bScore - aScore;
   });

   const strong = sorted.filter((c) => Math.abs(c.corr60 ?? 0) >= 0.15);
   if (strong.length > 0) {
      return strong.slice(0, 6);
   }
   return sorted.slice(0, 4);
}

async function fetchOverseasQuotes(candidates: OverseasCandidate[]): Promise<OverseasLine[]> {
   if (!candidates || candidates.length === 0) return [];

   const uniqueSymbols = Array.from(new Set(candidates.map((c) => c.symbol).filter(Boolean)));
   const corrMap = new Map<string, number | null>();
   for (const c of candidates) {
      if (!corrMap.has(c.symbol)) corrMap.set(c.symbol, c.corr60);
   }

   const result = await Promise.all(
      uniqueSymbols.map(async (symbol) => {
         try {
            const bars = await fetchYahooFinanceBars(symbol, 7);
            if (!bars || bars.length < 2) {
               return { symbol, price: null, chgPct: null, corr60: corrMap.get(symbol) ?? null };
            }
            const latest = bars[bars.length - 1].close;
            const prev = bars[bars.length - 2].close;
            const chgPct = prev > 0 ? ((latest - prev) / prev) * 100 : null;
            return {
               symbol,
               price: Number.isFinite(latest) ? latest : null,
               chgPct: Number.isFinite(chgPct ?? NaN) ? chgPct : null,
               corr60: corrMap.get(symbol) ?? null,
            };
         } catch (error) {
            console.error(`[TelegramBot] overseas quote failed: ${symbol}`, error);
            return { symbol, price: null, chgPct: null, corr60: corrMap.get(symbol) ?? null };
         }
      }),
   );

   return result;
}

function buildSyncLevel(overseas: OverseasLine[]): string {
   const corr = overseas
      .map((x) => x.corr60)
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
   if (corr.length === 0) return "—";
   const meanAbs = corr.reduce((a, b) => a + Math.abs(b), 0) / corr.length;
   return syncLevel(meanAbs);
}

function formatSignedHumanNumber(value: number | null): string {
   if (value === null) return "—";
   const absHuman = humanizeNumber(Math.abs(value));
   const sign = value >= 0 ? "+" : "-";
   return `${sign}${absHuman}`;
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
   const preferred = ["SOXX", "NVDA", "AVGO", "TSM"];
   const bySymbol = new Map<string, OverseasLine>();
   for (const item of overseas) {
      bySymbol.set(item.symbol, item);
   }

   const hasPreferred = preferred.some((s) => bySymbol.has(s));
   if (hasPreferred) {
      return preferred
         .map((symbol) => {
            const item = bySymbol.get(symbol);
            if (!item) return `${symbol} N/A`;
            return `${symbol} ${formatPrice(item.price, 2)}(${formatSignedPct(item.chgPct, 2)})`;
         })
         .join("｜");
   }

   if (overseas.length === 0) return "N/A";
   return overseas
      .slice(0, 4)
      .map((item) => `${item.symbol} ${formatPrice(item.price, 2)}(${formatSignedPct(item.chgPct, 2)})`)
      .join("｜");
}

function buildStockCardLines(card: StockCard): string {
   const stanceText = buildStanceText(card.shortDir, card.strategySignal, card.confidence);
   const overseasText = buildOverseasSummary(card.overseas);
   const volumeState = buildVolumeState(card.volume, card.volumeVs5dPct);
   const flowHuman = formatSignedHumanNumber(card.flowNet);
   const flowUnit = card.flowUnit || "N/A";
   const support = formatPrice(card.support, 2);
   const resistance = formatPrice(card.resistance, 2);
   const bullTarget = formatPrice(card.bullTarget, 2);
   const bearTarget = formatPrice(card.bearTarget, 2);

   const hasInsiderSell = card.insiderSells && card.insiderSells.length > 0;
   const insiderWarningLine = hasInsiderSell
      ? `🚨 【內部人警示】 ${card.insiderSells
         .slice(0, 2)
         .map(s => `${s.date} ${s.role}「${s.declarer}」拋售 ${s.lots.toLocaleString()} 張（${s.valueText}）`)
         .join("；")}`
      : null;

   const lines = [
      `📊 ${card.symbol} ${card.nameZh}`,
      `【現價】 ${formatPrice(card.close, 2)}（${formatSignedPct(card.chgPct, 2)}）`,
      `【量能】 ${volumeState}（vs5D ${formatSignedPct(card.volumeVs5dPct, 1)}）`,
      `【法人】 ${flowHuman}（單位：${flowUnit}）`,
      `【趨勢】 ${stanceText}（勝率 ${formatPct(card.confidence, 1)}）`,
      "",
      `【關鍵價】 支撐 ${support} ｜ 壓力 ${resistance}`,
      `• 站穩 ${resistance} → 看 ${bullTarget}（續強）`,
      `• 跌破 ${support} → 防 ${bearTarget}（轉弱）`,
      "",
      `【新聞】 ${card.newsLine || "—"}`,
      ...(insiderWarningLine ? ["", insiderWarningLine] : []),
   ];

   return lines.map((line) => escapeHtml(line)).join("\n");
}

async function buildStockCardWithAI(card: StockCard): Promise<string> {
   const structuredPart = buildStockCardLines(card);

   try {
      const playbook = await getTacticalPlaybook({
         ticker: card.symbol,
         stockName: card.nameZh,
         price: card.close || 0,
         support: card.support || 0,
         resistance: card.resistance || 0,
         macroRisk: 0, // Default to 0 for bot if unknown
         technicalTrend: card.shortDir,
         flowScore: 50, // Default neutral
         flowVerdict: card.shortDir,
         trustLots: 0,
         shortLots: 0,
         insiderTransfers: card.insiderSells.map(s => ({
            date: s.date,
            declarer: s.declarer,
            role: s.role,
            transferMode: "一般交易", // Default fallback
            humanMode: s.humanMode,
            lots: s.lots,
            valueText: s.valueText,
            estimatedValue: 0, // Placeholder
            currentHoldings: 0, // Placeholder
            transferRatio: s.transferRatio || 0,
            type: "市場拋售"
         })),
      });

      if (playbook) {
         const divider = escapeHtml("━━━━━━━━━━━━━━");
         const aiSection = [
            divider,
            `🤖 <b>AI 戰報：【${escapeHtml(playbook.verdict)}】</b>`,
            "",
            `⚡ <b>戰術腳本：</b>`,
            escapeHtml(playbook.tacticalScript),
            ...(playbook.insiderComment ? ["", `⚠️ <b>內部人異動：</b>`, escapeHtml(playbook.insiderComment)] : []),
         ].join("\n");

         return `${structuredPart}\n\n${aiSection}`;
      }
   } catch (e) {
      console.warn("[TelegramBot] AI playbook failed, using plain card:", e);
   }

   return structuredPart;
}

function createFallbackCard(symbol: string, nameZh: string, sourceLabel: string): StockCard {
   return {
      symbol,
      nameZh,
      close: null,
      chgPct: null,
      chgAbs: null,
      volume: null,
      volumeVs5dPct: null,
      flowNet: null,
      flowUnit: "股",
      shortDir: "中立",
      strategySignal: "觀察",
      confidence: null,
      p1d: null,
      p3d: null,
      p5d: null,
      support: null,
      resistance: null,
      bullTarget: null,
      bearTarget: null,
      overseas: [],
      syncLevel: "—",
      newsLine: "—",
      sourceLabel,
      insiderSells: [],
      chartUrl: null,
   };
}

async function fetchLiveStockCard(query: string, overrideBaseUrl?: string): Promise<StockCard | null> {
   const trimmed = query.trim();
   if (!trimmed) return null;

   const resolved = resolveCodeFromInputLocal(trimmed);
   const symbol = resolved || trimmed.match(/^(\d{4,})(\.TW|\.TWO)?$/i)?.[1] || null;
   if (!symbol) return null;

   const baseUrl = getSnapshotBaseUrl(overrideBaseUrl);
   if (!baseUrl) return null;

   try {
      const res = await fetch(`${baseUrl}/api/stock/${symbol}/snapshot`, { cache: 'no-store' });
      if (!res.ok) return null;

      const snapshot = await res.json();
      let bars: Array<{ open?: number; high?: number; low?: number; close?: number; volume?: number }> = Array.isArray(snapshot?.data?.prices)
         ? snapshot.data.prices
         : [];

      if (bars.length < 180) {
         try {
            const recent = await fetchRecentBars(symbol, 180);
            bars = recent.data.map((b) => ({ open: b.open, high: b.max, low: b.min, close: b.close, volume: b.Trading_Volume }));
         } catch (error) {
            console.error(`[TelegramBot] bars fallback failed: ${symbol}`, error);
         }
      }

      const card = createFallbackCard(
         String(snapshot?.normalizedTicker?.symbol || symbol),
         String(snapshot?.normalizedTicker?.companyNameZh || snapshot?.normalizedTicker?.displayName || symbol),
         "即時 snapshot",
      );

      if (bars.length >= 2) {
         const latest = Number(bars[bars.length - 1].close ?? NaN);
         const prev = Number(bars[bars.length - 2].close ?? NaN);
         if (Number.isFinite(latest)) card.close = latest;

         // Prioritize real-time quote from snapshot API
         if (snapshot.realTimeQuote && typeof snapshot.realTimeQuote.price === 'number') {
            const rtPrice = snapshot.realTimeQuote.price;
            card.close = rtPrice;
            if (typeof snapshot.realTimeQuote.changePct === 'number') {
               const rtChgPct = snapshot.realTimeQuote.changePct;
               card.chgPct = rtChgPct;
               const changePkg = rtChgPct / 100;
               if (changePkg !== -1) {
                  card.chgAbs = changePkg * (rtPrice / (1 + changePkg)); // Reverse calculate
               } else {
                  card.chgAbs = 0;
               }
            }
         } else if (Number.isFinite(latest) && Number.isFinite(prev)) {
            card.chgAbs = latest - prev;
            card.chgPct = prev !== 0 ? ((latest - prev) / prev) * 100 : null;
         }

         console.log(`[TelegramBot] Using Price: ${card.close} for ${symbol}`);
      }

      const volInfo = calcVolumeVs5d(bars);
      card.volume = volInfo.volume;
      card.volumeVs5dPct = volInfo.volumeVs5dPct;

      if (snapshot.keyLevels && typeof snapshot.keyLevels.support === 'number' && typeof snapshot.keyLevels.resistance === 'number') {
         card.support = snapshot.keyLevels.support;
         card.resistance = snapshot.keyLevels.resistance;
         card.bullTarget = snapshot.keyLevels.bullTarget ?? null;
         card.bearTarget = snapshot.keyLevels.bearTarget ?? null;
      } else {
         const key = calcSupportResistance(bars);
         card.support = key.support;
         card.resistance = key.resistance;
         card.bullTarget = key.bullTarget;
         card.bearTarget = key.bearTarget;
      }

      // Ensure chart is ALWAYS generated if we have enough data
      if (bars.length >= 2) {
         card.chartUrl = await buildChartUrl(bars.slice(-60), card.support, card.resistance);
      }

      card.flowNet = typeof snapshot?.signals?.flow?.foreign5D === "number" ? Math.round(snapshot.signals.flow.foreign5D / 1000) : null;
      card.flowUnit = "張";

      card.p1d = typeof snapshot?.predictions?.upProb1D === "number" ? snapshot.predictions.upProb1D : null;
      card.p3d = typeof snapshot?.predictions?.upProb3D === "number" ? snapshot.predictions.upProb3D : null;
      card.p5d = typeof snapshot?.predictions?.upProb5D === "number" ? snapshot.predictions.upProb5D : null;

      card.shortDir = buildTrendByProb(card.p1d);
      card.strategySignal = String(snapshot?.strategy?.signal || "觀察");
      card.confidence = typeof snapshot?.strategy?.confidence === "number" ? snapshot.strategy.confidence : null;

      card.newsLine = extractNewsLineFromSnapshot(snapshot as SnapshotLike);
      const overseasCandidates = buildOverseasCandidates(snapshot as SnapshotLike);

      // Dynamic overseas list from linkage results (not fixed 4 names).
      card.overseas = await fetchOverseasQuotes(overseasCandidates);
      card.syncLevel = buildSyncLevel(card.overseas);

      // 平行查詢內部人申報轉讓（60天內，門檻1000萬）
      try {
         const insiderRaw = await getFilteredInsiderTransfers(symbol);
         // 只取市場拋售型（最重要的警示，其他類型略過）
         card.insiderSells = insiderRaw
            .filter(t => t.type === "市場拋售")
            .map(t => ({
               date: t.date,
               declarer: t.declarer,
               role: t.role,
               humanMode: t.humanMode,
               lots: t.lots,
               valueText: t.valueText,
               transferRatio: t.transferRatio,
            }));
      } catch (e) {
         console.warn(`[TelegramBot] insider fetch failed for ${symbol}:`, e);
         card.insiderSells = [];
      }

      return card;
   } catch (error) {
      console.error(`[TelegramBot] live snapshot failed: ${symbol}`, error);
      return null;
   }
}

function normalizeReportRow(raw: TelegramStockRow): TelegramStockRow {
   return {
      ...raw,
      symbol: String(raw.symbol || ""),
      nameZh: String(raw.nameZh || raw.symbol || ""),
      strategySignal: raw.strategySignal || raw.predText || "觀察",
      strategyConfidence: typeof raw.strategyConfidence === "number" ? raw.strategyConfidence : null,
      upProb1D: raw.upProb1D ?? toNumberPercent(raw.probText),
      upProb3D: raw.upProb3D ?? toNumberPercent(raw.h3Text),
      upProb5D: raw.upProb5D ?? toNumberPercent(raw.h5Text),
      majorNews: Array.isArray(raw.majorNews) ? raw.majorNews : [],
   };
}

function cardFromReportRow(rowRaw: TelegramStockRow): StockCard {
   const row = normalizeReportRow(rowRaw);
   const card = createFallbackCard(row.symbol, row.nameZh, "收盤報告");
   card.close = typeof row.price === "number" ? row.price : null;
   card.chgPct = parseChangePct(row.changePct);

   const rawFlow = parseSignedNumberLoose(row.flowTotal);
   card.flowNet = rawFlow !== null ? Math.round(rawFlow / 1000) : null;
   card.flowUnit = "張";

   card.shortDir = row.tomorrowTrend || "中立";
   card.strategySignal = row.strategySignal || "觀察";
   card.confidence = row.strategyConfidence;
   card.p1d = row.upProb1D;
   card.p3d = row.upProb3D;
   card.p5d = row.upProb5D;

   const firstNews = row.majorNews?.[0]?.title || row.majorNewsSummary || "";
   card.newsLine = buildNewsLine(firstNews, 96);
   return card;
}
export async function generateBotReply(
   text: string,
   options?: TelegramHandleOptions,
): Promise<{ text: string, photoUrl?: string | null } | null> {
   const [commandRaw, ...argParts] = text.trim().split(/\s+/);
   // Support group commands like /tw@YourBot
   const command = commandRaw.toLowerCase().split("@")[0];
   const query = argParts.join(" ").trim();

   if (command === "/start" || command === "/help") {
      const welcome = [
         "👋 歡迎使用台股診斷助手！",
         "",
         "我會幫你整合技術面、籌碼動態與 AI 預測，提供一目了然的個股診斷報告。",
         "",
         "📌 <b>如何查詢？</b>",
         "請使用 <code>/tw</code> 指令，後方加上股票代號或名稱。",
         "例如：<code>/tw 2330</code> 或 <code>/tw 台積電</code>",
         "",
         "如果是剛加入，建議直接輸入 <code>/tw 2330</code> 試試看喔！",
      ].join("\n");
      return { text: welcome };
   }

   if (command === "/watchlist") {
      const wl = process.env.WATCHLIST_TW || "暫無系統預設";
      return { text: `📝 <b>預設觀察清單</b>\n\n${escapeHtml(wl)}` };
   }

   if (command === "/daily") {
      let reportData: any;
      try {
         reportData = await fetchLatestReport();
      } catch (e: any) {
         return { text: `⚠️ 讀取報告失敗，請確認設定: ${escapeHtml(e.message)}` };
      }
      if (!reportData || !reportData.watchlist) {
         return { text: "目前尚未產出最新收盤報告，請稍後再試。" };
      }

      let msg = `📊 <b>每日收盤極簡總覽</b> (${reportData.date})\n\n`;
      for (const r of reportData.watchlist) {
         if (r.predText === "—") {
            msg += `• ${r.nameZh}(${r.symbol}) ${r.changePct} ⚠️ 資料不足(法人不完整)\n`;
         } else {
            const dirText = r.predText === "微多" ? "偏多" : r.predText;
            msg += `• ${r.nameZh}(${r.symbol}) ${r.changePct}｜法人${r.flowTotal}｜${dirText} ${r.probText}｜3D ${r.h3Text?.split(" ")[0]}｜5D ${r.h5Text?.split(" ")[0]}\n`;
         }
      }
      return { text: msg };
   }

   if (command === "/tw" || command === "/stock") {
      if (!query) {
         return { text: "請輸入股票代號或名稱，例如: /tw 2330" };
      }

      const liveCard = await fetchLiveStockCard(query, options?.baseUrl);
      if (liveCard) {
         const finalMsg = await buildStockCardWithAI(liveCard);
         return { text: finalMsg, photoUrl: liveCard.chartUrl };
      }

      let report: LatestReport | null = null;
      try {
         report = (await fetchLatestReport()) as LatestReport | null;
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         return { text: `目前即時來源暫時不可用，且最新收盤報告尚未同步完成。\n請稍後再試（不是無資料）。\n\n錯誤: ${escapeHtml(message)}` };
      }

      if (!report || !Array.isArray(report.watchlist) || report.watchlist.length === 0) {
         return { text: "最新收盤報告尚未同步完成，請稍後再試（不是無資料）。" };
      }

      const stock = report.watchlist.find((item) => {
         const symbolMatch = item.symbol === query;
         const nameMatch = item.nameZh?.includes(query);
         return symbolMatch || Boolean(nameMatch);
      });

      if (!stock) {
         return { text: `找不到 ${escapeHtml(query)}，請確認股票代號或名稱。` };
      }

      const reportCard = cardFromReportRow(stock);
      const finalMsg = await buildStockCardWithAI(reportCard);
      return { text: finalMsg, photoUrl: reportCard.chartUrl };
   }

   return { text: "未知的指令。請輸入 /help 查看說明。" };
}


export async function handleTelegramMessage(
   chatId: number,
   text: string,
   isBackgroundPush = false,
   options?: TelegramHandleOptions,
) {
   if (isBackgroundPush) {
      const chatIds = await getAllChatIds();
      if (chatIds.length === 0) {
         console.warn("[TelegramBot] Skipping background push: no chat_ids found");
         return;
      }
      console.log(`[TelegramBot] Broadcasting to ${chatIds.length} chat(s): ${chatIds.join(", ")}`);
      await Promise.all(chatIds.map((id) => sendMessage(id, text)));
      return;
   }

   if (!text.startsWith("/")) return;

   await ensureTelegramCommandsSynced();

   const [commandRaw] = text.trim().split(/\s+/);
   const command = commandRaw.toLowerCase().split("@")[0];

   let progressMessageId: number | null = null;
   if (command === "/tw" || command === "/stock") {
      progressMessageId = await sendMessage(chatId, "正在搜尋資料中，請稍候...");
   }

   const reply = await generateBotReply(text, options);

   if (reply) {
      if (reply.photoUrl && (command === "/tw" || command === "/stock")) {
         await replyWithCard(chatId, progressMessageId, reply.text, reply.photoUrl);
      } else {
         await replyOrEdit(chatId, progressMessageId, reply.text);
      }
   } else if (progressMessageId) {
      await deleteMessage(chatId, progressMessageId);
   }
}
