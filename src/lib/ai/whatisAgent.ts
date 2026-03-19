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
  const cacheKey = `whatis:v4:${ctx.ticker || ctx.stockName}`;

  if (redis) {
    try {
      const cached = await redis.get<WhatIsResult>(cacheKey);
      if (cached) return cached;
    } catch (e) {}
  }


  const prompt = `
你是一位擁有 20 年資歷的頂級財經分析師與產業研究員。
請針對這間公司進行深度解析：${ctx.stockName} ${ctx.ticker ? `(${ctx.ticker})` : ""}。

【已知資料】
${ctx.companyProfile || "請根據你的知識庫提供該公司的業務核心、主要產品及營收來源。"}

【近期重大新聞】
${ctx.recentNews && ctx.recentNews.length > 0 ? ctx.recentNews.map(n => `* ${n}`).join('\n') : "近期無重大新聞，請根據產業近況進行推論。"}

【輸出要求】請嚴格回傳 JSON 格式：
{
  "businessSummary": "業務核心與獲利模式摘要 (約 80 字)",
  "recentNewsAnalysis": "動態解析與近期趨勢 (約 80 字)",
  "marketPosition": "地位、競爭對手與展望 (約 80 字)",
  "telegramReply": "【Telegram 專用回覆，約 250 字內】：\n1. 請使用極度專業、精煉且具洞察力的語氣。\n2. 嚴禁使用任何 Emoji 或圖示。\n3. 每一個段落標題請使用 **標題** 格式，且「段落與段落之間必須有兩個換行 (\\n\\n)」以利閱讀。\n\n回覆內容需嚴格包含：\n**公司定位**: 說明業務核心與競爭優勢。\n\n**熱點與新聞**: 分析近期動態與產業趨勢。\n\n**競爭與地位**: 點出主要對手與產業排名。\n\n**分析點評**: 提供一針見血的投資風險與機會評估。"
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
