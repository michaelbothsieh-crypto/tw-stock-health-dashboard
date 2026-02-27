import { fetchLatestReport } from "./reportFetcher";
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
};

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

function getSnapshotBaseUrl(): string | null {
  const explicit = process.env.BOT_BASE_URL || process.env.APP_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  return null;
}

function resolveCodeFromInputLocal(input: string): string | null {
  const query = input.trim();
  if (!query) return null;

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

function quoteText(line: OverseasLine): string {
  const price = formatPrice(line.price, 2);
  const pct = formatSignedPct(line.chgPct, 2);
  return `${line.symbol} ${price}(${pct})`;
}

function buildStockCardMessage(card: StockCard): string {
  const stanceText = buildStanceText(card.shortDir, card.strategySignal, card.confidence);
  const overseasText = card.overseas.length > 0
    ? card.overseas.map((x) => quoteText(x)).join("、")
    : "—";

  const lines = [
    `${card.symbol} ${card.nameZh}`,
    `收盤：${formatPrice(card.close, 2)} (${formatSignedPct(card.chgPct, 2)}，${formatPrice(card.chgAbs, 2)})｜量：${humanizeNumber(card.volume)}（vs5D：${formatSignedPct(card.volumeVs5dPct, 1)}）`,
    `法人：${humanizeNumber(card.flowNet)}（單位：${card.flowUnit || "不明"}）`,
    `結論：${stanceText}（信心 ${formatPct(card.confidence, 1)}）｜1D↑ ${formatPct(card.p1d, 1)}（3D ${formatPct(card.p3d, 1)} / 5D ${formatPct(card.p5d, 1)}）`,
    `關鍵：支撐 ${formatPrice(card.support, 1)}｜壓力 ${formatPrice(card.resistance, 1)}`,
    `劇本：站上壓力→看 ${formatPrice(card.bullTarget, 1)}；跌破支撐→防 ${formatPrice(card.bearTarget, 1)}`,
    `海外：${overseasText}（同步度：${card.syncLevel}）`,
    `新聞：${card.newsLine || "—"}`,
    `來源：${card.sourceLabel}`,
  ];

  return lines.map((line) => escapeHtml(line)).join("\n");
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
    flowUnit: "不明",
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
  };
}

