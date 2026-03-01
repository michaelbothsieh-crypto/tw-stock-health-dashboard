import { fetchLatestReport } from "./reportFetcher";
import { getAllChatIds } from "./chatStore";
import { generateStockAnalysis } from "../ai/stockAnalyst";
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
    await sendPhoto(chatId, photoUrl, text);
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

function buildChartUrl(bars: Array<{ close?: number, volume?: number }>, support: number | null, resistance: number | null): string | null {
  if (!bars || bars.length < 2) return null;
  
  const data = bars.map(b => Number(b.close)).filter(Number.isFinite);
  if (data.length === 0) return null;
  
  const volumes = bars.map(b => Number(b.volume)).filter(Number.isFinite);
  const maxVol = volumes.length > 0 ? Math.max(...volumes) : 1;
  
  const isUp = data[data.length - 1] > data[0];
  const color = isUp ? 'rgb(239, 68, 68)' : 'rgb(34, 197, 94)'; // 紅漲綠跌
  const latestPrice = data[data.length - 1];
  
  const annotations = [];
  
  if (support !== null) {
    annotations.push({
      type: 'line',
      mode: 'horizontal',
      scaleID: 'y',
      value: support,
      borderColor: 'rgba(34, 197, 94, 0.8)',
      borderWidth: 1.5,
      borderDash: [4, 4],
      label: { enabled: true, content: '支撐 ' + support, position: 'left', backgroundColor: 'rgba(34, 197, 94, 0.8)' }
    });
  }
  
  if (resistance !== null) {
    annotations.push({
      type: 'line',
      mode: 'horizontal',
      scaleID: 'y',
      value: resistance,
      borderColor: 'rgba(239, 68, 68, 0.8)',
      borderWidth: 1.5,
      borderDash: [4, 4],
      label: { enabled: true, content: '壓力 ' + resistance, position: 'left', backgroundColor: 'rgba(239, 68, 68, 0.8)' }
    });
  }

  annotations.push({
    type: 'line',
    mode: 'horizontal',
    scaleID: 'y',
    value: latestPrice,
    borderColor: color,
    borderWidth: 1.5,
    borderDash: [2, 2],
    label: { enabled: true, content: '現價 ' + latestPrice.toFixed(2), position: 'right', backgroundColor: color }
  });

  const chartConfig = {
    type: 'bar',
    data: {
      labels: data.map((_, i) => i),
      datasets: [
        {
          type: 'line',
          data: data,
          borderColor: color,
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          yAxisID: 'y'
        },
        ...(volumes.length === data.length ? [{
          type: 'bar',
          data: volumes,
          backgroundColor: 'rgba(156, 163, 175, 0.3)',
          yAxisID: 'yVol'
        }] : [])
      ]
    },
    options: {
      legend: { display: false },
      scales: {
        xAxes: [{ display: false }],
        yAxes: [
          {
            id: 'y',
            position: 'right',
            gridLines: { color: 'rgba(255,255,255,0.1)' },
            ticks: { fontColor: '#9ca3af' }
          },
          {
            id: 'yVol',
            display: false,
            ticks: { min: 0, max: maxVol * 4 }
          }
        ]
      },
      layout: { padding: 10 },
      annotation: { annotations }
    }
  };
  
  chartConfig['backgroundColor'] = '#1f2937';
  return `https://quickchart.io/chart?w=800&h=400&bkg=1f2937&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
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
      .map(s => `${s.role}「${s.declarer}」拋售 ${s.lots.toLocaleString()} 張（${s.valueText}）`)
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
    const aiText = await generateStockAnalysis({
      symbol: card.symbol,
      nameZh: card.nameZh,
      close: card.close,
      chgPct: card.chgPct,
      volume: card.volume,
      volumeVs5dPct: card.volumeVs5dPct,
      flowNet: card.flowNet,
      flowUnit: card.flowUnit,
      shortDir: card.shortDir,
      strategySignal: card.strategySignal,
      confidence: card.confidence,
      p1d: card.p1d,
      p3d: card.p3d,
      p5d: card.p5d,
      support: card.support,
      resistance: card.resistance,
      newsLine: card.newsLine,
      syncLevel: card.syncLevel,
      overseas: card.overseas.map(o => ({ symbol: o.symbol, chgPct: o.chgPct })),
      insiderSells: card.insiderSells || [],
    });

    if (aiText) {
      const divider = escapeHtml("━━━━━━━━━━━━━━");
      const aiSection = `${divider}\n🤖 <b>AI 分析師點評</b>\n${escapeHtml(aiText)}`;
      return `${structuredPart}\n\n${aiSection}`;
    }
  } catch (e) {
    console.warn("[TelegramBot] AI analysis failed, using plain card:", e);
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
    const res = await fetch(`${baseUrl}/api/stock/${symbol}/snapshot`);
    if (!res.ok) return null;

    const snapshot = await res.json();
    let bars: Array<{ high?: number; low?: number; close?: number; volume?: number }> = Array.isArray(snapshot?.data?.prices)
      ? snapshot.data.prices
      : [];

    if (bars.length < 180) {
      try {
        const recent = await fetchRecentBars(symbol, 180);
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
      
      card.chartUrl = buildChartUrl(bars.slice(-180), card.support, card.resistance);
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

export async function handleTelegramMessage(
  chatId: number,
  text: string,
  isBackgroundPush = false,
  options?: TelegramHandleOptions,
) {
  if (isBackgroundPush) {
    // 動態從 Redis 取得所有 chat_id，fallback 使用 env TELEGRAM_CHAT_ID
    const chatIds = await getAllChatIds();
    if (chatIds.length === 0) {
      console.warn("[TelegramBot] Skipping background push: no chat_ids found (Redis empty and TELEGRAM_CHAT_ID not set)");
      return;
    }
    console.log(`[TelegramBot] Broadcasting to ${chatIds.length} chat(s): ${chatIds.join(", ")}`);
    await Promise.all(chatIds.map((id) => sendMessage(id, text)));
    return;
  }

  if (!text.startsWith("/")) return;

  await ensureTelegramCommandsSynced();

  const [commandRaw, ...argParts] = text.trim().split(/\s+/);
  const command = commandRaw.toLowerCase();
  const query = argParts.join(" ").trim();

  // 處理 /start 指令 (引導訊息)
  if (command === "/start") {
    const welcome = [
      "👋 歡迎使用台股診斷助手！",
      "",
      "我會幫你整合技術面、籌碼動態與 AI 預測，提供一目了然的個股診斷報告。",
      "",
      "📌 <b>如何查詢？</b>",
      "請使用 <code>/tw</code> 指令，後方加上股票代號或名稱。",
      "例如：<code>/tw 2330</code> 或 <code>/tw 台積電</code>",
      "",
      "如果是剛加入群組，建議直接輸入指令試試看喔！",
      ].join("\n");
    await sendMessage(chatId, welcome);
    return;
  }

  if (command !== "/tw") {
    await sendMessage(chatId, "目前我主要支援 <code>/tw</code> 指令來進行股票查詢喔！\n你可以輸入 <code>/tw 2330</code> 來試試看。");
    return;
  }

  if (!query) {
    await sendMessage(chatId, "請輸入股票代號或名稱，例如: /tw 2330");
    return;
  }

  const progressMessageId = await sendMessage(chatId, "正在搜尋資料中，請稍候...");

  const liveCard = await fetchLiveStockCard(query, options?.baseUrl);
  if (liveCard) {
    const finalMsg = await buildStockCardWithAI(liveCard);
    await replyWithCard(chatId, progressMessageId, finalMsg, liveCard.chartUrl);
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

  const reportCard = cardFromReportRow(stock);
  const finalMsg = await buildStockCardWithAI(reportCard);
  await replyWithCard(chatId, progressMessageId, finalMsg, reportCard.chartUrl);
}
