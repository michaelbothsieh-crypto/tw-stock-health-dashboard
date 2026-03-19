import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { getAvailableGroqModels } from "./modelRouter";

export interface LLMOptions {
  temperature?: number;
  jsonMode?: boolean;
  timeout?: number;
}

export async function callGemini<T>(prompt: string, options: LLMOptions = {}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: options.temperature ?? 0,
      responseMimeType: options.jsonMode ? "application/json" : "text/plain",
    }
  });

  const fetchWithTimeout = async () => {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    if (options.jsonMode) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(cleanJson) as T;
    }
    return text as unknown as T;
  };

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Gemini Timeout")), options.timeout ?? 10000)
  );

  return Promise.race([fetchWithTimeout(), timeoutPromise]);
}

export async function callGroq<T>(prompt: string, modelName: string, options: LLMOptions = {}): Promise<T> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");

  const groq = new Groq({ apiKey });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? 12000);

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: modelName,
      temperature: options.temperature ?? 0,
      response_format: options.jsonMode ? { type: "json_object" } : undefined,
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error(`Empty response from Groq model: ${modelName}`);
    
    if (options.jsonMode) {
      return JSON.parse(content) as T;
    }
    return content as unknown as T;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export async function callLLMWithFallback<T>(prompt: string, options: LLMOptions = {}): Promise<T> {
  // Step 1: Groq Fallback Loop
  const availableModels = await getAvailableGroqModels();
  for (const modelName of availableModels) {
    try {
      return await callGroq<T>(prompt, modelName, options);
    } catch (err) {
      console.warn(`[LLM] Groq model ${modelName} failed, trying next...`);
    }
  }

  // Step 2: Gemini Fallback
  try {
    return await callGemini<T>(prompt, options);
  } catch (err) {
    console.error("[LLM] Gemini also failed", err);
    throw err;
  }
}
