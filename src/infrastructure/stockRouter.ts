
import { normalizeTicker, NormalizedTicker } from "@/shared/utils/ticker";
import { 
  getPriceDaily, 
  getInstitutionalInvestors, 
  getMarginShort, 
  getMonthlyRevenue, 
  getTaiwanStockNews,
  getFugleTechnicalIndicators,
  getFugleTechnicalIndicatorsTpex,
  getPriceDailyUs,
  getMonthlyRevenueUs,
  getUsStockNews,
  getInstitutionalInvestorsUs
} from "@/infrastructure/providers/finmind";
import { getTvTechnicalIndicators } from "@/infrastructure/providers/tradingViewFetch";
import { format, subDays } from "date-fns";

/**
 * 股票數據快照路由 (Infrastructure 層)
 * 負責整合不同市場的 Provider 數據
 */
export async function fetchStockSnapshot(norm: NormalizedTicker) {
  const symbol = norm.symbol;
  const isTaiwan = /[0-9]/.test(symbol) || symbol.endsWith(".TW") || symbol.endsWith(".TWO");
  const now = new Date();
  const startDate = format(subDays(now, 180), "yyyy-MM-dd");
  const today = format(now, "yyyy-MM-dd");

  const results: any = {
    symbol,
    displayName: symbol,
    prices: [],
    flow: { investors: [], margin: [] },
    fundamentals: { revenue: [], eps: null, revenueGrowth: null, peRatio: null },
    news: [],
    technicals: null,
    warnings: [],
    meta: { providerAuthUsed: true, fallbackUsed: false, newsMeta: { authUsed: true, fallbackUsed: false } }
  };

  try {
    if (isTaiwan) {
      const [priceRes, flowRes, marginRes, revRes, newsRes, tvTech] = await Promise.all([
        getPriceDaily(symbol, startDate, today),
        getInstitutionalInvestors(symbol, format(subDays(now, 60), "yyyy-MM-dd"), today),
        getMarginShort(symbol, format(subDays(now, 60), "yyyy-MM-dd"), today),
        getMonthlyRevenue(symbol, format(subDays(now, 365), "yyyy-MM-dd"), today),
        getTaiwanStockNews(symbol, format(subDays(now, 7), "yyyy-MM-dd"), today),
        getTvTechnicalIndicators(symbol)
      ]);

      results.prices = priceRes.data || [];
      results.flow.investors = flowRes.data || [];
      results.flow.margin = marginRes.data || [];
      results.fundamentals.revenue = revRes.data || [];
      results.news = newsRes.data || [];
      results.technicals = tvTech;
    } else {
      // 美股處理邏輯 (簡化版)
      const [priceRes, revRes, newsRes, tvTech] = await Promise.all([
        getPriceDailyUs(symbol, startDate, today).catch(() => ({ data: [] })),
        getMonthlyRevenueUs(symbol, startDate, today).catch(() => ({ data: [] })),
        getUsStockNews(symbol, format(subDays(now, 14), "yyyy-MM-dd"), today).catch(() => ({ data: [] })),
        getTvTechnicalIndicators(symbol)
      ]);
      results.prices = priceRes.data || [];
      results.fundamentals.revenue = revRes.data || [];
      results.news = newsRes.data || [];
      results.technicals = tvTech;
    }
  } catch (e) {
    console.error("[Infrastructure] StockRouter Error:", e);
    results.warnings.push("data_fetch_partial_failure");
  }

  return results;
}
