import { yf as yahooFinance } from "./yahooFinanceClient";
import { subYears, startOfYear, endOfDay } from "date-fns";

export interface EtfHolding {
  symbol: string;
  name: string;
  percent: number;
  ytdReturn: number | null;
}

export async function fetchEtfTopHoldings(symbol: string): Promise<EtfHolding[]> {
  try {
    // 嘗試抓取 topHoldings，若失敗則回傳空陣列
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ["topHoldings", "fundProfile"]
    }).catch(() => null);

    const holdings = summary?.topHoldings?.holdings;
    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      // 備援：若無持股資料，檢查是否為 ETF
      const profile = summary?.fundProfile;
      if (!profile) return [];
      return []; 
    }
    // ... (rest of the logic)
    // 2. Calculate YTD for each holding
    const now = new Date();
    const jan1st = startOfYear(now);
    
    const results = await Promise.all(holdings.slice(0, 10).map(async (h) => {
      let holdingSymbol = h.symbol;
      if (!holdingSymbol) return null;

      // Calculate YTD
      let ytdReturn: number | null = null;
      try {
        const [chartRes, quoteRes] = await Promise.all([
          yahooFinance.chart(holdingSymbol, {
            period1: jan1st,
            period2: endOfDay(new Date(jan1st.getTime() + 7 * 24 * 60 * 60 * 1000)), // First week of the year
            interval: "1d"
          }).catch(() => null),
          yahooFinance.quote(holdingSymbol).catch(() => null)
        ]);

        const history = chartRes?.quotes || [];
        const startPrice = history.find(q => q.close !== null)?.close;
        const currentPrice = (Array.isArray(quoteRes) ? quoteRes[0] : quoteRes)?.regularMarketPrice;

        if (startPrice && currentPrice) {
          ytdReturn = ((currentPrice - startPrice) / startPrice) * 100;
        }
      } catch (err) {
        console.error(`Failed to calculate YTD for ${holdingSymbol}`, err);
      }

      return {
        symbol: holdingSymbol,
        name: h.holdingName || holdingSymbol,
        percent: (h.holdingPercent || 0) * 100,
        ytdReturn
      };
    }));

    return results.filter((r): r is EtfHolding => r !== null);
  } catch (err) {
    console.error(`Failed to fetch ETF holdings for ${symbol}`, err);
    return [];
  }
}
