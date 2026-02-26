import { describe, expect, it } from "vitest";
import { calculateFundamental } from "../fundamental";
import { MonthlyRevenue } from "../../providers/finmind";

describe("calculateFundamental", () => {
  function generateRevenueData(months: number, yoyGetter: (idx: number) => number): MonthlyRevenue[] {
    const data: MonthlyRevenue[] = [];
    let curYear = 2024;
    let curMonth = 1;

    for (let i = 0; i < months; i += 1) {
      data.push({
        date: `${curYear}-${String(curMonth).padStart(2, "0")}-01`,
        stock_id: "2330",
        revenue_year: curYear,
        revenue_month: curMonth,
        revenue: 1000000 * (1 + yoyGetter(i) / 100),
        revenue_year_on_year: yoyGetter(i),
      } as MonthlyRevenue);

      curMonth += 1;
      if (curMonth > 12) {
        curMonth = 1;
        curYear += 1;
      }
    }

    return data;
  }

  it("returns null if data length is less than 8 months", () => {
    const rev = generateRevenueData(7, () => 10);
    const result = calculateFundamental(rev);

    expect(result.fundamentalScore).toBeNull();
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("calculates a high score with consistent high growth", () => {
    const rev = generateRevenueData(8, () => 30);
    const result = calculateFundamental(rev);

    expect(result.fundamentalScore).not.toBeNull();
    expect(result.fundamentalScore!).toBeGreaterThanOrEqual(70);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("triggers rev_turn_negative risk when recent yoy turns negative", () => {
    const rev = generateRevenueData(8, (i) => (i < 5 ? 10 : -5));
    const result = calculateFundamental(rev);

    expect(result.risks).toContain("rev_turn_negative");
  });

  it("triggers growth_decelerating risk when trend3 <= -10", () => {
    const rev = generateRevenueData(8, (i) => {
      if (i >= 2 && i < 5) return 20;
      if (i >= 5) return 5;
      return 10;
    });

    const result = calculateFundamental(rev);
    expect(result.risks).toContain("growth_decelerating");
  });
});
