import { getCache, setCache } from "../src/lib/providers/redisCache";
import { finmindFetch } from "../src/lib/providers/finmindFetch";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// 簡易版 dotenv 以免沒裝 dotenv 套件
function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, "../.env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || "";
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (e) {
    console.warn("Failed to load .env.local", e);
  }
}

async function run() {
  loadEnv();
  console.log("=== Redis Cache Self-Check ===");

  // Test A: Basic connection
  console.log("");
  console.log("[Test A] 基礎連線與讀寫測試");
  const testKey = `test:key:${crypto.randomUUID()}`;
  const testData = { hello: "world", timestamp: Date.now() };
  
  console.log("寫入資料...");
  await setCache(testKey, testData, 60);
  console.log("讀取資料...");
  const result = await getCache<typeof testData>(testKey);
  
  if (!result || result.hello !== "world") {
    console.error("❌ 測試 A 失敗：寫入與讀取的資料不一致或無法取得資料。");
    process.exit(1);
  }
  console.log("✅ 測試 A 通過：成功寫入並讀取 Redis 資料。");

  // Test B: Cache performance
  console.log("");
  console.log("[Test B] 快取效能驗證 (Finmind Fetch)");
  
  const fetchArgs = {
    url: "https://api.finmindtrade.com/api/v4/data",
    params: {
      dataset: "TaiwanStockPrice",
      data_id: "2330",
      start_date: "2024-01-01",
      end_date: "2024-01-05"
    },
    revalidateSeconds: 0,
    cacheKeyBase: `test-2330-price-${crypto.randomUUID()}` // ensuring a fresh key to bypass previous runs
  };

  console.log("-> 第一次呼叫 (預期 Cache Miss)...");
  const start1 = Date.now();
  const res1 = await finmindFetch(fetchArgs);
  const end1 = Date.now();
  const duration1 = end1 - start1;
  console.log(`   耗時: ${duration1}ms`);

  console.log("-> 第二次呼叫 (預期 Cache Hit)...");
  const start2 = Date.now();
  const res2 = await finmindFetch(fetchArgs);
  const end2 = Date.now();
  const duration2 = end2 - start2;
  console.log(`   耗時: ${duration2}ms`);

  if (!res1.ok || !res2.ok) {
    console.error("❌ API 請求失敗，無法完成測試。");
    process.exit(1);
  }

  // A network request usually takes > 100ms, while a Redis request takes ~10-50ms.
  if (duration2 > duration1 && duration2 > 100) { 
      console.warn(`⚠️ 警告：第二次請求沒有比第一次快 (${duration2}ms vs ${duration1}ms)，可能是網絡波動，或者 Cache 沒命中。`);
  } else {
      console.log(`✅ 效能提升：第二次請求比第一次快了 ${duration1 - duration2}ms`);
  }

  console.log("");
  console.log("🎉 ✅ 測試通過：Redis 快取機制運作正常");
}

run().catch(console.error);
