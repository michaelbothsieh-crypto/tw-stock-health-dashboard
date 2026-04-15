import { yf as yahooFinance } from "./yahooFinanceClient";
import { startOfYear, endOfDay } from "date-fns";
import { twStockNames } from "../../data/twStockNames";

export interface EtfHolding {
  symbol: string;
  name: string;
  percent: number;
  ytdReturn: number | null;
}

export interface EtfFetchResult {
  symbol: string;
  name: string;
  holdings: EtfHolding[];
  isEtf: boolean;
  status: "success" | "no_holdings" | "not_found" | "api_error";
  asOfDate?: string;
  dividendYield?: number | null;
  oneYearReturn?: number | null;
  errorMsg?: string;
}

async function tryQuoteSummary(symbol: string) {
  // 加入 defaultKeyStatistics 這是台股 ETF 績效較常出現的地方
  return await yahooFinance.quoteSummary(symbol, {
    modules: ["topHoldings", "price", "summaryDetail", "fundProfile", "fundPerformance", "defaultKeyStatistics"]
  }).catch(() => null);
}

async function tryQuote(symbol: string) {
  const res = await yahooFinance.quote(symbol).catch(() => null);
  return Array.isArray(res) ? res[0] : res;
}

function formatHoldingName(yahooName: string, symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  let marketTag = "";
  let displayName = yahooName;

  if (upperSymbol.endsWith(".TW") || upperSymbol.endsWith(".TWO")) {
    marketTag = "(TW)";
    const pureCode = upperSymbol.split(".")[0];
    if (twStockNames[pureCode]) displayName = twStockNames[pureCode];
  } else if (upperSymbol.endsWith(".T")) {
    marketTag = "(JP)";
  } else if (upperSymbol.endsWith(".HK")) {
    marketTag = "(HK)";
  } else if (upperSymbol.endsWith(".SS") || upperSymbol.endsWith(".SZ")) {
    marketTag = "(CN)";
  } else if (upperSymbol.endsWith(".L")) {
    marketTag = "(UK)";
  } else if (upperSymbol.endsWith(".DE")) {
    marketTag = "(DE)";
  } else if (upperSymbol.endsWith(".SG")) {
    marketTag = "(SG)";
  } else if (!upperSymbol.includes(".")) {
    marketTag = "(US)";
  }

  const cleanName = displayName
    .replace(/ Co Ltd/gi, "").replace(/ Ltd/gi, "").replace(/ Inc/gi, "").replace(/ Corp/gi, "")
    .replace(/ Ordinary Shares/gi, "").replace(/ Class [A-Z]/gi, "").trim();

  return `${cleanName} ${marketTag}`.trim();
}

export async function fetchEtfTopHoldings(symbol: string): Promise<EtfFetchResult> {
  const pureCode = symbol.split(".")[0];
  const localName = twStockNames[pureCode];
  
  let currentSymbol = symbol;
  let summary = await tryQuoteSummary(currentSymbol);
  let quote = await tryQuote(currentSymbol);

  if (!quote && /^[0-9]/.test(pureCode)) {
    const altSymbol = currentSymbol.endsWith(".TW") ? currentSymbol.replace(".TW", ".TWO") : currentSymbol.replace(".TWO", ".TW");
    const altSummary = await tryQuoteSummary(altSymbol);
    const altQuote = await tryQuote(altSymbol);
    if (altQuote) {
      summary = altSummary;
      quote = altQuote;
      currentSymbol = altSymbol;
    }
  }

  const etfName = localName || summary?.price?.longName || quote?.longName || quote?.shortName || pureCode;
  const isEtfLike = quote?.quoteType === "ETF" || quote?.quoteType === "MUTUALFUND" || !!summary?.topHoldings || !!localName;

  // 強化版績效抓取：依序嘗試不同欄位 (針對台美股差異)
  let dividendYield = (summary?.summaryDetail?.trailingAnnualDividendYield as number) || (summary?.summaryDetail?.yield as number);
  
  // 如果是台股 0.00%，有可能是 Yahoo 資料缺失或純粹未配息
  let oneYearReturn = (summary?.fundPerformance?.performanceOverview?.oneYearAnnualRollingReturn as number) || 
                     (summary?.defaultKeyStatistics?.ytdReturn as number) ||
                     (summary?.defaultKeyStatistics?.fiveYearAvgReturn as number);

  let asOfDateStr = "";
  if (summary?.topHoldings?.lastMarketDate) {
    const d = new Date(summary.topHoldings.lastMarketDate as any);
    asOfDateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('zh-TW') : "";
  }

  if (!quote && !localName) {
    return { symbol: pureCode, name: pureCode, holdings: [], isEtf: false, status: "not_found" };
  }

  try {
    const holdings = summary?.topHoldings?.holdings;
    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return { 
        symbol: pureCode, name: etfName, holdings: [], isEtf: isEtfLike, status: "no_holdings", asOfDate: asOfDateStr,
        dividendYield, oneYearReturn,
        errorMsg: quote?.quoteType === "MUTUALFUND" ? "此標的為共同基金/主動型 ETF，Yahoo 暫無公開持股明細。" : "目前 Yahoo Finance 尚未收錄此 ETF 的持股明細。"
      };
    }

    const now = new Date();
    const jan1st = startOfYear(now);
    
    const results = await Promise.all(holdings.slice(0, 10).map(async (h) => {
      let hSymbol = h.symbol;
      if (!hSymbol) return null;
      if (/^[0-9]{4}$/.test(hSymbol)) hSymbol = `${hSymbol}.TW`;

      let ytdReturn: number | null = null;
      try {
        const [hChart, hQuoteRes] = await Promise.all([
          yahooFinance.chart(hSymbol, { period1: jan1st, period2: endOfDay(new Date(jan1st.getTime() + 10 * 24 * 60 * 60 * 1000)), interval: "1d" }).catch(() => null),
          yahooFinance.quote(hSymbol).catch(() => null)
        ]);
        const history = hChart?.quotes || [];
        const startPrice = history.find(q => q.close !== null)?.close;
        const currentPrice = (Array.isArray(hQuoteRes) ? hQuoteRes[0] : hQuoteRes)?.regularMarketPrice;
        if (startPrice && currentPrice) ytdReturn = ((currentPrice - startPrice) / startPrice) * 100;
      } catch (err) { }

      return { symbol: hSymbol, name: formatHoldingName(h.holdingName || hSymbol, hSymbol), percent: (h.holdingPercent || 0) * 100, ytdReturn };
    }));

    return {
      symbol: pureCode, name: etfName, holdings: results.filter((r): r is EtfHolding => r !== null),
      isEtf: true, status: "success", asOfDate: asOfDateStr, dividendYield, oneYearReturn
    };
  } catch (err) {
    return { symbol: pureCode, name: etfName, holdings: [], isEtf: isEtfLike, status: "api_error", asOfDate: asOfDateStr, dividendYield, oneYearReturn };
  }
}
