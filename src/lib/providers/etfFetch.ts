import { yf as yahooFinance } from "./yahooFinanceClient";
import { startOfYear, endOfDay } from "date-fns";
import { twStockNames } from "../../data/twStockNames";

export interface EtfHolding {
  symbol: string;
  name: string;
  percent: number;
  ytdReturn: number | null;
}

export interface EtfFetchResult {
  name: string;
  holdings: EtfHolding[];
  isEtf: boolean;
}

async function tryQuoteSummary(symbol: string) {
  return await yahooFinance.quoteSummary(symbol, {
    modules: ["topHoldings", "price", "summaryDetail"]
  }).catch(() => null);
}

async function tryQuote(symbol: string) {
  const res = await yahooFinance.quote(symbol).catch(() => null);
  return Array.isArray(res) ? res[0] : res;
}

export async function fetchEtfTopHoldings(symbol: string): Promise<EtfFetchResult> {
  const pureCode = symbol.split(".")[0];
  const localName = twStockNames[pureCode];
  
  let currentSymbol = symbol;
  let summary = await tryQuoteSummary(currentSymbol);
  let quote = await tryQuote(currentSymbol);

  // 如果失敗且是台股，嘗試反向後綴 (TW <-> TWO)
  if (!quote && /^[0-9]/.test(pureCode)) {
    const altSymbol = currentSymbol.endsWith(".TW") 
      ? currentSymbol.replace(".TW", ".TWO") 
      : currentSymbol.replace(".TWO", ".TW");
    
    const altSummary = await tryQuoteSummary(altSymbol);
    const altQuote = await tryQuote(altSymbol);
    
    if (altQuote) {
      summary = altSummary;
      quote = altQuote;
      currentSymbol = altSymbol;
    }
  }

  try {
    const etfName = summary?.price?.longName || quote?.longName || quote?.shortName || localName || pureCode;
    const isEtf = quote?.quoteType === "ETF" || !!summary?.topHoldings || !!localName;

    const holdings = summary?.topHoldings?.holdings;
    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return { name: etfName, holdings: [], isEtf };
    }

    const now = new Date();
    const jan1st = startOfYear(now);
    
    const results = await Promise.all(holdings.slice(0, 10).map(async (h) => {
      let holdingSymbol = h.symbol;
      if (!holdingSymbol) return null;

      let ytdReturn: number | null = null;
      try {
        const [hChart, hQuoteRes] = await Promise.all([
          yahooFinance.chart(holdingSymbol, {
            period1: jan1st,
            period2: endOfDay(new Date(jan1st.getTime() + 10 * 24 * 60 * 60 * 1000)),
            interval: "1d"
          }).catch(() => null),
          yahooFinance.quote(holdingSymbol).catch(() => null)
        ]);

        const history = hChart?.quotes || [];
        const startPrice = history.find(q => q.close !== null)?.close;
        const currentPrice = (Array.isArray(hQuoteRes) ? hQuoteRes[0] : hQuoteRes)?.regularMarketPrice;

        if (startPrice && currentPrice) {
          ytdReturn = ((currentPrice - startPrice) / startPrice) * 100;
        }
      } catch (err) { }

      return {
        symbol: holdingSymbol,
        name: h.holdingName || holdingSymbol,
        percent: (h.holdingPercent || 0) * 100,
        ytdReturn
      };
    }));

    return {
      name: etfName,
      holdings: results.filter((r): r is EtfHolding => r !== null),
      isEtf: true
    };
  } catch (err) {
    return { name: localName || pureCode, holdings: [], isEtf: !!localName };
  }
}
