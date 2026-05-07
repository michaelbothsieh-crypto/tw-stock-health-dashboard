import { describe, expect, it } from "vitest";
import {
  getFirstNewsTitle,
  getRichNewsLinks,
  getRichNewsList,
  selectNewsByRecency,
  selectRelevantNewsByRecency,
} from "@/shared/utils/news";

const unrelatedYahooArticle = {
  title: "1 of Wall Street's Favorite Stock Worth Your Attention and 2 Facing Challenges",
  url: "https://finance.yahoo.com/markets/stocks/articles/1-wall-street-favorite-stock-015655742.html",
  providerPublishTime: Date.now() / 1000,
};

const yangMingArticle = {
  title: "揚明光量能放大，主力買盤回溫",
  url: "https://example.com/3504-news",
  providerPublishTime: Date.now() / 1000,
};

describe("news relevance helpers", () => {
  it("filters unrelated Yahoo articles for Taiwan stocks", () => {
    const aliases = ["3504", "揚明光"];
    const news = [unrelatedYahooArticle, yangMingArticle];

    expect(getRichNewsLinks(news, 1, aliases, false)).toEqual([
      { title: yangMingArticle.title, url: yangMingArticle.url },
    ]);
    expect(getFirstNewsTitle(news, aliases, false)).toBe(yangMingArticle.title);
    expect(getRichNewsList(news, aliases, false)).toEqual([yangMingArticle.title]);
  });

  it("keeps Taiwan stock news that mentions the numeric ticker", () => {
    const tickerArticle = {
      title: "3504 今日成交量創波段新高",
      url: "https://example.com/ticker-news",
    };

    expect(getRichNewsLinks([tickerArticle], 1, ["3504", "揚明光"], false)).toEqual([
      { title: tickerArticle.title, url: tickerArticle.url },
    ]);
  });

  it("falls back to older provider RSS news when no three-day item exists", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const rssArticle = {
      title: "【公告】信昌電董事會決議股利分派",
      link: "https://tw.stock.yahoo.com/news/6173-dividend.html",
      date: eightDaysAgo,
    };
    const staleArticle = {
      title: "【公告】信昌電前月營收公告",
      link: "https://tw.stock.yahoo.com/news/6173-stale.html",
      date: twentyDaysAgo,
    };

    expect(selectNewsByRecency([rssArticle, staleArticle], 3, 14)).toEqual([rssArticle]);
  });

  it("ignores unrelated recent news before deciding whether to use fallback news", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const unrelatedRecent = {
      title: "Shell: Q1 Earnings Snapshot",
      providerPublishTime: oneHourAgo,
    };
    const fallbackArticle = {
      title: "【公告】信昌電董事會決議股利分派",
      date: eightDaysAgo,
    };

    expect(selectRelevantNewsByRecency(
      [unrelatedRecent, fallbackArticle],
      ["6173", "信昌電"],
      false,
      3,
      14,
    )).toEqual([fallbackArticle]);
  });
});
