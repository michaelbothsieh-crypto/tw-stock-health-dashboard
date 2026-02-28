import { redis } from "../providers/redisCache";

const PREFERRED_GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "mixtral-8x7b-32768",
];

export async function getAvailableGroqModels(): Promise<string[]> {
  const cacheKey = "ai:groq_models";
  
  if (redis) {
    try {
      const cached = await redis.get<string[]>(cacheKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    } catch (e) {
      console.warn("[ModelRouter] Redis read failed", e);
    }
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return ["llama-3.1-8b-instant"];
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) throw new Error(`Groq API error: ${response.status}`);

    const data = await response.json();
    const remoteModels = new Set(data.data.map((m: any) => m.id));
    
    // Filter and sort by our preference
    const available = PREFERRED_GROQ_MODELS.filter(id => remoteModels.has(id));
    
    if (available.length === 0) {
      available.push("llama-3.1-8b-instant");
    }

    if (redis) {
      await redis.set(cacheKey, available, { ex: 3600 });
    }

    return available;
  } catch (error) {
    console.error("[ModelRouter] Failed to fetch models from Groq", error);
    return ["llama-3.1-8b-instant"];
  }
}
