export type StrategyMode = "波段" | "短線";
export type StrategySignal = "觀察" | "偏多" | "偏空" | "等待" | "避開" | "CASH" | "HOLD";

export interface StrategyActionCard {
  title: string;
  summary: string;
  conditions: string[];
  invalidation: string[];
  riskNotes: string[];
  plan: string[];
  tags: string[];
}

export interface StrategyInput {
  trendScore: number | null;
  flowScore: number | null;
  fundamentalScore: number | null;
  catalystScore: number;
  volatilityScore: number;
  shortTermOpportunityScore: number;
  pullbackRiskScore: number;
  breakoutScore: number;
  upProb1D: number;
  upProb3D: number;
  upProb5D: number;
  bigMoveProb3D: number;
  consistencyScore?: number;
  riskFlags: string[];
  crashRiskScore?: number | null; // 崩盤風險預警分數
}

export interface StrategyOutput {
  mode: StrategyMode;
  signal: StrategySignal;
  confidence: number;
  vetoReason?: string;
  explain: {
    direction: "偏多" | "中性" | "偏空";
    certainty: number;
    reasons: string[];
    contradictions: Array<{ left: string; right: string; why: string }>;
  };
  actionCards: StrategyActionCard[];
  debug: {
    chosenRuleId: string;
    matchedRules: string[];
  };
}
