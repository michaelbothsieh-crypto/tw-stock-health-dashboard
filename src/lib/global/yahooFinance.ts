export interface YahooBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchYahooFinanceBars(symbol: string, days: number = 100): Promise<YahooBar[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days}d`;
    const fetchOptions: any = {};
    if (typeof process !== 'undefined' && (process.env as any).NEXT_RUNTIME) {
      fetchOptions.next = { revalidate: 3600 };
    }
    const res = await fetch(url, fetchOptions);
    if (!res.ok) return [];
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];

    if (!timestamps || !quote?.close) return [];

    return timestamps.map((ts: number, i: number) => {
      const close = quote.close[i];
      if (close === null || close === undefined) return null;
      return {
        date: new Date(ts * 1000).toISOString().split('T')[0],
        open: quote.open?.[i] ?? close,
        high: quote.high?.[i] ?? close,
        low: quote.low?.[i] ?? close,
        close,
        volume: quote.volume?.[i] ?? 0,
      };
    }).filter(Boolean) as YahooBar[];
  } catch (e) {
    console.error(`Failed to fetch Yahoo Finance for ${symbol}`, e);
    return [];
  }
}
