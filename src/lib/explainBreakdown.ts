import { AIExplanation } from "@/lib/ai/explain";
import { PredictionOutput } from "@/lib/predict/probability";
import { FundamentalSignals } from "@/lib/signals/fundamental";
import { FlowSignals } from "@/lib/signals/flow";
import { ShortTermSignals } from "@/lib/signals/shortTerm";
import { ShortTermVolatility } from "@/lib/signals/shortTermVolatility";
import { TrendSignals } from "@/lib/signals/trend";
import { ConsistencyOutput } from "@/lib/consistency";

export interface ExplainComponent {
  key: string;
  label: string;
  value: number | string;
  weight: number;
  contribution: number;
}

export interface ExplainSection {
  score: number | null;
  components: ExplainComponent[];
  formula: string;
  reasons: string[];
  riskFlags: string[];
}

export interface ExplainBreakdown {
  trend: ExplainSection;
  flow: ExplainSection;
  fundamental: ExplainSection;
  confidence: ExplainSection & { score: number };
  volatility: ExplainSection;
  shortTerm: ExplainSection;
  prediction: ExplainSection;
  consistency: ExplainSection & {
    level: "高一致性" | "中一致性" | "低一致性";
    consensusDirection: "偏多" | "偏空" | "不明確";
    consensusValue: number;
    disagreement: number;
    sameSignRatio: number;
    contradictions: string[];
  };
}

