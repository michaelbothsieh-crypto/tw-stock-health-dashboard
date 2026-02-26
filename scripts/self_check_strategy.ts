import { fetchRecentBars } from "../src/lib/range";
import { calculateTrend } from "../src/lib/signals/trend";
import { calculateShortTermVolatility } from "../src/lib/signals/shortTermVolatility";
import { calculateShortTermSignals } from "../src/lib/signals/shortTerm";
import { predictProbabilities } from "../src/lib/predict/probability";
import { generateStrategy } from "../src/lib/strategy/strategyEngine";

const TICKERS = ["2330", "2317", "2454"];
const SIGNALS = new Set(["觀察", "偏多", "偏空", "等待", "避開"]);

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  for (const ticker of TICKERS) {
    const bars = await fetchRecentBars(ticker, 180);
    assert(bars.data.length >= 130, `${ticker} 資料不足`);

    const trend = calculateTrend(bars.data);
    const volatility = calculateShortTermVolatility(bars.data);
    const shortTerm = calculateShortTermSignals(bars.data, trend, volatility);
    const predictions = predictProbabilities({
      trendScore: trend.trendScore,
      flowScore: 50,
      fundamentalScore: null,
      catalystScore: 0,
      volatilityScore: volatility.volatilityScore,
      shortTermOpportunityScore: shortTerm.shortTermOpportunityScore,
      pullbackRiskScore: shortTerm.pullbackRiskScore,
      volumeSpike: volatility.volumeSpike,
      gap: volatility.gap,
    });

    const strategy = generateStrategy({
      trendScore: trend.trendScore,
      flowScore: 50,
      fundamentalScore: null,
      catalystScore: 0,
      volatilityScore: volatility.volatilityScore,
      shortTermOpportunityScore: shortTerm.shortTermOpportunityScore,
      pullbackRiskScore: shortTerm.pullbackRiskScore,
      breakoutScore: shortTerm.breakoutScore,
      upProb1D: predictions.upProb1D,
      upProb3D: predictions.upProb3D,
      upProb5D: predictions.upProb5D,
      bigMoveProb3D: predictions.bigMoveProb3D,
      riskFlags: shortTerm.breakdown.riskFlags,
    });

    assert(SIGNALS.has(strategy.signal), `${ticker} signal 非法: ${strategy.signal}`);
    assert(strategy.actionCards.length >= 1, `${ticker} actionCards 為空`);
    assert(strategy.confidence >= 0 && strategy.confidence <= 100, `${ticker} confidence 超出範圍`);
    assert(Boolean(strategy.debug.chosenRuleId), `${ticker} chosenRuleId 缺失`);

    for (const card of strategy.actionCards) {
      assert(Array.isArray(card.conditions), `${ticker} conditions 格式錯誤`);
      assert(Array.isArray(card.invalidation), `${ticker} invalidation 格式錯誤`);
      assert(Array.isArray(card.plan), `${ticker} plan 格式錯誤`);
      assert(Array.isArray(card.riskNotes), `${ticker} riskNotes 格式錯誤`);
    }

    console.log(
      `${ticker} => signal=${strategy.signal}, confidence=${strategy.confidence.toFixed(1)}, rule=${strategy.debug.chosenRuleId}`,
    );
  }

  console.log("PASS self_check_strategy");
}

run().catch((error) => {
  console.error("FAIL self_check_strategy:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
