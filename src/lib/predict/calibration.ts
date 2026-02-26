import { fetchRecentBars } from "../range";
import { PriceDaily } from "../providers/finmind";
import { calculateTrend } from "../signals/trend";
import { calculateShortTermVolatility } from "../signals/shortTermVolatility";
import { calculateShortTermSignals } from "../signals/shortTerm";
import { computeRawProbabilities } from "./probability";

export interface CalibrationBin {
  range: string;
  total: number;
  winRate: number;
}

export interface CalibrationModel {
  a: number;
  b: number;
  sampleSize: number;
  bins: CalibrationBin[];
}

let cachedCalibration: { at: number; model: CalibrationModel } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function identityCalibration(): CalibrationModel {
  return {
    a: 1,
    b: 0,
    sampleSize: 0,
    bins: [],
  };
}

function linearRegression(xs: number[], ys: number[]): { a: number; b: number } {
  if (xs.length < 2 || ys.length < 2 || xs.length !== ys.length) {
    return { a: 1, b: 0 };
  }
  const meanX = xs.reduce((acc, value) => acc + value, 0) / xs.length;
  const meanY = ys.reduce((acc, value) => acc + value, 0) / ys.length;
  let cov = 0;
  let variance = 0;
  for (let i = 0; i < xs.length; i += 1) {
    cov += (xs[i] - meanX) * (ys[i] - meanY);
    variance += (xs[i] - meanX) ** 2;
  }
  if (variance === 0) return { a: 1, b: 0 };
  const a = cov / variance;
  const b = meanY - a * meanX;
  return { a, b };
}

function computeBins(raws: number[], outcomes: number[]): CalibrationBin[] {
  const bins = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}-${(i + 1) * 10}`,
    total: 0,
    wins: 0,
  }));

  for (let i = 0; i < raws.length; i += 1) {
    const idx = clamp(Math.floor(raws[i] / 10), 0, 9);
    bins[idx].total += 1;
    bins[idx].wins += outcomes[i];
  }

  return bins.map((bin) => ({
    range: bin.range,
    total: bin.total,
    winRate: bin.total === 0 ? 0 : Number(((bin.wins / bin.total) * 100).toFixed(2)),
  }));
}

function rollingSamples(prices: PriceDaily[]): { rawProb: number; outcome: number }[] {
  const sorted = [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const samples: { rawProb: number; outcome: number }[] = [];

  for (let i = 130; i < sorted.length - 5; i += 1) {
    const history = sorted.slice(0, i + 1);
    const trend = calculateTrend(history);
    const volatility = calculateShortTermVolatility(history);
    const shortTerm = calculateShortTermSignals(history, trend, volatility);

    const raw = computeRawProbabilities({
      trendScore: trend.trendScore,
      flowScore: 50,
      fundamentalScore: null,
      catalystScore: 0,
      volatilityScore: volatility.volatilityScore,
      shortTermOpportunityScore: shortTerm.shortTermOpportunityScore,
      pullbackRiskScore: shortTerm.pullbackRiskScore,
      volumeSpike: volatility.volumeSpike,
      gap: volatility.gap,
    }).upProb5D;

    const nowClose = sorted[i].close;
    const futureClose = sorted[i + 5].close;
    const outcome = futureClose > nowClose ? 1 : 0;
    samples.push({ rawProb: raw, outcome });
  }

  return samples;
}

export async function buildCalibrationModel(
  tickers: string[] = ["2330", "2317", "2454", "3231"],
): Promise<CalibrationModel> {
  const allSamples: { rawProb: number; outcome: number }[] = [];

  for (const ticker of tickers) {
    try {
      const bars = await fetchRecentBars(ticker, 540);
      if (bars.data.length < 140) continue;
      allSamples.push(...rollingSamples(bars.data));
    } catch {
      // ignore per ticker errors and continue calibration with available symbols
    }
  }

  if (allSamples.length < 50) return identityCalibration();

  const xs = allSamples.map((item) => item.rawProb);
  const ys = allSamples.map((item) => item.outcome * 100);
  const { a, b } = linearRegression(xs, ys);
  const bins = computeBins(xs, allSamples.map((item) => item.outcome));

  return {
    a: Number(a.toFixed(4)),
    b: Number(b.toFixed(4)),
    sampleSize: allSamples.length,
    bins,
  };
}

export async function getCalibrationModel(
  tickers: string[] = ["2330", "2317", "2454", "3231"],
): Promise<CalibrationModel> {
  const now = Date.now();
  if (cachedCalibration && now - cachedCalibration.at < CACHE_TTL_MS) {
    return cachedCalibration.model;
  }

  const model = await buildCalibrationModel(tickers).catch(() => identityCalibration());
  cachedCalibration = { at: now, model };
  return model;
}
