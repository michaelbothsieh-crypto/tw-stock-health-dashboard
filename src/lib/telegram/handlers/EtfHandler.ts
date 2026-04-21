
import { CommandHandler, CommandContext, BotReply } from "../types";
import { formatSignedPct } from "../formatters";

export class EtfHandler implements CommandHandler {
  canHandle(command: string): boolean {
    return command === "/etf";
  }

  async handle(ctx: CommandContext): Promise<BotReply | null> {
    const { query } = ctx;
    if (!query) return { text: "請輸入 ETF 代號，例如: /etf 0050" };

    try {
      const { fetchEtfTopHoldings } = await import("../../providers/etfFetch");
      const result = await fetchEtfTopHoldings(query);
      if (!result) return { text: `找不到 ETF「${query}」的持股資料。` };

      const lines = [
        `📊 <b>${result.name} (${result.symbol}) 持股分析</b>`,
        // 修正型別問題：如果 result 沒 nav 就不顯示
        "",
        "<b>【前十大持股】</b>",
      ];

      result.holdings.forEach((h: any, index: number) => {
        const ytdText = h.ytdReturn !== null ? `(${formatSignedPct(h.ytdReturn, 2)})` : "(無資料)";
        lines.push(`${index + 1}. ${h.name} : ${h.percent.toFixed(2)}% ${ytdText}`);
      });

      lines.push("");
      if (result.asOfDate) {
        lines.push(`📅 資料更新日期：${result.asOfDate}`);
      }
      lines.push(`💡 YTD 代表持股年初至今的漲跌幅。`);

      return { text: lines.filter(Boolean).join("\n"), chartBuffer: null };
    } catch (err) {
      console.error("[EtfHandler] Error:", err);
      return { text: "抱歉，查詢 ETF 資料時發生錯誤。", chartBuffer: null };
    }
  }
}
