
/**
 * Yahoo 奇摩股市 - 社群爆紅榜 (熱門瀏覽)
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
  const url = `https://tw.stock.yahoo.com/community/rank/active?type=${type}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://tw.stock.yahoo.com/'
      }
    });

    if (!res.ok) return [];
    const html = await res.text();

    // 1. 擷取 root.App.main 的 JSON
    const marker = 'root.App.main = ';
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) return [];

    let jsonStr = "";
    let bracketCount = 0;
    let foundStart = false;

    for (let i = startIdx + marker.length; i < html.length; i++) {
        const char = html[i];
        if (char === '{') {
            bracketCount++;
            foundStart = true;
        } else if (char === '}') {
            bracketCount--;
        }
        if (foundStart) {
            jsonStr += char;
            if (bracketCount === 0) break;
        }
    }

    if (!jsonStr) return [];
    // 淨化 JSON (處理 undefined)
    const sanitizedJson = jsonStr.replace(/:\s*undefined\s*(,|})/g, ":null$1");
    const data = JSON.parse(sanitizedJson);

    // 2. 依照 Yahoo 最新結構提取列表 (精準路徑)
    // 優先順序: Stores -> Plugins -> 遞迴搜尋
    const stores = data?.context?.dispatcher?.stores;
    let list = stores?.CommunityRankingStore?.rankList || 
               stores?.RankStore?.list || 
               data?.pageData?.context?.dispatcher?.stores?.CommunityRankingStore?.rankList;

    if (!list) {
        // 最後防線：遞迴尋找具有 symbol 的陣列
        const findArray = (obj: any): any[] | null => {
            if (!obj || typeof obj !== 'object') return null;
            if (Array.isArray(obj) && obj.length > 0 && obj[0].symbol) return obj;
            for (const k in obj) {
                const found = findArray(obj[k]);
                if (found) return found;
            }
            return null;
        };
        list = findArray(data);
    }

    if (!list || !Array.isArray(list)) return [];

    return list.slice(0, 10).map((item: any, index: number) => {
      const fullSymbol = item.symbol || "";
      const ticker = fullSymbol.replace('.TW', '').replace('.TWO', '');
      const isETF = ticker.startsWith('00') || ticker.startsWith('01');

      return {
        symbol: ticker,
        name: item.stockName || item.name || ticker,
        price: typeof item.price === 'number' ? item.price : (typeof item.close === 'number' ? item.close : null),
        changePct: typeof item.changePercent === 'number' ? item.changePercent : null,
        rank: index + 1,
        category: isETF ? 'ETF' : '股票'
      };
    });
  } catch (err) {
    console.error('[YahooRank] Error:', err);
    return [];
  }
}
