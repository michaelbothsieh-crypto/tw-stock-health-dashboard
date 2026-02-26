import { StrategyInput, StrategyOutput, StrategySignal } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function strategyConfidence(input: StrategyInput): number {
  const riskFlagsPenalty = Math.min(12, input.riskFlags.length * 3);
  const score =
    50 +
    (input.upProb5D - 50) * 0.6 +
    (input.shortTermOpportunityScore - 50) * 0.4 -
    (input.pullbackRiskScore - 50) * 0.4 +
    Math.min(15, Math.abs(input.catalystScore) * 0.2) -
    riskFlagsPenalty;
  return Number(clamp(score, 0, 100).toFixed(1));
}

function baseRiskNotes(input: StrategyInput): string[] {
  const notes: string[] = [];
  if (input.riskFlags.includes("overheated")) notes.push("短線過熱，追價風險偏高");
  if (input.riskFlags.includes("fake_breakout_risk")) notes.push("突破量能不足，留意假突破");
  if (input.riskFlags.includes("weak_trend")) notes.push("中期趨勢偏弱，需更嚴格設定失效條件");
  return notes.length > 0 ? notes : ["波動可能放大，請以條件確認後再行動"];
}

function signalFromProb(prob5D: number): StrategySignal {
  if (prob5D >= 60) return "偏多";
  if (prob5D <= 45) return "等待";
  return "觀察";
}

