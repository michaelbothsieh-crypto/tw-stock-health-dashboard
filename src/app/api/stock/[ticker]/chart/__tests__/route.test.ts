import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/stock/[ticker]/chart/route";
import { yf } from "@/infrastructure/providers/yahooFinanceClient";
import { renderStockChart } from "@/shared/utils/chartRenderer";

vi.mock("@/shared/utils/market", () => ({
  detectMarket: vi.fn().mockResolvedValue({ market: "NASDAQ", yahoo: "DRAM", ambiguous: false }),
  isMarketOpen: vi.fn().mockReturnValue(false),
}));

vi.mock("@/shared/utils/range", () => ({
  fetchRecentBars: vi.fn(),
}));

vi.mock("@/infrastructure/providers/redisCache", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/infrastructure/providers/fugleQuote", () => ({
  fetchFugleQuote: vi.fn(),
}));

vi.mock("@/infrastructure/providers/yahooFinanceClient", () => ({
  yf: {
    quote: vi.fn(),
    chart: vi.fn(),
  },
}));

vi.mock("@/shared/utils/chartRenderer", async () => {
  const actual = await vi.importActual<typeof import("@/shared/utils/chartRenderer")>("@/shared/utils/chartRenderer");
  return {
    ...actual,
    renderStockChart: vi.fn().mockResolvedValue(Buffer.from("png")),
  };
});

describe("GET /api/stock/[ticker]/chart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(yf.chart).mockResolvedValue({
      quotes: [
        { date: new Date("2026-05-07T00:00:00.000Z"), open: 46, high: 48, low: 45, close: 47, volume: 1000 },
        { date: new Date("2026-05-08T00:00:00.000Z"), open: 48, high: 53, low: 47, close: 52.8, volume: 2000 },
      ],
    } as any);
    vi.mocked(yf.quote).mockResolvedValue({
      regularMarketPrice: 52.8,
      regularMarketDayHigh: 53,
      regularMarketDayLow: 47,
      regularMarketOpen: 48,
      regularMarketVolume: 2000,
    } as any);
  });

  it("renders US chart images from Yahoo history instead of proxying Finviz", async () => {
    const response = await GET(
      new NextRequest("https://stocks.example.com/api/stock/DRAM/chart"),
      { params: Promise.resolve({ ticker: "DRAM" }) },
    );

    expect(response.status).toBe(200);
    expect(yf.chart).toHaveBeenCalledWith("DRAM", expect.objectContaining({ interval: "1d" }));
    expect(renderStockChart).toHaveBeenCalled();
    const [chartData, _support, _resistance, symbol, visibleCount, options] = vi.mocked(renderStockChart).mock.calls[0];
    expect(chartData).toEqual(expect.arrayContaining([expect.objectContaining({ close: 52.8 })]));
    expect(symbol).toBe("DRAM");
    expect(visibleCount).toBe(180);
    expect(options).toEqual({});
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