async function fetchLiveStockCard(query: string): Promise<StockCard | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const resolved = resolveCodeFromInputLocal(trimmed);
  const symbol = resolved || trimmed.match(/^(\d{4,})(\.TW|\.TWO)?$/i)?.[1] || null;
  if (!symbol) return null;

  const baseUrl = getSnapshotBaseUrl();
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/api/stock/${symbol}/snapshot`);
    if (!res.ok) return null;

    const snapshot = await res.json();
    let bars: Array<{ high?: number; low?: number; close?: number; volume?: number }> = Array.isArray(snapshot?.data?.prices)
      ? snapshot.data.prices
      : [];

    if (bars.length < 2) {
      try {
        const recent = await fetchRecentBars(symbol, 60);
        bars = recent.data.map((b) => ({ high: b.max, low: b.min, close: b.close, volume: b.Trading_Volume }));
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
      if (Number.isFinite(latest) && Number.isFinite(prev)) {
        card.chgAbs = latest - prev;
        card.chgPct = prev !== 0 ? ((latest - prev) / prev) * 100 : null;
      }

      const volInfo = calcVolumeVs5d(bars);
      card.volume = volInfo.volume;
      card.volumeVs5dPct = volInfo.volumeVs5dPct;

      const key = calcSupportResistance(bars);
      card.support = key.support;
      card.resistance = key.resistance;
      card.bullTarget = key.bullTarget;
      card.bearTarget = key.bearTarget;
    }

    card.flowNet = typeof snapshot?.signals?.flow?.foreign5D === "number" ? snapshot.signals.flow.foreign5D : null;
    card.flowUnit = "不明"; // TODO: confirm provider unit (shares/lot/value)

    card.p1d = typeof snapshot?.predictions?.upProb1D === "number" ? snapshot.predictions.upProb1D : null;
    card.p3d = typeof snapshot?.predictions?.upProb3D === "number" ? snapshot.predictions.upProb3D : null;
    card.p5d = typeof snapshot?.predictions?.upProb5D === "number" ? snapshot.predictions.upProb5D : null;

    card.shortDir = buildTrendByProb(card.p1d);
    card.strategySignal = String(snapshot?.strategy?.signal || "觀察");
    card.confidence = typeof snapshot?.strategy?.confidence === "number" ? snapshot.strategy.confidence : null;

    const topNews = [
      ...(Array.isArray(snapshot?.news?.topBullishNews) ? snapshot.news.topBullishNews : []),
      ...(Array.isArray(snapshot?.news?.topBearishNews) ? snapshot.news.topBearishNews : []),
    ];
    const firstNewsTitle = topNews.length > 0 && topNews[0]?.title ? String(topNews[0].title) : "";
    card.newsLine = buildNewsLine(firstNewsTitle, 96);

    const overseasCandidates: OverseasCandidate[] = [];
    const sector = snapshot?.globalLinkage?.drivers?.sector;
    if (sector?.id) {
      overseasCandidates.push({
        symbol: String(sector.id),
        corr60: typeof sector.corr60 === "number" ? sector.corr60 : null,
      });
    }
    const peers = Array.isArray(snapshot?.globalLinkage?.drivers?.peers) ? snapshot.globalLinkage.drivers.peers : [];
    for (const p of peers) {
      if (p?.symbol) {
        overseasCandidates.push({
          symbol: String(p.symbol),
          corr60: typeof p.corr60 === "number" ? p.corr60 : null,
        });
      }
    }

    // Dynamic overseas list from linkage results (not fixed 4 names).
    card.overseas = await fetchOverseasQuotes(overseasCandidates.slice(0, 8));
    card.syncLevel = buildSyncLevel(card.overseas);

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
  card.flowNet = parseSignedNumberLoose(row.flowTotal);
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

export async function handleTelegramMessage(chatId: number, text: string, isBackgroundPush = false) {
  const privateChatId = process.env.TELEGRAM_CHAT_ID;

  if (isBackgroundPush) {
    if (!privateChatId) {
      console.warn("[TelegramBot] Skipping background push: TELEGRAM_CHAT_ID is missing");
      return;
    }
    await sendMessage(privateChatId, text);
    return;
  }

  if (!text.startsWith("/")) return;

  const [commandRaw, ...argParts] = text.trim().split(/\s+/);
  const command = commandRaw.toLowerCase();
  const query = argParts.join(" ").trim();

  if (command !== "/stock") {
    await sendMessage(chatId, "目前僅支援 /stock 指令。");
    return;
  }

  if (!query) {
    await sendMessage(chatId, "請輸入股票代號或名稱，例如: /stock 2330");
    return;
  }

  const progressMessageId = await sendMessage(chatId, "正在搜尋資料中，請稍候...");

  const liveCard = await fetchLiveStockCard(query);
  if (liveCard) {
    await replyOrEdit(chatId, progressMessageId, buildStockCardMessage(liveCard));
    return;
  }

  let report: LatestReport | null = null;
  try {
    report = (await fetchLatestReport()) as LatestReport | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await replyOrEdit(
      chatId,
      progressMessageId,
      `目前即時來源暫時不可用，且最新收盤報告尚未同步完成。\n請稍後再試（不是無資料）。\n\n錯誤: ${escapeHtml(message)}`,
    );
    return;
  }

  if (!report || !Array.isArray(report.watchlist) || report.watchlist.length === 0) {
    await replyOrEdit(chatId, progressMessageId, "最新收盤報告尚未同步完成，請稍後再試（不是無資料）。");
    return;
  }

  const stock = report.watchlist.find((item) => {
    const symbolMatch = item.symbol === query;
    const nameMatch = item.nameZh?.includes(query);
    return symbolMatch || Boolean(nameMatch);
  });

  if (!stock) {
    await replyOrEdit(chatId, progressMessageId, `找不到 ${escapeHtml(query)}，請確認股票代號或名稱。`);
    return;
  }

  await replyOrEdit(chatId, progressMessageId, buildStockCardMessage(cardFromReportRow(stock)));
}
