import { getStockInfo } from "./providers/finmind";

export type MarketType = 'TWSE' | 'TPEX' | 'UNKNOWN';

export interface MarketDetectionResult {
    market: MarketType;
    yahoo: string;
    ambiguous: boolean;
}

// 簡單的 in-memory cache，避免重複查詢相同的 ticker
const marketCache = new Map<string, MarketDetectionResult>();

export async function detectMarket(symbol: string): Promise<MarketDetectionResult> {
    if (marketCache.has(symbol)) {
        return marketCache.get(symbol)!;
    }

    let market: MarketType = 'UNKNOWN';
    let ambiguous = false;

    try {
        // 利用 FinMind 的 TaiwanStockInfo 來取得股票市場分類
        const infoResult = await getStockInfo(symbol);
        const info = infoResult.data;

        if (info.length > 0) {
            // 取第一筆資料的 type
            const typeStr = info[info.length - 1].type?.toLowerCase();

            if (typeStr === 'twse') {
                market = 'TWSE';
            } else if (typeStr === 'tpex') {
                market = 'TPEX';
            } else {
                market = 'UNKNOWN';
            }
        }
    } catch (error) {
        console.warn(`Failed to fetch stock info for ${symbol}, fallback to UNKNOWN`, error);
    }

    // 依據市場定義對應的 Yahoo suffix
    let yahoo = "";
    const isUS = /^[A-Z]+$/i.test(symbol);

    if (isUS) {
        yahoo = symbol.toUpperCase();
    } else {
        yahoo = `${symbol}.TW`; // 預設 TWSE
        if (market === 'TPEX') {
            yahoo = `${symbol}.TWO`;
        }
    }

    const result: MarketDetectionResult = { market, yahoo, ambiguous };

    // 將結果快取起來
    marketCache.set(symbol, result);

    return result;
}

// 方便測試時清理 cache
export function clearMarketCache() {
    marketCache.clear();
}
