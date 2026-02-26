import { fetchRecentBars } from "../range";
import { getInstitutionalInvestors, getMarginShort } from "../providers/finmind";
import { format, subDays } from "date-fns";

export interface HitStats {
  hits: number;
  total: number;
  hitRate: number;
}

export interface BacktestResult {
  window: number;
  h3: HitStats;
  h5: HitStats;
}

// 預測模型（維持專案現有的簡潔規則）：
// 外資買超 +2 / 賣超 -2
// 投信買超 +2 / 賣超 -2
// 自營商買超 +1 / 賣超 -1
// 近5日外資淨買超為正 +1 / 為負 -1
// 當日漲且量增 +1 / 跌且量增 -1
function evaluatePredictionSignal(
  todayIndex: number,
  prices: any[],
  investors: any[]
): "Bullish" | "Neutral" | "Bearish" {
  if (todayIndex < 5) return "Neutral";
  
  const todayClose = prices[todayIndex].close;
  const prevClose = prices[todayIndex - 1].close;
  const todayVol = prices[todayIndex].Trading_Volume || prices[todayIndex].volume || 0;
  const prevVol = prices[todayIndex - 1].Trading_Volume || prices[todayIndex - 1].volume || 0;
  const dateStr = prices[todayIndex].date;

  let score = 0;

  // Quantity Change
  if (todayClose > prevClose && todayVol > prevVol) score += 1;
  if (todayClose < prevClose && todayVol > prevVol) score -= 1;

  // Find flow on `dateStr`
  const flowToday = investors.filter(t => t.date === dateStr);
  const foreign = flowToday.find(t => t.name.includes("外資及陸資"));
  const trust = flowToday.find(t => t.name === "投信");
  const dealer = flowToday.find(t => t.name.includes("自營商"));

  if (foreign) {
    if (foreign.buy - foreign.sell > 0) score += 2;
    else if (foreign.buy - foreign.sell < 0) score -= 2;
  }
  
  if (trust) {
    if (trust.buy - trust.sell > 0) score += 2;
    else if (trust.buy - trust.sell < 0) score -= 2;
  }

  if (dealer) {
    if (dealer.buy - dealer.sell > 0) score += 1;
    else if (dealer.buy - dealer.sell < 0) score -= 1;
  }

  // 5-day Foreign Net Flow
  const last5Dates = prices.slice(todayIndex - 4, todayIndex + 1).map(b => b.date);
  const flowLast5 = investors.filter(t => last5Dates.includes(t.date) && t.name.includes("外資及陸資"));
  let foreignNet5D = 0;
  for (const f of flowLast5) {
    foreignNet5D += (f.buy - f.sell);
  }
  if (foreignNet5D > 0) score += 1;
  else if (foreignNet5D < 0) score -= 1;

  if (score >= 1) return "Bullish";
  if (score <= -2) return "Bearish";
  return "Neutral";
}

export async function runBacktest(symbol: string, windowDays: number = 120): Promise<BacktestResult> {
  // We need `windowDays` of evaluation, PLUS 5 days forward for the final check (t+5), 
  // and PLUS 5 days backward for the rolling net flow.
  const lookbackTotal = windowDays + 15; 
  let rangeResult;
  try {
     rangeResult = await fetchRecentBars(symbol, lookbackTotal);
  } catch (e) {
     return { window: windowDays, h3: {hits: 0, total: 0, hitRate: 0}, h5: {hits: 0, total: 0, hitRate: 0}};
  }
  
  const prices = rangeResult.data;
  if (prices.length < 20) {
    return { window: windowDays, h3: {hits: 0, total: 0, hitRate: 0}, h5: {hits: 0, total: 0, hitRate: 0}};
  }

  // Find boundary dates for finmind fetch
  const startDate = prices[0].date;
  const endDate = prices[prices.length - 1].date;

  let investorsResult;
  try {
     investorsResult = await getInstitutionalInvestors(symbol, startDate, endDate);
  } catch (e) {
     return { window: windowDays, h3: {hits: 0, total: 0, hitRate: 0}, h5: {hits: 0, total: 0, hitRate: 0}};
  }
  const investors = investorsResult.data;

  // We only run backtest on the days [N_start ... N_end - 5]
  // where N_end is prices.length - 1. We start roughly at `prices.length - windowDays - 5`.
  // Ensure we don't go out of bounds.
  let startIndex = Math.max(5, prices.length - windowDays - 5);
  let endIndex = prices.length - 1;

  let h3Hits = 0, h3Total = 0;
  let h5Hits = 0, h5Total = 0;

  for (let t = startIndex; t <= endIndex; t++) {
    const pred = evaluatePredictionSignal(t, prices, investors);
    
    // Ignore neutral signals
    if (pred === "Neutral") continue;

    const currentClose = prices[t].close;

    // Evaluate t+3
    if (t + 3 <= endIndex) {
      h3Total++;
      const closeT3 = prices[t + 3].close;
      if (pred === "Bullish" && closeT3 > currentClose) h3Hits++;
      else if (pred === "Bearish" && closeT3 < currentClose) h3Hits++;
    }

    // Evaluate t+5
    if (t + 5 <= endIndex) {
      h5Total++;
      const closeT5 = prices[t + 5].close;
      if (pred === "Bullish" && closeT5 > currentClose) h5Hits++;
      else if (pred === "Bearish" && closeT5 < currentClose) h5Hits++;
    }
  }

  return {
    window: windowDays,
    h3: {
      hits: h3Hits,
      total: h3Total,
      hitRate: h3Total > 0 ? (h3Hits / h3Total) : 0
    },
    h5: {
      hits: h5Hits,
      total: h5Total,
      hitRate: h5Total > 0 ? (h5Hits / h5Total) : 0
    }
  };
}
