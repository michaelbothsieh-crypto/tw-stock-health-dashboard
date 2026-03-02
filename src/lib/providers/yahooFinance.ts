export async function fetchYahooQuote(symbol: string) {
    // Convert standard tw ticker to yahoo format: 2330.TW or 8299.TWO.
    // We'll guess .TW and .TWO if the first fails. But the simplest foolproof strategy 
    // without a giant dictionary is to try .TW first, then .TWO.
    // For a production app, checking a mapping or trying concurrently is better.

    const attemptFetch = async (suffix: string) => {
        const yahooSym = `${symbol}${suffix}`;
        // Use the v7 quote API for more reliable instant snapshots
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSym}`;
        try {
            const res = await fetch(url, {
                cache: 'no-store',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                }
            });
            if (!res.ok) return null;
            const data = await res.json();
            const result = data?.quoteResponse?.result?.[0];
            if (!result) return null;

            const price = result.regularMarketPrice;
            const previousClose = result.regularMarketPreviousClose;

            // If we have both, calculate change. Otherwise fallback.
            if (typeof price === "number" && typeof previousClose === "number" && previousClose !== 0) {
                return {
                    price,
                    previousClose,
                    change: price - previousClose,
                    changePct: ((price - previousClose) / previousClose) * 100,
                    volume: result.regularMarketVolume
                };
            }
            return null;
        } catch {
            return null;
        }
    };

    let quote = await attemptFetch(".TW");
    if (!quote) {
        quote = await attemptFetch(".TWO");
    }

    return quote;
}
