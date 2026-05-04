import { PriceDaily } from "@/infrastructure/providers/finmind";

const GOODINFO_BASE = "https://goodinfo.tw/tw/ShowK_Chart.asp";

function stripTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, "")
    .trim();
}

function parseNumber(value: string): number {
  const normalized = value.replace(/,/g, "").replace(/[%+]/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: string): string | null {
  const match = value.match(/'?(\d{2})\/(\d{2})\/(\d{2})/);
  if (!match) return null;
  const [, yy, mm, dd] = match;
  return `20${yy}-${mm}-${dd}`;
}

export function parseGoodinfoAdjustedPriceRows(html: string): PriceDaily[] {
  const rows = html.match(/<tr align='center'>[\s\S]*?<\/tr>/g) || [];

  return rows
    .map((row) => {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => stripTags(m[1]));
      const date = parseDate(cells[0] || "");
      if (!date || cells.length < 11) return null;

      return {
        date,
        open: parseNumber(cells[1] || ""),
        high: parseNumber(cells[2] || ""),
        low: parseNumber(cells[3] || ""),
        close: parseNumber(cells[4] || ""),
        volume: parseNumber(cells[10] || "") * 1000,
      };
    })
    .filter((row): row is PriceDaily => !!row && row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getGoodinfoAdjustedPriceDaily(symbol: string): Promise<PriceDaily[]> {
  const query = new URLSearchParams({
    CHT_CAT: "DATE",
    PRICE_ADJ: "T",
    STOCK_ID: symbol,
  });
  const url = `${GOODINFO_BASE}?${query.toString()}`;
  const headers = {
    "User-Agent": "Mozilla/5.0",
    Referer: "https://goodinfo.tw/tw/",
  };

  const initRes = await fetch(url, { headers });
  const initHtml = await initRes.text();
  const reinit = initHtml.match(/REINIT=([0-9.]+)/)?.[1];

  if (!reinit) {
    return parseGoodinfoAdjustedPriceRows(initHtml);
  }

  const now = Date.now() / 86400000 + 25569;
  const cookie = `CLIENT_KEY=2.7|39075.7361700337|46853.5139478114|0|${now}|${now}|0`;
  const res = await fetch(`${url}&REINIT=${reinit}`, {
    headers: {
      ...headers,
      Cookie: cookie,
    },
  });

  return parseGoodinfoAdjustedPriceRows(await res.text());
}
