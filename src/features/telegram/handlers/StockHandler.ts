
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
          recordStockSearch(String(chatId), liveCard.symbol, liveCard.close).catch(() => null);
        }
        const finalMsg = await MessageService.buildStockCardWithAI(liveCard);
        return { text: finalMsg, chartBuffer: liveCard.chartBuffer };
      }
      return { text: `❌ 找不到「${tickers[0]}」的資料，請確認代號是否正確。` };
    }

    // 多檔查詢模式
    const cards = await Promise.all(tickers.map(t => TickerResolver.resolve(t, baseUrl, true, false)));

    // 並行處理所有 cards，結果保留原始順序
    const results = await Promise.all(tickers.map(async (ticker, i) => {
      const card = cards[i];
      if (!card) {
        return { error: escapeHtml(`❌ ${ticker}：找不到資料。`), summary: "", buffer: null, symbol: "" };
      }
      if (chatId && card.close) {
        recordStockSearch(String(chatId), card.symbol, card.close).catch(() => null);
      }
      const summary = await MessageService.buildStockSummaryLine(card);
      return { error: "", summary, buffer: card.chartBuffer ?? null, symbol: card.symbol };
    }));

    const summaryLines = results.filter(r => r.summary).map(r => r.summary);
    const errorParts = results.filter(r => r.error).map(r => r.error);
    const buffers = results.filter(r => r.buffer).map(r => r.buffer as Buffer);
    const validSymbols = results.filter(r => r.buffer).map(r => r.symbol);

    // 處理圖表合併 (每 3 檔一張圖，並行)
    const groups = Array.from({ length: Math.ceil(buffers.length / 3) }, (_, i) => ({
      chunk: buffers.slice(i * 3, i * 3 + 3),
      syms: validSymbols.slice(i * 3, i * 3 + 3),
    }));
    const chartBuffers = (await Promise.all(
      groups.map(g => combineImages(g.chunk, g.syms))
    )).filter((b): b is Buffer => b !== null && b !== undefined);

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
