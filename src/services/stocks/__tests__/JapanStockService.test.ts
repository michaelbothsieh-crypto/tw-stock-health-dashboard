import { describe, expect, it } from "vitest";
import { formatJapanStockName } from "@/services/stocks/JapanStockService";

describe("formatJapanStockName", () => {
  it("keeps the Yahoo company name for Japanese stock cards", () => {
    expect(
      formatJapanStockName("6981.T", "Murata Manufacturing Co., Ltd.", "MURATA MANUFACTURING CO"),
    ).toBe("Murata Manufacturing");
  });

  it("falls back to the symbol when Yahoo does not provide a company name", () => {
    expect(formatJapanStockName("6981.T", "", "")).toBe("6981.T");
  });
});
