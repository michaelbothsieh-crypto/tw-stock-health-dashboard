import { fetchYahooFinanceBars, YahooBar } from "./yahooFinance";

export interface PeerCorrelation {
  symbol: string;
  correlation60: number;
  direction: "正向" | "弱正" | "無關" | "弱反" | "反向";
  interpretation: string;
}

export interface SectorDriver {
  name: string;
  momentum20: number;
  beta60: number;
  interpretation: string;
}

export interface FxCommodity {
  usdTwdCorr: number;
  oilCorr: number;
  goldCorr: number;
  interpretation: string[];
}

export interface GlobalDriversData {
  peerCorrelation: PeerCorrelation[];
  sectorDrivers: SectorDriver[];
  fxCommodity: FxCommodity;
}

const PEER_MAPPING: Record<string, string[]> = {
  "2330": ["NVDA", "SOXX", "AAPL"],
  "2317": ["AAPL", "NVDA"],
  "2454": ["QCOM", "SOXX"],
  "3231": ["NVDA", "SMCI"],
  "2382": ["NVDA", "MSFT"],
  "2303": ["SOXX", "TXN"],
  "2308": ["TSLA", "QQQ"],
  "2603": ["ZIM"],
};
const DEFAULT_PEERS = ["QQQ", "SPY"];
const SECTORS = ["SOXX", "XLK"];
const FX_COMM = ["TWD=X", "CL=F", "GC=F"];

function alignSeries(twDates: string[], globalBars: YahooBar[]) {
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

function calcReturns(series: number[]): number[] {
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

function calcCorrelation(x: number[], y: number[]): number {
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

function calcBeta(stockRet: number[], etfRet: number[]): number {
  if (stockRet.length !== etfRet.length || stockRet.length === 0) return 0;
  const n = stockRet.length;
  const meanEtf = etfRet.reduce((a, b) => a + b, 0) / n;
  
  let cov = 0, varEtf = 0;
  for (let i = 0; i < n; i++) {
    const dStock = stockRet[i] - (stockRet.reduce((a,b)=>a+b,0)/n);
    const dEtf = etfRet[i] - meanEtf;
    cov += dStock * dEtf;
    varEtf += dEtf * dEtf;
  }
  return varEtf > 0 ? cov / varEtf : 0;
}

function interpretCorr(corr: number, symbol: string): PeerCorrelation {
  let dir: PeerCorrelation["direction"] = "無關";
  let interp = `與 ${symbol} 關聯較低`;
  if (corr >= 0.6) {
    dir = "正向";
    interp = `與 ${symbol} 正向高連動，可能共漲下行`;
  } else if (corr >= 0.3) {
    dir = "弱正";
    interp = `與 ${symbol} 呈現弱正向連動`;
  } else if (corr <= -0.6) {
    dir = "反向";
    interp = `與 ${symbol} 呈反向`;
  } else if (corr <= -0.3) {
    dir = "弱反";
    interp = `與 ${symbol} 呈現弱反向`;
  }
  return { symbol, correlation60: corr, direction: dir, interpretation: interp };
}

export async function calculateGlobalDrivers(ticker: string, twPrices: {date: string, close: number}[]): Promise<GlobalDriversData | null> {
  try {
    if (twPrices.length < 61) return null;
    const twDates = twPrices.map(p => p.date);
    const twCloses = twPrices.map(p => p.close);
    const twReturns = calcReturns(twCloses);
    
    // We only need the last 60 returns, meaning 61 prices
    const twRet60 = twReturns.slice(-60);
    const twDates60 = twDates.slice(-60);
    
    const peers = PEER_MAPPING[ticker] || DEFAULT_PEERS;
    const allSymbols = Array.from(new Set([...peers, ...SECTORS, ...FX_COMM]));
    
    const globalDataMap: Record<string, YahooBar[]> = {};
    await Promise.all(allSymbols.map(async sym => {
      globalDataMap[sym] = await fetchYahooFinanceBars(sym, 100);
    }));
    
    // Peer Correlation
    const peerCorrelation: PeerCorrelation[] = [];
    for (const sym of peers) {
      if (!globalDataMap[sym] || globalDataMap[sym].length === 0) continue;
      const aligned = alignSeries(twDates, globalDataMap[sym]);
      const globalRet = calcReturns(aligned);
      const globalRet60 = globalRet.slice(-60);
      const corr = calcCorrelation(twRet60, globalRet60);
      peerCorrelation.push(interpretCorr(corr, sym));
    }
    
    // Sector Drivers
    const sectorDrivers: SectorDriver[] = [];
    for (const sym of SECTORS) {
      if (!globalDataMap[sym] || globalDataMap[sym].length === 0) continue;
      const aligned = alignSeries(twDates, globalDataMap[sym]);
      const globalRet = calcReturns(aligned);
      const globalRet60 = globalRet.slice(-60);
      const beta = calcBeta(twRet60, globalRet60);
      
      const last20 = aligned.slice(-21); // need 21 for 20-day momentum
      const momentum20 = last20.length >= 21 ? (last20[last20.length-1] - last20[0]) / last20[0] : 0;
      
      let interp = "動能平穩";
      if (momentum20 >= 0.12) interp = "板塊強勢";
      else if (momentum20 <= -0.12) interp = "板塊弱勢";
      else if (beta >= 1) interp = "個股跟隨度高";
      
      sectorDrivers.push({
        name: sym,
        momentum20,
        beta60: beta,
        interpretation: interp
      });
    }
    
    // FX & Commodities
    const fxCommodity: FxCommodity = { usdTwdCorr: 0, oilCorr: 0, goldCorr: 0, interpretation: [] };
    const getCorr = (sym: string) => {
      if (!globalDataMap[sym] || globalDataMap[sym].length === 0) return 0;
      const aligned = alignSeries(twDates, globalDataMap[sym]);
      const globalRet = calcReturns(aligned);
      const globalRet60 = globalRet.slice(-60);
      return calcCorrelation(twRet60, globalRet60);
    };
    
    fxCommodity.usdTwdCorr = getCorr("TWD=X");
    fxCommodity.oilCorr = getCorr("CL=F");
    fxCommodity.goldCorr = getCorr("GC=F");
    
    if (Math.abs(fxCommodity.usdTwdCorr) > 0.4) fxCommodity.interpretation.push("價格可能受匯率影響");
    if (Math.abs(fxCommodity.oilCorr) > 0.3) fxCommodity.interpretation.push("與原油連動");
    if (Math.abs(fxCommodity.goldCorr) > 0.3) fxCommodity.interpretation.push("與黃金避險情緒連動");
    
    if (fxCommodity.interpretation.length === 0) fxCommodity.interpretation.push("受原物料匯率影響低");

    return {
      peerCorrelation,
      sectorDrivers,
      fxCommodity
    };
  } catch (e) {
    console.error("Global drivers calculation failed", e);
    return null;
  }
}
