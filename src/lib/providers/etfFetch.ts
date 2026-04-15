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
  errorMsg?: string;
}

async function tryQuoteSummary(symbol: string) {
  // 增加 fundProfile 以利判定主動型基金
  return await yahooFinance.quoteSummary(symbol, {
    modules: ["topHoldings", "price", "summaryDetail", "fundProfile"]
  }).catch(() => null);
}

async function tryQuote(symbol: string) {
  const res = await yahooFinance.quote(symbol).catch(() => null);
  return Array.isArray(res) ? res[0] : res;
}

export async function fetchEtfTopHoldings(symbol: string): Promise<EtfFetchResult> {
  const pureCode = symbol.split(".")[0];
  const localName = twStockNames[pureCode];
  
  let currentSymbol = symbol;
  let summary = await tryQuoteSummary(currentSymbol);
  let quote = await tryQuote(currentSymbol);

  // Fallback 1: 嘗試反向後綴 (TW <-> TWO)
  if (!quote && /^[0-9]/.test(pureCode)) {
    const altSymbol = currentSymbol.endsWith(".TW") 
      ? currentSymbol.replace(".TW", ".TWO") 
      : currentSymbol.replace(".TWO", ".TW");
    
    const altSummary = await tryQuoteSummary(altSymbol);
    const altQuote = await tryQuote(altSymbol);
    
    if (altQuote) {
      summary = altSummary;
      quote = altQuote;
      currentSymbol = altSymbol;
    }
  }

  const etfName = summary?.price?.longName || quote?.longName || quote?.shortName || localName || pureCode;
  
  // 判定是否為 ETF 或基金
  // Yahoo 的 quoteType 有可能是 'ETF' 或 'MUTUALFUND'
  const isEtfLike = quote?.quoteType === "ETF" || quote?.quoteType === "MUTUALFUND" || !!summary?.topHoldings || !!localName;

  if (!quote && !localName) {
    return { symbol: pureCode, name: pureCode, holdings: [], isEtf: false, status: "not_found" };
  }

  try {
    const holdings = summary?.topHoldings?.holdings;
    
    // 如果沒有持股資料
    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return { 
        symbol: pureCode, 
        name: etfName, 
        holdings: [], 
        isEtf: isEtfLike, 
        status: "no_holdings",
        errorMsg: quote?.quoteType === "MUTUALFUND" ? "此標的為共同基金/主動型 ETF，Yahoo 暫無公開持股明細。" : "目前 Yahoo Finance 尚未收錄此 ETF 的持股明細。"
      };
    }

    // 有持股資料，開始計算 YTD
    const now = new Date();
    const jan1st = startOfYear(now);
    
    const results = await Promise.all(holdings.slice(0, 10).map(async (h) => {
      let hSymbol = h.symbol;
      if (!hSymbol) return null;

      // 修正台股持股代號格式 (有時 Yahoo 回傳的持股代號會掉後綴)
      if (/^[0-9]{4}$/.test(hSymbol)) {
        hSymbol = `${hSymbol}.TW`; // 預設先補上市，後續計算會自動嘗試
      }

      let ytdReturn: number | null = null;
      try {
        const [hChart, hQuoteRes] = await Promise.all([
          yahooFinance.chart(hSymbol, {
            period1: jan1st,
            period2: endOfDay(new Date(jan1st.getTime() + 10 * 24 * 60 * 60 * 1000)),
            interval: "1d"
          }).catch(() => null),
          yahooFinance.quote(hSymbol).catch(() => null)
        ]);

        const history = hChart?.quotes || [];
        const startPrice = history.find(q => q.close !== null)?.close;
        const currentPrice = (Array.isArray(hQuoteRes) ? hQuoteRes[0] : hQuoteRes)?.regularMarketPrice;

        if (startPrice && currentPrice) {
          ytdReturn = ((currentPrice - startPrice) / startPrice) * 100;
        }
      } catch (err) { }

      return {
        symbol: hSymbol,
        name: h.holdingName || hSymbol,
        percent: (h.holdingPercent || 0) * 100,
        ytdReturn
      };
    }));

    return {
      symbol: pureCode,
      name: etfName,
      holdings: results.filter((r): r is EtfHolding => r !== null),
      isEtf: true,
      status: "success"
    };
  } catch (err) {
    return { symbol: pureCode, name: etfName, holdings: [], isEtf: isEtfLike, status: "api_error" };
  }
}
