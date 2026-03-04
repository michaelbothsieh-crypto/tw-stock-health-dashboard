import { getCache, setCache } from "./redisCache";

export interface TvTechnicalData {
  close: number;
  RSI7: number;
  RSI14: number;
  MACD: number;
  MACD_signal: number;
  SMA20: number;
  SMA50: number;
  SMA200: number;
  BB_lower: number;
  BB_upper: number;
  VWAP: number;
  ATR: number;
}

export async function getTvTechnicalIndicators(ticker: string): Promise<TvTechnicalData | null> {
  const isUS = /^[A-Z]+$/.test(ticker);
  const endpoint = isUS ? "america" : "taiwan";
  const symbols = isUS
    ? [`NASDAQ:${ticker}`, `NYSE:${ticker}`, `AMEX:${ticker}`]
    : [`TWSE:${ticker}`, `TPEX:${ticker}`];

  const cacheKey = `tv:tech:${ticker}`;
  try {
    const cached = await getCache<TvTechnicalData>(cacheKey);
    if (cached) return cached;
  } catch (e) {
    // Ignore cache error
  }

  let retries = 3;
  let data: any = null;

  while (retries > 0) {
    try {
      const response = await fetch(`https://scanner.tradingview.com/${endpoint}/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbols: { tickers: symbols },
          columns: [
            "close",
            "RSI7",
            "RSI",
            "MACD.macd",
            "MACD.signal",
            "SMA20",
            "SMA50",
            "SMA200",
            "BB.lower",
            "BB.upper",
            "VWAP",
            "ATR",
          ],
        }),
      });

      if (!response.ok) {
        retries--;
        if (retries === 0) {
          console.warn(`TradingView API failed for ${ticker}: ${response.status} ${response.statusText}`);
          return null;
        }
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      data = await response.json();
      break;
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.warn(`[TradingView] Error fetching for ${ticker}:`, error);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!data || !data.data || data.data.length === 0 || !data.data[0].d) {
    return null;
  }

  const d = data.data[0].d;
  const result: TvTechnicalData = {
    close: d[0] ?? 0,
    RSI7: d[1] ?? 0,
    RSI14: d[2] ?? 0,
    MACD: d[3] ?? 0,
    MACD_signal: d[4] ?? 0,
    SMA20: d[5] ?? 0,
    SMA50: d[6] ?? 0,
    SMA200: d[7] ?? 0,
    BB_lower: d[8] ?? 0,
    BB_upper: d[9] ?? 0,
    VWAP: d[10] ?? 0,
    ATR: d[11] ?? 0,
  };

  try {
    await setCache(cacheKey, result, 43200); // 12 hours
  } catch (e) {
    // Ignore cache error
  }

  return result;
}
