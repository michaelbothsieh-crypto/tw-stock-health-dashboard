import { beforeEach, describe, expect, it, vi } from "vitest";
import { TickerResolver } from "@/features/telegram/utils/TickerResolver";
import { StockService } from "@/services/StockService";

vi.mock("@/services/StockService", () => ({
  StockService: {
    fetchLiveStockCard: vi.fn(),
    fetchLiveUsStockCard: vi.fn(),
    fetchLiveJpStockCard: vi.fn(),
  },
}));

describe("TickerResolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves Taiwan stock names before fetching live stock cards", async () => {
    vi.mocked(StockService.fetchLiveStockCard).mockResolvedValueOnce(null);

    await TickerResolver.resolve("台玻", "https://stocks.example.com");

    expect(StockService.fetchLiveStockCard).toHaveBeenCalledWith(
      "1802",
      "https://stocks.example.com",
      false,
      false,
    );
  });

  it("resolves TPEX stock names before fetching live stock cards", async () => {
    vi.mocked(StockService.fetchLiveStockCard).mockResolvedValueOnce(null);

    await TickerResolver.resolve("信昌電", "https://stocks.example.com");

    expect(StockService.fetchLiveStockCard).toHaveBeenCalledWith(
      "6173",
      "https://stocks.example.com",
      false,
      false,
    );
  });

  it("does not fall back to Japan for known Taiwan numeric tickers", async () => {
    vi.mocked(StockService.fetchLiveStockCard).mockResolvedValueOnce(null);

    await TickerResolver.resolve("2454", "https://stocks.example.com");

    expect(StockService.fetchLiveStockCard).toHaveBeenCalledWith(
      "2454",
      "https://stocks.example.com",
      false,
      false,
    );
    expect(StockService.fetchLiveJpStockCard).not.toHaveBeenCalled();
  });

  it("keeps Japan fallback for unknown four-digit numeric tickers", async () => {
    vi.mocked(StockService.fetchLiveStockCard).mockResolvedValueOnce(null);

    await TickerResolver.resolve("7203", "https://stocks.example.com");

    expect(StockService.fetchLiveJpStockCard).toHaveBeenCalledWith(
      "7203",
      "https://stocks.example.com",
      false,
      false,
    );
  });
});
