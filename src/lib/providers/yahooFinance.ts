export async function fetchYahooQuote(symbol: string) {
    // Convert standard tw ticker to yahoo format: 2330.TW or 8299.TWO.
    // We'll guess .TW and .TWO if the first fails. But the simplest foolproof strategy 
    // without a giant dictionary is to try .TW first, then .TWO.
    // For a production app, checking a mapping or trying concurrently is better.

    const attemptFetch = async (suffix: string) => {
        const yahooSym = `${symbol}${suffix}`;
        // Try multiple Yahoo API versions for maximum reliability
        const urls = [
            `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSym}`,
            `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${yahooSym}`,
            `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${yahooSym}`
        ];

        for (const url of urls) {
            try {
                const res = await fetch(url, {
                    cache: 'no-store',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
                    },
                    next: { revalidate: 0 }
                });
                if (!res.ok) continue;
                const data = await res.json();
                const result = data?.quoteResponse?.result?.[0];
                if (!result) continue;

                // Priority: regularMarketPrice > (bid+ask)/2 > postMarketPrice > previousClose
                let price = result.regularMarketPrice;
                if (!price && result.bid && result.ask) price = (result.bid + result.ask) / 2;
                if (!price) price = result.postMarketPrice || result.preMarketPrice;

                const previousClose = result.regularMarketPreviousClose;

                if (typeof price === "number" && typeof previousClose === "number" && previousClose !== 0) {
                    return {
                        price,
                        previousClose,
                        change: price - previousClose,
                        changePct: ((price - previousClose) / previousClose) * 100,
                        volume: result.regularMarketVolume,
                        source: url.includes('v6') ? 'v6' : 'v7'
                    };
                }
            } catch (e) {
                console.warn(`[Yahoo] Fetch failed for ${yahooSym} via ${url}`, e);
            }
        }
        return null;
    };

    let quote = await attemptFetch(".TW");
    if (!quote) {
        quote = await attemptFetch(".TWO");
    }

    return quote;
}
