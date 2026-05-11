import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsStockService } from "@/services/stocks/UsStockService";
import { yf } from "@/infrastructure/providers/yahooFinanceClient";
import { renderStockChart } from "@/shared/utils/chartRenderer";

vi.mock("@/infrastructure/providers/yahooFinanceClient", () => ({
  yf: {
    quote: vi.fn(),
    quoteSummary: vi.fn(),
    chart: vi.fn(),
    search: vi.fn(),
  },
}));

vi.mock("@/infrastructure/providers/tradingViewFetch", () => ({
  getTvLatestNewsHeadline: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/infrastructure/providers/tradingViewRating", () => ({
  fetchTradingViewRating: vi.fn().mockResolvedValue("Neutral"),
  TV_RATING_ZH: { Neutral: "中性" },
}));

vi.mock("@/shared/utils/chartRenderer", async () => {
  const actual = await vi.importActual<typeof import("@/shared/utils/chartRenderer")>("@/shared/utils/chartRenderer");
  return {
    ...actual,
    renderStockChart: vi.fn().mockResolvedValue(Buffer.from("chart")),
  };
});

describe("UsStockService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(yf.quote).mockResolvedValue({
      regularMarketPrice: 52.8,
      regularMarketChangePercent: 13.43,
      regularMarketChange: 6.25,
      regularMarketVolume: 123456,
      longName: "DRAM",
      shortName: "DRAM",
      marketState: "REGULAR",
    } as any);
    vi.mocked(yf.quoteSummary).mockResolvedValue({ assetProfile: { sector: "Technology" } } as any);
    vi.mocked(yf.chart).mockResolvedValue({
      quotes: [
        { date: new Date("2026-05-07T00:00:00.000Z"), open: 46, high: 48, low: 45, close: 47, volume: 1000 },
        { date: new Date("2026-05-08T00:00:00.000Z"), open: 48, high: 53, low: 47, close: 52.8, volume: 2000 },
      ],
    } as any);
    vi.mocked(yf.search).mockResolvedValue({ news: [] } as any);
  });

  it("renders US charts from Yahoo history without downloading Finviz images", async () => {
    const card = await UsStockService.fetchLiveCard("DRAM");

    expect(card?.chartBuffer?.toString()).toBe("chart");
    expect(yf.chart).toHaveBeenCalledWith("DRAM", expect.objectContaining({ interval: "1d" }));
    expect(renderStockChart).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ close: 52.8 })]),
      expect.anything(),
      expect.anything(),
      "DRAM",
      180,
      expect.objectContaining({ chgPct: 13.43 }),
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
