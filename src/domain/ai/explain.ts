import { CatalystEvaluation } from "../news/catalystScore";
import { FlowSignals } from "../signals/flow";
import { FundamentalSignals } from "../signals/fundamental";
import { TrendSignals } from "../signals/trend";

export interface ConfidenceTerms {
  trendScore: number;
  flowScore: number;
  fundamentalScore: number;
  catalystScore: number;
  riskPenalty: number;
  trendTerm: number;
  flowTerm: number;
  fundamentalTerm: number;
  catalystTerm: number;
}

export interface AIExplanation {
  stance: "Bullish" | "Neutral" | "Bearish";
  confidence: number;
  keyPoints: string[];
  risks: string[];
  confidenceTerms: ConfidenceTerms;
  debug?: Record<string, unknown>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatSignedPercent(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function generateExplanation(
  ticker: string,
  trend: TrendSignals,
  flow: FlowSignals,
  fundamental: FundamentalSignals,
  catalyst: CatalystEvaluation | null = null,
): AIExplanation {
  const tScore = trend.trendScore;
  const fScore = flow.flowScore;
  const fundScore = fundamental.fundamentalScore;
  const catalystScore = catalyst?.catalystScore ?? 0;

  const risks = Array.from(new Set([...trend.risks, ...flow.risks, ...fundamental.risks]));

  let stance: "Bullish" | "Neutral" | "Bearish" = "Neutral";
  if (tScore !== null) {
    if (tScore >= 65) stance = "Bullish";
    else if (tScore < 45) stance = "Bearish";
  }

  if (tScore !== null) {
    if (stance === "Neutral" && tScore >= 58 && catalystScore >= 25) stance = "Bullish";
    if (stance === "Bullish" && catalystScore <= -35) stance = "Neutral";
    if (stance === "Bearish" && catalystScore >= 35) stance = "Neutral";
  }

  const trendTerm = tScore === null ? 0 : (tScore - 50) * 0.6;
  const flowTerm = fScore === null ? -10 : (fScore - 50) * 0.3;
  const fundamentalTerm = fundScore === null ? -5 : (fundScore - 50) * 0.2;
  const catalystTerm = catalystScore * 0.12;
  const riskPenalty = Math.min(15, risks.length * 5);

  let confidenceRaw = 50 + trendTerm + flowTerm + fundamentalTerm + catalystTerm - riskPenalty;
  if (tScore === null) {
    confidenceRaw = 30;
  }
  const confidence = Math.round(clamp(confidenceRaw, 0, 100));

  const keyPoints: string[] = [];

  keyPoints.push(
    tScore === null
      ? `${ticker} 技術資料不足，暫以中性看法。`
      : `Trend 分數 ${tScore.toFixed(1)}，目前判定為 ${stance}。`,
  );

  if (fScore !== null) {
    keyPoints.push(`Flow 分數 ${fScore.toFixed(1)}，外資 5 日淨買賣 ${flow.foreign5D.toFixed(0)}。`);
  } else {
    keyPoints.push("Flow 分數資料不足，信心已自動降權。");
  }

  if (fundScore !== null) {
    keyPoints.push(
      `Fundamental 分數 ${fundScore.toFixed(1)}，近 3 月 YoY ${formatSignedPercent(
        fundamental.recent3MoYoyAverage,
      )}。`,
    );
  } else {
    keyPoints.push("Fundamental 分數資料不足，信心已自動降權。");
  }

  if (catalyst) {
    keyPoints.push(`新聞催化分數 ${catalystScore}，近 7 日新聞已納入評估。`);
  }

  if (keyPoints.length > 5) {
    keyPoints.length = 5;
  }

  return {
    stance,
    confidence,
    keyPoints,
    risks,
    confidenceTerms: {
      trendScore: tScore ?? 50,
      flowScore: fScore ?? 50,
      fundamentalScore: fundScore ?? 50,
      catalystScore,
      riskPenalty,
      trendTerm,
      flowTerm,
      fundamentalTerm,
      catalystTerm,
    },
    debug: {
      trendScore: tScore,
      flowScore: fScore,
      fundamentalScore: fundScore,
      confidenceRaw,
      riskCount: risks.length,
    },
  };
}
