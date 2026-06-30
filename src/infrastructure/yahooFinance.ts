import { subDays } from "date-fns";

export interface YahooBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjclose: number;
  volume: number;
}

// ponytail: 改用 yahoo-finance2 library，避免直接打 query1 被 rate-limit
export async function fetchYahooFinanceBars(symbol: string, days: number = 100): Promise<YahooBar[]> {
  try {
    const { yf } = await import("@/infrastructure/providers/yahooFinanceClient");
    const chart = await yf.chart(symbol, {
      period1: subDays(new Date(), days),
      interval: "1d",
    });

    return (chart?.quotes || [])
      .map((q: any) => {
        const close = Number(q.close ?? q.adjclose ?? 0);
        if (!close) return null;
        return {
          date: (q.date instanceof Date ? q.date : new Date(q.date)).toISOString().split("T")[0],
          open: Number(q.open ?? close),
          high: Number(q.high ?? close),
          low: Number(q.low ?? close),
          close,
          adjclose: Number(q.adjclose ?? close),
          volume: Number(q.volume ?? 0),
        };
      })
      .filter(Boolean) as YahooBar[];
  } catch (e) {
    console.error(`Failed to fetch Yahoo Finance for ${symbol}`, e);
    return [];
  }
}
