
import { StockCard } from "./StockService";
import { getTacticalPlaybook } from "@/domain/ai/playbookAgent";
import { escapeHtml, formatPrice, formatSignedPct, buildNewsLine, buildStanceText, humanizeNumber } from "@/shared/utils/formatters";

export class MessageService {
   /**
    * 產生結構化的基本資訊行 (共用邏輯)
    */
   static buildStockCardLines(card: StockCard, verdict: string = "數據整理中"): string {
      const symbol = escapeHtml(card.symbol);
      const nameZh = escapeHtml(card.nameZh);
      const vText = escapeHtml(verdict);
      
      const title = (nameZh && nameZh !== symbol) ? `${symbol} ${nameZh}` : symbol;

      const lines = [
         `<b>${title} [${vText}]</b>`,
         `【現價】 ${formatPrice(card.close, 2)}（${formatSignedPct(card.chgPct, 2)}）${card.marketStatusLabel || ""}${card.isPriceRealTime === false ? "　⚠️延遲報價" : ""}`,
         `【技術】 ${card.tvRating || "—"}`,
         `【產業】 ${card.industry || "—"}`,
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

   /**
    * SSOT: 統一獲取 AI 洞察 (定見與摘要)
    * 確保單筆與多筆查詢背後的 AI 判斷標準完全一致
    */
   private static async resolveAIInsight(card: StockCard): Promise<{ verdict: string; caption: string }> {
      // 1. 如果已經有快取的 AI 定見，直接使用
      if (card.snapshotVerdict && card.snapshotPlaybookCaption) {
         return { verdict: card.snapshotVerdict, caption: card.snapshotPlaybookCaption };
      }

      // 2. 否則觸發 AI Agent 進行判斷 (與單筆輸入完全一樣的邏輯)
      const stanceText = buildStanceText(card.shortDir, card.strategySignal, card.confidence, card.chgPct);
      
      try {
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
            recentTrend: `今日股價表現：現價 ${card.close}，漲跌幅 ${card.chgPct?.toFixed(2)}% (${card.chgPct && card.chgPct > 9.5 ? '強勢漲停' : '趨勢強勁'})，成交量：${humanizeNumber(card.volume)}${card.flowUnit}，技術評分：${card.tvRating}。`,
            trustLots: card.trustLots || 0,
            shortLots: card.shortLots || 0,
            marginLots: card.marginLots || 0,
            institutionalLots: card.institutionalLots || 0,
            insiderTransfers: card.insiderSells,
            recentNews: card.recentNews || (card.newsLine && card.newsLine !== "—" ? [card.newsLine] : []),
         });

         const verdict = playbook?.verdict || stanceText;
         const caption = playbook?.telegramCaption || playbook?.tacticalScript || "";
         
         // 寫回 card 以供後續使用
         card.snapshotVerdict = verdict;
         card.snapshotPlaybookCaption = caption;

         return { verdict, caption };
      } catch (e) {
         return { verdict: stanceText, caption: "" };
      }
   }

   /**
    * 產出多筆查詢時的一行摘要
    */
   static async buildStockSummaryLine(card: StockCard): Promise<string> {
      const symbol = escapeHtml(card.symbol);
      const nameZh = escapeHtml(card.nameZh);
      const title = (nameZh && nameZh !== symbol) ? `${symbol} ${nameZh}` : symbol;
      const price = formatPrice(card.close, 2);
      const chg = formatSignedPct(card.chgPct, 2);
      const tech = card.tvRating || "—";
      
      // 使用 SSOT 獲取 AI 洞察
      const { caption } = await this.resolveAIInsight(card);
      
      // 擷取第一句，避免太長
      let aiBrief = caption || "";
      if (aiBrief && aiBrief.includes("。")) {
         aiBrief = aiBrief.split("。")[0] + "。";
      }

      return `<b>${title}</b> <code>${price}(${chg})</code> <b>[${tech}]</b>${aiBrief ? ` | ${escapeHtml(aiBrief)}` : ""}`;
   }

   /**
    * 產出單筆查詢時的完整卡片 (含 AI 分析)
    */
   static async buildStockCardWithAI(card: StockCard): Promise<string> {
      const { verdict, caption } = await this.resolveAIInsight(card);
      const structuredPart = this.buildStockCardLines(card, verdict);
      
      return caption ? `${structuredPart}\n\n💬 ${escapeHtml(caption)}` : structuredPart;
   }
}
