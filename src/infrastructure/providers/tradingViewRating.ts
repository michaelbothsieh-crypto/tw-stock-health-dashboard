
/**
 * TradingView 技術評分抓取工具
 */

export type TVRating = 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell' | 'Unknown';

export const TV_RATING_ZH: Record<TVRating, string> = {
  'Strong Buy': '強力買入',
  'Buy': '買入',
  'Neutral': '中性',
  'Sell': '賣出',
  'Strong Sell': '強力賣出',
  'Unknown': '—'
};

export async function fetchTradingViewRating(ticker: string, market: 'taiwan' | 'america'): Promise<TVRating> {
  const url = `https://scanner.tradingview.com/${market}/scan`;
  
  let symbol = ticker.toUpperCase();
  if (market === 'taiwan') {
    if (!symbol.includes(':')) {
      // 台股上櫃代號規律: 3, 4, 5, 6, 8 開頭通常為上櫃 (TPEX)
      const isProbablyTPEX = /^[34568]/.test(symbol) && symbol !== "3008"; 
      symbol = `${isProbablyTPEX ? 'TPEX' : 'TWSE'}:${symbol}`;
    }
  } else {
    if (!symbol.includes(':')) symbol = `NASDAQ:${symbol}`;
  }

  const body = {
    symbols: { tickers: [symbol] },
    columns: ["Recommend.All"]
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
        // 如果 NASDAQ 失敗，嘗試 NYSE (針對美股)
        if (market === 'america' && !ticker.includes(':')) {
            const nyseBody = { symbols: { tickers: [`NYSE:${ticker.toUpperCase()}`] }, columns: ["Recommend.All"] };
            const nyseRes = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nyseBody) });
            const nyseData = await nyseRes.json();
            return parseRating(nyseData?.data?.[0]?.d?.[0]);
        }
        return 'Unknown';
    }

    const data = await res.json();
    const score = data?.data?.[0]?.d?.[0];
    return parseRating(score);
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
