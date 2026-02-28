import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { redis } from "../providers/redisCache";
import { getAvailableGroqModels } from "./modelRouter";

export interface PlaybookContext {
  ticker: string;
  stockName: string;
  price: number;
  support: number;
  resistance: number;
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
  console.log('🤖 Current AI Tier: Rule-based');
  
  const fPrice = Number(ctx.price).toFixed(2);
  const fSupport = Number(ctx.support).toFixed(2);
  const fResistance = Number(ctx.resistance).toFixed(2);

  if (ctx.macroRisk >= 80) {
    return {
      verdict: "避險觀望",
      verdictColor: "green",
      actionSteps: [
        `全面降低 ${ctx.stockName} 持股至兩成以下`,
        `目前現價 ${fPrice} 靠近壓力 ${fResistance}，嚴禁追高`,
        "保留現金等待市場情緒回穩"
      ],
      watchTargets: ["留意 VIX 恐慌指數是否回落", "觀察美元指數 DXY 走勢"],
    };
  }

  if (ctx.flowScore <= 30) {
    return {
      verdict: "籌碼渙散",
      verdictColor: "amber",
      actionSteps: [
        `${ctx.stockName} 主力持續出貨，不宜於 ${fPrice} 接刀`,
        `觀察能否守穩關鍵支撐 ${fSupport}`,
        "縮小部位控管風險"
      ],
      watchTargets: ["緊盯三大法人買賣超動向", "觀察融資餘額是否持續增加"],
    };
  }

  return {
    verdict: "震盪整理",
    verdictColor: "slate",
    actionSteps: [
      `目前現價 ${fPrice} 於 ${fSupport} 至 ${fResistance} 區間震盪`,
      "維持現有部位，不主動加碼",
      `若後續跌破支撐 ${fSupport} 則需嚴格執行減碼`
    ],
    watchTargets: ["觀察月線支撐力道", "量能是否有效放大"],
  };
}

// Tier 2: Gemini API
async function callGemini(prompt: string): Promise<ActionPlaybook> {
  console.log('🤖 Current AI Tier: Gemini');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const fetchWithTimeout = async () => {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
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
      messages: [{ role: "user", content: prompt }],
      model: modelName,
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
  const cacheKey = `playbook:${ctx.ticker}:${hourKey}`;

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
    你是一位擁有 20 年實戰經驗的華爾街頂級交易員，現在請為客戶分析股票：${ctx.stockName} (${ctx.ticker})。
    你的語氣犀利、精準、直接，絕對禁止機器人般的死板回覆。
    
    當前盤勢數據：
    - 現價: ${fPrice}
    - 關鍵支撐: ${fSupport}
    - 關鍵壓力: ${fResistance}
    - 籌碼熱度: ${fFlow}
    - 系統風險: ${fMacro}
    - 技術趨勢: ${ctx.technicalTrend}

    任務：請依據上述數據，給出極具實戰感的戰術劇本。
    
    【語氣與邏輯要求】：
    1. 每一條 SOP 必須以「動詞」開頭 (如：觀察、防守、留意、減碼、佈局、緊盯)。
    2. 絕對禁止使用死板樣板。不准說『當...持續上升時』，要直接指出市場現象與價位。
    3. 你必須將具體數字 (${fPrice}, ${fSupport}, ${fResistance}) 融入分析中。不准講『逼近壓力』這種沒數字的廢話。
    4. 【重要觀察對象】語氣要求：絕對禁止印出『系統風險${fMacro}』這種冷冰冰的格式！請轉化為人話。
       - ✅ 正確：『留意大盤系統風險，若 VIX 異常飆高需立刻警戒』
       - ✅ 正確：『觀察外資與投信買盤是否能延續，提防高檔倒貨』

    必須回傳 JSON 格式：
    - verdict: 4字內結論
    - verdictColor: "red" (看多), "green" (看空), "amber" (警示), "slate" (中性)
    - actionSteps: 3條「洗鍊且帶數字」的操作步驟陣列
    - watchTargets: 2條「人類化」觀察指標陣列

    規則：
    1. 繁體中文輸出。
    2. 嚴禁 Emoji 與任何形式的括號。
    3. 文字極度洗鍊，展現專業靈魂。
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
