
import { StockCard } from "./stocks/types";
import { getTacticalPlaybook } from "@/domain/ai/playbookAgent";
import { buildStanceText, humanizeNumber } from "@/shared/utils/formatters";

export function buildRecentTrendText(card: StockCard): string {
   const chgPct = card.chgPct ?? 0;
   const volumeText = humanizeNumber(card.volume);
   const techText = card.tvRating || "—";

   let priceAction = "區間震盪";
   if (chgPct >= 9.5) priceAction = "強勢漲停";
   else if (chgPct >= 5) priceAction = "大漲收紅";
   else if (chgPct > 0) priceAction = "小幅上漲";
   else if (chgPct <= -9.5) priceAction = "重挫近跌停";
   else if (chgPct <= -5) priceAction = "重挫走跌";
   else if (chgPct < 0) priceAction = "小幅下跌";

   return `今日股價表現：現價 ${card.close}，漲跌幅 ${card.chgPct?.toFixed(2)}% (${priceAction})，成交量：${volumeText}${card.flowUnit}，技術評分：${techText}。`;
}

export function enforcePriceActionGuard(card: StockCard, insight: { verdict: string; caption: string }): { verdict: string; caption: string } {
   const chgPct = card.chgPct ?? 0;
   if (chgPct > -5) return insight;

   const bullishMismatch = /(爆量長紅|長紅|主力進場|主力發動|跟進|加碼|追價|續抱|走多)/.test(`${insight.verdict} ${insight.caption}`);
   if (!bullishMismatch) return insight;

   const verdict = chgPct <= -9.5 ? "重挫走跌，先防守" : "下跌轉弱，避免追價";
   const caption = chgPct <= -9.5
      ? `${card.nameZh} 今日重挫近跌停，技術買入只能當落後指標，先避開追價，等止跌再看。`
      : `${card.nameZh} 今日跌幅明顯，量大不是長紅進場訊號，先守風險，等價格止穩再評估。`;

   return { verdict, caption };
}

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
            recentTrend: buildRecentTrendText(card),
            trustLots: card.trustLots || 0,
            shortLots: card.shortLots || 0,
            marginLots: card.marginLots || 0,
            institutionalLots: card.institutionalLots || 0,
            insiderTransfers: card.insiderSells,
            recentNews: card.recentNews || (card.newsLine && card.newsLine !== "—" ? [card.newsLine] : []),
         });

         const verdict = playbook?.verdict || stanceText;
         let caption = playbook?.telegramCaption || playbook?.tacticalScript || "";
         
         // 全域過濾 Emoji 圖示，確保文字純粹 (SSOT 原則)
         caption = caption.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, "").trim();
         const guardedInsight = enforcePriceActionGuard(card, { verdict, caption });

         // 寫回 card 以利後續流程共用
         card.snapshotVerdict = guardedInsight.verdict;
         card.snapshotPlaybookCaption = guardedInsight.caption;

         return guardedInsight;
      } catch {
         return { verdict: stanceText, caption: "" };
      }
   }
}
