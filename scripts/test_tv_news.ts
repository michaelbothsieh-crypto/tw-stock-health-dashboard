
import { getTvLatestNewsHeadline } from '../src/lib/providers/tradingViewFetch';

async function test() {
    const tickers = ["2330", "NVDA"];
    for (const ticker of tickers) {
        console.log(`Testing TradingView news for ${ticker}...`);
        try {
            const headline = await getTvLatestNewsHeadline(ticker);
            if (headline) {
                console.log(`✅ Found News for ${ticker}: ${headline}`);
            } else {
                console.log(`❌ No news found from TradingView for ${ticker}.`);
            }
        } catch (e) {
            console.error(`Error during test for ${ticker}:`, e);
        }
    }
}

test();
