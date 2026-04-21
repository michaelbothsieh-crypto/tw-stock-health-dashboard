
import { twStockNames } from "@/data/twStockNames";

// 建立反向查詢表加速名稱解析
const reverseStockNames: Record<string, string> = {};
if (twStockNames) {
   Object.entries(twStockNames).forEach(([code, name]) => {
      reverseStockNames[name] = code;
   });
}

export function resolveCodeFromInputLocal(query: string): string | null {
   if (!query) return null;
   const q = query.trim().toUpperCase();

   // 1. 直接匹配代號 (台股或美股)
   if (/^[0-9A-Z]{2,6}(\.TW|\.TWO)?$/i.test(q)) {
      return q;
   }

   // 2. 透過名稱查詢代號 (僅限台股)
   if (reverseStockNames[q]) {
      return reverseStockNames[q];
   }

   // 3. 模糊匹配 (針對台股股名)
   for (const [code, name] of Object.entries(twStockNames)) {
      if (name.includes(q) || q.includes(name)) {
         return code;
      }
   }

   return null;
}
