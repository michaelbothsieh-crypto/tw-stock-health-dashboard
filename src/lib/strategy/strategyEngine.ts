import { StrategyInput, StrategyOutput, StrategySignal } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function strategyConfidence(input: StrategyInput): number {
  const riskFlagsPenalty = Math.min(12, input.riskFlags.length * 3);
  const consistencyScore = input.consistencyScore ?? 50;
  const score =
    50 +
    (input.upProb5D - 50) * 0.6 +
    (input.shortTermOpportunityScore - 50) * 0.4 -
    (input.pullbackRiskScore - 50) * 0.4 +
    Math.min(15, Math.abs(input.catalystScore) * 0.2) +
    (consistencyScore - 50) * 0.25 -
    riskFlagsPenalty;
  return Number(clamp(score, 0, 100).toFixed(1));
}

function baseRiskNotes(input: StrategyInput): string[] {
  const notes: string[] = [];
  if (input.riskFlags.includes("overheated")) notes.push("短線過熱，避免追高後回檔");
  if (input.riskFlags.includes("fake_breakout_risk")) notes.push("突破失敗風險提高，需確認量價延續");
  if (input.riskFlags.includes("weak_trend")) notes.push("趨勢強度不足，部位宜保守");
  return notes.length > 0 ? notes : ["波動放大前，建議先控管槓桿與部位。"];
}

function signalFromProb(prob5D: number): StrategySignal {
  if (prob5D >= 60) return "偏多";
  if (prob5D <= 45) return "等待";
  return "觀察";
}

function downgradeSignalByConsistency(signal: StrategySignal): StrategySignal {
  if (signal === "偏多" || signal === "偏空") return "觀察";
  return signal;
}

function finalizeStrategy(output: StrategyOutput, input: StrategyInput): StrategyOutput {
  if ((input.consistencyScore ?? 50) >= 45) return output;

  const planHint = "目前訊號分歧，建議等待一致性回升再加大操作";
  const actionCards = output.actionCards.map((card) => ({
    ...card,
    plan: card.plan.includes(planHint) ? card.plan : [...card.plan, planHint],
  }));

  return {
    ...output,
    signal: downgradeSignalByConsistency(output.signal),
    actionCards,
  };
}

