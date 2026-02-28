import { CrashWarningOutput } from "@/lib/global/crash/crashEngine";

import { CorrelationResult } from "@/lib/analytics/correlation";
import { StrategyOutput } from "@/lib/strategy/types";
import { KeyLevelsResult } from "@/lib/signals/keyLevels";
import { UxSummaryOutput } from "@/lib/ux/summaryBuilder";
import { RadarOverviewDataItem } from "@/components/charts/RadarOverview";

import { StockProfile } from "@/lib/industry/stockProfileResolver";
import { SelectedDrivers } from "@/lib/global/driverSelector";
import { RelativeStrengthResult } from "@/lib/analytics/relativeStrength";


export type ExplainTab = "trend" | "flow" | "fundamental" | "volatility" | "news" | "prediction" | "strategy" | "consistency";

export type ExplainSection = {
  score: number | null;
  formula: string;
  components: Array<{ key: string; label: string; value: number | string; weight: number; contribution: number }>;
  reasons: string[];
  riskFlags: string[];
};

export type ConsistencyDetail = ExplainSection & {
  level: "高一致性" | "中一致性" | "低一致性";
  consensusDirection: "偏多" | "偏空" | "不明確";
  consensusValue: number;
  disagreement: number;
  sameSignRatio: number;
  contradictions: string[];
};

export type SnapshotResponse = {
  overallHealthScore?: number;
  displayName?: string;
  crashWarning?: CrashWarningOutput;
  warnings?: string[];
  technicals?: import('@/lib/providers/tradingViewFetch').TvTechnicalData | null;
  technicalTactics?: import('@/lib/ux/technicalTranslator').TranslatedTechnicals | null;
  playbook?: import('@/lib/ai/playbookAgent').ActionPlaybook;
  insiderTransfers?: import('@/lib/providers/twseInsiderFetch').InsiderTransfer[];
  signals: {
    trend: { trendScore: number | null };
    flow: {
      flowScore: number | null;
      marginChange20D: number | null;
      smartMoneyFlow?: number;
      retailSentiment?: number;
      flowVerdict?: string;
      institutionalLots?: number;
      trustLots?: number;
      marginLots?: number;
      shortLots?: number;
    };
    fundamental: { fundamentalScore: number | null };
  };
  shortTerm: {
    shortTermOpportunityScore: number;
  };
  predictions: {
    upProb3D: number;
    upProb5D: number;
  };
  strategy: StrategyOutput;
  institutionCorrelation: CorrelationResult;
  globalLinkage: {
    profile: StockProfile;
    drivers: SelectedDrivers;
    relativeStrength: RelativeStrengthResult | null;
  } | null;
  aiSummary: { stance: "Bullish" | "Neutral" | "Bearish"; keyPoints: string[] };
  keyLevels: KeyLevelsResult;
  uxSummary: UxSummaryOutput;
  explainBreakdown: {
    trend: ExplainSection;
    flow: ExplainSection;
    fundamental: ExplainSection;
    volatility: ExplainSection;
    prediction: ExplainSection;
    consistency: ConsistencyDetail;
  };
  shortTermVolatility: { volatilityScore: number };
  newsMeta?: { bullishCount: number; bearishCount: number; catalystScore: number };
  consistency: {
    score: number;
    level: "高一致性" | "中一致性" | "低一致性";
    consensusDirection: "偏多" | "偏空" | "不明確";
    contradictions: string[];
    reasons: string[];
  };
  data: {
    prices: Array<{
      date: string;
      close: number;
      volume?: number;
    }>;
  };
};

export type MainTab = "數據判讀" | "分析詳解";

export interface DashboardLayoutProps {
  snapshot: SnapshotResponse;
  currentStockLabel: string;
  showDetail: boolean;
  setShowDetail: (v: boolean) => void;
  activeMainTab: MainTab;
  setActiveMainTab: (v: MainTab) => void;
  activeExplainTab: ExplainTab;
  setActiveExplainTab: (v: ExplainTab) => void;
  setShowStockPicker: (v: boolean) => void;
  radarData: RadarOverviewDataItem[];
}