export function generateStrategy(input: StrategyInput): StrategyOutput {
  const matchedRules: string[] = [];
  const riskNotes = baseRiskNotes(input);

  // (1) 突破追蹤（短線）
  if (
    input.shortTermOpportunityScore >= 75 &&
    input.breakoutScore >= 70 &&
    input.pullbackRiskScore <= 65 &&
    input.bigMoveProb3D >= 55
  ) {
    matchedRules.push("rule_breakout_follow");
    return {
      mode: "短線",
      signal: "偏多",
      confidence: strategyConfidence(input),
      actionCards: [
        {
          title: "突破追蹤：放量突破後續航",
          summary: "突破條件成立，優先觀察是否延續強勢。",
          conditions: ["站上近 20 日高點或接近突破", "波動敏感度偏高，具備擴張條件"],
          invalidation: ["收盤跌回 SMA20 下方", "突破後 2 日內量能明顯萎縮"],
          riskNotes,
          plan: ["突破當日→隔日觀察是否續強", "若回踩不破 SMA20/突破位，視為強勢"],
          tags: ["突破", "放量", "短線"],
        },
      ],
      debug: { chosenRuleId: "rule_breakout_follow", matchedRules },
    };
  }

  // (2) 回踩承接（波段）
  if (
    (input.trendScore ?? 50) >= 65 &&
    input.pullbackRiskScore >= 50 &&
    input.pullbackRiskScore <= 75 &&
    ((input.flowScore ?? 50) >= 55 || input.catalystScore >= 20)
  ) {
    matchedRules.push("rule_pullback_buy");
    return {
      mode: "波段",
      signal: signalFromProb(input.upProb5D),
      confidence: strategyConfidence(input),
      actionCards: [
        {
          title: "偏多策略：回踩承接",
          summary: "趨勢尚強，等待回踩確認後再提高關注。",
          conditions: ["趨勢分數維持高檔", "回檔風險處於可控區間", "資金流或新聞催化至少一項偏正向"],
          invalidation: ["跌破 SMA60", "法人轉弱（F5<0 且 F20<0）"],
          riskNotes,
          plan: ["優先觀察回踩是否止穩", "回穩後留意是否重新放量上攻"],
          tags: ["回踩", "波段", "承接"],
        },
      ],
      debug: { chosenRuleId: "rule_pullback_buy", matchedRules },
    };
  }

  // (3) 新聞事件驅動（短線）
  if (Math.abs(input.catalystScore) >= 35 && input.volatilityScore >= 55) {
    matchedRules.push("rule_news_event");
    const signal: StrategySignal = input.catalystScore > 0 ? "偏多" : "避開";
    return {
      mode: "短線",
      signal,
      confidence: strategyConfidence(input),
      actionCards: [
        {
          title: "事件驅動：新聞催化策略",
          summary: "事件強度高，短期波動可能放大。",
          conditions: ["新聞催化分數絕對值偏高", "波動敏感度偏高"],
          invalidation: ["事件後首日出現反向長黑/長紅吞噬", "成交量快速降溫"],
          riskNotes: [...riskNotes, "事件後 1~3 日易出現急拉急殺，留意跳空缺口"],
          plan: ["先確認方向與量能是否一致", "若出現反向訊號，優先等待再評估"],
          tags: ["新聞催化", "事件", "高波動"],
        },
      ],
      debug: { chosenRuleId: "rule_news_event", matchedRules },
    };
  }

  // (4) 籌碼轉弱避險（波段）
  if (
    ((input.trendScore ?? 50) >= 55 && (input.flowScore ?? 50) <= 35) ||
    input.riskFlags.includes("inst_reversal_down") ||
    input.riskFlags.includes("margin_spike")
  ) {
    matchedRules.push("rule_flow_risk_off");
    return {
      mode: "波段",
      signal: "等待",
      confidence: strategyConfidence(input),
      actionCards: [
        {
          title: "籌碼轉弱：保守防守",
          summary: "籌碼面走弱，先避免追價。",
          conditions: ["趨勢尚未完全轉空", "籌碼分數偏弱或出現轉弱旗標"],
          invalidation: ["籌碼分數回升至 50 以上", "法人連續轉買且量能配合"],
          riskNotes: [...riskNotes, "籌碼轉弱常先於價格，降低追價"],
          plan: ["觀察法人是否止穩", "未改善前以等待為主"],
          tags: ["籌碼", "防守", "避險"],
        },
      ],
      debug: { chosenRuleId: "rule_flow_risk_off", matchedRules },
    };
  }

  // (5) 弱勢反彈（短線）
  if (
    (input.trendScore ?? 50) <= 45 &&
    input.volatilityScore >= 60 &&
    input.upProb1D >= 55 &&
    input.upProb5D <= 50
  ) {
    matchedRules.push("rule_dead_cat_bounce");
    return {
      mode: "短線",
      signal: "觀察",
      confidence: strategyConfidence(input),
      actionCards: [
        {
          title: "弱勢反彈：短打觀察",
          summary: "短線或有反彈，但中期仍偏弱。",
          conditions: ["短期上漲機率偏高", "5 日機率未轉強", "波動敏感度偏高"],
          invalidation: ["反彈無法站回 SMA20", "反彈量能不足且隔日轉弱"],
          riskNotes: [...riskNotes, "屬反彈型，快進快出、嚴格失效條件"],
          plan: ["僅在反彈訊號同步時觀察", "若無法續強，回到等待模式"],
          tags: ["反彈", "短線", "高風險"],
        },
      ],
      debug: { chosenRuleId: "rule_dead_cat_bounce", matchedRules },
    };
  }

  // (6) 無明確優勢（預設）
  matchedRules.push("rule_default_wait");
  return {
    mode: "波段",
    signal: "觀察",
    confidence: strategyConfidence(input),
    actionCards: [
      {
        title: "無明確優勢：等待訊號收斂",
        summary: "訊號分歧，等待更一致的條件。",
        conditions: ["短期機會分數提升至 70 以上", "資金流分數回升至 55 以上", "5 日上漲機率持續站上 60%"],
        invalidation: ["趨勢分數跌破 45", "回檔風險持續升高且新聞轉負面"],
        riskNotes,
        plan: ["先觀察分數是否同步改善", "條件一致後再切換偏多或偏空策略"],
        tags: ["等待", "觀察", "訊號分歧"],
      },
    ],
    debug: { chosenRuleId: "rule_default_wait", matchedRules },
  };
}
