import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function test() {
  const symbol = "00988A.TWO";
  console.log(`Testing symbol: ${symbol}`);
  
  try {
    const [summary, quote] = await Promise.all([
      yf.quoteSummary(symbol, { modules: ["topHoldings", "price", "summaryDetail"] }).catch(e => e),
      yf.quote(symbol).catch(e => e)
    ]);

    console.log("--- Quote Summary topHoldings ---");
    console.log(JSON.stringify(summary?.topHoldings || "MISSING", null, 2));
    
    console.log("--- Quote Result ---");
    console.log(JSON.stringify(quote, null, 2));

    const isEtf = quote?.quoteType === "ETF" || !!summary?.topHoldings;
    console.log(`\nDecision: isEtf = ${isEtf}`);
  } catch (err) {
    console.error(err);
  }
}

test();