export function generateStrategy(input: StrategyInput): StrategyOutput {
  const matchedRules: string[] = [];
  const riskNotes = baseRiskNotes(input);

  if (
    input.shortTermOpportunityScore >= 75 &&
    input.breakoutScore >= 70 &&
    input.pullbackRiskScore <= 65 &&
    input.bigMoveProb3D >= 55
  ) {
    matchedRules.push("rule_breakout_follow");
    return finalizeStrategy(
      {
        mode: "短線",
        signal: "偏多",
        confidence: strategyConfidence(input),
        actionCards: [
          {
            title: "突破追蹤，分批進場",
            summary: "突破條件成立，等待回踩或續強確認後執行。",
            conditions: ["價格站上 20 日高點並放量", "波動分數不高於過熱區間"],
            invalidation: ["收盤跌回 SMA20 以下", "突破後連兩日無量回落"],
            riskNotes,
            plan: ["突破當日先小倉位試單", "回踩不破後再加碼"],
            tags: ["突破", "短線", "偏多"],
          },
        ],
        debug: { chosenRuleId: "rule_breakout_follow", matchedRules },
      },
      input,
    );
  }

  if (
    (input.trendScore ?? 50) >= 65 &&
    input.pullbackRiskScore >= 50 &&
    input.pullbackRiskScore <= 75 &&
    ((input.flowScore ?? 50) >= 55 || input.catalystScore >= 20)
  ) {
    matchedRules.push("rule_pullback_buy");
    return finalizeStrategy(
      {
        mode: "波段",
        signal: signalFromProb(input.upProb5D),
        confidence: strategyConfidence(input),
        actionCards: [
          {
            title: "偏多策略：回檔承接",
            summary: "趨勢維持上行，等待回檔到支撐區分批布局。",
            conditions: ["趨勢分數維持高檔", "回檔風險不高", "籌碼或新聞至少一項支持"],
            invalidation: ["跌破中期均線", "籌碼動能明顯轉弱"],
            riskNotes,
            plan: ["先小部位承接", "支撐確認後逐步加碼"],
            tags: ["回檔", "波段", "承接"],
          },
        ],
        debug: { chosenRuleId: "rule_pullback_buy", matchedRules },
      },
      input,
    );
  }

  if (Math.abs(input.catalystScore) >= 35 && input.volatilityScore >= 55) {
    matchedRules.push("rule_news_event");
    const signal: StrategySignal = input.catalystScore > 0 ? "偏多" : "避開";
    return finalizeStrategy(
      {
        mode: "短線",
        signal,
        confidence: strategyConfidence(input),
        actionCards: [
          {
            title: "事件驅動：新聞催化",
            summary: "事件催化有效，但波動放大，需以紀律倉位參與。",
            conditions: ["催化分數絕對值明顯", "波動分數進入事件區間"],
            invalidation: ["事件熱度快速衰退", "量能不足以支撐方向"],
            riskNotes: [...riskNotes, "事件交易 1~3 日需提高停損紀律"],
            plan: ["事件當日只做試單", "次日若延續再提高部位"],
            tags: ["新聞", "事件", "短線"],
          },
        ],
        debug: { chosenRuleId: "rule_news_event", matchedRules },
      },
      input,
    );
  }

  if (
    ((input.trendScore ?? 50) >= 55 && (input.flowScore ?? 50) <= 35) ||
    input.riskFlags.includes("inst_reversal_down") ||
    input.riskFlags.includes("margin_spike")
  ) {
    matchedRules.push("rule_flow_risk_off");
    return finalizeStrategy(
      {
        mode: "波段",
        signal: "等待",
        confidence: strategyConfidence(input),
        actionCards: [
          {
            title: "籌碼轉弱：先保守",
            summary: "技術面尚可但籌碼轉弱，避免提前押方向。",
            conditions: ["趨勢與籌碼出現背離", "法人或融資顯著轉弱"],
            invalidation: ["籌碼分數回升", "融資風險消退"],
            riskNotes: [...riskNotes, "籌碼背離階段容易假突破"],
            plan: ["降槓桿並減碼", "等待資金回流訊號"],
            tags: ["籌碼", "保守", "等待"],
          },
        ],
        debug: { chosenRuleId: "rule_flow_risk_off", matchedRules },
      },
      input,
    );
  }

  if (
    (input.trendScore ?? 50) <= 45 &&
    input.volatilityScore >= 60 &&
    input.upProb1D >= 55 &&
    input.upProb5D <= 50
  ) {
    matchedRules.push("rule_dead_cat_bounce");
    return finalizeStrategy(
      {
        mode: "短線",
        signal: "觀察",
        confidence: strategyConfidence(input),
        actionCards: [
          {
            title: "反彈觀察：快進快出",
            summary: "短線可能反彈，但中期方向未翻多。",
            conditions: ["短期上漲機率高於中期", "波動仍高"],
            invalidation: ["反彈無法站上壓力區", "量價結構轉弱"],
            riskNotes: [...riskNotes, "反彈交易不宜戀戰"],
            plan: ["設定明確停損", "獲利後分批了結"],
            tags: ["反彈", "短線", "觀察"],
          },
        ],
        debug: { chosenRuleId: "rule_dead_cat_bounce", matchedRules },
      },
      input,
    );
  }

  matchedRules.push("rule_default_wait");
  return finalizeStrategy(
    {
      mode: "波段",
      signal: "觀察",
      confidence: strategyConfidence(input),
      actionCards: [
        {
          title: "訊號不足，維持觀察",
          summary: "多空訊號尚未收斂，等待明確方向。",
          conditions: ["短期機會分數提升", "籌碼回到中性以上", "5 日上漲機率高於 60%"],
          invalidation: ["趨勢分數跌破 45", "回檔風險快速升高"],
          riskNotes,
          plan: ["先觀察不追價", "等待進一步確認"],
          tags: ["觀察", "等待", "保守"],
        },
      ],
      debug: { chosenRuleId: "rule_default_wait", matchedRules },
    },
    input,
  );
}
