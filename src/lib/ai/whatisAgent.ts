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
  const cacheKey = `whatis:v7:${ctx.ticker || ctx.stockName}`;

  if (redis) {
    try {
      const cached = await redis.get<WhatIsResult>(cacheKey);
      if (cached) return cached;
    } catch (e) {}
  }


  const prompt = `
你是一位資深財經分析師。請針對：${ctx.stockName} ${ctx.ticker ? `(${ctx.ticker})` : ""} 進行分析。

【重要準則】
1. 務必確保業務描述精確（例如瑞軒 2489 是顯示器 OEM，而非半導體）。
2. 嚴禁使用任何 Emoji、圖示或 Markdown 符號。
3. 使用專業、精鍊的純文字。

【排版規範 - 極度重要】
1. 每段開頭為「標題名稱：內容」。
2. 段落與段落之間「僅容許一個空行」（即兩個換行字元 \\n\\n）。
3. 嚴禁連續出現三個或以上的換行字元。
4. 結尾不要有額外的換行。

回覆內容包含：
公司定位：核心業務與競爭力。

熱點與新聞：近期動態。

競爭與地位：產業位置。

分析點評：投資建議。
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
