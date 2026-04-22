
import { CommandHandler, CommandContext, BotReply } from "@/features/telegram/types";
import { MessageService } from "@/services/MessageService";
import { recordStockSearch } from "@/features/telegram/rankStore";
import { combineImages } from "@/shared/utils/chartRenderer";
import { escapeHtml } from "@/shared/utils/formatters";
import { TickerResolver } from "@/features/telegram/utils/TickerResolver";

/**
 * StockHandler (Controller Layer)
 * 負責解析使用者輸入、調度 Resolver 與 Formatter，最後回傳訊息。
 */
export class StockHandler implements CommandHandler {
  canHandle(command: string): boolean {
    return command === "/stock";
  }

  async handle(ctx: CommandContext): Promise<BotReply | null> {
    const { query, chatId, baseUrl } = ctx;
    if (!query) {
      return { text: "請輸入股票代號或名稱，例如:\n/stock 2330\n/stock NVDA\n/stock 7203.T (日股)\n/stock 台積電" };
    }

    const tickers = query.split(/[,，\s]+/).map(t => t.trim().toUpperCase()).filter(Boolean).slice(0, 10);

    // 單檔查詢模式
    if (tickers.length === 1) {
      const liveCard = await TickerResolver.resolve(tickers[0], baseUrl);
      if (liveCard && liveCard.close !== null) {
        if (chatId && liveCard.close) {
          await recordStockSearch(String(chatId), liveCard.symbol, liveCard.close).catch(() => null);
        }
        const finalMsg = await MessageService.buildStockCardWithAI(liveCard);
        return { text: finalMsg, chartBuffer: liveCard.chartBuffer };
      }
      return { text: `❌ 找不到「${tickers[0]}」的資料，請確認代號是否正確。` };
    }

    // 多檔查詢模式
    const cards = await Promise.all(tickers.map(t => TickerResolver.resolve(t, baseUrl, true, true)));
    const errorParts: string[] = [];
    const summaryLines: string[] = [];
    const buffers: Buffer[] = [];
    const validSymbols: string[] = [];

    for (let i = 0; i < tickers.length; i++) {
      const card = cards[i];
      if (!card) {
        errorParts.push(escapeHtml(`❌ ${tickers[i]}：找不到資料。`));
      } else {
        if (chatId && card.close) {
          await recordStockSearch(String(chatId), card.symbol, card.close).catch(() => null);
        }
        
        // 收集摘要文字 (使用 SSOT 獲取 AI 洞察)
        summaryLines.push(await MessageService.buildStockSummaryLine(card));

        if (card.chartBuffer) {
          buffers.push(card.chartBuffer);
          validSymbols.push(card.symbol);
        }
      }
    }

    // 處理圖表合併 (每 3 檔一張圖)
    const chartBuffers: Buffer[] = [];
    for (let i = 0; i < buffers.length; i += 3) {
      const chunk = buffers.slice(i, i + 3);
      const chunkSymbols = validSymbols.slice(i, i + 3);
      const combined = await combineImages(chunk, chunkSymbols);
      if (combined) chartBuffers.push(combined);
    }

    const finalTexts = [...summaryLines, ...errorParts];

    if (chartBuffers.length === 0 && finalTexts.length > 0) {
      return { text: finalTexts.join("\n") };
    }

    return { 
      text: finalTexts.length > 0 ? finalTexts.join("\n") : "", 
      chartBuffers 
    };
  }
}
