import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { redis } from "../providers/redisCache";
import { getAvailableGroqModels } from "./modelRouter";
import { InsiderTransfer } from "../providers/twseInsiderFetch";

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
}

export interface ActionPlaybook {
  verdict: string;
  verdictColor: "red" | "green" | "amber" | "slate";
  tacticalScript: string;
  shortSummary: string;
  insiderComment?: string;
}

// Tier 3: Rule-based Fallback (深度優化版)
export function generateRuleBasedPlaybook(ctx: PlaybookContext): ActionPlaybook {
  console.log('🤖 Current AI Tier: Rule-based (Enhanced)');

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

  return {
    verdict: trend.includes("多") ? "偏多看待" : trend.includes("空") ? "偏空需防守" : "震盪整理",
    verdictColor: trend.includes("多") ? "red" : trend.includes("空") ? "green" : "slate",
    tacticalScript: analysis,
    shortSummary: "區間整理中，靜待表態"
  };
}

// Tier 2: Gemini API
async function callGemini(prompt: string): Promise<ActionPlaybook> {
  console.log('🤖 Current AI Tier: Gemini');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    }
  });

  const fetchWithTimeout = async () => {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // Gemini sometimes wraps in markdown blocks even with responseMimeType
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : text;
    return JSON.parse(cleanJson) as ActionPlaybook;
  };

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Gemini Timeout")), 8000)
  );

  return Promise.race([fetchWithTimeout(), timeoutPromise]);
}

// Tier 1: Groq API
async function callGroq(prompt: string, modelName: string): Promise<ActionPlaybook> {
  console.log(`🤖 Current AI Tier: Groq (${modelName})`);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const groq = new Groq({ apiKey });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: modelName,
      temperature: 0,
      response_format: { type: "json_object" },
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error(`Empty response from Groq model: ${modelName}`);
    return JSON.parse(content) as ActionPlaybook;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
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
你是一位擁有 20 年實戰經驗的台股分析師。現在請為客戶分析股票：${ctx.stockName} (${ctx.ticker})。
請結合價格走勢與近期新聞時事進行精闢短評。

當前盤勢數據：
- 現價: ${fPrice}
- 關鍵支撐: ${fSupport}
- 關鍵壓力: ${fResistance}
- 近期走勢: ${ctx.recentTrend || "未提供"}
- 籌碼對抗: ${ctx.flowVerdict || "中性"}
- 內部人轉讓: ${ctx.insiderTransfers?.length ? JSON.stringify(ctx.insiderTransfers) : "無"}

任務：撰寫一段專業分析內容。

【分析師短評 (tacticalScript) 撰寫規則】：
1. 【長度要求】：字數必須在 40 到 60 字之間，不要過於簡短。
2. 【深度內容】：必須同時提到「近期價格走勢」與「市場時事或新聞影響」。
3. 【嚴禁 Emoji】：輸出內容絕對不能包含任何 Emoji 表情符號。
4. 【語氣】：冷靜、客觀，展现機構操盤手的專業感。

{
  "verdict": "4字內精煉結論 (如: 強勢整理, 破線轉弱)",
  "verdictColor": "red|green|amber|slate",
  "tacticalScript": "40-60字的深度分析短評，包含走勢與時事分析",
  "shortSummary": "15字內白話總結"
}
`;

  let result: ActionPlaybook | null = null;

  // Step 1: Dynamic Groq Discovery & Routing
  const availableModels = await getAvailableGroqModels();

  for (const modelName of availableModels) {
    try {
      result = await callGroq(prompt, modelName);
      if (result) break;
    } catch (err) {
      console.warn(`[Playbook] Groq model ${modelName} failed, trying next...`);
    }
  }

  // Step 2: Fallback to Gemini
  if (!result) {
    try {
      result = await callGemini(prompt);
    } catch (err) {
      console.error("[Playbook] Gemini also failed", err);
    }
  }

  // Step 3: Rule-based Last Resort
  if (!result) {
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
