import { MarketIndicatorResult } from "../../providers/marketIndicators";

export interface CrashFactorResult {
  score: number | null;
  triggers: string[];
  available: boolean;
}

export interface MacroIndicator {
  value?: number;
  status: string;
  variant: 'positive' | 'neutral' | 'negative';
  trend?: string;
}

export interface CrashWarningOutput {
  score: number | null;
  level: "正常" | "警戒" | "高風險" | "崩盤風險" | "資料不足";
  headline: string;
  summary: string;
  triggersTop: string[];
  macroIndicators?: {
    vix: MacroIndicator;
    soxx: MacroIndicator;
    liquidity: MacroIndicator;
    systemRisk: MacroIndicator;
  };
  factors: {
    volatilityStress: CrashFactorResult;
    sectorBreakdown: CrashFactorResult;
    crossAssetStress: CrashFactorResult;
    liquidityStress: CrashFactorResult;
  };
  lastUpdated: string;
  meta: {
    computedAt: string;
    engineVersion: string;
    usedSymbols: string[];
    usedPointsMin: number;
    calcTrace: {
      volatility: { available: boolean; inputs: string[]; score: number | null };
      sector: { available: boolean; inputs: string[]; score: number | null };
      crossAsset: { available: boolean; inputs: string[]; score: number | null };
      liquidity: { available: boolean; inputs: string[]; score: number | null };
    };
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return null;
  return num;
}

function calcRet20(closes: readonly number[]): number | null {
  if (closes.length < 21) return null;
  const current = safeNumber(closes[closes.length - 1]);
  const old = safeNumber(closes[closes.length - 21]);
  if (current === null || old === null || old === 0) return null;
  return safeNumber((current - old) / old);
}

function calcDrawdown20(closes: readonly number[]): number | null {
  if (closes.length < 21) return null;
  const recent20 = closes.slice(-20);
  const current = safeNumber(recent20[recent20.length - 1]);
  const validCloses = recent20.map(b => safeNumber(b)).filter(c => c !== null) as number[];
  if (validCloses.length === 0 || current === null) return null;
  const maxClose = Math.max(...validCloses);
  if (maxClose === 0) return null;
  return safeNumber(current / maxClose - 1);
}

function calcVixStats(closes: readonly number[]): { current: number; ma20: number; delta: number } | null {
  if (closes.length < 20) return null;
  const recent20 = closes.slice(-20);
  const current = safeNumber(recent20[recent20.length - 1]);
  const validCloses = recent20.map(b => safeNumber(b)).filter(c => c !== null) as number[];
  if (validCloses.length < 20 || current === null) return null;
  const sum20 = validCloses.reduce((acc, val) => acc + val, 0);
  const ma20 = sum20 / validCloses.length;
  if (ma20 === 0) return null;
  const delta = safeNumber((current - ma20) / ma20);
  if (delta === null) return null;
  return { current, ma20, delta };
}

export function evaluateCrashWarning(marketData: MarketIndicatorResult): CrashWarningOutput {
  const { seriesBySymbol, usedSymbols } = marketData;

  const usedPointsArray = usedSymbols.map(sym => seriesBySymbol[sym]?.closes.length || 0).filter(len => len > 0);
  const usedPointsMin = usedPointsArray.length > 0 ? Math.min(...usedPointsArray) : 0;

  const meta: CrashWarningOutput["meta"] = {
    computedAt: new Date().toISOString(),
    engineVersion: "crash-v2.1",
    usedSymbols: usedSymbols,
    usedPointsMin: usedPointsMin,
    calcTrace: {
      volatility: { available: false, inputs: [], score: null },
      sector: { available: false, inputs: [], score: null },
      crossAsset: { available: false, inputs: [], score: null },
      liquidity: { available: false, inputs: [], score: null }
    }
  };

  const checkFailOpen = () => {
      // 2) 強制資料可用性門檻：少於門檻就是「資料不足」，不准顯示 0
      if (usedSymbols.length < 2 || usedPointsMin < 21) {
          return true;
      }
      return false;
  };

  const isFailOpen = checkFailOpen();

  const getCloses = (keys: string[]) => {
    for (const k of keys) {
      if (seriesBySymbol[k] && seriesBySymbol[k].closes.length >= 21) {
        return { closes: seriesBySymbol[k].closes, symbol: k };
      }
    }
    return { closes: [], symbol: null };
  };

  const vixSeries = getCloses(["^VIX"]);
  const moveSeries = getCloses(["^MOVE"]);
  const soxxSeries = getCloses(["SOXX"]);
  const qqqSeries = getCloses(["QQQ"]);
  const dxySeries = getCloses(["^DXY", "DX-Y.NYB", "UUP"]);
  const usdjpySeries = getCloses(["USDJPY=X", "JPY=X"]);

  // --- 1. 波動壓力 (Volatility) ---
  const volFact: CrashFactorResult = { score: null, triggers: [], available: false };
  let vixStats = null;
  if (!isFailOpen && vixSeries.symbol) {
      vixStats = calcVixStats(vixSeries.closes);
      if (vixStats) {
          volFact.available = true;
          volFact.score = 0;
          meta.calcTrace.volatility.inputs.push(vixSeries.symbol);
          if (vixStats.current >= 35) { volFact.score += 40; volFact.triggers.push("VIX 高於 35（恐慌水位）"); }
          else if (vixStats.current >= 25) { volFact.score += 25; volFact.triggers.push("VIX 高於 25（波動升溫）"); }
          if (vixStats.delta >= 0.20) { volFact.score += 15; volFact.triggers.push("VIX 顯著高於月均（快速升溫）"); }
      }
  }
  if (!isFailOpen && moveSeries.symbol && moveSeries.closes.length > 0) {
      const move = safeNumber(moveSeries.closes[moveSeries.closes.length - 1]);
      if (move !== null && typeof volFact.score === "number") {
          meta.calcTrace.volatility.inputs.push(moveSeries.symbol);
          if (move >= 140) { volFact.score += 20; volFact.triggers.push("MOVE 偏高（債市極端波動）"); }
          else if (move >= 120) { volFact.score += 10; volFact.triggers.push("MOVE 偏高（債市波動升溫）"); }
      }
  }

  if (volFact.available && volFact.score !== null) {
      volFact.score = clamp(volFact.score, 0, 100);
      meta.calcTrace.volatility.available = true;
      meta.calcTrace.volatility.score = volFact.score;
  } else {
      volFact.score = null;
      volFact.available = false;
      volFact.triggers.push(isFailOpen ? "資料不足：系統評估門檻未達標" : "資料不足：VIX 計算結果無效");
  }

  // --- 2. 板塊破位 (Sector Breakdown) ---
  const secFact: CrashFactorResult = { score: null, triggers: [], available: false };
  let soxxRet20 = null;
  let qqqRet20 = null;
  if (!isFailOpen) {
      soxxRet20 = calcRet20(soxxSeries.closes);
      qqqRet20 = calcRet20(qqqSeries.closes);
      const soxxDd = calcDrawdown20(soxxSeries.closes);
      const qqqDd = calcDrawdown20(qqqSeries.closes);

      if (soxxRet20 !== null) {
          secFact.available = true;
          secFact.score = (secFact.score || 0);
          meta.calcTrace.sector.inputs.push(soxxSeries.symbol as string);
          if (soxxRet20 <= -0.12) { secFact.score += 40; secFact.triggers.push("費半近 20 日跌幅大於 12%（明顯破位）"); }
          else if (soxxRet20 <= -0.08) { secFact.score += 25; secFact.triggers.push("費半近 20 日跌幅大於 8%（板塊轉弱）"); }
      }

      if (qqqRet20 !== null) {
          secFact.available = true;
          secFact.score = (secFact.score || 0);
          meta.calcTrace.sector.inputs.push(qqqSeries.symbol as string);
          if (qqqRet20 <= -0.10) { secFact.score += 30; secFact.triggers.push("QQQ 跌幅偏大（科技風險急升）"); }
          else if (qqqRet20 <= -0.06) { secFact.score += 15; secFact.triggers.push("QQQ 跌幅偏大（科技風險上升）"); }
      }

      if (secFact.available && typeof secFact.score === "number") {
          const minDd = Math.min((soxxDd !== null ? soxxDd : 0), (qqqDd !== null ? qqqDd : 0));
          if (minDd <= -0.06) {
              secFact.score += 15;
              secFact.triggers.push("近 20 日回落幅度擴大（走勢破位）");
          }
      }
  }

  if (secFact.available && secFact.score !== null) {
      secFact.score = clamp(secFact.score, 0, 100);
      meta.calcTrace.sector.available = true;
      meta.calcTrace.sector.score = secFact.score;
  } else {
      secFact.score = null;
      secFact.available = false;
      secFact.triggers.push(isFailOpen ? "資料不足：系統評估門檻未達標" : "資料不足：SOXX/QQQ 計算結果無效");
  }

  // --- 3. 跨資產壓力 (Cross Asset) ---
  const crossFact: CrashFactorResult = { score: null, triggers: [], available: false };
  let dxyRet20 = null;
  let usdjpyRet20 = null;

  if (!isFailOpen) {
      dxyRet20 = calcRet20(dxySeries.closes);
      usdjpyRet20 = calcRet20(usdjpySeries.closes);

      if (dxyRet20 !== null) {
          crossFact.available = true;
          crossFact.score = (crossFact.score || 0);
          meta.calcTrace.crossAsset.inputs.push(dxySeries.symbol as string);
          if (dxyRet20 >= 0.06) { crossFact.score += 25; crossFact.triggers.push("美元指數近 20 日明顯走強（風險緊縮）"); }
          else if (dxyRet20 >= 0.03) { crossFact.score += 15; crossFact.triggers.push("美元指數偏強（資金流出壓力）"); }
      }
      if (usdjpyRet20 !== null) {
          crossFact.available = true;
          crossFact.score = (crossFact.score || 0);
          meta.calcTrace.crossAsset.inputs.push(usdjpySeries.symbol as string);
          if (usdjpyRet20 >= 0.06) { crossFact.score += 20; crossFact.triggers.push("美元兌日圓升幅偏大（匯率壓力升溫）"); }
          else if (usdjpyRet20 >= 0.03) { crossFact.score += 10; crossFact.triggers.push("美元兌日圓偏強（匯率壓力）"); }
      }
  }

  if (crossFact.available && crossFact.score !== null) {
      crossFact.score = clamp(crossFact.score, 0, 100);
      meta.calcTrace.crossAsset.available = true;
      meta.calcTrace.crossAsset.score = crossFact.score;
  } else {
      crossFact.score = null;
      crossFact.available = false;
      crossFact.triggers.push(isFailOpen ? "資料不足：系統評估門檻未達標" : "資料不足：DXY/USDJPY 計算結果無效");
  }

  // --- 4. 流動性壓力 (Liquidity Proxy) ---
  const liqFact: CrashFactorResult = { score: null, triggers: [], available: false };
  if (!isFailOpen && vixStats && dxyRet20 !== null && soxxRet20 !== null) {
      liqFact.available = true;
      liqFact.score = 0;
      meta.calcTrace.liquidity.inputs = ["VIX", "DXY", "SOXX"];
      let liqHits = 0;
      if (vixStats.current >= 25 && dxyRet20 >= 0.03) {
          liqFact.score += 25;
          liqFact.triggers.push("波動升溫 + 美元偏強（流動性代理訊號）");
          liqHits++;
      }
      if (soxxRet20 <= -0.10 && vixStats.delta >= 0.20) {
          liqFact.score += 25;
          liqFact.triggers.push("費半轉弱 + 波動急升（流動性代理訊號）");
          liqHits++;
      }
      if (liqHits === 2) {
          liqFact.score += 10;
          liqFact.triggers.push("多重壓力疊加，資金流動性顯著變差");
      }
  }

  if (liqFact.available && liqFact.score !== null) {
      liqFact.score = clamp(liqFact.score, 0, 100);
      meta.calcTrace.liquidity.available = true;
      meta.calcTrace.liquidity.score = liqFact.score;
  } else {
      liqFact.score = null;
      liqFact.available = false;
      liqFact.triggers.push(isFailOpen ? "資料不足：系統評估門檻未達標" : "資料不足：Liquidity Proxy 計算結果無效");
  }

  // --- 綜合計算 (Normalize Weights) ---
  if (isFailOpen) {
      return {
          score: null,
          level: "資料不足",
          headline: "資料不足",
          summary: "目前無法取得足夠市場資料，暫時無法評估風險",
          triggersTop: ["市場資料取得失敗", "請稍後再試"],
          macroIndicators: {
            vix: { value: 0, status: "資料不足", variant: "neutral" },
            soxx: { trend: "趨勢不明", status: "中性", variant: "neutral" },
            liquidity: { status: "評估中", variant: "neutral" },
            systemRisk: { status: "資料不足", variant: "neutral" }
          },
          factors: {
              volatilityStress: volFact,
              sectorBreakdown: secFact,
              crossAssetStress: crossFact,
              liquidityStress: liqFact
          },
          lastUpdated: meta.computedAt,
          meta
      };
  }

  let totalScoreRaw = 0;
  let availableWeight = 0;
  
  if (volFact.available && volFact.score !== null) { totalScoreRaw += volFact.score * 0.30; availableWeight += 0.30; }
  if (secFact.available && secFact.score !== null) { totalScoreRaw += secFact.score * 0.30; availableWeight += 0.30; }
  if (crossFact.available && crossFact.score !== null) { totalScoreRaw += crossFact.score * 0.20; availableWeight += 0.20; }
  if (liqFact.available && liqFact.score !== null) { totalScoreRaw += liqFact.score * 0.20; availableWeight += 0.20; }

  let finalScore: number | null = null;
  let level: CrashWarningOutput["level"] = "正常";
  let headline = "市場風險偏低";
  let summary = "整體環境相對平穩，可維持正常操作。";
  let triggersTop: string[] = ["總經與市場指標平穩，無極端警示"];

  if (availableWeight > 0) {
      const normalized = totalScoreRaw / availableWeight;
      finalScore = safeNumber(normalized);
      
      if (finalScore !== null) {
          // No rounding if it is NaN explicitly
          finalScore = safeNumber(Math.round(clamp(finalScore, 0, 100) * 10) / 10);
      }
  }

  if (finalScore === null) {
      return {
          score: null,
          level: "資料不足",
          headline: "資料不足",
          summary: "計算結果無效 (NaN)，暫時無法評估風險",
          triggersTop: ["資料不足：計算結果無效"],
          macroIndicators: {
            vix: { value: 0, status: "資料不足", variant: "neutral" },
            soxx: { trend: "趨勢不明", status: "中性", variant: "neutral" },
            liquidity: { status: "評估中", variant: "neutral" },
            systemRisk: { status: "資料不足", variant: "neutral" }
          },
          factors: {
              volatilityStress: volFact,
              sectorBreakdown: secFact,
              crossAssetStress: crossFact,
              liquidityStress: liqFact
          },
          lastUpdated: meta.computedAt,
          meta
      };
  }

  if (finalScore >= 80) {
    level = "崩盤風險";
    headline = "崩盤風險極高，建議對沖";
    summary = "多項市場指標顯示極端異常，資金可能快速撤出風險資產。";
  }
  else if (finalScore >= 60) {
    level = "高風險";
    headline = "風險升高，偏向防守";
    summary = "市場出現明顯壓力訊號，建議降低持股水位。";
  }
  else if (finalScore >= 30) {
    level = "警戒";
    headline = "市場進入警戒狀態";
    summary = "部分指標轉弱或波動升溫，需密切觀察。";
  }

  const allFactors = [
    { name: "波動", res: volFact },
    { name: "板塊", res: secFact },
    { name: "跨資產", res: crossFact },
    { name: "流動性", res: liqFact }
  ];
  
  allFactors.sort((a, b) => (b.res.score ?? 0) - (a.res.score ?? 0));
  
  const reasons: string[] = [];
  for (const f of allFactors) {
    if (f.res.available && f.res.triggers.length > 0) {
      reasons.push(...f.res.triggers.slice(0, 2));
    }
  }
  
  const dedupedReasons = Array.from(new Set(reasons));
  if (dedupedReasons.length > 0) {
    triggersTop = dedupedReasons.slice(0, 4);
  }

  if (availableWeight < 1) {
    triggersTop.push("部分資料缺失，以可用指標估算");
  }

  // --- Macro Radar Indicators (Pro Max) ---
  const macroIndicators = {
    vix: {
      value: vixStats?.current ?? 0,
      status: vixStats ? (vixStats.current >= 30 ? "恐慌升溫" : vixStats.current >= 20 ? "波動偏高" : "情緒平穩") : "資料不足",
      variant: (vixStats ? (vixStats.current >= 30 ? "negative" : vixStats.current >= 20 ? "neutral" : "positive") : "neutral") as 'positive' | 'neutral' | 'negative'
    },
    soxx: {
      trend: soxxRet20 !== null ? (soxxRet20 > 0.02 ? "多頭延續" : soxxRet20 < -0.05 ? "弱勢破位" : "高檔震盪") : "趨勢不明",
      status: soxxRet20 !== null ? (soxxRet20 > 0 ? "偏多" : "偏空") : "中性",
      variant: (soxxRet20 !== null ? (soxxRet20 > 0.02 ? "positive" : soxxRet20 < -0.05 ? "negative" : "neutral") : "neutral") as 'positive' | 'neutral' | 'negative'
    },
    liquidity: {
      status: dxyRet20 !== null ? (dxyRet20 >= 0.03 ? "緊縮壓力" : dxyRet20 <= -0.02 ? "資金寬鬆" : "資金中性") : "評估中",
      variant: (dxyRet20 !== null ? (dxyRet20 >= 0.03 ? "negative" : dxyRet20 <= -0.02 ? "positive" : "neutral") : "neutral") as 'positive' | 'neutral' | 'negative'
    },
    systemRisk: {
      status: level === "正常" ? "風險偏低" : level,
      variant: (finalScore >= 60 ? "negative" : finalScore >= 30 ? "neutral" : "positive") as 'positive' | 'neutral' | 'negative'
    }
  };

  return {
    score: finalScore,
    level,
    headline,
    summary,
    triggersTop,
    macroIndicators,
    factors: {
      volatilityStress: volFact,
      sectorBreakdown: secFact,
      crossAssetStress: crossFact,
      liquidityStress: liqFact
    },
    lastUpdated: meta.computedAt,
    meta
  };
}
