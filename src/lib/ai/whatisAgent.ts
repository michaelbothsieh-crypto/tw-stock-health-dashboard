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
  const cacheKey = `whatis:v8:${ctx.ticker || ctx.stockName}`;

  if (redis) {
    try {
      const cached = await redis.get<WhatIsResult>(cacheKey);
      if (cached) return cached;
    } catch (e) {}
  }

  const prompt = `
你是一位資深財經分析師。請針對：${ctx.stockName} ${ctx.ticker ? `(${ctx.ticker})` : ""} 進行深度分析。

【重要準則】
1. 務必確保業務描述精確。
2. 嚴禁使用任何 Emoji、圖示或 Markdown 符號。
3. 使用專業、精鍊的純文字語氣。

【排版規範】
1. 每段開頭為標題名稱（如 公司定位：）。
2. 段落與段落之間僅保留一個空行。
3. 嚴禁使用星號 ** 或底線 _。

【輸出要求】請回傳 JSON 格式：
{
  "businessSummary": "業務核心與獲利模式摘要 (約 80 字)",
  "recentNewsAnalysis": "近期新聞與趨勢 (約 80 字)",
  "marketPosition": "地位與競爭對手 (約 80 字)",
  "telegramReply": "公司定位：[內容]\n\n熱點與新聞：[內容]\n\n競爭與地位：[內容]\n\n分析點評：[內容]"
}
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
      telegramReply: `抱歉，目前無法針對 ${ctx.stockName} 提供分析，請稍後再試。`
    };
  }

  if (redis && result) {
    try {
      await redis.set(cacheKey, result, { ex: 86400 });
    } catch (e) {}
  }

  return result;
}
