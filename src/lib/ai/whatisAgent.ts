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
  const cacheKey = `whatis:v3:${ctx.ticker || ctx.stockName}`;

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
- 公司/標的名稱: ${ctx.stockName}
- 系統代號: ${ctx.ticker || "未提供，請根據名稱判斷"}
- 近期新聞摘要:
${ctx.recentNews && ctx.recentNews.length > 0 ? ctx.recentNews.map(n => `  * ${n}`).join('\n') : "  * 系統未抓取到近期新聞，請根據你的知識庫提供該公司或該產業近期的重大動態。"}

【任務目標】
1. **業務核心**: 這間公司到底是做什麼的？它的賺錢模型是什麼？（核心產品、服務、客戶群）。
2. **動態解析**: 近期（特別是這一年）該公司有什麼重大新聞、政策影響或產業趨勢？
3. **競爭力與地位**: 它在產業中的地位如何？誰是它最主要的競爭對手？它有什麼護城河或弱點？
4. **展望與風險**: 對於投資者，目前最需要關注的關鍵觀察點是什麼？（利多或風險點）。

【輸出要求】請嚴格回傳 JSON 格式：
{
  "businessSummary": "業務核心與獲利模式摘要 (約 80 字)",
  "recentNewsAnalysis": "動態解析與近期趨勢 (約 80 字)",
  "marketPosition": "地位、競爭對手與展望 (約 80 字)",
  "telegramReply": "【Telegram 專用回覆，約 250 字內】：\n請使用極度專業、精煉且具洞察力的語氣。嚴禁使用任何 Emoji 或圖示，僅使用純文字標題與條列。內容需包含：\n公司定位: 它是做什麼的，強項在哪。\n熱點與新聞: 近期發生了什麼值得注意的事。\n競爭與地位: 產業地位與對手。\n分析點評: 一針見血的投資觀察與風險提示。"
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
