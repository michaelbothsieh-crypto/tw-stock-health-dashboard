
import { resolveCodeFromInputLocal } from "@/features/telegram/utils";
import { StockService } from "@/services/StockService";
import { StockCard } from "@/services/stocks/types";

export type MarketType = 'taiwan' | 'us' | 'japan';

/**
 * TickerResolver
 * 實作策略模式中的 Context，負責偵測輸入代號所屬的市場並調用對應服務。
 */
export class TickerResolver {
   static async resolve(query: string, baseUrl?: string, skipH = false, skipQ = false): Promise<StockCard | null> {
      const cleanT = query.trim().toUpperCase();
      
      // 1. 偵測市場類型
      const isTaiwan = /^[0-9]{4,6}$/.test(cleanT) || cleanT.includes('.TW') || cleanT.includes('.TWO');
      const isUs = /^[A-Z]{1,5}$/.test(cleanT);
      const isJapan = /^[0-9]{4}\.T$/.test(cleanT);
      
      // 2. 名稱解析 (僅限台股)
      const resolvedTaiwan = !isTaiwan && !isUs && !isJapan ? resolveCodeFromInputLocal(query) : null;

      // 3. 執行抓取
      if (isJapan) {
         return await StockService.fetchLiveJpStockCard(cleanT, baseUrl, skipH, skipQ);
      }

      if (isTaiwan || resolvedTaiwan) {
         const card = await StockService.fetchLiveStockCard(resolvedTaiwan || cleanT, baseUrl, skipH, skipQ);
         // 4. Fallback 邏輯：台股查無此號但符合日股編號規則
         if (!card && /^[0-9]{4}$/.test(cleanT)) {
            return await StockService.fetchLiveJpStockCard(cleanT, baseUrl, skipH, skipQ);
         }
         return card;
      }

      if (isUs) {
         return await StockService.fetchLiveUsStockCard(cleanT, baseUrl, skipH, skipQ);
      }
      
      return null;
   }
}
