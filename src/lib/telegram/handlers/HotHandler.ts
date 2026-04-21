
import { CommandHandler, CommandContext, BotReply } from "../types";
import { fetchYahooCommunityRank } from "../../providers/yahooRankFetch";
import { twStockNames } from "../../../data/twStockNames";
import { yf as yahooFinance } from "../../providers/yahooFinanceClient";
import { formatSignedPct } from "../formatters";

export class HotHandler implements CommandHandler {
  canHandle(command: string): boolean {
    return command === "/hot";
  }

  async handle(ctx: CommandContext): Promise<BotReply | null> {
    const { query } = ctx;
    const subType = query.toLowerCase();
    let type: 'all' | 'stock' | 'etf' = 'all';
    if (subType === 'etf') type = 'etf';
    else if (subType === 'stock' || subType === '股票') type = 'stock';

    const list = await fetchYahooCommunityRank(type);
    if (list.length === 0) return { text: "暫時無法取得 Yahoo 社群爆紅榜資料 (可能受限於存取頻率)。" };

    const title = type === 'etf' ? "ETF" : (type === 'stock' ? "股票" : "全部");
    const lines: string[] = [`🔥 <b>Yahoo 社群爆紅榜 - ${title}</b>`, ""];
    
    const enrichedList = await Promise.all(list.map(async item => {
       const name = twStockNames[item.symbol] || item.symbol;
       const q = await yahooFinance.quote(item.symbol).catch(() => null);
       const res: any = Array.isArray(q) ? q[0] : q;
       const price = res?.regularMarketPrice || null;
       return { ...item, name, price };
    }));

    enrichedList.forEach(item => {
       const priceText = item.price ? `<code>${item.price.toFixed(2)}</code>` : "—";
       lines.push(`${item.rank}. ${item.name} (${item.symbol}) ${priceText}`);
    });

    lines.push("");
    lines.push(`👉 <a href="https://tw.stock.yahoo.com/community/rank/active?type=${type}">查看完整榜單</a>`);

    return { text: lines.join("\n") };
  }
}
