
import { CommandHandler, CommandContext, BotReply } from "@/features/telegram/types";
import { fetchYahooCommunityRank } from "@/infrastructure/providers/yahooRankFetch";
import { formatSignedPct } from "@/shared/utils/formatters";

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
    if (list.length === 0) return { text: "暫時無法取得 Yahoo 社群爆紅榜資料。" };

    const title = type === 'etf' ? "ETF" : (type === 'stock' ? "股票" : "全部");
    const lines: string[] = [`🔥 <b>Yahoo 社群爆紅榜 - ${title}</b>`, ""];
    
    const enrichedList = await Promise.all(list.map(async item => {
       // 強制透過 StockService 獲取最新準確報價
       const { yf } = await import("@/infrastructure/providers/yahooFinanceClient");
       const yahooSym = item.symbol.length > 4 ? `${item.symbol}.TWO` : `${item.symbol}.TW`;
       const q = await yf.quote(yahooSym).catch(() => null);
       const res: any = Array.isArray(q) ? q[0] : q;
       
       return { 
          ...item, 
          price: res?.regularMarketPrice || item.price,
          changePct: res?.regularMarketChangePercent || item.changePct
       };
    }));

    enrichedList.forEach(item => {
       const priceText = item.price ? `<code>${item.price.toFixed(2)}</code>` : "—";
       const pctText = item.changePct !== null ? formatSignedPct(item.changePct, 2) : "";
       lines.push(`${item.rank}. ${item.name} (${item.symbol}) ${priceText} ${pctText}`);
    });

    lines.push("");
    lines.push(`👉 <a href="https://tw.stock.yahoo.com/community/rank/active?type=${type}">查看完整榜單</a>`);

    return { text: lines.join("\n") };
  }
}
