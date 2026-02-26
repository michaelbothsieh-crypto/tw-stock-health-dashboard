export interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface KeyLevelsResult {
  breakoutLevel: number | null;
  supportLevel: number | null;
  invalidationLevel: number | null;
  atr14: number | null;
  notes: string[];
}

function calculateSMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const sum = data.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateATR(data: PriceData[], period: number): number | null {
  if (data.length <= period) return null;
  const trs = [];
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }
  const lastTrs = trs.slice(-period);
  return lastTrs.reduce((a, b) => a + b, 0) / period;
}

export function calculateKeyLevels(prices: PriceData[]): KeyLevelsResult {
  if (prices.length === 0) {
    return {
      breakoutLevel: null,
      supportLevel: null,
      invalidationLevel: null,
      atr14: null,
      notes: [],
    };
  }

  const closes = prices.map(p => p.close);
  const highs = prices.map(p => p.high);
  const lows = prices.map(p => p.low);
  const latestClose = closes[closes.length - 1];

  const recent20Highs = highs.slice(-20);
  const recent20Lows = lows.slice(-20);
  const recent60Lows = lows.slice(-60);

  const highest20 = recent20Highs.length > 0 ? Math.max(...recent20Highs) : null;
  const lowest20 = recent20Lows.length > 0 ? Math.min(...recent20Lows) : null;
  const lowest60 = recent60Lows.length > 0 ? Math.min(...recent60Lows) : null;

  const sma20 = calculateSMA(closes, 20);
  const sma60 = calculateSMA(closes, 60);
  const atr14 = calculateATR(prices, 14);

  let breakoutLevel = highest20;
  
  let supportLevel = sma20;
  if (sma20 !== null && lowest20 !== null) {
    const c1 = sma20;
    const c2 = lowest20;
    if (c1 < latestClose && c2 < latestClose) {
      supportLevel = Math.max(c1, c2); // Closest below current price
    } else if (c1 < latestClose) {
      supportLevel = c1;
    } else if (c2 < latestClose) {
      supportLevel = c2;
    }
  }

  let invalidationLevel = sma60;
  if (sma60 !== null && lowest60 !== null) {
    if (latestClose < sma60) {
      invalidationLevel = lowest60;
    }
  }

  const notes = [
    "轉強條件：站上突破位並延續",
    "回踩不破支撐位視為強勢",
    "跌破失效位代表結構轉弱"
  ];

  return {
    breakoutLevel: breakoutLevel !== null ? Number(breakoutLevel.toFixed(2)) : null,
    supportLevel: supportLevel !== null ? Number(supportLevel.toFixed(2)) : null,
    invalidationLevel: invalidationLevel !== null ? Number(invalidationLevel.toFixed(2)) : null,
    atr14: atr14 !== null ? Number(atr14.toFixed(2)) : null,
    notes
  };
}
