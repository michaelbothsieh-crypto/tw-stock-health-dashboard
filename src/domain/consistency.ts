export type ConsistencyLevel = "高一致性" | "中一致性" | "低一致性";
export type ConsensusDirection = "偏多" | "偏空" | "不明確";

export interface ConsistencyComponent {
  key: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface ConsistencyInput {
  trendScore: number | null;
  flowScore: number | null;
  fundamentalScore: number | null;
  catalystScore: number;
  shortTermOpportunityScore: number;
  upProb5D: number;
}

export interface ConsistencyOutput {
  score: number;
  level: ConsistencyLevel;
  consensusDirection: ConsensusDirection;
  consensusValue: number;
  disagreement: number;
  sameSignRatio: number;
  components: ConsistencyComponent[];
  formula: string;
  reasons: string[];
  contradictions: string[];
}

type SignalRow = {
  key: string;
  label: string;
  direction: number;
  weight: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toDirection(score: number | null): number {
  if (score === null || Number.isNaN(score)) return 0;
  return clamp((score - 50) / 25, -1, 1);
}

function directionToText(direction: number): ConsensusDirection {
  if (direction > 0.15) return "偏多";
  if (direction < -0.15) return "偏空";
  return "不明確";
}

function levelFromScore(score: number): ConsistencyLevel {
  if (score >= 75) return "高一致性";
  if (score >= 55) return "中一致性";
  return "低一致性";
}

export function calculateConsistency(input: ConsistencyInput): ConsistencyOutput {
  const dTrend = toDirection(input.trendScore);
  const dFlow = toDirection(input.flowScore);
  const dFund = input.fundamentalScore === null ? 0 : toDirection(input.fundamentalScore);
  const dNews = clamp(input.catalystScore / 50, -1, 1);
  const dOpp = toDirection(input.shortTermOpportunityScore);
  const dProb = toDirection(input.upProb5D);

  const signals: SignalRow[] = [
    { key: "trend", label: "技術面", direction: dTrend, weight: 1.0 },
    { key: "flow", label: "籌碼面", direction: dFlow, weight: 0.9 },
    { key: "fundamental", label: "基本面", direction: dFund, weight: 0.6 },
    { key: "news", label: "新聞", direction: dNews, weight: 0.9 },
    { key: "opportunity", label: "短期機會", direction: dOpp, weight: 1.0 },
    { key: "probability", label: "機率(5日)", direction: dProb, weight: 1.0 },
  ];

  const totalWeight = signals.reduce((sum, row) => sum + row.weight, 0);
  const consensus = signals.reduce((sum, row) => sum + row.weight * row.direction, 0) / totalWeight;
  const disagreementRaw = signals.reduce((sum, row) => sum + row.weight * Math.abs(row.direction - consensus), 0) / totalWeight;
  const disagreement = clamp(disagreementRaw, 0, 1);

  const consensusSign = consensus >= 0 ? 1 : -1;
  const sameSignRatio =
    Math.abs(consensus) < 0.15
      ? 0.5
      : signals
          .filter((row) => {
            if (Math.abs(row.direction) < 0.15) return false;
            return Math.sign(row.direction) === consensusSign;
          })
          .reduce((sum, row) => sum + row.weight, 0) / totalWeight;

  const base = 100 * (1 - clamp(disagreement / 1.0, 0, 1));
  const bonus = 15 * clamp((sameSignRatio - 0.5) / 0.5, 0, 1);
  const penalty = Math.abs(consensus) < 0.15 ? 12 : 0;
  const score = clamp(Number((base + bonus - penalty).toFixed(1)), 0, 100);

  const components: ConsistencyComponent[] = signals.map((row) => ({
    key: row.key,
    label: row.label,
    value: Number(row.direction.toFixed(3)),
    weight: row.weight,
    contribution: Number((row.weight * row.direction).toFixed(4)),
  }));

  const contradictions = signals
    .filter((row) => Math.abs(consensus) >= 0.15 && Math.sign(row.direction) !== consensusSign && Math.abs(row.direction) >= 0.4)
    .map((row) => `${row.label}${directionToText(row.direction)}，與共識${directionToText(consensus)}相反`);

  const alignedLabels = signals
    .filter((row) => Math.abs(row.direction) >= 0.2 && (Math.abs(consensus) < 0.15 || Math.sign(row.direction) === consensusSign))
    .map((row) => row.label);

  const reasons: string[] = [
    alignedLabels.length > 0
      ? `多數訊號同向：${alignedLabels.slice(0, 4).join("、")}`
      : "多數訊號未形成明顯同向",
    contradictions.length > 0
      ? `${contradictions.length} 個訊號與共識相反，造成一致性下降`
      : "主要訊號未出現強烈對立",
    `共識強度 ${Math.abs(consensus).toFixed(2)}、分歧度 ${disagreement.toFixed(2)}、同向比例 ${(sameSignRatio * 100).toFixed(0)}%`,
  ];

  if (input.fundamentalScore === null) {
    reasons.push("基本面資料不足，一致性可信度下降");
  }

  return {
    score,
    level: levelFromScore(score),
    consensusDirection: directionToText(consensus),
    consensusValue: Number(consensus.toFixed(4)),
    disagreement: Number(disagreement.toFixed(4)),
    sameSignRatio: Number(sameSignRatio.toFixed(4)),
    components,
    formula:
      "consensus=Σ(w*d)/Σw；disagreement=Σ(w*|d-consensus|)/Σw；score=clamp(100*(1-disagreement)+15*bonus-penalty,0..100)",
    reasons,
    contradictions,
  };
}
