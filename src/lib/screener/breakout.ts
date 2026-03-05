export interface BreakoutSignalInput {
  close: number;
  fastEma: number;
  slowEma: number;
  trendEma: number;
  rsi: number;
  tradedValue: number;
  volume: number;
  avgVolume: number;
  fastSeries: number[];
  slowSeries: number[];
}

export interface BreakoutScreenerRow extends BreakoutSignalInput {
  symbol: string;
  exchange: string;
  code: string;
  name: string;
  description: string;
  marketCap: number | null;
  volumeRatio: number;
  entrySignal: boolean;
  exitSignal: boolean;
  exitReasons: string[];
  crossAgeDays: number | null;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function findCrossAgeDays(fastSeries: number[], slowSeries: number[]): number | null {
  if (!Number.isFinite(fastSeries[0]) || !Number.isFinite(slowSeries[0])) return null;
  if (fastSeries[0] <= slowSeries[0]) return null;

  const limit = Math.min(fastSeries.length, slowSeries.length) - 1;
  for (let age = 0; age < limit; age++) {
    const fastNow = fastSeries[age];
    const slowNow = slowSeries[age];
    const fastPrev = fastSeries[age + 1];
    const slowPrev = slowSeries[age + 1];
    if (!Number.isFinite(fastNow) || !Number.isFinite(slowNow) || !Number.isFinite(fastPrev) || !Number.isFinite(slowPrev)) continue;
    if (fastNow > slowNow && fastPrev <= slowPrev) return age;
  }
  return null;
}

export function isBreakoutEntry(
  input: BreakoutSignalInput,
  minTurnover: number,
  minRsi: number,
  maxCrossAgeDays: number,
  minRelativeVolumeMultiplier: number
): { ok: boolean; crossAgeDays: number | null } {
  const hasRelativeVolume =
    input.avgVolume > 0 && input.volume >= input.avgVolume * minRelativeVolumeMultiplier;

  const trendAndMomentum =
    input.close > 20 &&
    input.close > input.trendEma &&
    input.rsi > minRsi &&
    input.tradedValue >= minTurnover &&
    hasRelativeVolume;

  const crossAgeDays = findCrossAgeDays(input.fastSeries, input.slowSeries);
  const recentCross = crossAgeDays !== null && crossAgeDays <= maxCrossAgeDays;
  return { ok: trendAndMomentum && recentCross, crossAgeDays };
}

export function getBreakoutExitReasons(input: Pick<BreakoutSignalInput, "close" | "slowEma" | "rsi">): string[] {
  const reasons: string[] = [];
  if (input.close < input.slowEma) reasons.push("收盤價跌破慢線 EMA");
  if (input.rsi < 50) reasons.push("RSI 低於 50");
  return reasons;
}

export function isBreakoutExit(input: Pick<BreakoutSignalInput, "close" | "slowEma" | "rsi">): boolean {
  return getBreakoutExitReasons(input).length > 0;
}

export function parseTvSymbol(tvSymbol: string): { exchange: string; code: string } {
  const [exchange, code] = tvSymbol.split(":");
  return {
    exchange: exchange ?? "",
    code: code ?? tvSymbol,
  };
}

export function buildBreakoutRow(input: {
  tvSymbol: string;
  name: string;
  description: string;
  close: unknown;
  fastEma: unknown;
  slowEma: unknown;
  trendEma: unknown;
  rsi: unknown;
  prevFastEma: unknown;
  prevSlowEma: unknown;
  tradedValue: unknown;
  fastEma2?: unknown;
  fastEma3?: unknown;
  fastEma4?: unknown;
  fastEma5?: unknown;
  slowEma2?: unknown;
  slowEma3?: unknown;
  slowEma4?: unknown;
  slowEma5?: unknown;
  volume: unknown;
  avgVolume: unknown;
  marketCap: unknown;
  minTurnover?: number;
  minRsi?: number;
  maxCrossAgeDays?: number;
  minRelativeVolumeMultiplier?: number;
}): BreakoutScreenerRow | null {
  const close = isFiniteNumber(input.close) ? input.close : null;
  const fastEma = isFiniteNumber(input.fastEma) ? input.fastEma : null;
  const slowEma = isFiniteNumber(input.slowEma) ? input.slowEma : null;
  const trendEma = isFiniteNumber(input.trendEma) ? input.trendEma : null;
  const rsi = isFiniteNumber(input.rsi) ? input.rsi : null;
  const prevFastEma = isFiniteNumber(input.prevFastEma) ? input.prevFastEma : null;
  const prevSlowEma = isFiniteNumber(input.prevSlowEma) ? input.prevSlowEma : null;
  const tradedValue = isFiniteNumber(input.tradedValue) ? input.tradedValue : null;
  const volume = isFiniteNumber(input.volume) ? input.volume : null;
  const avgVolume = isFiniteNumber(input.avgVolume) ? input.avgVolume : null;

  const fastEma2 = isFiniteNumber(input.fastEma2) ? input.fastEma2 : null;
  const fastEma3 = isFiniteNumber(input.fastEma3) ? input.fastEma3 : null;
  const fastEma4 = isFiniteNumber(input.fastEma4) ? input.fastEma4 : null;
  const fastEma5 = isFiniteNumber(input.fastEma5) ? input.fastEma5 : null;
  const slowEma2 = isFiniteNumber(input.slowEma2) ? input.slowEma2 : null;
  const slowEma3 = isFiniteNumber(input.slowEma3) ? input.slowEma3 : null;
  const slowEma4 = isFiniteNumber(input.slowEma4) ? input.slowEma4 : null;
  const slowEma5 = isFiniteNumber(input.slowEma5) ? input.slowEma5 : null;

  if (
    close === null ||
    fastEma === null ||
    slowEma === null ||
    trendEma === null ||
    rsi === null ||
    prevFastEma === null ||
    prevSlowEma === null ||
    tradedValue === null ||
    volume === null ||
    avgVolume === null
  ) {
    return null;
  }

  const { exchange, code } = parseTvSymbol(input.tvSymbol);
  const fastSeries = [fastEma, prevFastEma, fastEma2, fastEma3, fastEma4, fastEma5].filter((v): v is number => v !== null);
  const slowSeries = [slowEma, prevSlowEma, slowEma2, slowEma3, slowEma4, slowEma5].filter((v): v is number => v !== null);

  const signalInput: BreakoutSignalInput = {
    close,
    fastEma,
    slowEma,
    trendEma,
    rsi,
    tradedValue,
    volume,
    avgVolume,
    fastSeries,
    slowSeries,
  };

  const exitReasons = getBreakoutExitReasons(signalInput);
  const minTurnover = input.minTurnover ?? 0;
  const minRsi = input.minRsi ?? 60;
  const maxCrossAgeDays = input.maxCrossAgeDays ?? 0;
  const minRelativeVolumeMultiplier = input.minRelativeVolumeMultiplier ?? 2;
  const entry = isBreakoutEntry(
    signalInput,
    minTurnover,
    minRsi,
    maxCrossAgeDays,
    minRelativeVolumeMultiplier
  );

  return {
    symbol: input.tvSymbol,
    exchange,
    code,
    name: input.name,
    description: input.description,
    close,
    fastEma,
    slowEma,
    trendEma,
    rsi,
    tradedValue,
    volume,
    avgVolume,
    fastSeries,
    slowSeries,
    marketCap: isFiniteNumber(input.marketCap) ? input.marketCap : null,
    volumeRatio: avgVolume > 0 ? volume / avgVolume : 0,
    entrySignal: entry.ok,
    exitSignal: exitReasons.length > 0,
    exitReasons,
    crossAgeDays: entry.crossAgeDays,
  };
}
