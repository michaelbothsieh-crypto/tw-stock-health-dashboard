
import { CommandHandler, CommandContext, BotReply } from "@/features/telegram/types";
import { StockService } from "@/services/StockService";
import { MessageService } from "@/services/MessageService";
import { recordStockSearch } from "@/features/telegram/rankStore";
import { combineImages } from "@/shared/utils/chartRenderer";
import { escapeHtml } from "@/shared/utils/formatters";
import { resolveCodeFromInputLocal } from "@/features/telegram/utils";

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

    if (tickers.length === 1) {
      const liveCard = await this.processTicker(tickers[0], baseUrl);
      if (liveCard && liveCard.close !== null) {
        if (chatId && liveCard.close) {
          await recordStockSearch(String(chatId), liveCard.symbol, liveCard.close).catch(() => null);
        }
        const finalMsg = await MessageService.buildStockCardWithAI(liveCard);
        return { text: finalMsg, chartBuffer: liveCard.chartBuffer };
      }
      return { text: `❌ 找不到「${tickers[0]}」的資料，請確認代號是否正確。` };
    }

    // 多檔查詢
    const cards = await Promise.all(tickers.map(t => this.processTicker(t, baseUrl, true, true)));
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
        
        // 收集文字摘要 (現在是非同步呼叫)
        summaryLines.push(await MessageService.buildStockSummaryLine(card));

        if (card.chartBuffer) {
          buffers.push(card.chartBuffer);
          validSymbols.push(card.symbol);
        }
      }
    }

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

  private async processTicker(t: string, baseUrl?: string, skipH = false, skipQ = false) {
    const cleanT = t.trim().toUpperCase();
    
    // 1. 優先判斷是否為台股代號 (4-6位純數字, 或帶有 .TW/.TWO)
    const isTaiwanTicker = /^[0-9]{4,6}$/.test(cleanT) || cleanT.includes('.TW') || cleanT.includes('.TWO');
    
    // 2. 判斷是否為美股代號 (1-5位純字母)
    const isUsTicker = /^[A-Z]{1,5}$/.test(cleanT);

    // 3. 判斷是否為日股代號 (4位數字 + .T)
    const isJapanTicker = /^[0-9]{4}\.T$/.test(cleanT);

    // 4. 透過名稱解析 (僅限台股)
    const resolvedTaiwanTicker = !isTaiwanTicker && !isUsTicker && !isJapanTicker ? resolveCodeFromInputLocal(t) : null;

    if (isJapanTicker) {
      return await StockService.fetchLiveJpStockCard(cleanT, baseUrl, skipH, skipQ);
    }

    if (isTaiwanTicker || resolvedTaiwanTicker) {
      const card = await StockService.fetchLiveStockCard(resolvedTaiwanTicker || cleanT, baseUrl, skipH, skipQ);
      // 如果台股查不到，且代號是 4 位數字，嘗試日股
      if (!card && /^[0-9]{4}$/.test(cleanT)) {
        return await StockService.fetchLiveJpStockCard(cleanT, baseUrl, skipH, skipQ);
      }
      return card;
    } else if (isUsTicker) {
      return await StockService.fetchLiveUsStockCard(cleanT, baseUrl, skipH, skipQ);
    }
    
    return null;
  }
}
