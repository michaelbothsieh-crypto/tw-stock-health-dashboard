import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROIHandler } from "@/features/telegram/handlers/ROIHandler";
import { StockService } from "@/services/StockService";
import { yf } from "@/infrastructure/providers/yahooFinanceClient";

vi.mock("@/services/StockService", () => ({
  StockService: {
    fetchLiveStockCard: vi.fn(),
    fetchLiveUsStockCard: vi.fn(),
  },
}));

vi.mock("@/infrastructure/providers/yahooFinanceClient", () => ({
  yf: {
    chart: vi.fn(),
  },
}));

vi.mock("@/shared/utils/chartRenderer", async () => {
  const actual = await vi.importActual<typeof import("@/shared/utils/chartRenderer")>("@/shared/utils/chartRenderer");
  return {
    ...actual,
    renderMultiRoiChart: vi.fn().mockResolvedValue(null),
  };
});

describe("ROIHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves Taiwan stock names before fetching ROI history", async () => {
    vi.mocked(StockService.fetchLiveStockCard).mockResolvedValueOnce({
      symbol: "3163",
      nameZh: "波若威",
      close: 1260,
      chgPct: null,
      chgAbs: null,
      volume: null,
      volumeVs5dPct: null,
      flowNet: null,
      flowUnit: "張",
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
      newsLine: "—",
      sourceLabel: "snapshot",
      insiderSells: [],
      chartBuffer: null,
      yahooSymbol: "3163.TWO",
      historyBars: [],
    });

    vi.mocked(yf.chart).mockResolvedValueOnce({
      quotes: [
        { date: new Date("2025-05-05"), close: 151.5 },
        { date: new Date("2026-05-05"), close: 1260 },
      ],
    } as unknown as Awaited<ReturnType<typeof yf.chart>>);

    const reply = await new ROIHandler().handle({
      command: "/roi",
      query: "波若威 1y",
      baseUrl: "https://stocks.example.com",
    });

    expect(StockService.fetchLiveStockCard).toHaveBeenCalledWith("3163", "https://stocks.example.com");
    expect(yf.chart).toHaveBeenCalledWith("3163.TWO", expect.any(Object));
    expect(reply?.text).toContain("波若威(3163)");
    expect(reply?.text).toContain("151.50 → 1260.00");
    expect(reply?.text).not.toContain("→ 現在");
    expect(reply?.text).not.toBe("找不到指定的股票歷史資料。");
  });

  it("falls back from a stale TW Yahoo symbol to TWO history for TPEX stocks", async () => {
    vi.mocked(StockService.fetchLiveStockCard).mockResolvedValueOnce({
      symbol: "3163",
      nameZh: "波若威",
      close: 1260,
      chgPct: null,
      chgAbs: null,
      volume: null,
      volumeVs5dPct: null,
      flowNet: null,
      flowUnit: "張",
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
      newsLine: "—",
      sourceLabel: "snapshot",
      insiderSells: [],
      chartBuffer: null,
      yahooSymbol: "3163.TW",
      historyBars: [],
    });

    vi.mocked(yf.chart)
      .mockRejectedValueOnce(new Error("No data found"))
      .mockResolvedValueOnce({
        quotes: [
          { date: new Date("2025-05-05"), close: 151.5 },
          { date: new Date("2026-05-05"), close: 1260 },
        ],
      } as unknown as Awaited<ReturnType<typeof yf.chart>>);

    const reply = await new ROIHandler().handle({ command: "/roi", query: "3163 1y" });

    expect(yf.chart).toHaveBeenNthCalledWith(1, "3163.TW", expect.any(Object));
    expect(yf.chart).toHaveBeenNthCalledWith(2, "3163.TWO", expect.any(Object));
    expect(reply?.text).toContain("波若威(3163)");
    expect(reply?.text).toContain("151.50 → 1260.00");
    expect(reply?.text).not.toContain("→ 現在");
    expect(reply?.text).not.toBe("找不到指定的股票歷史資料。");
  });
});
