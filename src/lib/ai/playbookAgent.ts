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
}

export interface ActionPlaybook {
  verdict: string;
  verdictColor: "red" | "green" | "amber" | "slate";
  actionSteps: string[];
  watchTargets: string[];
  insiderComment?: string;
}

// Tier 3: Rule-based Fallback
export function generateRuleBasedPlaybook(ctx: PlaybookContext): ActionPlaybook {
  console.log('🤖 Current AI Tier: Rule-based');
  
  const fPrice = Number(ctx.price).toFixed(2);
  const fSupport = Number(ctx.support).toFixed(2);
  const fResistance = Number(ctx.resistance).toFixed(2);

  let insiderComment = "";
  if (ctx.insiderTransfers && ctx.insiderTransfers.length > 0) {
    const totalLots = ctx.insiderTransfers.reduce((sum, item) => sum + item.lots, 0);
    const selling = ctx.insiderTransfers.filter(t => t.type === "市場拋售");
    if (selling.length > 0) {
      insiderComment = `偵測到大股東大筆拋售共 ${totalLots.toLocaleString()} 張，壓力量大需謹慎。`;
    } else {
      insiderComment = "內部人持股結構調整中，目前對市場影響中性。";
    }
  }

  if (ctx.insiderTransfers && ctx.insiderTransfers.some(t => t.type === "市場拋售")) {
    return {
      verdict: "內部人拋售",
      verdictColor: "amber",
      actionSteps: [
        `偵測到 ${ctx.stockName} 內部人大額申報轉讓，籌碼面出現強烈警戒`,
        "大股東倒貨期間，建議空手者絕對觀望",
        `嚴格守住 ${fSupport} 支撐，若跌破則全面撤退`
      ],
      watchTargets: ["內部人轉讓是否持續", "量能是否異常放大"],
      insiderComment
    };
  }

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

  if (ctx.flowVerdict === "散戶接刀 (籌碼凌亂)") {
    return {
      verdict: "籌碼警戒",
      verdictColor: "amber",
      actionSteps: [
        `${ctx.stockName} 出現法人拋售、散戶接刀現象`,
        `現價 ${fPrice} 雖有技術支撐，但籌碼面極度凌亂`,
        "建議空手者觀望，持有者嚴守支撐"
      ],
      watchTargets: ["三大法人買賣超動向", "融資餘額是否止增"],
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
      watchTargets: ["三大法人買賣超動向", "融資餘額增減"],
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
    你的語氣犀利、精準、直接，展現機構操盤手的專業感。
    
    當前盤勢數據：
    - 現價: ${fPrice}
    - 關鍵支撐: ${fSupport}
    - 關鍵壓力: ${fResistance}
    - 籌碼熱度: ${fFlow}
    - 籌碼對抗結論: ${ctx.flowVerdict || "中性"}
    - 投信動向: ${ctx.trustLots || 0} 張
    - 融券變化: ${ctx.shortLots || 0} 張
    - 內部人申報轉讓數據: ${ctx.insiderTransfers?.length ? JSON.stringify(ctx.insiderTransfers) : "無重大轉讓"}
    - 系統風險: ${fMacro}
    - 技術趨勢: ${ctx.technicalTrend}

    任務：請依據上述數據，給出極具實戰感的戰術劇本。
    
    【語氣與邏輯要求】：
    1. 每一條 SOP 必須以「動詞」開頭 (如：觀察、防守、留意、減碼、佈局、緊盯)。
    2. 你必須將具體數字 (${fPrice}, ${fSupport}, ${fResistance}) 融入分析中。
    3. 【核心策略規則】：
       - 【內部人行為分析】：
         - 如果出現多筆「市場拋售」(一般交易/鉅額) 且總價值巨大：在「觀察重點」中強烈強調內部人減持風險。
         - 如果只是「持股調整」(信託/贈與)：請判讀為中性，避免過度恐慌。
         - 綜合技術面：若股價處於高檔且老闆在賣，請給出『極度危險』或『高度警戒』的戰術評價。
       - 若為「散戶接刀 (籌碼凌亂)」，即便技術面良好，也必須在 SOP 中強烈警告風險。
       - 若「投信」大買且籌碼集中：請提及『投信積極作帳，籌碼安定』。
    4. 【新增欄位要求】：
       - 若有內部人轉讓數據，請在 JSON 中新增 "insiderComment" 欄位，輸出一段犀利的操盤手評論。
       - 格式範例：『【內部人短評】：大股東高檔倒貨，壓力量大，建議避開』。若無數據則不需此欄位。

    必須回傳 JSON 格式：
    - verdict: 4字內精煉結論
    - verdictColor: "red" (看多), "green" (看空), "amber" (警示), "slate" (中性)
    - actionSteps: 3條操作步驟陣列
    - watchTargets: 2條觀察指標陣列
    - insiderComment: (選填) 針對轉讓數據的犀利短評

    規則：繁體中文、嚴禁 Emoji、文字極度洗鍊。
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
