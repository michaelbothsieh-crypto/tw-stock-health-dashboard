/**
 * Fugle MarketData API — 台股即時報價
 * 免費方案：60 calls/min，永久有效
 * 文件：https://developer.fugle.tw/docs/marketdata/http-api/intraday/quote
 */

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
  if (!apiKey) return null;

  // Fugle 只支援台股，strip .TW / .TWO suffix
  const code = symbol.replace(/\.(TW|TWO)$/i, "");
  if (!/^\d{4,}$/.test(code)) return null;

  try {
    const res = await fetch(
      `https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/${code}`,
      {
        headers: { "X-API-KEY": apiKey },
        // Next.js: 不快取，每次都拿最新
        cache: "no-store",
      }
    );
    if (!res.ok) {
      console.warn(`[FugleQuote] ${code} → HTTP ${res.status}, falling back to Yahoo`);
      return null;
    }

    const d = await res.json();

    const price: number = d.lastPrice ?? d.closePrice;
    const prevClose: number = d.previousClose ?? d.referencePrice;
    if (!price || !prevClose) return null;

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
    console.info(`[FugleQuote] ${code} ✓ 即時價 ${price} (${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%)`);
    return quote;
  } catch (e) {
    console.warn(`[FugleQuote] ${code} 例外錯誤, falling back to Yahoo`, e);
    return null;
  }
}
