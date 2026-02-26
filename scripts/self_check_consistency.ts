import { fetchRecentBars } from "../src/lib/range";
import { calculateTrend } from "../src/lib/signals/trend";
import { calculateShortTermVolatility } from "../src/lib/signals/shortTermVolatility";
import { calculateShortTermSignals } from "../src/lib/signals/shortTerm";
import { predictProbabilities } from "../src/lib/predict/probability";
import { calculateConsistency } from "../src/lib/consistency";

const TICKERS = ["2330", "2317", "2454"];
const DIRECTION_ENUM = new Set(["偏多", "偏空", "不明確"]);

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  const scores: number[] = [];

  for (const ticker of TICKERS) {
    const bars = await fetchRecentBars(ticker, 180);
    assert(bars.data.length >= 130, `${ticker} 價格資料不足`);

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

    const consistency = calculateConsistency({
      trendScore: trend.trendScore,
      flowScore: 50,
      fundamentalScore: null,
      catalystScore: 0,
      shortTermOpportunityScore: shortTerm.shortTermOpportunityScore,
      upProb5D: predictions.upProb5D,
    });

    assert(consistency.score >= 0 && consistency.score <= 100, `${ticker} consistencyScore 超出範圍`);
    assert(consistency.components.length >= 5, `${ticker} components 長度不足`);
    assert(DIRECTION_ENUM.has(consistency.consensusDirection), `${ticker} consensusDirection 非法`);

    scores.push(consistency.score);
    console.log(
      `${ticker} => score=${consistency.score.toFixed(1)}, direction=${consistency.consensusDirection}, disagree=${consistency.disagreement.toFixed(3)}`,
    );
  }

  const spread = Math.max(...scores) - Math.min(...scores);
  assert(spread >= 1, `consistencyScore 幾乎固定，spread=${spread.toFixed(2)}`);
  console.log("PASS self_check_consistency");
}

run().catch((error) => {
  console.error("FAIL self_check_consistency:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
