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
  actionSteps: string[];
  watchTargets: string[];
  insiderComment?: string;
  shortSummary?: string; // 新增：供戰情室使用的極短總結
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
      actionSteps: [
        `偵測到 ${ctx.stockName} 內部人大額申報轉讓，籌碼面出現強烈警戒`,
        "大股東倒貨期間，建議空手者絕對觀望",
        `嚴格守住 ${fSupport} 支撐，若跌破則全面撤退`
      ],
      watchTargets: ["內部人轉讓是否持續", "量能是否異常放大"],
      insiderComment,
      shortSummary: shortSummary || "內部人大筆賣出"
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
      shortSummary: "市場系統風險極高"
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
      shortSummary: "法人賣散戶接，籌碼亂"
    };
  }

  const isBull = (ctx.flowScore >= 60 && ctx.technicalTrend.includes("多"));
  return {
    verdict: isBull ? "多頭趨勢" : "震盪整理",
    verdictColor: isBull ? "red" : "slate",
    actionSteps: [
      `目前現價 ${fPrice} 於 ${fSupport} 至 ${fResistance} 區間震盪`,
      "維持現有部位，不主動加碼",
      `若後續跌破支撐 ${fSupport} 則需嚴格執行減碼`
    ],
    watchTargets: ["觀察月線支撐力道", "量能是否有效放大"],
    shortSummary: isBull ? "技術籌碼雙多，續抱" : "區間整理，靜待方向"
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
你的語氣冷靜、客觀、犀利，不帶任何散戶恐慌情緒，展現機構操盤手「只看數據與價格行為」專業感。

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
- 技術趨勢: ${ctx.technicalTrend}

任務：請依據上述數據，給出極具實戰感的戰術劇本。

【操盤手思維與權重規則】(嚴格遵守)：
1. 核心權重：價格位階 (近期走勢) 與 關鍵支撐壓力 > 法人籌碼動向 > 內部人轉讓 > 系統風險。
2. 多頭換手防護：若『近期位階』為多頭/高檔，且現價並未跌破『關鍵支撐』，此時若出現法人大賣或籌碼轉弱，【絕對禁止】判讀為「盤勢偏空」、「散戶套牢」或「主力出貨」。你必須將其客觀解讀為「高檔震盪」、「法人獲利了結」或「籌碼換手區」。
3. 空頭確認規則：只有當現價「明確跌破關鍵支撐」，且伴隨法人大賣，才可判定為「趨勢轉弱」或「偏空」。
4. 價量背離防護：若現價為強勢大漲（如接近漲停），量縮視為「籌碼鎖定、買盤強勢」，絕對不可判讀為量價背離或偏空。
5. 內部人行為判定：
   - 若為一般交易/鉅額拋售且總金額大：必須在 SOP 中設定為首要防守警報。
   - 若僅為信託、贈與：視為大股東財務規劃，判定為中性，勿過度解讀。

【語氣與輸出要求】：
1. 每一條 actionSteps (操作 SOP) 必須以「動詞」開頭 (如：觀察、防守、留意、減碼、佈局、緊盯)。
2. 必須將具體數字 (${fPrice}, ${fSupport}, ${fResistance}) 完美融入分析與 SOP 中。
3. 【絕對禁止】直接輸出底層變數名稱 (如：籌碼熱度 ${fFlow}、系統風險)，必須轉化為白話文 (例如：外資買盤積極、總經環境承壓)。
4. 嚴禁任何散戶情緒用語、Emoji、以及任何 Markdown 標記 (如 \`\`\`json)。
5. 必須回傳純淨的 JSON 格式。

{
  "verdict": "4字內精煉結論 (如: 強勢整理, 高檔震盪, 破線轉弱)",
  "verdictColor": "red|green|amber|slate",
  "actionSteps": ["操作步驟1", "操作步驟2", "操作步驟3"],
  "watchTargets": ["觀察指標1", "觀察指標2"],
  "shortSummary": "15字內白話總結 (顯示於戰情室卡片)",
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
