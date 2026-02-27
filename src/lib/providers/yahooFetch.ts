import YahooFinance from "yahoo-finance2";
import { getCache, setCache } from "./redisCache";

const yahooFinance = new YahooFinance();

export interface USStockFundamentals {
  name: string | null;
  eps: number | null;
  peRatio: number | null;
  revenueGrowth: number | null;
  institutionalOwnership: number | null;
}

export async function getUSStockFundamentals(ticker: string): Promise<USStockFundamentals> {
  const cacheKey = `us:fund:${ticker}`;
  try {
    const cached = await getCache<USStockFundamentals>(cacheKey);
    if (cached) return cached;
  } catch (e) {}

  try {
    const quote = await yahooFinance.quote(ticker);
    const summaryDetail = await yahooFinance.quoteSummary(ticker, { modules: ["summaryDetail", "defaultKeyStatistics", "financialData"] }) as any;
    
    const name = quote.longName || quote.shortName || null;
    const eps = summaryDetail.defaultKeyStatistics?.trailingEps ?? null;
    const peRatio = summaryDetail.summaryDetail?.trailingPE ?? null;
    const revenueGrowth = summaryDetail.financialData?.revenueGrowth ?? null;
    const institutionalOwnership = summaryDetail.defaultKeyStatistics?.heldPercentInstitutions ?? null;

    const result: USStockFundamentals = {
      name,
      eps,
      peRatio,
      revenueGrowth,
      institutionalOwnership,
    };

    try {
      await setCache(cacheKey, result, 43200); // 12 hours
    } catch (e) {}

    return result;
  } catch (error) {
    console.warn(`[Yahoo] Error fetching fundamentals for ${ticker}:`, error);
    return {
      name: null,
      eps: null,
      peRatio: null,
      revenueGrowth: null,
      institutionalOwnership: null,
    };
  }
}
