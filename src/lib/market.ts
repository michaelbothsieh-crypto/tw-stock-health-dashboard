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
        // 台灣債券 ETF (代碼以 B 結尾) 絕大多數在上櫃市場 (TPEX)
        const isBondETF = symbol.toUpperCase().endsWith('B') && symbol.length >= 5;

        if (market === 'TPEX' || (market === 'UNKNOWN' && isBondETF)) {
            yahoo = `${symbol}.TWO`;
            if (market === 'UNKNOWN' && isBondETF) market = 'TPEX';
        } else {
            yahoo = `${symbol}.TW`;
        }
    }

    const result: MarketDetectionResult = { market, yahoo, ambiguous };

    // 將結果快取起來
    marketCache.set(symbol, result);

    return result;
}

/** 判斷目前對應市場是否在交易時段（含台、美股簡易定義） */
export function isMarketOpen(ticker: string): boolean {
    const now = new Date();
    // 取得當前 UTC 分鐘數：(Hours*60) + Minutes
    const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const day = now.getUTCDay(); // 0=Sun, 6=Sat

    // 簡易判斷台股：包含數字或是帶有 .TW/.TWO 後綴
    const isTW = /[0-9]/.test(ticker) || /\.(TW|TWO)$/i.test(ticker);

    if (isTW) {
        // 台股：週一至週五 9:00~13:30 CST
        // CST = UTC+8，故 UTC 時間為 1:00~5:30
        if (day === 0 || day === 6) return false;
        return utcMins >= 60 && utcMins <= 330;
    } else {
        // 美股：週一至週五 9:30~16:00 ET (夏令 UTC-4=13:30, 冬令 UTC-5=14:30)
        // 抓個大概區間 13:30~21:00 UTC
        if (day === 0 || day === 6) return false;
        return utcMins >= 810 && utcMins <= 1260;
    }
}

// 方便測試時清理 cache
export function clearMarketCache() {
    marketCache.clear();
}
