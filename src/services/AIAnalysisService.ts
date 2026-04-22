
import { StockCard } from "./stocks/types";
import { getTacticalPlaybook } from "@/domain/ai/playbookAgent";
import { buildStanceText, humanizeNumber } from "@/shared/utils/formatters";

/**
 * AIAnalysisService (SSOT for AI Insights)
 * 負責所有股票分析的決策邏輯，確保全系統分析標準一致。
 */
export class AIAnalysisService {
   /**
    * 獲取統一的 AI 洞察 (定見與摘要)
    */
   static async resolveAIInsight(card: StockCard): Promise<{ verdict: string; caption: string }> {
      // 1. 優先使用現有快取
      if (card.snapshotVerdict && card.snapshotPlaybookCaption) {
         return { verdict: card.snapshotVerdict, caption: card.snapshotPlaybookCaption };
      }

      // 2. 準備 AI Agent 所需參數
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
         
         // 寫回 card 以利後續流程共用
         card.snapshotVerdict = verdict;
         card.snapshotPlaybookCaption = caption;

         return { verdict, caption };
      } catch (e) {
         return { verdict: stanceText, caption: "" };
      }
   }
}
