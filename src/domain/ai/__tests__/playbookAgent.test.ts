import { describe, expect, it } from "vitest";
import { generateRuleBasedPlaybook, type PlaybookContext } from "../playbookAgent";

const baseContext: PlaybookContext = {
  ticker: "2330",
  stockName: "台積電",
  price: 2440,
  support: 2435.25,
  resistance: null,
  macroRisk: 20,
  technicalTrend: "中立",
  flowScore: 50,
};

describe("generateRuleBasedPlaybook", () => {
  it("does not invent a zero resistance when the level is unavailable", () => {
    const playbook = generateRuleBasedPlaybook(baseContext);

    expect(playbook.tacticalScript).toContain("2435.25");
    expect(playbook.tacticalScript).toContain("壓力尚未形成可靠價位");
    expect(playbook.tacticalScript).not.toContain("0.00");
  });
});
