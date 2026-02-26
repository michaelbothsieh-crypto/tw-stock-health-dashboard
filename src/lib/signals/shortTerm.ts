import { PriceDaily } from "../providers/finmind";
import { ShortTermVolatility } from "./shortTermVolatility";
import { TrendSignals } from "./trend";

export interface ShortTermComponent {
  key: string;
  label: string;
  value: number | string;
  weight: number;
  contribution: number;
}

export interface ShortTermSignals {
  breakoutScore: number;
  squeezeScore: number;
  relativeStrengthScore: number;
  pullbackRiskScore: number;
  shortTermOpportunityScore: number;
  breakdown: {
    components: ShortTermComponent[];
    formula: string;
    reasons: string[];
    riskFlags: string[];
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function percentileRank(values: number[], current: number): number {
  if (!values.length) return 0.5;
  const count = values.filter((value) => value <= current).length;
  return count / values.length;
}

function toContribution(weight: number, score: number): number {
  return Number((weight * (clamp(score, 0, 100) / 100)).toFixed(4));
}

function linearMap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return outMin;
  const ratio = (value - inMin) / (inMax - inMin);
  return outMin + ratio * (outMax - outMin);
}

export function calculateShortTermSignals(
  prices: PriceDaily[],
  trend: TrendSignals,
  volatility: ShortTermVolatility,
): ShortTermSignals {
  const sorted = [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length < 130) {
    return {
      breakoutScore: 35,
      squeezeScore: 50,
      relativeStrengthScore: 50,
      pullbackRiskScore: 50,
      shortTermOpportunityScore: 40,
      breakdown: {
        components: [],
        formula:
          "Opportunity = clamp(0.35*Breakout + 0.25*Squeeze + 0.25*Volatility + 0.15*Trend - 0.30*PullbackRisk, 0..100)",
        reasons: ["資料不足，短期評分採保守估計"],
        riskFlags: ["weak_trend"],
      },
    };
  }

  const closes = sorted.map((bar) => bar.close);
  const highs = sorted.map((bar) => bar.max);
  const latest = sorted[sorted.length - 1];
  const close = latest.close;

  const high20 = Math.max(...highs.slice(-20));
  const distToHigh = high20 > 0 ? (high20 - close) / high20 : 1;
  const isBreakout = close >= high20;

  let breakoutScore = 35;
  if (isBreakout) breakoutScore = 90;
  else if (distToHigh <= 0.02) breakoutScore = 70;
  else if (distToHigh <= 0.05) breakoutScore = 55;

  const bbWidths: number[] = [];
  for (let i = 19; i < closes.length; i += 1) {
    const window = closes.slice(i - 19, i + 1);
    const middle = mean(window);
    const std = stdev(window);
    const upper = middle + 2 * std;
    const lower = middle - 2 * std;
    const width = middle !== 0 ? (upper - lower) / middle : 0;
    bbWidths.push(width);
  }

  const recentWidths = bbWidths.slice(-120);
  const currentWidth = recentWidths[recentWidths.length - 1] ?? 0;
  const bbWidthPct = percentileRank(recentWidths, currentWidth);

  let squeezeScore = 35;
  if (bbWidthPct <= 0.2) squeezeScore = 85;
  else if (bbWidthPct <= 0.5) squeezeScore = linearMap(bbWidthPct, 0.2, 0.5, 85, 55);

  const sma20 = trend.sma20 ?? mean(closes.slice(-20));
  const sma60 = trend.sma60 ?? mean(closes.slice(-60));
  const rsi = trend.rsi14 ?? 50;
  const distSMA20 = sma20 > 0 ? close / sma20 - 1 : 0;

  let pullbackRiskScore = 55;
  if (distSMA20 > 0.1 || rsi >= 75) {
    pullbackRiskScore = 85;
  } else if (distSMA20 >= 0.06 && distSMA20 <= 0.1) {
    pullbackRiskScore = linearMap(distSMA20, 0.06, 0.1, 65, 85);
  } else if (distSMA20 < 0.06 && rsi >= 45 && rsi <= 65) {
    pullbackRiskScore = linearMap(Math.max(distSMA20, 0), 0, 0.06, 35, 55);
  } else if (close < sma20 && rsi < 45) {
    pullbackRiskScore = 60;
  }

  const relativeStrengthScore = 50;
  const trendScore = trend.trendScore ?? 50;
  const volatilityScore = volatility.volatilityScore;

  const opportunityRaw =
    0.35 * breakoutScore + 0.25 * squeezeScore + 0.25 * volatilityScore + 0.15 * trendScore;
  const shortTermOpportunityScore = clamp(Math.round(opportunityRaw - 0.3 * pullbackRiskScore), 0, 100);

  const reasons: string[] = [];
  if (isBreakout) reasons.push("價格已觸及 20 日高點，具備突破條件");
  else if (distToHigh <= 0.02) reasons.push("股價接近 20 日高點，短線有機會突破");
  else reasons.push("目前仍在區間內，等待更明確突破訊號");

  if (bbWidthPct <= 0.2) reasons.push("布林通道寬度處於低檔，壓縮後易放大波動");
  else if (bbWidthPct <= 0.5) reasons.push("布林通道中度收斂，波動可能逐步擴大");
  else reasons.push("布林通道較寬，短期較偏震盪");

  if (volatilityScore >= 70) reasons.push("短期波動敏感度偏高，事件催化影響更大");
  else if (volatilityScore >= 40) reasons.push("短期波動中等，需搭配量價確認方向");
  else reasons.push("短期波動偏低，短線節奏相對平穩");

  const riskFlags: string[] = [];
  if (distSMA20 > 0.1 || rsi >= 75) riskFlags.push("overheated");
  if (isBreakout && (volatility.volumeSpike ?? 1) < 1.2) riskFlags.push("fake_breakout_risk");
  if ((trend.trendScore ?? 50) < 45) riskFlags.push("weak_trend");

  const components: ShortTermComponent[] = [
    {
      key: "breakout_score",
      label: "突破分數",
      value: Number(breakoutScore.toFixed(2)),
      weight: 0.35,
      contribution: toContribution(0.35, breakoutScore),
    },
    {
      key: "squeeze_score",
      label: "壓縮分數",
      value: Number(squeezeScore.toFixed(2)),
      weight: 0.25,
      contribution: toContribution(0.25, squeezeScore),
    },
    {
      key: "volatility_score",
      label: "波動敏感度",
      value: Number(volatilityScore.toFixed(2)),
      weight: 0.25,
      contribution: toContribution(0.25, volatilityScore),
    },
    {
      key: "trend_score",
      label: "趨勢分數",
      value: Number(trendScore.toFixed(2)),
      weight: 0.15,
      contribution: toContribution(0.15, trendScore),
    },
    {
      key: "pullback_risk_penalty",
      label: "回檔風險扣分",
      value: Number(pullbackRiskScore.toFixed(2)),
      weight: -0.3,
      contribution: -toContribution(0.3, pullbackRiskScore),
    },
  ];

  return {
    breakoutScore: Number(breakoutScore.toFixed(2)),
    squeezeScore: Number(squeezeScore.toFixed(2)),
    relativeStrengthScore: Number(relativeStrengthScore.toFixed(2)),
    pullbackRiskScore: Number(pullbackRiskScore.toFixed(2)),
    shortTermOpportunityScore,
    breakdown: {
      components,
      formula:
        "Opportunity = clamp(0.35*Breakout + 0.25*Squeeze + 0.25*Volatility + 0.15*Trend - 0.30*PullbackRisk, 0..100)",
      reasons: reasons.slice(0, 4),
      riskFlags,
    },
  };
}
