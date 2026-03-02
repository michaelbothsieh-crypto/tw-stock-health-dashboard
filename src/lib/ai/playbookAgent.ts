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

// Tier 3: Rule-based Fallback
export function generateRuleBasedPlaybook(ctx: PlaybookContext): ActionPlaybook {
  console.log('🤖 Current AI Tier: Rule-based');

  const fPrice = Number(ctx.price).toFixed(2);
  const fSupport = Number(ctx.support).toFixed(2);
  const fResistance = Number(ctx.resistance).toFixed(2);

  let insiderComment = "";
  let shortSummary = "數據整理中";

  if (ctx.insiderTransfers && ctx.insiderTransfers.length > 0) {
    const totalLots = ctx.insiderTransfers.reduce((sum, item) => sum + item.lots, 0);
    const selling = ctx.insiderTransfers.filter(t => t.type === "市場拋售");
    if (selling.length > 0) {
      insiderComment = `偵測到大股東大筆拋售共 ${totalLots.toLocaleString()} 張，壓力量大需謹慎。`;
      shortSummary = "大股東申報賣出，警戒";
    } else {
      insiderComment = "內部人持股結構調整中，目前對市場影響中性。";
      shortSummary = "內部人持股調整中";
    }
  }

  if (ctx.insiderTransfers && ctx.insiderTransfers.some(t => t.type === "市場拋售")) {
    return {
      verdict: "內部人拋售",
      verdictColor: "amber",
      tacticalScript: `偵測到大額拋售，若跌破 ${fSupport} 則全面撤退，持股建議減碼。`,
      shortSummary: shortSummary || "內部人大筆賣出",
      insiderComment
    };
  }

  if (ctx.macroRisk >= 80) {
    return {
      verdict: "避險觀望",
      verdictColor: "green",
      tacticalScript: `市場風險極高，現價 ${fPrice} 靠近壓力 ${fResistance}，建議空手觀望。`,
      shortSummary: "市場系統風險極高"
    };
  }

  if (ctx.flowVerdict === "散戶接刀 (籌碼凌亂)") {
    return {
      verdict: "籌碼警戒",
      verdictColor: "amber",
      tacticalScript: `法人拋售且籌碼凌亂，若跌破 ${fSupport} 則立即停損，空手者禁追。`,
      shortSummary: "法人賣散戶接，籌碼亂"
    };
  }

  const isBull = (ctx.flowScore >= 60 && ctx.technicalTrend.includes("多"));
  return {
    verdict: isBull ? "多頭趨勢" : "震盪整理",
    verdictColor: isBull ? "red" : "slate",
    tacticalScript: isBull
      ? `若守住 ${fSupport} 支撐則續抱，站穩 ${fResistance} 且法人續買可加碼。`
      : `股價於 ${fSupport} 至 ${fResistance} 區間震盪，未破支撐前暫行觀望。`,
    shortSummary: isBull ? "趨勢偏多，持股續抱" : "區間整理，靜待突破",
    insiderComment: insiderComment || undefined
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
你是一位擁有 20 年實戰經驗的華爾街頂級量化與順勢交易員。現在請為客戶分析股票：${ctx.stockName} (${ctx.ticker})。
你的語氣冷靜、客觀、犀利，不帶任何散戶恐慌情緒，展現機構操盤手「只看數據與價格行為」的專業感。

當前盤勢數據：
- 現價: ${fPrice}
- 關鍵支撐: ${fSupport}
- 關鍵壓力: ${fResistance}
- 近期位階與走勢: ${ctx.recentTrend || "未提供"}
- 籌碼熱度: ${fFlow}
- 籌碼對抗結論: ${ctx.flowVerdict || "中性"}
- 投信動向: ${ctx.trustLots || 0} 張
- 融券變化: ${ctx.shortLots || 0} 張
- 內部人申報轉讓: ${ctx.insiderTransfers?.length ? JSON.stringify(ctx.insiderTransfers) : "無重大轉讓"}
- 系統風險: ${fMacro}

任務：放棄所有條列式分析，請依據上述數據，給出「一句話」的極簡實戰腳本。

【一句話戰術腳本 (tacticalScript) 撰寫規則】(嚴格遵守)：
1. 【絕對精簡】：必須控制在 40 個字以內的一段話。
2. 【IF-THEN 結構】：必須將「價格數字 (${fSupport} 或 ${fResistance})」結合「籌碼/位階條件」，給出明確的動作。
3. 【禁用模糊廢話】：嚴禁出現「觀察、留意、是否、可能、建議」等模稜兩可的字眼。
4. 【動作指令化】：只能使用明確的交易動作，如「停損、減碼、試單、加碼、續抱、空手觀望」。
   - ✅ 正確範例：「若帶量跌破 1795 即停損，站穩 2465 且外資轉買才進場試單。」
   - ❌ 錯誤範例：「觀察股價是否能站穩 1795 支撐，並留意外資動向決定是否進場。」

{
  "verdict": "4字內精煉結論 (如: 強勢整理, 破線轉弱)",
  "verdictColor": "red|green|amber|slate",
  "tacticalScript": "40字內的 IF-THEN 一句話實戰腳本",
  "shortSummary": "15字內白話總結 (供戰情室首頁卡片使用)",
  "insiderComment": "針對轉讓數據的犀利短評(選填，無異常則留白)"
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
