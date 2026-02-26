export interface YahooBar {
  date: string;
  close: number;
}

export async function fetchYahooFinanceBars(symbol: string, days: number = 100): Promise<YahooBar[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days}d`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return [];
    
    const timestamps = result.timestamp;
    const closes = result.indicators?.quote?.[0]?.close;
    
    if (!timestamps || !closes) return [];
    
    return timestamps.map((ts: number, i: number) => {
      const date = new Date(ts * 1000).toISOString().split('T')[0];
      return { date, close: closes[i] };
    }).filter((x: any) => x.close !== null && x.close !== undefined);
  } catch (e) {
    console.error(`Failed to fetch Yahoo Finance for ${symbol}`, e);
    return [];
  }
}
