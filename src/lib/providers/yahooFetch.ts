import { getCache, setCache } from "./redisCache";
import { yf as yahooFinance } from "./yahooFinanceClient";

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

export async function getTaiwanStockYahooNews(ticker: string) {
  try {
    const url = `https://tw.stock.yahoo.com/rss?s=${ticker}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const xml = await res.text();
    // Simple Regex parser for RSS
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const news = items.map(m => {
      const block = m[1];
      const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/);
      const linkMatch = block.match(/<link>(.*?)<\/link>/);
      const dateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);
      return {
        title: titleMatch ? titleMatch[1] : "",
        link: linkMatch ? linkMatch[1] : "",
        date: dateMatch ? new Date(dateMatch[1]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        source: "Yahoo Finance TW"
      };
    }).filter(n => n.title).slice(0, 10);
    return news;
  } catch (e) {
    console.warn(`[Yahoo] RSS fetch failed for ${ticker}`, e);
    return [];
  }
}
