import { fetchRecentBars } from "../src/lib/range";
import { calculateTrend } from "../src/lib/signals/trend";
import { calculateShortTermVolatility } from "../src/lib/signals/shortTermVolatility";
import { calculateShortTermSignals } from "../src/lib/signals/shortTerm";
import { predictProbabilities } from "../src/lib/predict/probability";
import { getCalibrationModel } from "../src/lib/predict/calibration";

const TICKERS = ["2330", "2317", "2454"];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

async function run(): Promise<void> {
  const calibration = await getCalibrationModel(TICKERS);
  const results: Array<{ ticker: string; up1: number; up3: number; up5: number }> = [];

  for (const ticker of TICKERS) {
    const bars = await fetchRecentBars(ticker, 180);
    assert(bars.data.length >= 130, `${ticker} 歷史資料不足`);

    const trend = calculateTrend(bars.data);
    const volatility = calculateShortTermVolatility(bars.data);
    const shortTerm = calculateShortTermSignals(bars.data, trend, volatility);

    const prediction = predictProbabilities({
      trendScore: trend.trendScore,
      flowScore: 50,
      fundamentalScore: null,
      catalystScore: 0,
      volatilityScore: volatility.volatilityScore,
      shortTermOpportunityScore: shortTerm.shortTermOpportunityScore,
      pullbackRiskScore: shortTerm.pullbackRiskScore,
      volumeSpike: volatility.volumeSpike,
      gap: volatility.gap,
      calibration,
    });

    assert(inRange(prediction.upProb1D, 0, 100), `${ticker} upProb1D 超出範圍`);
    assert(inRange(prediction.upProb3D, 0, 100), `${ticker} upProb3D 超出範圍`);
    assert(inRange(prediction.upProb5D, 0, 100), `${ticker} upProb5D 超出範圍`);
    assert(inRange(prediction.bigMoveProb3D, 0, 100), `${ticker} bigMoveProb3D 超出範圍`);

    const nonZeroContribution = prediction.breakdown.components.some(
      (component) => Math.abs(component.contribution) > 0,
    );
    assert(nonZeroContribution, `${ticker} breakdown contribution 全為 0`);

    results.push({ ticker, up1: prediction.upProb1D, up3: prediction.upProb3D, up5: prediction.upProb5D });
  }

  const pairs: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];
  const hasDiff = pairs.some(([i, j]) => Math.abs(results[i].up3 - results[j].up3) >= 1);
  assert(hasDiff, "不同股票機率差異不足（需至少 1）");

  console.log("PASS self_check_probabilities");
  for (const row of results) {
    console.log(`${row.ticker} => 1D ${row.up1.toFixed(1)}%, 3D ${row.up3.toFixed(1)}%, 5D ${row.up5.toFixed(1)}%`);
  }
}

run().catch((error) => {
  console.error("FAIL self_check_probabilities:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
