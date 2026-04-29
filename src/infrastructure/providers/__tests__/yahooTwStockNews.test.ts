import { describe, expect, it } from "vitest";
import { parseYahooTwStockNewsRss } from "../yahooTwStockNews";

describe("parseYahooTwStockNewsRss", () => {
  it("parses stock-specific Yahoo Taiwan RSS items", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>【公告】揚明光董事會決議不發放股利</title>
            <link>https://tw.stock.yahoo.com/news/example.html</link>
            <pubDate>Fri, 24 Apr 2026 08:04:01 GMT</pubDate>
            <description>公司名稱：揚明光(3504)</description>
          </item>
        </channel>
      </rss>`;

    expect(parseYahooTwStockNewsRss(xml)).toEqual([
      {
        title: "【公告】揚明光董事會決議不發放股利",
        link: "https://tw.stock.yahoo.com/news/example.html",
        date: "2026-04-24T08:04:01.000Z",
        description: "公司名稱：揚明光(3504)",
        source: "Yahoo奇摩股市",
      },
    ]);
  });
});
