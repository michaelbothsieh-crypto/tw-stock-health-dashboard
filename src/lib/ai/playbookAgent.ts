import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { redis } from "../providers/redisCache";

export interface PlaybookContext {
  ticker: string;
  macroRisk: number; // 0-100
  technicalTrend: string; // e.g. "多頭延續", "空頭轉強"
  flowScore: number; // 0-100
}

export interface ActionPlaybook {
  verdict: string;
  verdictColor: "red" | "green" | "amber" | "slate";
  actionSteps: string[];
  watchTargets: string[];
}

// Tier 3: Rule-based Fallback
export function generateRuleBasedPlaybook(ctx: PlaybookContext): ActionPlaybook {
  if (ctx.macroRisk >= 80) {
    return {
      verdict: "避險觀望",
      verdictColor: "green", // Caution in TWSE logic (green is down/defensive)
      actionSteps: ["全面降低持股至兩成以下", "保留現金等待市場情緒回穩", "嚴禁任何追高行為"],
      watchTargets: ["VIX 恐慌指數是否回落", "美元指數 DXY 走勢"],
    };
  }

  if (ctx.flowScore <= 30) {
    return {
      verdict: "籌碼渙散",
      verdictColor: "amber",
      actionSteps: ["主力持續出貨，不宜過早接刀", "觀察外資是否轉賣為買", "縮小部位控管風險"],
      watchTargets: ["三大法人買賣超動向", "融資餘額增減"],
    };
  }

  return {
    verdict: "震盪整理",
    verdictColor: "slate",
    actionSteps: ["維持現有部位，不加碼", "嚴守均線支撐作為防守點", "等待方向明確再行動"],
    watchTargets: ["月線支撐力道", "量能是否有效放大"],
  };
}

// Tier 2: Gemini API
async function callGemini(prompt: string): Promise<ActionPlaybook> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const fetchWithTimeout = async () => {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // Improved JSON extraction for LLMs that wrap in markdown blocks
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
async function callGroq(prompt: string): Promise<ActionPlaybook> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const groq = new Groq({ apiKey });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty Groq response");
    return JSON.parse(content) as ActionPlaybook;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export async function getTacticalPlaybook(ctx: PlaybookContext): Promise<ActionPlaybook> {
  const hourKey = Math.floor(Date.now() / 3600000);
  const cacheKey = `playbook:${ctx.ticker}:${hourKey}`;

  // Check Redis Cache
  if (redis) {
    try {
      const cached = await redis.get<ActionPlaybook>(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.warn("[Playbook] Redis cache read failed");
    }
  }

  const prompt = `
    你是一位專業的股票戰術分析師。請根據以下數據，生成精簡的台股操作劇本。
    必須回傳 JSON 格式，包含以下欄位：
    - verdict: 4字內的狀態結論
    - verdictColor: 只能是 "red" (看多), "green" (看空/保守), "amber" (警示), "slate" (中性)
    - actionSteps: 3條具體的操作步驟字串陣列
    - watchTargets: 2條重點觀察指標字串陣列

    數據內容：
    - 股票代號: ${ctx.ticker}
    - 總經風險 (0-100): ${ctx.macroRisk}
    - 技術趨勢: ${ctx.technicalTrend}
    - 籌碼分數 (0-100): ${ctx.flowScore}

    規則：
    1. 輸出必須是繁體中文。
    2. 禁止使用 Emoji 與括號。
    3. JSON 格式必須正確。
  `;

  let result: ActionPlaybook;

  try {
    // Tier 1: Groq
    result = await callGroq(prompt);
  } catch (err) {
    console.warn(`[Playbook] Groq failed, falling back to Gemini...`, err);
    try {
      // Tier 2: Gemini
      result = await callGemini(prompt);
    } catch (err2) {
      console.error(`[Playbook] Gemini failed, using Rule-based...`, err2);
      // Tier 3: Rule-based
      result = generateRuleBasedPlaybook(ctx);
    }
  }

  // Save to Cache
  if (redis && result) {
    try {
      await redis.set(cacheKey, result, { ex: 3600 });
    } catch (e) {
      console.warn("[Playbook] Redis cache write failed");
    }
  }

  return result;
}
