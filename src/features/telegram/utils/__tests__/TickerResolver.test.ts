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
});
