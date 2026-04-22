
import { StockCard } from "./stocks/types";
import { TaiwanStockService } from "./stocks/TaiwanStockService";
import { UsStockService } from "./stocks/UsStockService";
import { JapanStockService } from "./stocks/JapanStockService";

export type { StockCard };

/**
 * StockService Facade (符合 SOLID SRP 與 Facade Pattern)
 * 將不同市場的抓取邏輯委派給專屬的 Sub-Service。
 */
export class StockService {
   static getSnapshotBaseUrl(override?: string): string {
      return override || process.env.BOT_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";
   }

   /**
    * 抓取即時台股卡片
    */
   static async fetchLiveStockCard(query: string, overrideBaseUrl?: string, skipHeavy = false, skipQuote = false): Promise<StockCard | null> {
      return TaiwanStockService.fetchLiveCard(query, overrideBaseUrl, skipHeavy, skipQuote);
   }

   /**
    * 抓取即時美股卡片
    */
   static async fetchLiveUsStockCard(ticker: string, overrideBaseUrl?: string, skipHeavy = false, skipQuote = false): Promise<StockCard | null> {
      return UsStockService.fetchLiveCard(ticker, overrideBaseUrl, skipHeavy, skipQuote);
   }

   /**
    * 抓取即時日股卡片
    */
   static async fetchLiveJpStockCard(ticker: string, overrideBaseUrl?: string, skipHeavy = false, skipQuote = false): Promise<StockCard | null> {
      return JapanStockService.fetchLiveCard(ticker, overrideBaseUrl, skipHeavy, skipQuote);
   }
}
