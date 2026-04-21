
import { CommandHandler, CommandContext, BotReply } from "../types";
import { fetchTopGainers } from "../legacyHelpers";
import { twStockNames } from "../../../data/twStockNames";

export class TrendRankHandler implements CommandHandler {
  canHandle(command: string): boolean {
    return command === "/twrank" || command === "/usrank";
  }

  async handle(ctx: CommandContext): Promise<BotReply | null> {
    const isUs = ctx.command === "/usrank";
    const market = isUs ? "america" : "taiwan";
    const gainers = await fetchTopGainers(market, 10);
    
    if (gainers.length === 0) return { text: `暫時無法取得${isUs ? "美股" : "台股"}漲幅排行資料。` };

    const textLines: string[] = [`🏆 <b>${isUs ? "美股" : "台股"}昨日漲幅前 10 名</b>`, ""];
    for (let i = 0; i < gainers.length; i++) {
       const g = gainers[i];
       const name = twStockNames[g.symbol] || "";
       const label = name ? `${name}(${g.symbol})` : g.symbol;
       textLines.push(`${i + 1}. ${label}: <b>+${g.change.toFixed(2)}%</b>`);
    }
    return { text: textLines.join("\n") };
  }
}
