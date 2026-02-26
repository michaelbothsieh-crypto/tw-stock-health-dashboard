import { describe, it, expect } from "vitest";
import { evaluateCrashWarning } from "../global/crash/crashEngine";

// Utility to generate mock bars
function generateMockBars(startPrice: number, dailyRet: number, days: number = 61): { close: number }[] {
  const bars = [];
  let price = startPrice;
  for (let i = 0; i < days; i++) {
    bars.push({ close: price });
    price *= (1 + dailyRet);
  }
  return bars;
}

describe("Crash Warning Engine Evaluator", () => {
  it("Case 1: All indicators available, simulates a crash strictly (Score > 40)", () => {
    // VIX flat at 15, then spike to 36
    const vixBars = generateMockBars(15, 0, 61);
    vixBars[60].close = 36;

    // SOXX flat at 100, then drop to 80
    const soxxBars = generateMockBars(100, 0, 61);
    soxxBars[60].close = 80;

    // QQQ flat at 100, then drop to 85
    const qqqBars = generateMockBars(100, 0, 61);
    qqqBars[60].close = 85;

    // DXY flat at 100, then spike to 108
    const dxyBars = generateMockBars(100, 0, 61);
    dxyBars[60].close = 108;

    const marketData = {
      "^VIX": vixBars,
      "SOXX": soxxBars,
      "QQQ": qqqBars,
      "^DXY": dxyBars,
    };

    const res = evaluateCrashWarning(marketData);
    
    expect(res.score).not.toBeNull();
    expect(res.score).toBeGreaterThan(40);
    expect(res.level).not.toBe("資料不足");
    expect(res.level).not.toBe("正常");
    expect(res.triggersTop.length).toBeGreaterThan(0);
    // Should contain some crash phrases
    expect(res.triggersTop.some(t => t.includes("波動升溫") || t.includes("破位") || t.includes("風險"))).toBeTruthy();
  });

  it("Case 2: Empty data, simulates no indicators available", () => {
    const res = evaluateCrashWarning({});
    expect(res.score).toBeNull();
    expect(res.level).toBe("資料不足");
    expect(res.triggersTop).toContain("請稍後再試");
    // Ensure all factors are unavailable
    expect(res.factors.volatilityStress.available).toBe(false);
    expect(res.factors.volatilityStress.score).toBeNull();
    expect(res.factors.sectorBreakdown.available).toBe(false);
    expect(res.factors.sectorBreakdown.score).toBeNull();
  });

  it("Case 3: Missing partial data (e.g. MOVE/DXY)", () => {
    // Only VIX and SOXX provided, but QQQ and DXY/MOVE missing.
    const vixBars = generateMockBars(20, 0.001, 61);
    const soxxBars = generateMockBars(100, 0.001, 61);
    
    const res = evaluateCrashWarning({
      "^VIX": vixBars,
      "SOXX": soxxBars
    });

    // We should still get a valid score because VIX and SOXX are present
    expect(res.score).not.toBeNull();
    // It should have warnings about missing data in triggersTop or debug notes
    expect(res.factors.crossAssetStress.available).toBe(false);
    expect(res.factors.crossAssetStress.score).toBeNull();
    expect(res.triggersTop.some(t => t.includes("部分資料缺失"))).toBeTruthy();
  });
});
