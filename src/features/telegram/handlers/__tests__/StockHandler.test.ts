import { describe, expect, it } from "vitest";
import { parseStockQueryTickers } from "@/features/telegram/handlers/StockHandler";

describe("parseStockQueryTickers", () => {
  it("normalizes and deduplicates Taiwan code/name pairs", () => {
    expect(parseStockQueryTickers("2454, 聯發科")).toEqual(["2454"]);
  });

  it("keeps distinct market inputs in order", () => {
    expect(parseStockQueryTickers("2454, NVDA, 7203.T")).toEqual(["2454", "NVDA", "7203.T"]);
  });
});
