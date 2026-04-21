import { describe, expect, it } from "vitest";
import {
  buildBreakoutRow,
  findCrossAgeDays,
  getBreakoutExitReasons,
  isBreakoutEntry,
  isBreakoutExit,
  parseTvSymbol,
} from "../breakout";

describe("breakout screener rules", () => {
  it("matches strict entry rule with fresh golden cross, trend, and relative volume", () => {
    const result = isBreakoutEntry(
      {
        close: 110,
        fastEma: 108,
        slowEma: 103,
        trendEma: 100,
        rsi: 75,
        tradedValue: 150_000_000,
        volume: 2_000_000,
        avgVolume: 900_000,
        fastSeries: [108, 101, 99],
        slowSeries: [103, 101, 100],
      },
      100_000_000,
      70,
      3,
      2
    );
    expect(result.ok).toBe(true);
    expect(result.crossAgeDays).toBe(0);
  });

  it("rejects entry when any condition is not met", () => {
    expect(
      isBreakoutEntry(
        {
          close: 98,
          fastEma: 108,
          slowEma: 103,
          trendEma: 100,
          rsi: 65,
          tradedValue: 150_000_000,
          volume: 2_000_000,
          avgVolume: 900_000,
          fastSeries: [108, 101],
          slowSeries: [103, 101],
        },
        100_000_000,
        70,
        3,
        2
      ).ok
    ).toBe(false);

    expect(
      isBreakoutEntry(
        {
          close: 110,
          fastEma: 108,
          slowEma: 103,
          trendEma: 100,
          rsi: 71,
          tradedValue: 150_000_000,
          volume: 1_700_000,
          avgVolume: 900_000,
          fastSeries: [108, 103, 104],
          slowSeries: [103, 102, 103],
        },
        100_000_000,
        70,
        3,
        2
      ).ok
    ).toBe(false);

    expect(
      isBreakoutEntry(
        {
          close: 110,
          fastEma: 108,
          slowEma: 103,
          trendEma: 100,
          rsi: 71,
          tradedValue: 99_000_000,
          volume: 2_000_000,
          avgVolume: 900_000,
          fastSeries: [108, 101],
          slowSeries: [103, 101],
        },
        100_000_000,
        70,
        3,
        2
      ).ok
    ).toBe(false);

    expect(
      isBreakoutEntry(
        {
          close: 110,
          fastEma: 108,
          slowEma: 103,
          trendEma: 100,
          rsi: 71,
          tradedValue: 150_000_000,
          volume: 1_400_000,
          avgVolume: 900_000,
          fastSeries: [108, 101],
          slowSeries: [103, 101],
        },
        100_000_000,
        70,
        3,
        2
      ).ok
    ).toBe(false);
  });

  it("detects cross age within series", () => {
    expect(findCrossAgeDays([110, 109, 95], [100, 101, 100])).toBe(1);
    expect(findCrossAgeDays([110, 109, 108], [100, 101, 102])).toBeNull();
  });

  it("marks exit when close < slow EMA or RSI < 50", () => {
    expect(isBreakoutExit({ close: 95, slowEma: 100, rsi: 56 })).toBe(true);
    expect(isBreakoutExit({ close: 105, slowEma: 100, rsi: 45 })).toBe(true);
    expect(getBreakoutExitReasons({ close: 95, slowEma: 100, rsi: 45 })).toEqual([
      "收盤價跌破慢線 EMA",
      "RSI 低於 50",
    ]);
  });

  it("does not mark exit when both exit conditions are false", () => {
    expect(isBreakoutExit({ close: 105, slowEma: 100, rsi: 55 })).toBe(false);
    expect(getBreakoutExitReasons({ close: 105, slowEma: 100, rsi: 55 })).toEqual([]);
  });

  it("parses TradingView symbol correctly", () => {
    expect(parseTvSymbol("TWSE:2330")).toEqual({ exchange: "TWSE", code: "2330" });
  });

  it("builds breakout row and ignores invalid indicator values", () => {
    const row = buildBreakoutRow({
      tvSymbol: "TWSE:2330",
      name: "2330",
      description: "TSMC",
      close: 110,
      fastEma: 108,
      slowEma: 103,
      trendEma: 100,
      rsi: 75,
      tradedValue: 150_000_000,
      prevFastEma: 101,
      prevSlowEma: 101,
      fastEma2: 99,
      slowEma2: 100,
      minTurnover: 100_000_000,
      minRsi: 70,
      maxCrossAgeDays: 3,
      minRelativeVolumeMultiplier: 2,
      volume: 2_000_000,
      avgVolume: 900_000,
      marketCap: 1_000_000_000,
    });

    expect(row).not.toBeNull();
    expect(row?.entrySignal).toBe(true);
    expect(row?.exitSignal).toBe(false);
    expect(row?.volumeRatio).toBeGreaterThan(2);

    const invalid = buildBreakoutRow({
      tvSymbol: "TWSE:2330",
      name: "2330",
      description: "TSMC",
      close: 110,
      fastEma: null,
      slowEma: 103,
      trendEma: 100,
      rsi: 65,
      tradedValue: 150_000_000,
      prevFastEma: 101,
      prevSlowEma: 101,
      fastEma2: 99,
      slowEma2: 100,
      minTurnover: 100_000_000,
      minRsi: 70,
      maxCrossAgeDays: 3,
      minRelativeVolumeMultiplier: 2,
      volume: 2_000_000,
      avgVolume: 900_000,
      marketCap: 1_000_000_000,
    });
    expect(invalid).toBeNull();
  });
});
