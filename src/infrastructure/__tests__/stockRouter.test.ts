import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStockSnapshot } from "@/infrastructure/stockRouter";
import { getInstitutionalInvestors, getPriceDaily, getPriceDailyAdj } from "@/infrastructure/providers/finmind";
import { getGoodinfoAdjustedPriceDaily } from "@/infrastructure/providers/goodinfoAdjustedPrice";
import { yf } from "@/infrastructure/providers/yahooFinanceClient";

vi.mock("@/infrastructure/providers/finmind", () => ({
  getPriceDaily: vi.fn(),
  getPriceDailyAdj: vi.fn(),
  getInstitutionalInvestors: vi.fn().mockResolvedValue({ data: [] }),
  getMarginShort: vi.fn().mockResolvedValue({ data: [] }),
  getMonthlyRevenue: vi.fn().mockResolvedValue({ data: [] }),
  getTaiwanStockNews: vi.fn().mockResolvedValue({ data: [] }),
  getFugleTechnicalIndicators: vi.fn(),
  getFugleTechnicalIndicatorsTpex: vi.fn(),
  getPriceDailyUs: vi.fn(),
  getMonthlyRevenueUs: vi.fn(),
  getUsStockNews: vi.fn(),
  getInstitutionalInvestorsUs: vi.fn(),
}));

vi.mock("@/infrastructure/providers/tradingViewFetch", () => ({
  getTvTechnicalIndicators: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/infrastructure/providers/goodinfoAdjustedPrice", () => ({
  getGoodinfoAdjustedPriceDaily: vi.fn(),
}));

vi.mock("@/infrastructure/providers/yahooFinanceClient", () => ({
  yf: {
    chart: vi.fn(),
  },
}));

describe("fetchStockSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGoodinfoAdjustedPriceDaily).mockReset();
    delete process.env.STOCK_ROUTER_PROVIDER_TIMEOUT_MS;
  });

  it("uses regular FinMind prices without blocking on Goodinfo when adjusted prices are unavailable", async () => {
    const prices = [
      { date: "2026-05-07", open: 3400, high: 3500, low: 3390, close: 3480, volume: 1000 },
    ];
    vi.mocked(getPriceDailyAdj).mockResolvedValueOnce({ data: [] });
    vi.mocked(getPriceDaily).mockResolvedValueOnce({ data: prices });

    const snapshot = await fetchStockSnapshot({
      symbol: "2454",
      market: "TWSE",
      yahoo: "2454.TW",
      finmind: "2454",
      companyNameZh: "聯發科",
      displayName: "聯發科",
    });

    expect(snapshot.prices).toBe(prices);
    expect(getGoodinfoAdjustedPriceDaily).not.toHaveBeenCalled();
  });

  it("falls back to Goodinfo only when FinMind and Yahoo price sources are empty", async () => {
    const goodinfoPrices = [
      { date: "2026-05-07", open: 3400, high: 3500, low: 3390, close: 3480, volume: 1000 },
    ];
    vi.mocked(getPriceDailyAdj).mockResolvedValueOnce({ data: [] });
    vi.mocked(getPriceDaily).mockResolvedValueOnce({ data: [] });
    vi.mocked(getGoodinfoAdjustedPriceDaily).mockResolvedValueOnce(goodinfoPrices);

    const snapshot = await fetchStockSnapshot({
      symbol: "2454",
      market: "TWSE",
      yahoo: "2454.TW",
      finmind: "2454",
      companyNameZh: "聯發科",
      displayName: "聯發科",
    });

    expect(snapshot.prices).toBe(goodinfoPrices);
    expect(getGoodinfoAdjustedPriceDaily).toHaveBeenCalledWith("2454");
  });

  it("returns available prices when a non-critical provider times out", async () => {
    process.env.STOCK_ROUTER_PROVIDER_TIMEOUT_MS = "5";
    const prices = [
      { date: "2026-05-07", open: 3400, high: 3500, low: 3390, close: 3480, volume: 1000 },
    ];
    vi.mocked(getPriceDailyAdj).mockResolvedValueOnce({ data: [] });
    vi.mocked(getPriceDaily).mockResolvedValueOnce({ data: prices });
    vi.mocked(getInstitutionalInvestors).mockReturnValueOnce(new Promise(() => undefined) as any);

    const snapshot = await fetchStockSnapshot({
      symbol: "2454",
      market: "TWSE",
      yahoo: "2454.TW",
      finmind: "2454",
      companyNameZh: "聯發科",
      displayName: "聯發科",
    });

    expect(snapshot.prices).toBe(prices);
    expect(snapshot.warnings).toContain("institutional_timeout");
  });

  it("falls back to Yahoo chart prices when all Taiwan price providers are empty", async () => {
    vi.mocked(getPriceDailyAdj).mockResolvedValueOnce({ data: [] });
    vi.mocked(getPriceDaily).mockResolvedValueOnce({ data: [] });
    vi.mocked(getGoodinfoAdjustedPriceDaily).mockResolvedValueOnce([]);
    vi.mocked(yf.chart).mockResolvedValueOnce({
      quotes: [
        {
          date: new Date("2026-05-07T00:00:00.000Z"),
          open: 3400,
          high: 3500,
          low: 3390,
          close: 3480,
          volume: 1000,
        },
      ],
    } as any);

    const snapshot = await fetchStockSnapshot({
      symbol: "2454",
      market: "TWSE",
      yahoo: "2454.TW",
      finmind: "2454",
      companyNameZh: "聯發科",
      displayName: "聯發科",
    });

    expect(snapshot.prices).toEqual([
      { date: "2026-05-07", open: 3400, high: 3500, low: 3390, close: 3480, volume: 1000 },
    ]);
    expect(yf.chart).toHaveBeenCalledWith("2454.TW", expect.objectContaining({ interval: "1d" }));
  });
});
