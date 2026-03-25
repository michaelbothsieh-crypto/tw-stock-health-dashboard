import { redis } from "../providers/redisCache";

/**
 * 股票排名紀錄結構
 */
export interface StockRankRecord {
  symbol: string;
  count: number;
  initialPrice: number;
  initialTimestamp: number;
}

/**
 * 紀錄股票查詢
 * @param chatId 群組 ID
 * @param ticker 股票代號 (已標準化)
 * @param currentPrice 當前價格 (收盤價)
 */
export async function recordStockSearch(chatId: string | number, ticker: string, currentPrice: number | null): Promise<void> {
  if (!redis || !currentPrice) return;

  const id = String(chatId);
  const countKey = `tg:rank:count:${id}`;
  const initialKey = `tg:rank:initial:${id}`;

  try {
    console.log(`[rankStore] Recording search for ${ticker} in chat ${id} (Price: ${currentPrice})`);
    // 1. 增加查詢次數 (Sorted Set)
    await redis.zincrby(countKey, 1, ticker);

    // 2. 紀錄初始價格 (Hash Set)，只有第一次查詢會寫入
    // hsetnx 會在欄位不存在時才寫入，非常適合「紀錄第一次」
    const initialData = JSON.stringify({
      price: currentPrice,
      timestamp: Date.now(),
    });
    await redis.hsetnx(initialKey, ticker, initialData);
  } catch (error) {
    console.error(`[rankStore] Failed to record search for ${ticker} in ${chatId}:`, error);
  }
}

/**
 * 取得群組前十名熱門股票
 */
export async function getTopRankedStocks(chatId: string | number): Promise<StockRankRecord[]> {
  if (!redis) return [];

  const id = String(chatId);
  const countKey = `tg:rank:count:${id}`;
  const initialKey = `tg:rank:initial:${id}`;

  try {
    // 1. 從 ZSET 取得次數前十名的股票及其分數 (ZRANGE ... REV WITHSCORES)
    // Upstash Redis SDK 的 zrange 若加上 withScores，返回 [member, score, member, score...]
    const rawRanks = await redis.zrange(countKey, 0, 9, { rev: true, withScores: true }) as (string | number)[];
    
    console.log(`[rankStore] Rank ZRange result for ${id}:`, rawRanks);

    if (!rawRanks || rawRanks.length === 0) return [];

    const ranks: { symbol: string, count: number }[] = [];
    for (let i = 0; i < rawRanks.length; i += 2) {
      ranks.push({
        symbol: rawRanks[i] as string,
        count: Number(rawRanks[i + 1]),
      });
    }

    // 2. 批量取得初始價格 (HMGET)
    const symbols = ranks.map(r => r.symbol);
    const rawInitials = await redis.hmget(initialKey, ...symbols) as unknown as (string | null)[];

    // 3. 組合結果
    const results: StockRankRecord[] = [];
    for (let i = 0; i < ranks.length; i++) {
      const initialJson = rawInitials ? rawInitials[i] : null;
      if (initialJson) {
         try {
           const initial = JSON.parse(initialJson);
           results.push({
             symbol: ranks[i].symbol,
             count: ranks[i].count,
             initialPrice: initial.price,
             initialTimestamp: initial.timestamp,
           });
         } catch (e) {
           // Skip if invalid JSON
         }
      }
    }

    return results;
  } catch (error) {
    console.error(`[rankStore] Failed to get ranks for ${chatId}:`, error);
    return [];
  }
}
