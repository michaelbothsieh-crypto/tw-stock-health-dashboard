/**
 * chatStore.ts
 * 用 Upstash Redis 動態管理 Telegram Chat ID 列表
 *
 * Key 設計：
 *   tg:chat_ids  → Redis Set，存所有已知的 chat_id（string）
 */

const REDIS_KEY = "tg:chat_ids";

function getRedisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

/**
 * 呼叫 Upstash REST API 的通用函式
 */
async function upstashRequest(config: { url: string; token: string }, command: string[]): Promise<unknown> {
  const res = await fetch(`${config.url}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error(`Upstash request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { result: unknown };
  return json.result;
}

/**
 * 新增一個 chat_id 到 Redis Set
 */
export async function registerChatId(chatId: number | string): Promise<void> {
  const config = getRedisConfig();
  if (!config) {
    console.warn("[chatStore] Upstash Redis not configured, skipping registerChatId");
    return;
  }
  try {
    await upstashRequest(config, ["SADD", REDIS_KEY, String(chatId)]);
    console.log(`[chatStore] Registered chat_id: ${chatId}`);
  } catch (error) {
    console.error("[chatStore] Failed to register chat_id:", error);
  }
}

/**
 * 取得所有已知的 chat_id 列表
 * Fallback：若 Redis 無資料或未設定，回傳 env TELEGRAM_CHAT_ID（若有的話）
 */
export async function getAllChatIds(): Promise<string[]> {
  const config = getRedisConfig();

  if (config) {
    try {
      const result = await upstashRequest(config, ["SMEMBERS", REDIS_KEY]);
      if (Array.isArray(result) && result.length > 0) {
        return result.map(String);
      }
    } catch (error) {
      console.error("[chatStore] Failed to get chat_ids from Redis:", error);
    }
  }

  // Fallback：使用 env TELEGRAM_CHAT_ID
  const fallback = process.env.TELEGRAM_CHAT_ID;
  if (fallback) {
    console.warn("[chatStore] Using fallback TELEGRAM_CHAT_ID from env");
    return [fallback];
  }

  return [];
}

/**
 * 移除一個 chat_id（例如使用者封鎖 bot 時）
 */
export async function removeChatId(chatId: number | string): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;
  try {
    await upstashRequest(config, ["SREM", REDIS_KEY, String(chatId)]);
    console.log(`[chatStore] Removed chat_id: ${chatId}`);
  } catch (error) {
    console.error("[chatStore] Failed to remove chat_id:", error);
  }
}
