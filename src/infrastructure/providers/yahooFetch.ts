import { getCache, setCache } from "./redisCache";
import { yf as yahooFinance } from "./yahooFinanceClient";
import { XMLParser } from "fast-xml-parser";

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
  } catch (e) { }

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
    } catch (e) { }

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

export async function getTaiwanStockYahooNews(ticker: string) {
  try {
    const url = `https://tw.stock.yahoo.com/rss?s=${ticker}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const xml = await res.text();

    // Parse RSS XML safely
    const parser = new XMLParser({
      ignoreAttributes: false,
      cdataPropName: "__cdata" // if we needed it, but by default it strips cdata tags and gives the content
    });
    const parsed = parser.parse(xml);

    let items = parsed?.rss?.channel?.item || [];
    if (!Array.isArray(items)) {
      items = [items]; // if there's only one item, it might be an object instead of array
    }

    const news = items.map((item: any) => {
      // Handle edge cases where field might be wrapped or undefined
      const title = typeof item.title === 'string' ? item.title : '';
      const link = typeof item.link === 'string' ? item.link : '';
      const rawDate = typeof item.pubDate === 'string' ? item.pubDate : '';

      let dateIso = new Date().toISOString().split('T')[0];
      if (rawDate) {
        try {
          dateIso = new Date(rawDate).toISOString().split('T')[0];
        } catch (e) {
          // Keep fallback date
        }
      }

      return {
        title,
        link,
        date: dateIso,
        source: "Yahoo Finance TW"
      };
    }).filter((n: any) => n.title).slice(0, 10);

    return news;
  } catch (e) {
    console.warn(`[Yahoo] RSS fetch failed for ${ticker}`, e);
    return [];
  }
}
