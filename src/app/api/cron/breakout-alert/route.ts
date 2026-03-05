import { NextRequest, NextResponse } from "next/server";
import { sendTelegramAlert } from "@/lib/notifications/telegram";
import { getCache, setCache } from "@/lib/providers/redisCache";
import { twStockNames } from "@/data/twStockNames";
import { findCrossAgeDays } from "@/lib/screener/breakout";
import {
  formatTurnover,
  getBreakoutFastEma,
  getBreakoutMaxCrossAgeDays,
  getBreakoutMinRsi,
  getBreakoutMinTurnover,
  getBreakoutRelativeVolumeMultiplier,
  getBreakoutSlowEma,
  getBreakoutTrendEma,
} from "@/lib/screener/constants";

export const dynamic = "force-dynamic";

interface TradingViewScanResponse {
  totalCount: number;
  data: Array<{
    s: string;
    d: unknown[];
  }>;
}

interface BreakoutMatch {
  symbol: string;
  code: string;
  name: string;
  close: number;
  fastEma: number;
  slowEma: number;
  trendEma: number;
  rsi: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  crossAgeDays: number;
}

const TV_ENDPOINT = "https://scanner.tradingview.com/taiwan/scan";
const MAX_NOTIFY_LINES = 20;

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDateKey(date = new Date()): string {
  return date.toLocaleDateString("en-CA");
}

function buildTvColumns(fastEma: number, slowEma: number, trendEma: number): string[] {
  return [
    "name",
    "description",
    "close",
    `EMA${fastEma}`,
    `EMA${slowEma}`,
    `EMA${trendEma}`,
    "RSI",
    `EMA${fastEma}|1`,
    `EMA${slowEma}|1`,
    `EMA${fastEma}|2`,
    `EMA${slowEma}|2`,
    `EMA${fastEma}|3`,
    `EMA${slowEma}|3`,
    `EMA${fastEma}|4`,
    `EMA${slowEma}|4`,
    `EMA${fastEma}|5`,
    `EMA${slowEma}|5`,
    "volume",
    "average_volume_30d_calc",
  ];
}

