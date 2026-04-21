import { describe, expect, it } from "vitest";
import { generateExplanation } from "../explain";
import { TrendSignals } from "../../signals/trend";
import { FlowSignals } from "../../signals/flow";
import { FundamentalSignals } from "../../signals/fundamental";

describe("generateExplanation", () => {
  it("returns neutral and low confidence when trend score is null", () => {
    const trend: TrendSignals = {
      sma20: null,
      sma60: null,
      sma120: null,
      rsi14: null,
      macd: { macdLine: null, signalLine: null, histogram: null },
      return20D: null,
      return60D: null,
      volRatio: null,
      trendScore: null,
      reasons: ["null trend"],
      risks: [],
    };

    const flow: FlowSignals = {
      foreign5D: 0,
      foreign20D: 0,
      trust5D: 0,
      trust20D: 0,
      marginChange20D: null,
      smartMoneyFlow: 0,
      retailSentiment: 0,
      flowVerdict: "中性震盪",
      institutionalLots: 0,
      trustLots: 0,
      marginLots: 0,
      shortLots: 0,
      flowScore: 80,
      reasons: [],
      risks: [],
    };

    const fund: FundamentalSignals = {
      recent3MoYoyAverage: null,
      recent6MoYoyAverage: null,
      yoyTrend: null,
      fundamentalScore: 80,
      reasons: [],
      risks: [],
    };

    const result = generateExplanation("2330", trend, flow, fund);
    expect(result.stance).toBe("Neutral");
    expect(result.confidence).toBe(30);
    expect(result.keyPoints[0]).toContain("資料不足");
  });

  it("upgrades to bullish when trend and catalyst are both strong", () => {
    const trend: TrendSignals = {
      sma20: null,
      sma60: null,
      sma120: null,
      rsi14: null,
      macd: { macdLine: null, signalLine: null, histogram: null },
      return20D: null,
      return60D: null,
      volRatio: null,
      trendScore: 60,
      reasons: [],
      risks: [],
    };

    const flow: FlowSignals = {
      foreign5D: 0,
      foreign20D: 0,
      trust5D: 0,
      trust20D: 0,
      marginChange20D: null,
      smartMoneyFlow: 0,
      retailSentiment: 0,
      flowVerdict: "中性震盪",
      institutionalLots: 0,
      trustLots: 0,
      marginLots: 0,
      shortLots: 0,
      flowScore: 65,
      reasons: [],
      risks: [],
    };

    const fund: FundamentalSignals = {
      recent3MoYoyAverage: null,
      recent6MoYoyAverage: null,
      yoyTrend: null,
      fundamentalScore: 50,
      reasons: [],
      risks: [],
    };

    const catalyst = {
      catalystScore: 30,
      bullishCount: 2,
      bearishCount: 0,
      timeline: [],
      topBullishNews: [],
      topBearishNews: [],
    };

    const result = generateExplanation("2330", trend, flow, fund, catalyst);
    expect(result.stance).toBe("Bullish");
  });

  it("deducts confidence points for risk flags", () => {
    const trend: TrendSignals = {
      sma20: null,
      sma60: null,
      sma120: null,
      rsi14: null,
      macd: { macdLine: null, signalLine: null, histogram: null },
      return20D: null,
      return60D: null,
      volRatio: null,
      trendScore: 80,
      reasons: [],
      risks: ["overheated", "whipsaw"],
    };

    const flow: FlowSignals = {
      foreign5D: 0,
      foreign20D: 0,
      trust5D: 0,
      trust20D: 0,
      marginChange20D: null,
      smartMoneyFlow: 0,
      retailSentiment: 0,
      flowVerdict: "中性震盪",
      institutionalLots: 0,
      trustLots: 0,
      marginLots: 0,
      shortLots: 0,
      flowScore: 80,
      reasons: [],
      risks: ["margin_spike"],
    };

    const fund: FundamentalSignals = {
      recent3MoYoyAverage: null,
      recent6MoYoyAverage: null,
      yoyTrend: null,
      fundamentalScore: 80,
      reasons: [],
      risks: [],
    };

    const result = generateExplanation("2330", trend, flow, fund);
    expect(result.confidence).toBe(68);
    expect(result.confidenceTerms.riskPenalty).toBe(15);
  });
});
