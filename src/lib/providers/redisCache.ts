import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// Only initialize if env vars are present
const redis = url && token ? new Redis({ url, token }) : null;

export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  
  try {
    const data = await redis.get<T>(key);
    return data;
  } catch (error) {
    console.error(`[Redis] Failed to get cache for key: ${key}`, error);
    return null; // Silent failure, fallback to API
  }
}

export async function setCache<T>(key: string, data: T, exSeconds: number): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.set(key, data, { ex: exSeconds });
  } catch (error) {
    console.error(`[Redis] Failed to set cache for key: ${key}`, error);
    // Silent failure
  }
}