async function fetchFreshGoldenCrossMatches(input: {
  limit: number;
  minTurnover: number;
  minRsi: number;
  maxCrossAgeDays: number;
  minRelativeVolumeMultiplier: number;
  fastEma: number;
  slowEma: number;
  trendEma: number;
}): Promise<{ totalCount: number; matches: BreakoutMatch[] }> {
  const body = {
    filter: [
      { left: "type", operation: "equal", right: "stock" },
      { left: "close", operation: "greater", right: 20 },
      { left: "close", operation: "egreater", right: `EMA${input.trendEma}` },
      { left: "RSI", operation: "greater", right: input.minRsi },
      { left: "Value.Traded", operation: "greater", right: input.minTurnover },
    ],
    options: { lang: "zh" },
    symbols: { query: { types: [] }, tickers: [] },
    columns: buildTvColumns(input.fastEma, input.slowEma, input.trendEma),
    sort: { sortBy: "RSI", sortOrder: "desc" },
    range: [0, input.limit],
  };

  const response = await fetch(TV_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TradingView scan failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as TradingViewScanResponse;
  const matches: BreakoutMatch[] = [];

  for (const row of payload.data ?? []) {
    const [
      name,
      description,
      closeRaw,
      fastEmaRaw,
      slowEmaRaw,
      trendEmaRaw,
      rsiRaw,
      prevFastEmaRaw,
      prevSlowEmaRaw,
      fastEma2Raw,
      slowEma2Raw,
      fastEma3Raw,
      slowEma3Raw,
      fastEma4Raw,
      slowEma4Raw,
      fastEma5Raw,
      slowEma5Raw,
      volumeRaw,
      avgVolumeRaw,
    ] = row.d;

    const close = toNumber(closeRaw);
    const fastEma = toNumber(fastEmaRaw);
    const slowEma = toNumber(slowEmaRaw);
    const trendEma = toNumber(trendEmaRaw);
    const rsi = toNumber(rsiRaw);
    const prevFastEma = toNumber(prevFastEmaRaw);
    const prevSlowEma = toNumber(prevSlowEmaRaw);
    const volume = toNumber(volumeRaw);
    const avgVolume = toNumber(avgVolumeRaw);

    const fastEma2 = toNumber(fastEma2Raw);
    const slowEma2 = toNumber(slowEma2Raw);
    const fastEma3 = toNumber(fastEma3Raw);
    const slowEma3 = toNumber(slowEma3Raw);
    const fastEma4 = toNumber(fastEma4Raw);
    const slowEma4 = toNumber(slowEma4Raw);
    const fastEma5 = toNumber(fastEma5Raw);
    const slowEma5 = toNumber(slowEma5Raw);

    if (
      close === null ||
      fastEma === null ||
      slowEma === null ||
      trendEma === null ||
      rsi === null ||
      prevFastEma === null ||
      prevSlowEma === null ||
      volume === null ||
      avgVolume === null ||
      avgVolume <= 0
    ) {
      continue;
    }

    const volumeRatio = volume / avgVolume;
    if (volumeRatio < input.minRelativeVolumeMultiplier) continue;

    const fastSeries = [fastEma, prevFastEma, fastEma2, fastEma3, fastEma4, fastEma5].filter((v): v is number => v !== null);
    const slowSeries = [slowEma, prevSlowEma, slowEma2, slowEma3, slowEma4, slowEma5].filter((v): v is number => v !== null);
    const crossAgeDays = findCrossAgeDays(fastSeries, slowSeries);
    if (crossAgeDays === null || crossAgeDays > input.maxCrossAgeDays) continue;

    const code = row.s.includes(":") ? row.s.split(":")[1] : String(name ?? "");
    const stockName = twStockNames[code] || String(description ?? name ?? code);

    matches.push({
      symbol: row.s,
      code,
      name: stockName,
      close,
      fastEma,
      slowEma,
      trendEma,
      rsi,
      volume,
      avgVolume,
      volumeRatio,
      crossAgeDays,
    });
  }

  return {
    totalCount: payload.totalCount ?? matches.length,
    matches,
  };
}

function buildTelegramMessage(
  dateKey: string,
  totalCount: number,
  matches: BreakoutMatch[],
  input: {
    minTurnover: number;
    minRsi: number;
    maxCrossAgeDays: number;
    minRelativeVolumeMultiplier: number;
    fastEma: number;
    slowEma: number;
    trendEma: number;
  }
): string {
  const top = matches.slice(0, MAX_NOTIFY_LINES);
  const header = [
    `📈 <b>突破選股通知 (${dateKey})</b>`,
    "",
    `條件: Close > 20、Close > EMA${input.trendEma}、RSI > ${input.minRsi}、成交金額 >= ${formatTurnover(input.minTurnover)}、Volume >= AvgVolume30 * ${input.minRelativeVolumeMultiplier}、EMA${input.fastEma}/EMA${input.slowEma} 黃金交叉近 ${input.maxCrossAgeDays} 日`,
    `總檔數: <b>${totalCount}</b>`,
    "",
  ].join("\n");

  const lines = top.map((item, idx) => {
    return `${idx + 1}. <b>${item.code}</b> ${item.name}｜收 ${item.close.toFixed(2)}｜RSI ${item.rsi.toFixed(1)}｜量比 ${item.volumeRatio.toFixed(2)}x｜交叉 ${item.crossAgeDays} 天前`;
  });

  const footer =
    totalCount > MAX_NOTIFY_LINES
      ? `\n...尚有 ${totalCount - MAX_NOTIFY_LINES} 檔，請到選股頁查看\nhttps://tw-stock-health.vercel.app/screener`
      : "\n完整名單如下\nhttps://tw-stock-health.vercel.app/screener";

  return `${header}${lines.join("\n")}${footer}`;
}

export async function GET(_req: NextRequest) {
  const dateKey = formatDateKey();

  const minTurnover = getBreakoutMinTurnover();
  const minRsi = getBreakoutMinRsi();
  const maxCrossAgeDays = getBreakoutMaxCrossAgeDays();
  const minRelativeVolumeMultiplier = getBreakoutRelativeVolumeMultiplier();

  let fastEma = getBreakoutFastEma();
  let slowEma = getBreakoutSlowEma();
  const trendEma = getBreakoutTrendEma();
  if (slowEma <= fastEma) {
    slowEma = Math.min(fastEma + 1, 120);
  }

  const notifyLockKey = `cron:breakout-alert:sent:${dateKey}:turnover=${minTurnover}:rsi=${minRsi}:crossDays=${maxCrossAgeDays}:rv=${minRelativeVolumeMultiplier}:f=${fastEma}:s=${slowEma}:t=${trendEma}`;
  const existing = await getCache<{ sent: boolean }>(notifyLockKey);
  if (existing?.sent) {
    return NextResponse.json({ status: "skipped", reason: "already_sent_today", date: dateKey });
  }

  try {
    const rule = {
      limit: 300,
      minTurnover,
      minRsi,
      maxCrossAgeDays,
      minRelativeVolumeMultiplier,
      fastEma,
      slowEma,
      trendEma,
    };

    const { totalCount, matches } = await fetchFreshGoldenCrossMatches(rule);
    const message = buildTelegramMessage(dateKey, totalCount, matches, rule);
    await sendTelegramAlert(message);
    await setCache(notifyLockKey, { sent: true }, 60 * 60 * 30);

    return NextResponse.json({
      status: "ok",
      date: dateKey,
      totalCount,
      notifiedTop: Math.min(matches.length, MAX_NOTIFY_LINES),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron Breakout Alert] Error:", error);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
