
import { StockCard } from "./StockService";
import { AIAnalysisService } from "./AIAnalysisService";
import { escapeHtml, formatPrice, formatSignedPct } from "@/shared/utils/formatters";

/**
 * MessageService (View Layer / Presentation)
 * 僅負責將數據格式化為人類可讀的訊息字串。
 */
export class MessageService {
   /**
    * 產生結構化的基本資訊行
    */
   static buildStockCardLines(card: StockCard, verdict: string = "數據整理中"): string {
      const symbol = escapeHtml(card.symbol);
      const nameZh = escapeHtml(card.nameZh);
      const vText = escapeHtml(verdict);
      
      const title = (nameZh && nameZh !== symbol) ? `${symbol} ${nameZh}` : symbol;

      const newsSection = this.formatNewsSection(card);

      const lines = [
         `<b>${title} [${vText}]</b>`,
         `【現價】 ${formatPrice(card.close, 2)}（${formatSignedPct(card.chgPct, 2)}）${card.marketStatusLabel || ""}${card.isPriceRealTime === false ? "　⚠️延遲報價" : ""}`,
         `【技術】 ${card.tvRating || "—"}`,
         `【產業】 ${card.industry || "—"}`,
         ...newsSection,
      ];

      if (card.insiderSells && card.insiderSells.length > 0) {
         lines.push("");
         lines.push(`🚨 【內部人警訊】 近期高層申讓 ${card.insiderSells.length} 筆：`);
         card.insiderSells.slice(0, 2).forEach(sell => {
            const modeStr = escapeHtml(sell.humanMode || "拋售");
            const declarer = escapeHtml(sell.declarer);
            const role = escapeHtml(sell.role);
            lines.push(`  - ${declarer}(${role}) ${modeStr} ${sell.lots}張`);
         });
      }

      return lines.join("\n");
   }

   private static formatNewsSection(card: StockCard): string[] {
      if (card.newsLinks && card.newsLinks.length > 0) {
         const items = card.newsLinks.map(n =>
            `  • <a href="${n.url}">${escapeHtml(n.title)}</a>`
         );
         return [`【新聞】`, ...items];
      }
      return [`【新聞】 ${escapeHtml(card.newsLine || "—")}`];
   }

   /**
    * 產出多筆查詢時的一行摘要
    */
   static async buildStockSummaryLine(card: StockCard): Promise<string> {
      const symbol = escapeHtml(card.symbol);
      const nameZh = escapeHtml(card.nameZh);
      // 名稱處理邏輯已在 Service 層優化，此處僅做結構保護
      const title = (nameZh && nameZh !== symbol) ? nameZh : symbol;
      
      const price = formatPrice(card.close, 2);
      const chg = formatSignedPct(card.chgPct, 2);
      const tech = card.tvRating || card.shortDir || "中立";
      
      const { caption } = await AIAnalysisService.resolveAIInsight(card);
      
      let aiBrief = caption || "";
      if (aiBrief && aiBrief.includes("。")) {
         aiBrief = aiBrief.split("。")[0] + "。";
      }
      
      return `<b>${title}</b> <code>${price}(${chg})</code> <b>[${tech}]</b>${aiBrief ? ` | ${escapeHtml(aiBrief)}` : ""}`;
   }

   /**
    * 產出單筆查詢時的完整卡片
    */
   static async buildStockCardWithAI(card: StockCard): Promise<string> {
      const { verdict, caption } = await AIAnalysisService.resolveAIInsight(card);
      const structuredPart = this.buildStockCardLines(card, verdict);
      
      return caption ? `${structuredPart}\n\n💬 ${escapeHtml(caption)}` : structuredPart;
   }
}
