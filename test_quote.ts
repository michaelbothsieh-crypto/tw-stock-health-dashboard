import { fetchFugleQuote } from "./src/lib/providers/fugleQuote";
import { yf as yahooFinance } from "./src/lib/providers/yahooFinanceClient";

async function test() {
  const code = "2344";
  
  // Test Yahoo
  try {
    const yfQuote = await yahooFinance.quote(`${code}.TW`);
    console.log("Yahoo Finance 2344.TW:", yfQuote.regularMarketPrice);
  } catch (e) {
    console.error("Yahoo Error", e);
  }
}

test();