interface BuildExplainBreakdownInput {
  trend: TrendSignals;
  flow: FlowSignals;
  fundamental: FundamentalSignals;
  ai: AIExplanation;
  shortTermVolatility: ShortTermVolatility;
  shortTerm: ShortTermSignals;
  predictions: PredictionOutput;
  consistency: ConsistencyOutput;
  latestClose: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function scoreFromReturn(ret: number | null, low = -0.1, high = 0.1): number {
  if (ret === null || !Number.isFinite(ret)) return 50;
  if (ret <= low) return 10;
  if (ret >= high) return 95;
  const ratio = (ret - low) / (high - low);
  return 10 + ratio * 85;
}

function scoreFromRsi(rsi: number | null): number {
  if (rsi === null || !Number.isFinite(rsi)) return 50;
  if (rsi >= 75) return 95;
  if (rsi >= 65) return 85;
  if (rsi >= 55) return 70;
  if (rsi >= 45) return 55;
  if (rsi >= 35) return 35;
  return 15;
}

function scoreFromMacdHistogram(histogram: number | null, close: number): number {
  if (histogram === null || !Number.isFinite(histogram) || close <= 0) return 50;
  const normalized = histogram / close;
  if (normalized >= 0.02) return 90;
  if (normalized >= 0) return 60 + (normalized / 0.02) * 30;
  if (normalized >= -0.02) return 40 + ((normalized + 0.02) / 0.02) * 20;
  return 20;
}

function scoreFromAlignment(trend: TrendSignals, latestClose: number): number {
  const { sma20, sma60, sma120 } = trend;
  if ([sma20, sma60, sma120].some((item) => item === null)) return 50;

  const bullishAligned = sma20! > sma60! && sma60! > sma120!;
  const bearishAligned = sma20! < sma60! && sma60! < sma120!;
  const aboveSma20 = latestClose > sma20!;

  if (bullishAligned && aboveSma20) return 95;
  if (bullishAligned) return 80;
  if (bearishAligned && !aboveSma20) return 15;
  if (bearishAligned) return 30;
  return aboveSma20 ? 60 : 45;
}

function scoreFromFlowPressure(net5: number, net20: number): number {
  const ratio = net5 / (Math.abs(net20) + 1);
  return clamp(50 + Math.tanh(ratio) * 35, 10, 95);
}

function scoreFromMarginChange(marginChange20D: number | null): number {
  if (marginChange20D === null || !Number.isFinite(marginChange20D)) return 50;
  if (marginChange20D <= -5) return 78;
  if (marginChange20D < 5) return 58;
  if (marginChange20D < 15) return 40;
  return 18;
}

function scoreFromYoy(yoy: number | null): number {
  if (yoy === null || !Number.isFinite(yoy)) return 50;
  return clamp(50 + Math.tanh(yoy / 25) * 30, 10, 95);
}

function scoreFromYoyTrend(trend: FundamentalSignals["yoyTrend"]): number {
  if (trend === "up") return 78;
  if (trend === "down") return 30;
  return 50;
}

function scoreFromVolumeSpike(volumeSpike: number | null): number {
  if (volumeSpike === null || !Number.isFinite(volumeSpike)) return 0;
  if (volumeSpike >= 2) return 100;
  if (volumeSpike >= 1.3) return 45 + ((volumeSpike - 1.3) / 0.7) * 55;
  return clamp((volumeSpike / 1.3) * 45, 0, 45);
}

function scoreFromAtrPct(atrPct: number | null): number {
  if (atrPct === null || !Number.isFinite(atrPct)) return 0;
  if (atrPct >= 0.05) return 100;
  if (atrPct >= 0.02) return 45 + ((atrPct - 0.02) / 0.03) * 55;
  return clamp((atrPct / 0.02) * 45, 0, 45);
}

function scoreFromGap(gap: number | null): number {
  if (gap === null || !Number.isFinite(gap)) return 0;
  const absGap = Math.abs(gap);
  if (absGap >= 0.03) return 100;
  if (absGap >= 0.01) return 33 + ((absGap - 0.01) / 0.02) * 67;
  return clamp((absGap / 0.01) * 33, 0, 33);
}

function withContribution(
  key: string,
  label: string,
  value: number | string,
  weight: number,
  rawScore: number,
): ExplainComponent {
  const normalized = clamp01(rawScore / 100);
  return {
    key,
    label,
    value,
    weight,
    contribution: Number((weight * normalized).toFixed(4)),
  };
}

function toDisplayValue(value: number | null, digits = 4): number | string {
  if (value === null || Number.isNaN(value)) return "N/A";
  return Number(value.toFixed(digits));
}

export function buildExplainBreakdown(input: BuildExplainBreakdownInput): ExplainBreakdown {
  const { trend, flow, fundamental, ai, shortTermVolatility, shortTerm, predictions, consistency, latestClose } = input;

  const trendComponents = [
    withContribution(
      "ma_alignment",
      "均線排列與價位",
      `close=${latestClose.toFixed(2)}`,
      0.3,
      scoreFromAlignment(trend, latestClose),
    ),
    withContribution("rsi14", "RSI(14)", toDisplayValue(trend.rsi14, 2), 0.15, scoreFromRsi(trend.rsi14)),
    withContribution(
      "macd_hist",
      "MACD 柱狀體",
      toDisplayValue(trend.macd.histogram, 4),
      0.15,
      scoreFromMacdHistogram(trend.macd.histogram, latestClose),
    ),
    withContribution(
      "return20d",
      "20 日報酬",
      toDisplayValue(trend.return20D !== null ? trend.return20D * 100 : null, 2),
      0.25,
      scoreFromReturn(trend.return20D),
    ),
    withContribution(
      "return60d",
      "60 日報酬",
      toDisplayValue(trend.return60D !== null ? trend.return60D * 100 : null, 2),
      0.15,
      scoreFromReturn(trend.return60D, -0.2, 0.2),
    ),
  ];

  const flowComponents = [
    withContribution(
      "foreign_flow_5d",
      "外資 5 日相對動能",
      toDisplayValue(flow.foreign5D, 0),
      0.3,
      scoreFromFlowPressure(flow.foreign5D, flow.foreign20D),
    ),
    withContribution(
      "trust_flow_5d",
      "投信 5 日相對動能",
      toDisplayValue(flow.trust5D, 0),
      0.2,
      scoreFromFlowPressure(flow.trust5D, flow.trust20D),
    ),
    withContribution(
      "margin_change_20d",
      "融資 20 日變動(%)",
      toDisplayValue(flow.marginChange20D, 2),
      0.25,
      scoreFromMarginChange(flow.marginChange20D),
    ),
    withContribution("flow_total", "Flow 總分校正", toDisplayValue(flow.flowScore, 2), 0.25, flow.flowScore ?? 50),
  ];

  const fundamentalComponents = [
    withContribution(
      "yoy_3m_avg",
      "近 3 月 YoY 平均(%)",
      toDisplayValue(fundamental.recent3MoYoyAverage, 2),
      0.45,
      scoreFromYoy(fundamental.recent3MoYoyAverage),
    ),
    withContribution(
      "yoy_6m_avg",
      "近 6 月 YoY 平均(%)",
      toDisplayValue(fundamental.recent6MoYoyAverage, 2),
      0.35,
      scoreFromYoy(fundamental.recent6MoYoyAverage),
    ),
    withContribution("yoy_trend", "YoY 趨勢", fundamental.yoyTrend ?? "N/A", 0.2, scoreFromYoyTrend(fundamental.yoyTrend)),
  ];

  const confidenceComponents = [
    withContribution("trend_score", "Trend 分數", toDisplayValue(trend.trendScore, 2), 0.6, trend.trendScore ?? 50),
    withContribution("flow_score", "Flow 分數", toDisplayValue(flow.flowScore, 2), 0.3, flow.flowScore ?? 50),
    withContribution(
      "fundamental_score",
      "Fundamental 分數",
      toDisplayValue(fundamental.fundamentalScore, 2),
      0.2,
      fundamental.fundamentalScore ?? 50,
    ),
    withContribution(
      "catalyst_score",
      "新聞催化分數",
      toDisplayValue(ai.confidenceTerms.catalystScore, 2),
      0.12,
      ai.confidenceTerms.catalystScore + 50,
    ),
    withContribution(
      "risk_penalty",
      "風險扣分（反向）",
      toDisplayValue(ai.confidenceTerms.riskPenalty, 2),
      -0.15,
      ai.confidenceTerms.riskPenalty,
    ),
  ];

  const volatilityComponents = [
    withContribution(
      "volume_spike",
      "量能放大倍數",
      toDisplayValue(shortTermVolatility.volumeSpike, 3),
      0.35,
      scoreFromVolumeSpike(shortTermVolatility.volumeSpike),
    ),
    withContribution(
      "atr_pct",
      "ATR%",
      toDisplayValue(shortTermVolatility.atrPct !== null ? shortTermVolatility.atrPct * 100 : null, 2),
      0.35,
      scoreFromAtrPct(shortTermVolatility.atrPct),
    ),
    withContribution(
      "gap_abs",
      "Gap 絕對值(%)",
      toDisplayValue(shortTermVolatility.gap !== null ? Math.abs(shortTermVolatility.gap) * 100 : null, 2),
      0.3,
      scoreFromGap(shortTermVolatility.gap),
    ),
  ];

  return {
    trend: {
      score: trend.trendScore,
      components: trendComponents,
      formula:
        "TrendScore ≈ 0.30*均線 + 0.15*RSI + 0.15*MACD + 0.25*20日報酬 + 0.15*60日報酬",
      reasons: trend.reasons,
      riskFlags: trend.risks,
    },
    flow: {
      score: flow.flowScore,
      components: flowComponents,
      formula:
        "FlowScore ≈ 0.30*外資動能 + 0.20*投信動能 + 0.25*融資變化 + 0.25*Flow總分校正",
      reasons: flow.reasons,
      riskFlags: flow.risks,
    },
    fundamental: {
      score: fundamental.fundamentalScore,
      components: fundamentalComponents,
      formula: "FundamentalScore ≈ 0.45*近3月YoY + 0.35*近6月YoY + 0.20*YoY趨勢",
      reasons: fundamental.reasons,
      riskFlags: fundamental.risks,
    },
    confidence: {
      score: ai.confidence,
      components: confidenceComponents,
      formula:
        "Confidence = clamp(50 + 0.6*(Trend-50) + 0.3*(Flow-50) + 0.2*(Fund-50) + 0.12*Catalyst - RiskPenalty, 0..100)",
      reasons: ai.keyPoints,
      riskFlags: ai.risks,
    },
    volatility: {
      score: shortTermVolatility.volatilityScore,
      components: volatilityComponents,
      formula:
        "VolatilityScore = clamp(round(VolumeSpikeScore + ATR%Score + |Gap|Score), 0..100)",
      reasons: [
        "VolumeSpike 2.0 以上視為高波動量能",
        "ATR% 5% 以上代表日內波幅明顯擴大",
        "Gap 絕對值 3% 以上視為高跳空風險",
      ],
      riskFlags: [],
    },
    shortTerm: {
      score: shortTerm.shortTermOpportunityScore,
      components: shortTerm.breakdown.components,
      formula: shortTerm.breakdown.formula,
      reasons: shortTerm.breakdown.reasons,
      riskFlags: shortTerm.breakdown.riskFlags,
    },
    prediction: {
      score: predictions.upProb3D,
      components: predictions.breakdown.components,
      formula: predictions.breakdown.formula,
      reasons: predictions.breakdown.notes,
      riskFlags: [],
    },
    consistency: {
      score: consistency.score,
      level: consistency.level,
      consensusDirection: consistency.consensusDirection,
      consensusValue: consistency.consensusValue,
      disagreement: consistency.disagreement,
      sameSignRatio: consistency.sameSignRatio,
      components: consistency.components.map((row) => ({
        key: row.key,
        label: row.label,
        value: row.value,
        weight: row.weight,
        contribution: row.contribution,
      })),
      formula: consistency.formula,
      reasons: consistency.reasons,
      riskFlags: [],
      contradictions: consistency.contradictions,
    },
  };
}
