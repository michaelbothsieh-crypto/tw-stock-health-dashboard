
import { twStockNames } from "@/data/twStockNames";

export interface NormalizedTicker {
  symbol: string;
  market: 'TWSE' | 'TPEX' | 'NASDAQ' | 'NYSE' | 'AMEX' | 'UNKNOWN';
  yahoo: string;
  finmind: string;
  companyNameZh?: string;
  displayName?: string;
}

// 建立反向查詢表加速名稱解析
const reverseStockNames: Record<string, string> = {};
if (twStockNames) {
   Object.entries(twStockNames).forEach(([code, name]) => {
      reverseStockNames[name] = code;
   });
}

/**
 * 標準化股票代號與解析
 */
export function normalizeTicker(input: string): NormalizedTicker {
  const clean = input.trim().toUpperCase();
  const symbol = clean.replace(/\.(TW|TWO)$/i, "");
  
  // 簡易判定
  const isTW = /^[0-9]{4,6}$/.test(symbol) || symbol.endsWith("A") || symbol.endsWith("B");
  
  return {
    symbol,
    market: isTW ? 'TWSE' : 'NASDAQ', // 預設判定，後續由 detectMarket 修正
    yahoo: isTW ? (symbol.length > 4 ? `${symbol}.TWO` : `${symbol}.TW`) : symbol,
    finmind: symbol
  };
}

export function resolveCodeFromInputLocal(query: string): string | null {
   if (!query) return null;
   const q = query.trim().toUpperCase();

   // 1. 直接匹配代號
   if (/^[0-9A-Z]{2,6}(\.TW|\.TWO)?$/i.test(q)) {
      return q.replace(/\.(TW|TWO)$/i, "");
   }

   // 2. 透過名稱查詢
   if (reverseStockNames[q]) return reverseStockNames[q];

   // 3. 模糊匹配
   for (const [code, name] of Object.entries(twStockNames)) {
      if (name.includes(q) || q.includes(name)) return code;
   }

   return null;
}
