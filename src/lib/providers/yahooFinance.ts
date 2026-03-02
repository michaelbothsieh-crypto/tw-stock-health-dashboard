export async function fetchYahooQuote(symbol: string) {
    // Convert standard tw ticker to yahoo format: 2330.TW or 8299.TWO.
    // We'll guess .TW and .TWO if the first fails. But the simplest foolproof strategy 
    // without a giant dictionary is to try .TW first, then .TWO.
    // For a production app, checking a mapping or trying concurrently is better.

    const attemptFetch = async (suffix: string) => {
        const yahooSym = `${symbol}${suffix}`;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1d&range=1d`;
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                }
            });
            if (!res.ok) return null;
            const data = await res.json();
            const result = data?.chart?.result?.[0];
            if (!result) return null;

            const meta = result.meta;
            return {
                price: meta.regularMarketPrice,
                previousClose: meta.chartPreviousClose,
                changePct: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
                volume: meta.regularMarketVolume
            };
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
