import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearMarketCache, detectMarket } from "../market";
import * as finmind from "../providers/finmind";

vi.mock("../providers/finmind", () => ({
  getStockInfo: vi.fn(),
}));

describe("detectMarket", () => {
  beforeEach(() => {
    clearMarketCache();
    vi.clearAllMocks();
  });

  it("detects TWSE market correctly and caches it", async () => {
    vi.mocked(finmind.getStockInfo).mockResolvedValueOnce({
      data: [{ stock_id: "2330", type: "twse", stock_name: "台積電" } as any],
      meta: { authUsed: "anon", fallbackUsed: false },
    });

    const result1 = await detectMarket("2330");
    expect(result1.market).toBe("TWSE");
    expect(result1.yahoo).toBe("2330.TW");
    expect(result1.ambiguous).toBe(false);
    expect(finmind.getStockInfo).toHaveBeenCalledTimes(1);

    const result2 = await detectMarket("2330");
    expect(result2).toEqual(result1);
    expect(finmind.getStockInfo).toHaveBeenCalledTimes(1);
  });

  it("detects TPEX market correctly", async () => {
    vi.mocked(finmind.getStockInfo).mockResolvedValueOnce({
      data: [{ stock_id: "3529", type: "tpex", stock_name: "力旺" } as any],
      meta: { authUsed: "anon", fallbackUsed: false },
    });

    const result = await detectMarket("3529");
    expect(result.market).toBe("TPEX");
    expect(result.yahoo).toBe("3529.TWO");
  });

  it("returns UNKNOWN if API fails or returns empty", async () => {
    vi.mocked(finmind.getStockInfo).mockRejectedValueOnce(new Error("API Error"));

    const result = await detectMarket("9999");
    expect(result.market).toBe("UNKNOWN");
    expect(result.yahoo).toBe("9999.TW");
  });

  it("returns UNKNOWN if type is unrecognized", async () => {
    vi.mocked(finmind.getStockInfo).mockResolvedValueOnce({
      data: [{ stock_id: "1234", type: "weird_type" } as any],
      meta: { authUsed: "anon", fallbackUsed: false },
    });

    const result = await detectMarket("1234");
    expect(result.market).toBe("UNKNOWN");
    expect(result.yahoo).toBe("1234.TW");
  });
});
