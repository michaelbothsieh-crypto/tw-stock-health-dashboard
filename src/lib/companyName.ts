import stockNames from '@/data/tw_stock_names.json';
import { getStockInfo } from './providers/finmind';

// Cache for dynamically fetched names
const dynamicNamesCache = new Map<string, string>();

export async function getCompanyNameZh(symbol: string): Promise<string | null> {
    // 1. Check static dictionary
    if (symbol in stockNames) {
        return (stockNames as Record<string, string>)[symbol];
    }

    // 2. Check dynamic in-memory cache
    if (dynamicNamesCache.has(symbol)) {
        return dynamicNamesCache.get(symbol)!;
    }

    // 3. Fallback to FinMind dynamic lookup
    try {
        const infoResult = await getStockInfo(symbol);
        const info = infoResult.data;
        if (info.length > 0) {
            // FinMind stock_name property
            const name = info[info.length - 1].stock_name;
            if (name) {
                dynamicNamesCache.set(symbol, name);
                return name;
            }
        }
    } catch (error) {
        console.warn(`Failed to fetch dynamic stock name for ${symbol}`, error);
    }

    return null;
}
