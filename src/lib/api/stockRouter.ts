import { UnifiedStockSnapshot } from "@/lib/types/stock";
import { fetchRecentBars } from "@/lib/range";
import { format, subDays } from "date-fns";
import {
  getInstitutionalInvestors,
  getMarginShort,
  getMonthlyRevenue,
  getTaiwanStockNews,
  FinmindProviderError,
} from "@/lib/providers/finmind";
import { getTvTechnicalIndicators } from "@/lib/providers/tradingViewFetch";
import { getUSStockFundamentals, getTaiwanStockYahooNews } from "@/lib/providers/yahooFetch";
import { fetchYahooFinanceBars } from "@/lib/global/yahooFinance";
import { getCompanyNameZh } from "@/lib/companyName";
import { yf as yahooFinance } from "@/lib/providers/yahooFinanceClient";

export async function fetchStockSnapshot(norm: { symbol: string; market: string; yahoo: string }): Promise<UnifiedStockSnapshot> {
  const isTaiwanStock = /^\d+$/.test(norm.symbol) || norm.symbol.endsWith(".TW") || norm.symbol.endsWith(".TWO");
  const warnings: string[] = [];

  if (isTaiwanStock) {
    const [rangeResult, companyName] = await Promise.all([
      fetchRecentBars(norm.symbol, 180),
      getCompanyNameZh(norm.symbol)
    ]);
    const prices = rangeResult.data;

    if (prices.length === 0) {
      warnings.push("price_data_missing");
      throw new Error("No price data found for ticker");
    }

    if (rangeResult.barsReturned < 130) {
      warnings.push(`bars_insufficient_${rangeResult.barsReturned}`);
    }

    const latestDateObj = new Date(prices[prices.length - 1].date);
    const latestDate = format(latestDateObj, "yyyy-MM-dd");
    const flowStartDate = format(subDays(latestDateObj, 120), "yyyy-MM-dd");
    const fundamentalStartDate = format(subDays(latestDateObj, 540), "yyyy-MM-dd");
    const newsStartDate = format(subDays(latestDateObj, 7), "yyyy-MM-dd");

    const [investorsResult, marginResult, revenueResult, newsResult, technicalsResult, yahooNewsTW] = await Promise.all([
      getInstitutionalInvestors(norm.symbol, flowStartDate, latestDate).catch((error) => {
        if (error instanceof FinmindProviderError) warnings.push(`investors_error:${error.errorCode}`);
        return { data: [], meta: { authUsed: "anon" as const, fallbackUsed: false } };
      }),
      getMarginShort(norm.symbol, flowStartDate, latestDate).catch((error) => {
        if (error instanceof FinmindProviderError) warnings.push(`margin_error:${error.errorCode}`);
        return { data: [], meta: { authUsed: "anon" as const, fallbackUsed: false } };
      }),
      getMonthlyRevenue(norm.symbol, fundamentalStartDate, latestDate).catch((error) => {
        if (error instanceof FinmindProviderError) warnings.push(`revenue_error:${error.errorCode}`);
        return { data: [], meta: { authUsed: "anon" as const, fallbackUsed: false } };
      }),
      getTaiwanStockNews(norm.symbol, newsStartDate, latestDate).catch((error) => {
        if (error instanceof FinmindProviderError) {
          return {
            data: [],
            meta: { authUsed: error.meta.authUsed, fallbackUsed: error.meta.fallbackUsed, errorCode: error.errorCode, message: error.message },
          };
        }
        return {
          data: [],
          meta: { authUsed: "anon" as const, fallbackUsed: false, errorCode: "news_fetch_failed", message: String(error) },
        };
      }),
      getTvTechnicalIndicators(norm.symbol),
      getTaiwanStockYahooNews(norm.symbol)
    ]);

    const fallbackUsed = Boolean(rangeResult.providerMeta?.fallbackUsed) || investorsResult.meta.fallbackUsed || marginResult.meta.fallbackUsed || revenueResult.meta.fallbackUsed;

    // Merge FinMind and Yahoo news
    const mergedNews = [...newsResult.data, ...yahooNewsTW];
    // Deduplicate by title roughly
    const uniqueNews = Array.from(new Map(mergedNews.map(item => [item.title.substring(0,10), item])).values());
    uniqueNews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      displayName: companyName,
      prices: prices.map(p => ({ date: p.date, open: p.open, high: p.max, low: p.min, close: p.close, volume: p.Trading_Volume })),
      fundamentals: {
        revenue: revenueResult.data,
        eps: null,
        peRatio: null,
        revenueGrowth: null,
      },
      flow: {
        investors: investorsResult.data,
        margin: marginResult.data,
        institutionalOwnership: null,
      },
      technicals: technicalsResult,
      news: uniqueNews,
      meta: {
        providerAuthUsed: investorsResult.meta.authUsed,
        fallbackUsed,
        newsMeta: newsResult.meta,
      },
      warnings,
    };
  } else {
    const [pricesResult, usFundamentals, tvTechnicals, yahooNews] = await Promise.all([
      fetchYahooFinanceBars(norm.yahoo, 180),
      getUSStockFundamentals(norm.yahoo),
      getTvTechnicalIndicators(norm.yahoo),
      (yahooFinance.search(norm.yahoo, { newsCount: 5 }) as Promise<any>).then((res: any) => res.news || []).catch(() => [])
    ]);

    if (pricesResult.length === 0) {
      warnings.push("price_data_missing");
      throw new Error("No price data found for ticker");
    }

    // Format news
    const formattedNews = yahooNews.map((n: any) => ({
      date: new Date(n.providerPublishTime).toISOString().split('T')[0],
      title: n.title,
      link: n.link,
      source: n.publisher
    }));

    return {
      displayName: usFundamentals.name,
      prices: pricesResult.map(p => ({ 
        date: p.date, 
        open: p.close, 
        high: p.close, 
        low: p.close, 
        close: p.close, 
        volume: 0 
      })),
      fundamentals: {
        revenue: [], // US doesn't use FinMind monthly revenue array
        eps: usFundamentals.eps,
        peRatio: usFundamentals.peRatio,
        revenueGrowth: usFundamentals.revenueGrowth,
      },
      flow: {
        investors: [],
        margin: [],
        institutionalOwnership: usFundamentals.institutionalOwnership,
      },
      technicals: tvTechnicals,
      news: formattedNews,
      meta: {
        providerAuthUsed: "anon",
        fallbackUsed: false,
        newsMeta: { authUsed: "anon", fallbackUsed: false },
      },
      warnings,
    };
  }
}
