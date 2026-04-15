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

export async function fetchEtfTopHoldings(symbol: string): Promise<EtfFetchResult> {
  const pureCode = symbol.split(".")[0];
  const localName = twStockNames[pureCode];

  try {
    // 1. 同時抓取持股明細與基本報價資訊，確保即使沒持股也能拿到名稱
    const [summary, quoteRes] = await Promise.all([
      yahooFinance.quoteSummary(symbol, {
        modules: ["topHoldings", "price", "summaryDetail"]
      }).catch(() => null),
      yahooFinance.quote(symbol).catch(() => null)
    ]);

    const quote: any = Array.isArray(quoteRes) ? quoteRes[0] : quoteRes;
    const etfName = summary?.price?.longName || quote?.longName || quote?.shortName || localName || symbol;
    
    // 判定是否為 ETF (Yahoo 的 quoteType 通常會標示 ETF)
    // 或者如果在本地 twStockNames 有名字，我們也先將其判定為 ETF (或至少是我們追蹤的標的)
    const isEtf = quote?.quoteType === "ETF" || !!summary?.topHoldings || !!localName;

    const holdings = summary?.topHoldings?.holdings;
    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return { name: etfName, holdings: [], isEtf };
    }

    // 2. 計算 YTD
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
            period2: endOfDay(new Date(jan1st.getTime() + 10 * 24 * 60 * 60 * 1000)), // 增加緩衝天數
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
    console.error(`Failed to fetch ETF holdings for ${symbol}`, err);
    return { name: localName || symbol, holdings: [], isEtf: !!localName };
  }
}
