import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchRecentBars } from "../range";
import * as finmind from "../providers/finmind";

vi.mock("../providers/finmind");

describe("fetchRecentBars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 180 bars if enough data is available in first try", async () => {
    const mockData = Array.from({ length: 200 }, (_, i) => {
      const d = new Date(2024, 0, i + 1);
      return {
        date: d.toISOString().split("T")[0],
        stock_id: "2330",
        Trading_Volume: 1000,
        open: 100,
        max: 105,
        min: 95,
        close: 100 + i,
      };
    });

    vi.mocked(finmind.getPriceDaily).mockResolvedValueOnce({
      data: mockData,
      meta: { authUsed: "anon", fallbackUsed: false },
    });

    const result = await fetchRecentBars("2330", 180);

    expect(finmind.getPriceDaily).toHaveBeenCalledTimes(1);
    expect(result.barsRequested).toBe(180);
    expect(result.barsReturned).toBe(180);
    expect(result.data.length).toBe(180);
    expect(result.data[179].close).toBe(299);
  });

  it("retries with expanding range if data is insufficient", async () => {
    const mockData1 = Array.from({ length: 100 }, () => ({ date: "2024-01-01", close: 100 })) as any[];
    const mockData2 = Array.from({ length: 185 }, () => ({ date: "2024-01-01", close: 100 })) as any[];

    vi.mocked(finmind.getPriceDaily)
      .mockResolvedValueOnce({ data: mockData1, meta: { authUsed: "anon", fallbackUsed: false } })
      .mockResolvedValueOnce({ data: mockData2, meta: { authUsed: "env", fallbackUsed: true } });

    const result = await fetchRecentBars("2330", 180);

    expect(finmind.getPriceDaily).toHaveBeenCalledTimes(2);
    expect(result.barsReturned).toBe(180);
  });

  it("returns what it has if max retries exceeded", async () => {
    const mockData = Array.from({ length: 50 }, () => ({ date: "2024-01-01", close: 100 })) as any[];

    vi.mocked(finmind.getPriceDaily).mockResolvedValue({
      data: mockData,
      meta: { authUsed: "anon", fallbackUsed: false },
    });

    const result = await fetchRecentBars("2330", 180);

    expect(finmind.getPriceDaily).toHaveBeenCalledTimes(3);
    expect(result.barsRequested).toBe(180);
    expect(result.barsReturned).toBe(50);
    expect(result.data.length).toBe(50);
  });

  it("filters out missing close prices", async () => {
    const mockData = [
      { date: "2024-01-01", close: 100 },
      { date: "2024-01-02", close: null },
      { date: "2024-01-03", close: undefined },
      { date: "2024-01-04", close: 105 },
    ] as any[];

    vi.mocked(finmind.getPriceDaily).mockResolvedValue({
      data: mockData,
      meta: { authUsed: "anon", fallbackUsed: false },
    });

    const result = await fetchRecentBars("2330", 4);

    expect(result.barsReturned).toBe(2);
    expect(result.data[0].date).toBe("2024-01-01");
    expect(result.data[1].date).toBe("2024-01-04");
  });
});
