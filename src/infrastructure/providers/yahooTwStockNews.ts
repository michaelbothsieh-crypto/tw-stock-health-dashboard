import { XMLParser } from "fast-xml-parser";

export interface YahooTwStockNewsItem {
  title: string;
  link: string;
  date: string;
  description?: string;
  source: "Yahoo奇摩股市";
}

type YahooRssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
};

type YahooRssDocument = {
  rss?: {
    channel?: {
      item?: YahooRssItem | YahooRssItem[];
    };
  };
};

export function parseYahooTwStockNewsRss(xml: string): YahooTwStockNewsItem[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml) as YahooRssDocument;
  const rawItems = data.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  const parsed: YahooTwStockNewsItem[] = [];

  for (const item of items) {
    const title = String(item.title || "").trim();
    const link = String(item.link || "").trim();
    const pubDate = String(item.pubDate || "").trim();
    if (!title || !link || !pubDate) continue;

    const date = new Date(pubDate);
    if (Number.isNaN(date.getTime())) continue;

    parsed.push({
      title,
      link,
      date: date.toISOString(),
      description: item.description,
      source: "Yahoo奇摩股市",
    });
  }

  return parsed;
}

export async function fetchYahooTwStockNews(yahooSymbol: string): Promise<YahooTwStockNewsItem[]> {
  const url = `https://tw.stock.yahoo.com/rss?s=${encodeURIComponent(yahooSymbol)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://tw.stock.yahoo.com/",
    },
  });

  if (!res.ok) return [];
  return parseYahooTwStockNewsRss(await res.text());
}
