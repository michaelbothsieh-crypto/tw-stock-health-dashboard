import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatJapanStockName, JapanStockService } from "@/services/stocks/JapanStockService";

const yahooMocks = vi.hoisted(() => ({
  quote: vi.fn(),
  quoteSummary: vi.fn(),
  chart: vi.fn(),
  search: vi.fn(),
}));

vi.mock("@/infrastructure/providers/yahooFinanceClient", () => ({
  yf: yahooMocks,
}));

vi.mock("@/infrastructure/providers/tradingViewFetch", () => ({
  getTvLatestNewsHeadline: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/infrastructure/providers/tradingViewRating", () => ({
  fetchTradingViewRating: vi.fn(),
  TV_RATING_ZH: {},
}));

describe("formatJapanStockName", () => {
  it("keeps the Yahoo company name for Japanese stock cards", () => {
    expect(
      formatJapanStockName("6981.T", "Murata Manufacturing Co., Ltd.", "MURATA MANUFACTURING CO"),
    ).toBe("Murata Manufacturing");
  });

  it("keeps the localized Yahoo long name when Japan locale returns it", () => {
    expect(formatJapanStockName("6981.T", "村田製作所", "MURATA MANUFACTURING CO")).toBe("村田製作所");
  });

  it("falls back to the symbol when Yahoo does not provide a company name", () => {
    expect(formatJapanStockName("6981.T", "", "")).toBe("6981.T");
  });
});

describe("JapanStockService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    yahooMocks.quote.mockResolvedValue({
      regularMarketPrice: 2840,
      regularMarketChangePercent: 1.2,
      regularMarketChange: 33,
      regularMarketVolume: 1000,
      longName: "村田製作所",
      shortName: "MURATA MANUFACTURING CO",
    });
    yahooMocks.quoteSummary.mockResolvedValue({ assetProfile: { sector: "Technology" } });
    yahooMocks.chart.mockResolvedValue({ quotes: [] });
    yahooMocks.search.mockResolvedValue({ news: [] });
  });

  it("requests Japanese Yahoo locale and uses the localized API name", async () => {
    const card = await JapanStockService.fetchLiveCard("6981", undefined, true, true);

    expect(yahooMocks.quote).toHaveBeenCalledWith("6981.T", { lang: "ja-JP", region: "JP" });
    expect(card?.nameZh).toBe("村田製作所");
  });
});
