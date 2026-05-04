import { describe, expect, it } from "vitest";
import { parseGoodinfoAdjustedPriceRows } from "@/infrastructure/providers/goodinfoAdjustedPrice";

describe("parseGoodinfoAdjustedPriceRows", () => {
  it("parses adjusted OHLCV rows from Goodinfo table HTML", () => {
    const html = `
      <tr align='center'><td><nobr>'26/03/24</nobr></td><td><nobr>20.9</nobr></td><td><nobr>20.9</nobr></td><td><nobr>19.8</nobr></td><td><nobr>20.1</nobr></td><td><nobr>+0.02</nobr></td><td><nobr>+0.08</nobr></td><td><nobr>5.75</nobr></td><td><nobr>446.34</nobr></td><td><nobr>-0.72</nobr></td><td><nobr>9,701</nobr></td></tr>
      <tr align='center'><td><nobr>'26/03/31</nobr></td><td><nobr>19.7</nobr></td><td><nobr>19.9</nobr></td><td><nobr>19.1</nobr></td><td><nobr>19.3</nobr></td><td><nobr>-0.88</nobr></td><td><nobr>-4.37</nobr></td><td><nobr>3.87</nobr></td><td><nobr>19.24</nobr></td><td><nobr>0.1</nobr></td><td><nobr>317,429</nobr></td></tr>
    `;

    expect(parseGoodinfoAdjustedPriceRows(html)).toEqual([
      { date: "2026-03-24", open: 20.9, high: 20.9, low: 19.8, close: 20.1, volume: 9701000 },
      { date: "2026-03-31", open: 19.7, high: 19.9, low: 19.1, close: 19.3, volume: 317429000 },
    ]);
  });
});
