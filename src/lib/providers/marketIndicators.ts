import { fetchYahooFinanceBars } from "../global/yahooFinance";

export interface MarketIndicatorResult {
  seriesBySymbol: Record<string, { closes: number[]; dates: string[] }>;
  okBySymbol: Record<string, { ok: boolean; points: number; err?: string }>;
  usedSymbols: string[];
}

export async function getMarketIndicators(params: {
  symbols: string[];
  rangeDays: number;
}): Promise<MarketIndicatorResult> {
  const { symbols, rangeDays } = params;

  const seriesBySymbol: Record<string, { closes: number[]; dates: string[] }> = {};
  const okBySymbol: Record<string, { ok: boolean; points: number; err?: string }> = {};
  const usedSymbols: string[] = [];

  const promises = symbols.map(async (sym) => {
    try {
      const bars = await fetchYahooFinanceBars(sym, rangeDays);
      if (!bars || bars.length === 0) {
        okBySymbol[sym] = { ok: false, points: 0, err: "No data returned" };
        return;
      }
      
      seriesBySymbol[sym] = {
        closes: bars.map((b) => b.close),
        dates: bars.map((b) => b.date),
      };
      
      okBySymbol[sym] = { ok: bars.length >= 21, points: bars.length };
      if (bars.length >= 21) {
          usedSymbols.push(sym);
      } else {
          okBySymbol[sym].err = `Insufficient data points (${bars.length})`;
      }
    } catch (e: any) {
      okBySymbol[sym] = { ok: false, points: 0, err: e.message || "Fetch failed" };
    }
  });

  await Promise.allSettled(promises);

  return {
    seriesBySymbol,
    okBySymbol,
    usedSymbols,
  };
}
