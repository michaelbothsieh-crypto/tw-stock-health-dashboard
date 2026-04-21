
import { CommandHandler, CommandContext, BotReply } from "@/features/telegram/types";
import { getTopRankedStocks } from "@/features/telegram/rankStore";
import { StockService } from "@/services/StockService";
import { twStockNames } from "@/data/twStockNames";
import { formatSignedPct } from "@/shared/utils/formatters";
import { renderRankChart } from "@/shared/utils/chartRenderer";

export class RankHandler implements CommandHandler {
  canHandle(command: string): boolean {
    return command === "/rank";
  }

  async handle(ctx: CommandContext): Promise<BotReply | null> {
    const { chatId, baseUrl } = ctx;
    if (!chatId) return { text: "無法辨識群組 ID，請在群組中使用。" };

    try {
      const ranks = await getTopRankedStocks(String(chatId));
      if (ranks.length === 0) return { text: "目前尚未有股票查詢紀錄。" };

      const lines: string[] = ["🏆 <b>本群熱門股票表現 (Top 10)</b>", ""];
      const chartData: { symbol: string; pct: number; count: number }[] = [];

      const results = await Promise.all(ranks.map(async (r, index) => {
        try {
          const live = await (r.symbol.match(/^[0-9]/) 
            ? StockService.fetchLiveStockCard(r.symbol, baseUrl, true) 
            : StockService.fetchLiveUsStockCard(r.symbol, baseUrl, true));
          
          if (!live || live.close === null) return `${index + 1}. <b>${r.symbol}</b> (取得報價失敗)`;
          
          const diff = live.close - r.initialPrice;
          const pct = (diff / r.initialPrice) * 100;
          chartData.push({ symbol: r.symbol, pct, count: r.count });

          const isTW = /^[0-9]+$/.test(r.symbol);
          const name = twStockNames[r.symbol] || (live.nameZh && live.nameZh !== r.symbol ? live.nameZh : "");
          const label = (isTW && name) ? `${name}(${r.symbol})` : r.symbol;
          return `${index + 1}. ${label}: <b>${formatSignedPct(pct, 2)}</b> (查詢時:${r.initialPrice.toFixed(2)} → 現價:${live.close.toFixed(2)})`;
        } catch (e: any) {
          return `${index + 1}. <b>${r.symbol}</b> (處理失敗)`;
        }
      }));

      chartData.sort((a, b) => b.pct - a.pct);
      const chartBuffer = await renderRankChart(chartData).catch(() => null);
      lines.push(...results);
      return { text: lines.join("\n"), chartBuffer };
    } catch (err: any) {
      console.error("[RankHandler] Major failure:", err);
      return { text: `排行榜產生失敗` };
    }
  }
}
