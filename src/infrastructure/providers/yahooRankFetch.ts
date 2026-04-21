
/**
 * Yahoo Finance Trending API - 取得目前熱門趨勢
 * API: https://query1.finance.yahoo.com/v1/finance/trending/TW
 */

export interface YahooRankItem {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
  rank: number;
  category: string;
}

export async function fetchYahooCommunityRank(type: 'all' | 'stock' | 'etf' = 'all'): Promise<YahooRankItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/trending/TW`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
        // Fallback: 如果 429 則回傳空陣列
        if (res.status === 429) console.warn('[YahooRank] Rate limited (429)');
        return [];
    }
    
    const json = await res.json();
    const quotes = json?.finance?.result?.[0]?.quotes || [];

    const result: YahooRankItem[] = [];
    let rankCount = 1;

    for (const q of quotes) {
      const fullSymbol = q.symbol;
      const ticker = fullSymbol.split('.')[0];
      
      // 簡單分類判斷
      const isETF = ticker.startsWith('00') || ticker.startsWith('01');
      
      if (type === 'etf' && !isETF) continue;
      if (type === 'stock' && isETF) continue;

      result.push({
        symbol: ticker,
        name: ticker, // Trending API 通常不帶名稱，後續由 BotEngine 名稱解析補上
        price: null,
        changePct: null,
        rank: rankCount++,
        category: isETF ? 'ETF' : '股票'
      });

      if (result.length >= 10) break;
    }

    return result;
  } catch (err) {
    console.error('[YahooRank] Error fetching trending:', err);
    return [];
  }
}
