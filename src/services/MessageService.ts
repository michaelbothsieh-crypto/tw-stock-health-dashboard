
import { StockCard } from "./StockService";
import { getTacticalPlaybook } from "@/domain/ai/playbookAgent";
import { escapeHtml, formatPrice, formatSignedPct, buildNewsLine, buildStanceText } from "@/shared/utils/formatters";

export class MessageService {
   static buildStockCardLines(card: StockCard, verdict: string = "數據整理中"): string {
      const symbol = escapeHtml(card.symbol);
      const nameZh = escapeHtml(card.nameZh);
      const vText = escapeHtml(verdict);
      
      const title = (nameZh && nameZh !== symbol) ? `${symbol} ${nameZh}` : symbol;

      const lines = [
         `<b>${title} [${vText}]</b>`,
         `【現價】 ${formatPrice(card.close, 2)}（${formatSignedPct(card.chgPct, 2)}）${card.isPriceRealTime === false ? "　⚠️延遲報價" : ""}`,
         `【技術】 ${card.tvRating || "—"}`,
         `【新聞】 ${card.newsLine || "—"}`,
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

   static async buildStockCardWithAI(card: StockCard): Promise<string> {
      try {
         const stanceText = buildStanceText(card.shortDir, card.strategySignal, card.confidence, card.chgPct);
         
         if (card.snapshotPlaybookCaption) {
            const structuredPart = this.buildStockCardLines(card, card.snapshotVerdict || stanceText);
            return `${structuredPart}\n\n💬 ${escapeHtml(card.snapshotPlaybookCaption)}`;
         }

         const playbook = await getTacticalPlaybook({
            ticker: card.symbol,
            stockName: card.nameZh,
            price: card.close || 0,
            support: card.support || 0,
            resistance: card.resistance || 0,
            macroRisk: card.macroRisk ?? 0,
            technicalTrend: card.shortDir,
            flowScore: card.flowScore ?? 50,
            flowVerdict: card.shortDir,
            recentTrend: `今日股價表現：現價 ${card.close}，漲跌幅 ${card.chgPct?.toFixed(2)}% (${card.chgPct && card.chgPct > 9.5 ? '強勢漲停' : '趨勢強勁'})，技術評分：${card.tvRating}。`,
            trustLots: card.trustLots || 0,
            shortLots: card.shortLots || 0,
            marginLots: card.marginLots || 0,
            institutionalLots: card.institutionalLots || 0,
            insiderTransfers: card.insiderSells,
            recentNews: card.recentNews || (card.newsLine && card.newsLine !== "—" ? [card.newsLine] : []),
         });

         const structuredPart = this.buildStockCardLines(card, playbook?.verdict || stanceText);
         if (playbook) {
            const tgText = playbook.telegramCaption || playbook.tacticalScript;
            return `${structuredPart}\n\n💬 ${escapeHtml(tgText)}`;
         }
         return structuredPart;
      } catch (e) {
         return this.buildStockCardLines(card);
      }
   }
}
