import { redis } from "../providers/redisCache";
import { InsiderTransfer } from "../providers/twseInsiderFetch";
import { callLLMWithFallback } from "./base";

export interface PlaybookContext {
  ticker: string;
  stockName: string;
  price: number;
  support: number;
  resistance: number;
  macroRisk: number; // 0-100
  technicalTrend: string; // e.g. "多頭延續", "空頭轉強"
  flowScore: number; // 0-100
  smartMoneyFlow?: number;
  retailSentiment?: number;
  flowVerdict?: string;
  institutionalLots?: number;
  trustLots?: number;
  marginLots?: number;
  shortLots?: number;
  insiderTransfers?: InsiderTransfer[];
  recentTrend?: string;
  recentNews?: string[];
}

export interface ActionPlaybook {
  verdict: string;
  verdictColor: "red" | "green" | "amber" | "slate";
  tacticalScript: string;  // 網站用：機構語氣，40-60字，無 emoji
  telegramCaption: string; // TG用：操盤手口吻，emoji，明確操作建議
  shortSummary: string;
  insiderComment?: string;
}

// Tier 3: Rule-based Fallback (深度優化版)
export function generateRuleBasedPlaybook(ctx: PlaybookContext): ActionPlaybook {
// 移除 console.log('🤖 Current AI Tier: Rule-based (Enhanced)');

  const fPrice = Number(ctx.price).toFixed(2);
  const fSupport = Number(ctx.support).toFixed(2);
  const fResistance = Number(ctx.resistance).toFixed(2);
  const trend = ctx.technicalTrend || "區間震盪";

  // 根據不同盤勢產生更具深度的分析內容
  let analysis = "";
  if (trend.includes("多") || trend.includes("積極")) {
    analysis = `近期股價表現強勢，目前維持在 ${fSupport} 之上的多頭結構。考量到市場對該產業的前景預期，若能放量站穩壓力位 ${fResistance}，則有望開啟新一輪攻勢，建議在支撐未破前維持偏多操作思維。`;
  } else if (trend.includes("空") || trend.includes("防守")) {
    analysis = `受限於近期市場利空因素干擾，股價走勢偏弱且在 ${fResistance} 附近遭遇明顯賣壓。當前應密切留意 ${fSupport} 支撐是否守住，若失守恐引發另一波價格修正，操作上建議提高現金水位並保守看待。`;
  } else {
    analysis = `股價目前處於 ${fSupport} 與 ${fResistance} 之間的盤整區間，市場多空力道呈現拉鋸，並在靜待下一個重大新聞時事帶動。在方向性未明確表態前，建議採取低買高賣的區間策略，並觀察近期走勢的突破跡象。`;
  }

  const tgCaption = trend.includes("多")
    ? `📈 ${ctx.stockName} 走多！守穩支撐 ${fSupport} 可續抱，目標看 ${fResistance}，破底停損勿戀戰。`
    : trend.includes("空")
      ? `📉 ${ctx.stockName} 偏空，壓力在 ${fResistance}，守不住 ${fSupport} 就跑，別接飛刀！`
      : `⚠️ ${ctx.stockName} 整理中，${fSupport}-${fResistance} 區間操作，等方向明確再出手。`;

  return {
    verdict: trend.includes("多") ? "偏多看待" : trend.includes("空") ? "偏空需防守" : "震盪整理",
    verdictColor: trend.includes("多") ? "red" : trend.includes("空") ? "green" : "slate",
    tacticalScript: analysis,
    telegramCaption: tgCaption,
    shortSummary: "區間整理中，靜待表態"
  };
}

