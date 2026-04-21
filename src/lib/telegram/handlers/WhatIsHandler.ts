
import { CommandHandler, CommandContext, BotReply } from "../types";
import { StockService } from "../StockService";
import { getStockWhatIs } from "../../ai/whatisAgent";

export class WhatIsHandler implements CommandHandler {
  canHandle(command: string): boolean {
    return command === "/whatis";
  }

  async handle(ctx: CommandContext): Promise<BotReply | null> {
    const { query, baseUrl } = ctx;
    if (!query) return { text: "請輸入公司名稱或代號，例如:\n/whatis 2330" };

    try {
       const isUs = /^[A-Z]{1,5}$/i.test(query);
       const liveCard = isUs 
         ? await StockService.fetchLiveUsStockCard(query, baseUrl) 
         : await StockService.fetchLiveStockCard(query, baseUrl);

       const result = await getStockWhatIs({
          ticker: liveCard?.symbol,
          stockName: liveCard?.nameZh || query,
          recentNews: liveCard?.recentNews,
          companyProfile: liveCard?.industry ? `該公司所屬產業為：${liveCard.industry}` : undefined,
       });
       return { text: result.telegramReply, chartBuffer: liveCard?.chartBuffer || null };
    } catch (err) {
       console.error("[WhatIsHandler] Error:", err);
       return { text: `抱歉，分析「${query}」時發生錯誤。`, chartBuffer: null };
    }
  }
}
