
import { normalizeTicker, NormalizedTicker } from "@/shared/utils/ticker";
import { 
  getPriceDaily, 
  getPriceDailyAdj,
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
import type { PriceDaily } from "@/infrastructure/providers/finmind";
import { getTvTechnicalIndicators } from "@/infrastructure/providers/tradingViewFetch";
import { getGoodinfoAdjustedPriceDaily } from "@/infrastructure/providers/goodinfoAdjustedPrice";
import { yf as yahooFinance } from "@/infrastructure/providers/yahooFinanceClient";
import { format, subDays } from "date-fns";

function getProviderTimeoutMs(): number {
  const value = Number(process.env.STOCK_ROUTER_PROVIDER_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : 5000;
}

function withProviderTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  label: string,
  warnings: string[],
  timeoutMs = getProviderTimeoutMs(),
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const guarded = promise.catch(() => {
    warnings.push(`${label}_failed`);
    return fallback;
  });

  const timer = new Promise<T>((resolve) => {
    timeout = setTimeout(() => {
      warnings.push(`${label}_timeout`);
      resolve(fallback);
    }, timeoutMs);
  });

  return Promise.race([guarded, timer]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

async function fetchYahooChartPrices(yahooSymbol: string, startDate: string): Promise<PriceDaily[]> {
  const chart = await yahooFinance.chart(yahooSymbol, {
    period1: new Date(startDate),
    interval: "1d",
  });

  return (chart?.quotes || [])
    .map((bar: any) => ({
      date: bar.date instanceof Date ? bar.date.toISOString().slice(0, 10) : String(bar.date || "").slice(0, 10),
      open: Number(bar.open ?? bar.close ?? 0),
      high: Number(bar.high ?? bar.close ?? 0),
      low: Number(bar.low ?? bar.close ?? 0),
      close: Number(bar.close ?? 0),
      volume: Number(bar.volume ?? 0),
    }))
    .filter((bar: PriceDaily) => Boolean(bar.date) && Number.isFinite(bar.close) && bar.close > 0);
}

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
    displayName: norm.companyNameZh || norm.displayName || symbol,
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
      const [priceAdjRes, priceRes, flowRes, marginRes, revRes, newsRes, tvTech] = await Promise.all([
        withProviderTimeout(getPriceDailyAdj(symbol, startDate, today), { data: [] }, "price_adj", results.warnings),
        withProviderTimeout(getPriceDaily(symbol, startDate, today), { data: [] }, "price", results.warnings),
        withProviderTimeout(getInstitutionalInvestors(symbol, format(subDays(now, 60), "yyyy-MM-dd"), today), { data: [] }, "institutional", results.warnings),
        withProviderTimeout(getMarginShort(symbol, format(subDays(now, 60), "yyyy-MM-dd"), today), { data: [] }, "margin", results.warnings),
        withProviderTimeout(getMonthlyRevenue(symbol, format(subDays(now, 365), "yyyy-MM-dd"), today), { data: [] }, "revenue", results.warnings),
        withProviderTimeout(getTaiwanStockNews(symbol, format(subDays(now, 7), "yyyy-MM-dd")), { data: [] }, "news", results.warnings),
        withProviderTimeout(getTvTechnicalIndicators(symbol), null, "tv_technical", results.warnings)
      ]);

      const adjustedPrices = priceAdjRes.data || [];
      const regularPrices = priceRes.data || [];
      const yahooPrices = adjustedPrices.length || regularPrices.length
        ? []
        : await withProviderTimeout(fetchYahooChartPrices(norm.yahoo || `${symbol}.TW`, startDate), [], "yahoo_price", results.warnings);
      const goodinfoAdj = adjustedPrices.length || regularPrices.length || yahooPrices.length
        ? []
        : await withProviderTimeout(getGoodinfoAdjustedPriceDaily(symbol), [], "goodinfo_price", results.warnings);

      results.prices = adjustedPrices.length
        ? adjustedPrices
        : regularPrices.length
          ? regularPrices
          : yahooPrices.length
            ? yahooPrices
            : goodinfoAdj;
      results.flow.investors = flowRes.data || [];
      results.flow.margin = marginRes.data || [];
      results.fundamentals.revenue = revRes.data || [];
      results.news = newsRes.data || [];
      results.technicals = tvTech;
    } else {
      // 美股處理邏輯 (簡化版)
      const [priceRes, revRes, newsRes, tvTech] = await Promise.all([
        withProviderTimeout(getPriceDailyUs(symbol, startDate, today), { data: [] }, "price", results.warnings),
        withProviderTimeout(getMonthlyRevenueUs(symbol, startDate, today), { data: [] }, "revenue", results.warnings),
        withProviderTimeout(getUsStockNews(symbol, format(subDays(now, 14), "yyyy-MM-dd")), { data: [] }, "news", results.warnings),
        withProviderTimeout(getTvTechnicalIndicators(symbol), null, "tv_technical", results.warnings)
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
