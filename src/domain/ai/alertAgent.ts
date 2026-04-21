import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { getAvailableGroqModels } from "./modelRouter";

/**
 * 針對異常數據生成 Telegram 推播文案
 */
export async function generatePushAlert(
  stockName: string,
  ticker: string,
  insiderData: any[],
  flowData: any
): Promise<string> {
  const prompt = `
    你是一個毒舌但精準的華爾街風險分析師。
    以下是 ${stockName} (${ticker}) 今天的異常數據：
    - 內部人轉讓：${JSON.stringify(insiderData)}
    - 籌碼動向：${JSON.stringify(flowData)}

    請幫我寫一則用於 Telegram 推播的短文字（100字內）。
    
    格式要求：
    第一行：🚨 [${ticker} ${stockName}] AI 戰術異常警報！
    第二行：(一句話點出最危險的數據，例如：大股東申報拋售 3 萬張，或是融資暴增散戶接刀)
    第三行：(給出強烈操作建議，如：建議立即避開，切勿摸底)
    
    規則：
    1. 使用繁體中文。
    2. 使用適當的 Emoji。
    3. 語氣要有急迫感與威懾力。
    4. 嚴禁廢話，直接給結論。
  `;

  // 優先使用 Groq 70B
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      const groq = new Groq({ apiKey });
      const availableModels = await getAvailableGroqModels();
      const model = availableModels.includes("llama-3.3-70b-versatile") 
        ? "llama-3.3-70b-versatile" 
        : availableModels[0];

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: model,
      });
      return completion.choices[0]?.message?.content || "AI 生成失敗";
    }
  } catch (e) {
    console.warn("[AlertAgent] Groq failed, falling back to Gemini", e);
  }

  // Fallback to Gemini
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      return result.response.text();
    }
  } catch (e) {
    console.error("[AlertAgent] All AI providers failed", e);
  }

  return `🚨 [${ticker} ${stockName}] 偵測到異常異動，請立即回主控台檢查。`;
}