export async function getTacticalPlaybook(ctx: PlaybookContext): Promise<ActionPlaybook> {
  const hourKey = Math.floor(Date.now() / 3600000);
  const cacheKey = `playbook:v3:${ctx.ticker}:${hourKey}`;

  // Check Global Cache
  if (redis) {
    try {
      const cached = await redis.get<ActionPlaybook>(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.warn("[Playbook] Cache read error");
    }
  }

  // --- Data Pre-processing ---
  const fPrice = Number(ctx.price).toFixed(2);
  const fSupport = Number(ctx.support).toFixed(2);
  const fResistance = Number(ctx.resistance).toFixed(2);
  const fFlow = Number(ctx.flowScore).toFixed(1);
  const fMacro = Number(ctx.macroRisk).toFixed(1);

  const prompt = `
你是一位擁有 20 年華爾街與台股實戰經驗的頂級避險基金操盤手。請為客戶深度 analysis 股票：${ctx.stockName} (${ctx.ticker})。
你的風格是「刁鑽、犀利、一針見血、不說廢話」。對於散戶的盲目樂觀或恐慌會直接點出盲點。

【客觀盤勢與價格數據】
- 現價: ${fPrice} (關鍵支撐: ${fSupport} / 關鍵壓力: ${fResistance})
- 近期走勢: ${ctx.recentTrend || "未提供"}

【籌碼面數據】(極度重要，請納入主觀判斷邏輯)
- 法人(外+投+自)近 5 日淨買賣: ${ctx.institutionalLots !== undefined ? `${ctx.institutionalLots} 張` : "無資料"}
- 投信近 5 日淨買賣: ${ctx.trustLots !== undefined ? `${ctx.trustLots} 張` : "無資料"}
- 融資變化 (散戶指標): ${ctx.marginLots !== undefined ? `${ctx.marginLots} 張` : "無資料"}
- 融券變化: ${ctx.shortLots !== undefined ? `${ctx.shortLots} 張` : "無資料"}
- 籌碼對抗結論: ${ctx.flowVerdict || "中立"}
- 內部人申讓警訊: ${ctx.insiderTransfers?.length ? ctx.insiderTransfers.map(i => `${i.declarer}(${i.role}) ${i.type} ${i.lots}張`).join(', ') : "無"}
- 系統環境風險: ${fMacro} (大於 80 時大盤崩盤風險極高，策略須極端保守)

【新聞驅動與事件】(必須判斷新聞題材是否真實發酵，或者只是主力倒貨的利多出盡)
- 判斷依據: 若有新聞且法人大買、股價漲，為「發酵中」；若新聞樂觀但法人賣超或跌破支撐，為「利多出盡/騙線」。
- 近期新聞標題與催化劑:
${ctx.recentNews && ctx.recentNews.length > 0 ? ctx.recentNews.map(n => `  * ${n}`).join('\n') : "  * (近期無顯著新聞)"}


任務：融合「技術價格行為」、「籌碼散戶與法人對峙」以及「新聞驅動熱度」，提出最犀利、充滿洞見的實戰解析。嚴格遵守字數限制！

【輸出要求】：請回傳 JSON 格式
{
  "verdict": "依據數據寫出戰略結論 (如: 利多出貨, 籌碼凌亂, 題材發酵 等)",
  "verdictColor": "red|green|amber|slate",
  "tacticalScript": "【網站用，約40~60字】：綜合股價、新聞與籌碼這三個維度分析背離或共振。不要重複念數字，應具備一針見血的獨特推論與防守點。無 emoji。",
  "telegramCaption": "【Telegram用，約30~50字】：開頭用一個 Emoji (📈📉⚠️💀)。語氣簡潔緊迫，直接點破主力與散戶戰況，並給出最粗暴的操作建議。",
  "shortSummary": "15字內極短戰術總結"
}
`;

  let result: ActionPlaybook | null = null;

  try {
    result = await callLLMWithFallback<ActionPlaybook>(prompt, { jsonMode: true });
  } catch (err) {
    console.error("[Playbook] LLM failed", err);
    result = generateRuleBasedPlaybook(ctx);
  }

  // Save to Cache
  if (redis && result) {
    try {
      await redis.set(cacheKey, result, { ex: 3600 });
    } catch (e) {
      console.warn("[Playbook] Cache write error");
    }
  }

  return result;
}
