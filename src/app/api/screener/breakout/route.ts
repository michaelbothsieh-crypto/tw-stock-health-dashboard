import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/providers/redisCache";
import { twStockNames } from "@/data/twStockNames";
import { buildBreakoutRow, BreakoutScreenerRow } from "@/lib/screener/breakout";
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

const TV_ENDPOINT = "https://scanner.tradingview.com/taiwan/scan";

function buildTvColumns(fastEma: number, slowEma: number, trendEma: number): string[] {
  return [
    "name",
    "type",
    "subtype",
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
    "Value.Traded",
    "volume",
    "average_volume_30d_calc",
    "market_cap_basic",
  ];
}

async function scanTradingView(input: {
  filters: Array<Record<string, unknown>>;
  limit: number;
  minTurnover: number;
  minRsi: number;
  maxCrossAgeDays: number;
  minRelativeVolumeMultiplier: number;
  fastEma: number;
  slowEma: number;
  trendEma: number;
}): Promise<BreakoutScreenerRow[]> {
  const columns = buildTvColumns(input.fastEma, input.slowEma, input.trendEma);
  const body = {
    filter: input.filters,
    options: { lang: "zh" },
    symbols: { query: { types: [] }, tickers: [] },
    columns,
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
  if (!payload.data || payload.data.length === 0) {
    return [];
  }

  const rows: BreakoutScreenerRow[] = [];
  for (const item of payload.data) {
    const [
      name,
      _type,
      _subtype,
      description,
      close,
      fastEma,
      slowEma,
      trendEma,
      rsi,
      prevFastEma,
      prevSlowEma,
      fastEma2,
      slowEma2,
      fastEma3,
      slowEma3,
      fastEma4,
      slowEma4,
      fastEma5,
      slowEma5,
      tradedValue,
      volume,
      avgVolume,
      marketCap,
    ] = item.d;

    const parsed = buildBreakoutRow({
      tvSymbol: item.s,
      name: String(name ?? ""),
      description: String(description ?? ""),
      close,
      fastEma,
      slowEma,
      trendEma,
      rsi,
      prevFastEma,
      prevSlowEma,
      fastEma2,
      slowEma2,
      fastEma3,
      slowEma3,
      fastEma4,
      slowEma4,
      fastEma5,
      slowEma5,
      tradedValue,
      volume,
      avgVolume,
      marketCap,
      minTurnover: input.minTurnover,
      minRsi: input.minRsi,
      maxCrossAgeDays: input.maxCrossAgeDays,
      minRelativeVolumeMultiplier: input.minRelativeVolumeMultiplier,
    });

    if (!parsed) continue;
    parsed.name = twStockNames[parsed.code] || parsed.description || parsed.name || parsed.code;
    rows.push(parsed);
  }

  return rows;
}

function dedupeBySymbol(rows: BreakoutScreenerRow[]): BreakoutScreenerRow[] {
  return Array.from(new Map(rows.map((row) => [row.symbol, row])).values());
}

function parseBoundedNumber(raw: string | null, fallback: number, min: number, max: number, integer = false): number {
  const parsed = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const value = integer ? Math.trunc(parsed) : parsed;
  return Math.min(Math.max(value, min), max);
}

export async function GET(req: NextRequest) {
  const limit = parseBoundedNumber(req.nextUrl.searchParams.get("limit"), 80, 20, 200, true);

  const defaultTurnover = getBreakoutMinTurnover();
  const defaultRsi = getBreakoutMinRsi();
  const defaultCrossDays = getBreakoutMaxCrossAgeDays();
  const defaultRelativeVolumeMultiplier = getBreakoutRelativeVolumeMultiplier();
  const defaultFastEma = getBreakoutFastEma();
  const defaultSlowEma = getBreakoutSlowEma();
  const defaultTrendEma = getBreakoutTrendEma();

  const parsedTurnoverYi = Number(req.nextUrl.searchParams.get("turnoverYi"));
  const minTurnover = Number.isFinite(parsedTurnoverYi) && parsedTurnoverYi > 0
    ? Math.trunc(parsedTurnoverYi * 100_000_000)
    : defaultTurnover;

  const minRsi = parseBoundedNumber(req.nextUrl.searchParams.get("rsi"), defaultRsi, 1, 99);
  const maxCrossAgeDays = parseBoundedNumber(req.nextUrl.searchParams.get("crossDays"), defaultCrossDays, 0, 10, true);
  const minRelativeVolumeMultiplier = parseBoundedNumber(
    req.nextUrl.searchParams.get("relativeVolumeMultiplier"),
    defaultRelativeVolumeMultiplier,
    0.5,
    10
  );

  let fastEma = parseBoundedNumber(req.nextUrl.searchParams.get("fastEma"), defaultFastEma, 2, 60, true);
  let slowEma = parseBoundedNumber(req.nextUrl.searchParams.get("slowEma"), defaultSlowEma, 3, 120, true);
  const trendEma = parseBoundedNumber(req.nextUrl.searchParams.get("trendEma"), defaultTrendEma, 20, 300, true);
  if (slowEma <= fastEma) {
    slowEma = Math.min(fastEma + 1, 120);
  }

  const cacheKey = `screener:breakout:v5:${limit}:turnover=${minTurnover}:rsi=${minRsi}:crossDays=${maxCrossAgeDays}:rv=${minRelativeVolumeMultiplier}:f=${fastEma}:s=${slowEma}:t=${trendEma}`;
  const isForceRefresh = req.nextUrl.searchParams.get("refresh") === "true";

  if (!isForceRefresh) {
    const cached = await getCache<unknown>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  try {
    const entryFilters = [
      { left: "type", operation: "equal", right: "stock" },
      { left: "close", operation: "greater", right: 20 },
      { left: "close", operation: "egreater", right: `EMA${trendEma}` },
      { left: "RSI", operation: "greater", right: minRsi },
      { left: "Value.Traded", operation: "greater", right: minTurnover },
    ];

    const exitByCloseFilters = [
      { left: "type", operation: "equal", right: "stock" },
      { left: "close", operation: "less", right: `EMA${slowEma}` },
    ];

    const exitByRsiFilters = [
      { left: "type", operation: "equal", right: "stock" },
      { left: "RSI", operation: "less", right: 50 },
    ];

    const sharedScanInput = {
      minTurnover,
      minRsi,
      maxCrossAgeDays,
      minRelativeVolumeMultiplier,
      fastEma,
      slowEma,
      trendEma,
    };

    const [entryRows, exitCloseRows, exitRsiRows] = await Promise.all([
      scanTradingView({ filters: entryFilters, limit, ...sharedScanInput }),
      scanTradingView({ filters: exitByCloseFilters, limit: Math.max(limit, 120), ...sharedScanInput }),
      scanTradingView({ filters: exitByRsiFilters, limit: Math.max(limit, 120), ...sharedScanInput }),
    ]);

    const entries = entryRows
      .filter((row) => row.entrySignal)
      .sort((a, b) => b.rsi - a.rsi)
      .slice(0, limit);

    const exits = dedupeBySymbol([...exitCloseRows, ...exitRsiRows])
      .filter((row) => row.exitSignal)
      .sort((a, b) => a.rsi - b.rsi)
      .slice(0, limit);

    const result = {
      generatedAt: new Date().toISOString(),
      strategy: {
        name: "Breakout Screener",
        entry: `Close > 20 且 Close > EMA${trendEma} 且 RSI(14) > ${minRsi} 且 成交金額 >= ${formatTurnover(minTurnover)} 且 Volume >= AvgVolume30 * ${minRelativeVolumeMultiplier} 且 EMA${fastEma}/EMA${slowEma} 黃金交叉發生於近 ${maxCrossAgeDays} 日`,
        exit: `Close < EMA${slowEma} 或 RSI < 50`,
      },
      params: {
        minTurnover,
        minRsi,
        maxCrossAgeDays,
        minRelativeVolumeMultiplier,
        fastEma,
        slowEma,
        trendEma,
      },
      entries,
      exits,
      counts: {
        entry: entries.length,
        exit: exits.length,
      },
    };

    await setCache(cacheKey, result, 600);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[Screener] breakout scan failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
