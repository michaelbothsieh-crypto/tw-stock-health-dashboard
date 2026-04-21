import { describe, expect, it } from "vitest";
import { calculateFlow } from "../flow";
import { InstitutionalInvestor, MarginShort } from "../../providers/finmind";

describe("calculateFlow", () => {
  function generateInstData(days: number, name: string, netBuy: number): InstitutionalInvestor[] {
    const data: InstitutionalInvestor[] = [];
    const today = new Date();

    for (let i = days; i >= 1; i -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split("T")[0],
        stock_id: "2330",
        name,
        buy: netBuy > 0 ? netBuy : 0,
        sell: netBuy < 0 ? -netBuy : 0,
      });
    }

    return data;
  }

  function generateMarginData(days: number, changeRate: number): MarginShort[] {
    const data: MarginShort[] = [];
    const today = new Date();
    const baseBalance = 10000;

    for (let i = days; i >= 1; i -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const fraction = (days - i) / (days - 1);
      const currentBalance = baseBalance * (1 + changeRate * fraction);

      data.push({
        date: date.toISOString().split("T")[0],
        stock_id: "2330",
        MarginPurchaseTodayBalance: currentBalance,
      });
    }

    return data;
  }

  it("returns null if unique trading dates are less than 30", () => {
    const inst = generateInstData(29, "Foreign_Investor", 100);
    const margin = generateMarginData(29, 0);
    const tradingDates = inst.map((d) => d.date).sort();

    const result = calculateFlow(tradingDates, inst, margin);

    expect(result.flowScore).toBeNull();
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("calculates flow score and net buy totals", () => {
    const instForeign = generateInstData(30, "Foreign_Investor", 100);
    const instTrust = generateInstData(30, "Investment_Trust", 50);
    const margin = generateMarginData(30, 0);
    const tradingDates = instForeign.map((d) => d.date).sort();

    const result = calculateFlow(tradingDates, [...instForeign, ...instTrust], margin);

    expect(result.flowScore).not.toBeNull();
    expect(result.foreign5D).toBe(500);
    expect(result.foreign20D).toBe(2000);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("triggers margin_spike risk when margin increases significantly", () => {
    const instForeign = generateInstData(30, "Foreign_Investor", 100);
    const instTrust = generateInstData(30, "Investment_Trust", 50);
    const margin = generateMarginData(30, 0.25);
    const tradingDates = instForeign.map((d) => d.date).sort();

    const result = calculateFlow(tradingDates, [...instForeign, ...instTrust], margin);

    expect(result.risks).toContain("margin_spike");
  });

  it("flags flow_data_missing risk when data missing ratio exceeds 20%", () => {
    const instTrust = generateInstData(30, "Investment_Trust", 50);
    const instForeignFull = generateInstData(30, "Foreign_Investor", 100);
    const tradingDates = instForeignFull.map((d) => d.date).sort();

    const instForeign = [...instForeignFull];
    instForeign.splice(instForeign.length - 10, 5);

    const margin = generateMarginData(30, 0);
    const result = calculateFlow(tradingDates, [...instForeign, ...instTrust], margin);

    expect(result.risks).toContain("flow_data_missing");
  });
});
