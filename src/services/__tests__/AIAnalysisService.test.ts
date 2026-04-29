import { describe, expect, it } from "vitest";
import { buildRecentTrendText, enforcePriceActionGuard } from "../AIAnalysisService";
import { StockCard } from "../stocks/types";

function makeCard(overrides: Partial<StockCard> = {}): StockCard {
  return {
    symbol: "9984.T",
    nameZh: "9984.T",
    close: 5268,
    chgPct: -9.86,
    chgAbs: -577,
    volume: 12345600,
    volumeVs5dPct: null,
    flowNet: null,
    flowUnit: "股",
    shortDir: "中立",
    strategySignal: "觀察",
    confidence: null,
    p1d: null,
    p3d: null,
    p5d: null,
    support: null,
    resistance: null,
    bullTarget: null,
    bearTarget: null,
    overseas: [],
    syncLevel: "—",
    newsLine: "無三天內新聞",
    sourceLabel: "yahoo",
    insiderSells: [],
    chartBuffer: null,
    tvRating: "買入",
    ...overrides,
  };
}

describe("AIAnalysisService price-action guard", () => {
  it("describes a sharp negative move as weakness, not strength", () => {
    const trendText = buildRecentTrendText(makeCard());

    expect(trendText).toContain("重挫近跌停");
    expect(trendText).not.toContain("趨勢強勁");
  });

  it("blocks bullish captions when price action is sharply negative", () => {
    const guarded = enforcePriceActionGuard(makeCard(), {
      verdict: "買入",
      caption: "爆量長紅，主力進場，跟進",
    });

    expect(guarded.verdict).toContain("防守");
    expect(guarded.caption).toContain("重挫近跌停");
    expect(guarded.caption).not.toMatch(/爆量長紅|主力進場|跟進/);
  });
});
