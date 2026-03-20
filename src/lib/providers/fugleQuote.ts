/**
 * Fugle MarketData API — 台股即時報價
 * 免費方案：60 calls/min，永久有效
 * 文件：https://developer.fugle.tw/docs/marketdata/http-api/intraday/quote
 */
import { getCache, setCache } from "@/lib/providers/redisCache";

export type FugleQuote = {
  price: number;
  changePct: number;
  changeAbs: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  isRealTime: true;
};

export async function fetchFugleQuote(symbol: string): Promise<FugleQuote | null> {
  const apiKey = process.env.FUGLE_API_KEY;
  if (!apiKey) {
    console.error("[Fugle] FUGLE_API_KEY is missing in environment variables.");
    return null;
  }

  // Fugle 只支援台股，strip .TW / .TWO suffix
  const code = symbol.replace(/\.(TW|TWO)$/i, "");
  if (!/^\d{4,}$/.test(code)) {
    console.warn(`[Fugle] Invalid symbol format for Fugle: ${symbol}`);
    return null;
  }

  // 30s 快取，防止短時間內重複查詢同一檔股票超過 rate limit
  const cacheKey = `fugle:quote:${code}`;
  const cached = await getCache<FugleQuote>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/${code}`,
      {
        headers: { "X-API-KEY": apiKey },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      console.error(`[Fugle] API error: ${res.status} ${res.statusText} for code ${code}`);
      return null;
    }

    const d = await res.json();
    
    // 檢查關鍵欄位是否存在 (盤前可能沒有 lastPrice / closePrice)
    const price: number = d.lastPrice ?? d.closePrice ?? d.lastTrial?.price ?? d.previousClose ?? d.referencePrice;
    const prevClose: number = d.previousClose ?? d.referencePrice;
    
    if (price === undefined || prevClose === undefined) {
      console.warn(`[Fugle] Missing price data for ${code}. price: ${price}, prevClose: ${prevClose}`);
      return null;
    }

    const quote = {
      price,
      changePct: prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      changeAbs: price - prevClose,
      volume: d.total?.tradeVolume ?? 0,
      high: d.highPrice ?? price,
      low: d.lowPrice ?? price,
      open: d.openPrice ?? price,
      isRealTime: true as const,
    };
    await setCache(cacheKey, quote, 30);
    return quote;
  } catch (error) {
    console.error(`[Fugle] Unexpected error for ${code}:`, error);
    return null;
  }
}
