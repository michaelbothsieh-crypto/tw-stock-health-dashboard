import { SelectedSector } from "../global/driverSelector";
import { YahooBar } from "../global/yahooFinance";

export interface RelativeStrengthResult {
  sectorId: string;
  rsScore: number;
  state: "領先" | "同步" | "落後";
  interpretation: string[];
  metrics: {
    rsSlope20: number;
    rsZ60: number;
  };
}

function calculateSMA(series: number[], period: number): number[] {
  const sma = [];
  for (let i = 0; i < series.length; i++) {
    if (i < period - 1) {
      sma.push(0);
    } else {
      const sum = series.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

export function calculateRelativeStrength(
  twPrices: {date: string, close: number}[],
  sector: SelectedSector | null,
  globalDataMap: Record<string, YahooBar[]>
): RelativeStrengthResult | null {
  if (!sector || twPrices.length < 60) return null;
  const sectorBars = globalDataMap[sector.id];
  if (!sectorBars || sectorBars.length < 60) return null;

  const twDates = twPrices.map(p => p.date);
  const twCloses = twPrices.map(p => p.close);
  
  // Align sector
  const globalMap = new Map(sectorBars.map(b => [b.date, b.close]));
  const sectorAligned: number[] = [];
  let lastVal = sectorBars[0]?.close || 1;
  
  for (const date of twDates) {
    if (globalMap.has(date)) {
      lastVal = globalMap.get(date)!;
    }
    sectorAligned.push(lastVal === 0 ? 1 : lastVal);
  }

  // Calculate RS Line
  const rsLine = twCloses.map((c, i) => c / sectorAligned[i]);
  const rsMA20 = calculateSMA(rsLine, 20);

  // We need the latest slope
  const currentMA = rsMA20[rsMA20.length - 1];
  const oldMA = rsMA20[rsMA20.length - 21];
  
  let rsSlope20 = 0;
  if (oldMA && oldMA > 0) {
    rsSlope20 = (currentMA - oldMA) / oldMA;
  }

  // Calculate Z-Score over 60 days
  const rs60 = rsLine.slice(-60);
  const mean60 = rs60.reduce((a,b)=>a+b,0) / rs60.length;
  const std60 = Math.sqrt(rs60.reduce((a,b)=>a+Math.pow(b-mean60,2),0) / rs60.length) || 1;
  const currentRS = rs60[rs60.length - 1];
  const rsZ60 = (currentRS - mean60) / std60;

  // Scoring mapping
  let state: "領先" | "同步" | "落後" = "同步";
  let rsScore = 50;

  if (rsSlope20 > 0.03) {
    state = "領先";
    rsScore = 70 + Math.min(30, rsSlope20 * 100 * 3); // max 100
  } else if (rsSlope20 < -0.03) {
    state = "落後";
    rsScore = Math.max(0, 39 + rsSlope20 * 100 * 3);
  } else {
    state = "同步";
    rsScore = 40 + ((rsSlope20 + 0.03) / 0.06) * 29; // map -0.03..0.03 to 40..69
  }
  
  rsScore = Math.min(100, Math.max(0, rsScore));

  const interpretation: string[] = [];
  if (state === "領先") {
    interpretation.push(`相對 ${sector.id} 呈領先：個股比板塊更強`);
  } else if (state === "落後") {
    interpretation.push(`相對 ${sector.id} 落後：上漲多靠板塊，個股本身偏弱`);
    interpretation.push(`若板塊轉弱，落後股風險較高`);
  } else {
    interpretation.push(`與 ${sector.id} 同步：隨板塊起伏`);
  }

  return {
    sectorId: sector.id,
    rsScore,
    state,
    interpretation,
    metrics: { rsSlope20, rsZ60 }
  };
}
