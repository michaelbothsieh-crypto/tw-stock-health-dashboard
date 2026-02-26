export type StrategyMode = "波段" | "短線";
export type StrategySignal = "觀察" | "偏多" | "偏空" | "等待" | "避開";

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
  riskFlags: string[];
}

export interface StrategyOutput {
  mode: StrategyMode;
  signal: StrategySignal;
  confidence: number;
  actionCards: StrategyActionCard[];
  debug: {
    chosenRuleId: string;
    matchedRules: string[];
  };
}
