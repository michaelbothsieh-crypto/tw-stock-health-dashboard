
/**
 * TradingView 技術評分抓取工具
 */

import { getCache, setCache } from "@/infrastructure/providers/redisCache";

export type TVRating = 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell' | 'Unknown';

export const TV_RATING_ZH: Record<TVRating, string> = {
  'Strong Buy': '強力買入',
  'Buy': '買入',
  'Neutral': '中性',
  'Sell': '賣出',
  'Strong Sell': '強力賣出',
  'Unknown': '—'
};

const TV_RATING_CACHE_TTL = 86400; // 24 小時

export async function fetchTradingViewRating(ticker: string, market: 'taiwan' | 'america' | 'japan'): Promise<TVRating> {
  const cleanTicker = ticker.toUpperCase().replace(/\.T$/, "");
  const cacheKey = `tv:rating:${market}:${cleanTicker}`;

  const cached = await getCache<TVRating>(cacheKey);
  if (cached) return cached;

  const url = `https://scanner.tradingview.com/${market}/scan`;

  const getSymbols = (): string[] => {
    if (market === 'taiwan') {
      if (cleanTicker.includes(':')) return [cleanTicker];
      // 同時查詢 TWSE 與 TPEX，避免判斷錯誤 (例如 6257 是上市非上櫃)
      return [`TWSE:${cleanTicker}`, `TPEX:${cleanTicker}`];
    }
    if (market === 'japan') {
      return [`TSE:${cleanTicker}`];
    }
    // 美股可能在不同交易所，一次查多個
    return [`NASDAQ:${cleanTicker}`, `NYSE:${cleanTicker}`, `AMEX:${cleanTicker}`];
  };

  const body = {
    symbols: { tickers: getSymbols() },
    columns: ["Recommend.All"]
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return 'Unknown';

    const data = await res.json();
    const rows = data?.data || [];
    
    // 找出第一個有效的評分
    let rating: TVRating = 'Unknown';
    for (const row of rows) {
      if (row.d && row.d[0] !== undefined && row.d[0] !== null) {
        rating = parseRating(row.d[0]);
        break;
      }
    }

    await setCache(cacheKey, rating, TV_RATING_CACHE_TTL);
    return rating;
  } catch (err) {
    console.error(`[TVRating] Error for ${ticker}:`, err);
    return 'Unknown';
  }
}

function parseRating(score: number | undefined | null): TVRating {
  if (score === undefined || score === null) return 'Unknown';
  if (score > 0.5) return 'Strong Buy';
  if (score > 0.1) return 'Buy';
  if (score < -0.5) return 'Strong Sell';
  if (score < -0.1) return 'Sell';
  return 'Neutral';
}
