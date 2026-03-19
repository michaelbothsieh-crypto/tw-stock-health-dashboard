import { redis } from "../providers/redisCache";
import { callLLMWithFallback } from "./base";

export interface WhatIsContext {
  ticker?: string;
  stockName: string;
  recentNews?: string[];
  companyProfile?: string;
}

export interface WhatIsResult {
  businessSummary: string;
  recentNewsAnalysis: string;
  marketPosition: string;
  telegramReply: string;
}

export async function getStockWhatIs(ctx: WhatIsContext): Promise<WhatIsResult> {
  const cacheKey = `whatis:v6:${ctx.ticker || ctx.stockName}`;

  if (redis) {
    try {
      const cached = await redis.get<WhatIsResult>(cacheKey);
      if (cached) return cached;
    } catch (e) {}
  }


  const prompt = `
你是一位資深財經分析師與產業專家。請針對：${ctx.stockName} ${ctx.ticker ? `(${ctx.ticker})` : ""} 進行深度解析。

【重要準則】
1. 務必確保業務描述與事實相符。
2. 嚴禁使用任何 Emoji、圖示或 Markdown 語法（例如不要使用星號 ** 或底線 _）。
3. 使用專業、精煉、具備商業洞察力的純文字語氣。

【輸出格式要求】
請回傳 JSON 格式。其中 telegramReply 需嚴格遵守以下排版：
- 每段標題格式為「標題名稱：」(例如：公司定位：)，不要加任何符號。
- 段落之間僅保留一個空行。
- 使用純文字，確保所有設備（包含行動裝置）都能清晰閱讀。

回覆內容需包含：
公司定位：說明其核心業務、獲利模式與競爭優勢。

熱點與新聞：總結近期動態與產業趨勢。

競爭與地位：說明其在產業中的位置及主要競爭對手。

分析點評：提供一針見血的投資觀察與風險提示。
`;


  let result: WhatIsResult;
  try {
    result = await callLLMWithFallback<WhatIsResult>(prompt, { jsonMode: true });
  } catch (err) {
    console.error("[WhatIsAgent] LLM failed", err);
    result = {
      businessSummary: `${ctx.stockName} 業務分析中。`,
      recentNewsAnalysis: "近期新聞整理中。",
      marketPosition: "產業地位確認中。",
      telegramReply: `抱歉，目前無法針對 ${ctx.stockName} 提供深度分析，請稍後再試。`
    };
  }

  if (redis && result) {
    try {
      await redis.set(cacheKey, result, { ex: 86400 }); // 快取 24 小時
    } catch (e) {}
  }

  return result;
}
