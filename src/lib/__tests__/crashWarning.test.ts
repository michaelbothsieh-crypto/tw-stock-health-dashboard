import { describe, it, expect } from "vitest";
import { evaluateCrashWarning } from "../global/crash/crashEngine";
import { MarketIndicatorResult } from "../providers/marketIndicators";

function generateMockBars(startPrice: number, dailyRet: number, days = 61): number[] {
  const closes: number[] = [];
  let price = startPrice;
  for (let i = 0; i < days; i++) {
    closes.push(price);
    price *= 1 + dailyRet;
  }
  return closes;
}

function buildMarketData(series: Record<string, number[]>): MarketIndicatorResult {
  const seriesBySymbol: MarketIndicatorResult["seriesBySymbol"] = {};
  const okBySymbol: MarketIndicatorResult["okBySymbol"] = {};
  const usedSymbols: string[] = [];

  for (const [symbol, closes] of Object.entries(series)) {
    seriesBySymbol[symbol] = {
      closes,
      dates: closes.map((_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`),
    };
    const ok = closes.length >= 21;
    okBySymbol[symbol] = { ok, points: closes.length };
    if (ok) usedSymbols.push(symbol);
  }

  return { seriesBySymbol, okBySymbol, usedSymbols };
}

describe("Crash Warning Engine Evaluator", () => {
  it("Case 1: crash-like conditions should produce elevated score", () => {
    const vixBars = generateMockBars(15, 0, 61);
    vixBars[60] = 36;

    const soxxBars = generateMockBars(100, 0, 61);
    soxxBars[60] = 80;

    const qqqBars = generateMockBars(100, 0, 61);
    qqqBars[60] = 85;

    const dxyBars = generateMockBars(100, 0, 61);
    dxyBars[60] = 108;

    const marketData = buildMarketData({
      "^VIX": vixBars,
      SOXX: soxxBars,
      QQQ: qqqBars,
      "^DXY": dxyBars,
    });

    const res = evaluateCrashWarning(marketData);

    expect(res.score).not.toBeNull();
    expect((res.score ?? 0) > 40).toBeTruthy();
    expect(res.level).not.toBe("資料不足");
    expect(res.level).not.toBe("正常");
    expect(res.triggersTop.length).toBeGreaterThan(0);
  });

  it("Case 2: empty data should return data-insufficient status", () => {
    const res = evaluateCrashWarning(buildMarketData({}));
    expect(res.score).toBeNull();
    expect(res.level).toBe("資料不足");
    expect(res.factors.volatilityStress.available).toBe(false);
    expect(res.factors.sectorBreakdown.available).toBe(false);
  });

  it("Case 3: partial data should still compute partial score", () => {
    const vixBars = generateMockBars(20, 0.001, 61);
    const soxxBars = generateMockBars(100, 0.001, 61);

    const res = evaluateCrashWarning(
      buildMarketData({
        "^VIX": vixBars,
        SOXX: soxxBars,
      }),
    );

    expect(res.score).not.toBeNull();
    expect(res.factors.crossAssetStress.available).toBe(false);
    expect(res.factors.crossAssetStress.score).toBeNull();
  });
});
