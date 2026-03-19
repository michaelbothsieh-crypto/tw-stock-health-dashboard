import { redis } from "../src/lib/providers/redisCache";
import * as dotenv from "dotenv";

dotenv.config();

async function clearCache() {
  if (!redis) {
    console.error("❌ Redis 未配置，無法清理快取。");
    return;
  }

  console.log("🧹 正在清理 /whatis 相關快取...");

  try {
    // 列出所有 whatis:* 開頭的 keys
    // 注意: Upstash Redis 的 keys 方法可能因限制而不同，這裡使用 SCAN 或 KEYS
    const keys = await redis.keys("whatis:*");

    if (keys.length === 0) {
      console.log("✅ 沒有找到相關快取。");
      return;
    }

    console.log(`🔍 找到 ${keys.length} 個相關快取鍵：`, keys);

    // 刪除所有找到的 keys
    const deletedCount = await redis.del(...keys);
    console.log(`✅ 已成功刪除 ${deletedCount} 個快取鍵。`);
  } catch (error) {
    console.error("❌ 清理快取時發生錯誤:", error);
  }
}

clearCache().catch(console.error);
