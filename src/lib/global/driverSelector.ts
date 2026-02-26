import { USThemeMapping } from "./themeMapper";
import { YahooBar } from "./yahooFinance";

export interface SelectedSector {
  id: string;
  nameZh: string;
  corr60: number;
  corrL1: number;
  momentum20: number;
  reason?: string;
}

export interface SelectedPeer {
  symbol: string;
  nameEn: string; // we can just use symbol as nameEn for now if no lookup
  corr60: number;
  corrL1: number;
  reason?: string;
}

export interface SelectedDrivers {
  sector: SelectedSector | null;
  peers: SelectedPeer[];
}

export function alignSeries(twDates: string[], globalBars: YahooBar[]) {
  const globalMap = new Map(globalBars.map(b => [b.date, b.close]));
  const aligned: number[] = [];
  let lastVal = globalBars[0]?.close || 0;
  
  for (const date of twDates) {
    if (globalMap.has(date)) {
      lastVal = globalMap.get(date)!;
    }
    aligned.push(lastVal);
  }
  return aligned;
}

export function calcReturns(series: number[]): number[] {
  const rets = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i-1] === 0) {
      rets.push(0);
    } else {
      rets.push((series[i] - series[i-1]) / series[i-1]);
    }
  }
  return rets;
}

export function calcCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  return denX > 0 && denY > 0 ? num / Math.sqrt(denX * denY) : 0;
}

export function selectDrivers(
  twPrices: {date: string, close: number}[],
  mapping: USThemeMapping,
  globalDataMap: Record<string, YahooBar[]>
): SelectedDrivers {
  
  const twDates = twPrices.map(p => p.date);
  const twCloses = twPrices.map(p => p.close);
  const twReturns = calcReturns(twCloses);
  const twRet60 = twReturns.slice(-60);
  
  const scoreCandidate = (id: string) => {
    const bars = globalDataMap[id];
    if (!bars || bars.length < 60) return { corr60: 0, corrL1: 0, momentum20: 0, maxScore: 0 };
    
    const aligned = alignSeries(twDates, bars);
    const globalRet = calcReturns(aligned);
    
    const globalRet60 = globalRet.slice(-60);
    const globalRetL1 = globalRet.slice(-61, -1); // shifted 1 day (T-1) // this requires 61 returns length
    
    const twRetForL1 = twRet60.slice(-globalRetL1.length);
    
    const corr60 = calcCorrelation(twRet60, globalRet60);
    const corrL1 = calcCorrelation(twRetForL1, globalRetL1);
    const maxScore = Math.max(Math.abs(corr60), Math.abs(corrL1));
    
    const last20 = aligned.slice(-21);
    const momentum20 = last20.length >= 21 ? (last20[last20.length-1] - last20[0]) / last20[0] : 0;
    
    return { corr60, corrL1, momentum20, maxScore };
  };

  // Score Sector
  let bestSector: SelectedSector | null = null;
  if (mapping.sector) {
      const stats = scoreCandidate(mapping.sector.id);
      bestSector = { 
          id: mapping.sector.id, 
          nameZh: mapping.sector.nameZh, 
          ...stats 
      };
      if (stats.maxScore < 0.25) {
          bestSector.reason = "連動不明顯";
      }
  }

  // Score Peers
  const scoredPeers: SelectedPeer[] = mapping.hints.map(sym => {
    const stats = scoreCandidate(sym);
    return { symbol: sym, nameEn: sym, ...stats };
  });

  scoredPeers.sort((a, b) => {
    const aScore = Math.max(Math.abs(a.corrL1), Math.abs(a.corr60));
    const bScore = Math.max(Math.abs(b.corrL1), Math.abs(b.corr60));
    return bScore - aScore;
  });

  const topPeers = scoredPeers.slice(0, 3).map(p => {
    const s = Math.max(Math.abs(p.corrL1), Math.abs(p.corr60));
    if (s < 0.15) {
      return { ...p, reason: "連動不明顯" };
    }
    return p;
  });

  // Sort so that "連動不明顯" items move to the bottom
  topPeers.sort((a, b) => {
    const aObvious = a.reason !== "連動不明顯" ? 1 : 0;
    const bObvious = b.reason !== "連動不明顯" ? 1 : 0;
    if (aObvious !== bObvious) return bObvious - aObvious;
    const aScore = Math.max(Math.abs(a.corrL1), Math.abs(a.corr60));
    const bScore = Math.max(Math.abs(b.corrL1), Math.abs(b.corr60));
    return bScore - aScore;
  });

  return {
    sector: bestSector,
    peers: topPeers
  };
}
