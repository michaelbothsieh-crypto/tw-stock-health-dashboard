import { getStockInfo } from "@/infrastructure/providers/finmind";

export interface StockProfile {
  sectorZh: string | null;
  subIndustryZh: string | null;
  confidence: number;
}

// Static mapping for major Taiwan stocks (Single Source of Truth for fallback)
const MAJOR_STOCK_INDUSTRY_MAP: Record<string, string> = {
    "2330": "半導體業",
    "2317": "其他電子業",
    "2454": "半導體業",
    "2303": "半導體業",
    "2327": "電子零組件業",
    "2308": "電子零組件業",
    "3711": "半導體業",
    "2382": "電腦及週邊設備業",
    "3231": "電腦及週邊設備業",
    "2357": "電腦及週邊設備業",
    "2412": "通信網路業",
    "2881": "金融保險業",
    "2882": "金融保險業",
    "2891": "金融保險業",
    "1216": "食品工業",
    "1301": "塑膠工業",
    "1303": "塑膠工業",
    "2002": "鋼鐵工業",
    "2603": "航運業",
    "2609": "航運業",
    "2615": "航運業",
    "3008": "光電業",
    "2408": "半導體業",
    "2344": "半導體業",
    "2337": "半導體業",
    "3037": "電子零組件業",
    "8046": "電子零組件業",
    "3189": "電子零組件業",
    "2379": "半導體業",
    "3443": "半導體業",
    "3661": "半導體業",
    "5269": "半導體業",
    "3529": "半導體業",
    "6669": "電腦及週邊設備業",
    "2395": "電腦及週邊設備業",
    "2301": "電腦及週邊設備業",
    "2377": "電腦及週邊設備業",
    "2356": "電腦及週邊設備業",
    "4938": "電腦及週邊設備業",
    "2376": "電腦及週邊設備業",
    "3034": "半導體業",
    "4966": "半導體業",
    "6415": "半導體業",
    "3406": "光電業",
    "3653": "電腦及週邊設備業",
    "2474": "其他電子業",
    "2352": "電腦及週邊設備業",
    "2353": "電腦及週邊設備業",
    "2324": "電腦及週邊設備業",
    "2618": "航運業",
    "2610": "航運業",
    "2201": "汽車工業",
    "2207": "汽車工業",
    "1101": "水泥工業",
    "1102": "水泥工業",
    "2105": "橡膠工業",
    "1402": "紡織纖維",
    "1476": "紡織纖維",
    "1477": "紡織纖維",
    "2912": "貿易百貨",
    "9904": "其他業",
    "9910": "其他業",
    "9921": "其他業",
    "9945": "建材營造業",
    "5876": "金融保險業",
    "5880": "金融保險業",
    "2880": "金融保險業",
    "2883": "金融保險業",
    "2884": "金融保險業",
    "2885": "金融保險業",
    "2886": "金融保險業",
    "2887": "金融保險業",
    "2888": "金融保險業",
    "2889": "金融保險業",
    "2890": "金融保險業",
    "2892": "金融保險業",
    "2404": "其他電子業",
    "6196": "其他電子業",
    "3131": "半導體業",
    "3583": "半導體業",
    "3680": "半導體業",
    "6223": "半導體業",
    "6643": "半導體業",
    "6208": "半導體業",
    "3293": "文化創意業",
    "6488": "半導體業",
    };

    // Very basic fallback rules based on name keywords
    function resolveByName(name: string): string | null {
    if (name.includes("金") || name.includes("保") || name.includes("壽") || name.includes("產險") || name.includes("證券") || name.includes("銀行")) {
        return "金融保險業";
    }
    if (name.includes("半導體") || name.includes("積體") || name.includes("光電") || name.includes("電子") || name.includes("零組件") || name.includes("元件") || name.includes("電路") || name.includes("晶圓") || name.includes("封測") || name.includes("設備") || name.includes("矽") || name.includes("封裝") || name.includes("測試") || name.includes("載板") || name.includes("探針") || name.includes("自動化")) {
        return "半導體及電子業";
    }
    if (name.includes("航") || name.includes("船") || name.includes("海") || name.includes("運")) {
        return "航運業";
    }
    if (name.includes("鋼") || name.includes("鐵")) {
        return "鋼鐵工業";
    }
    if (name.includes("建") || name.includes("營") || name.includes("地產") || name.includes("開發") || name.includes("工程") || name.includes("建築")) {
        return "建材營造業";
    }
    if (name.includes("生技") || name.includes("生醫") || name.includes("藥") || name.includes("醫") || name.includes("保健")) {
        return "生技醫療業";
    }
    if (name.includes("車") || name.includes("汽車")) {
        return "汽車工業";
    }
    if (name.includes("化學") || name.includes("塑") || name.includes("膠") || name.includes("樹脂")) {
        return "化學塑膠工業";
    }
    if (name.includes("網") || name.includes("通信") || name.includes("電訊") || name.includes("光通")) {
        return "通信網路業";
    }
    if (name.includes("電商") || name.includes("百貨") || name.includes("零售") || name.includes("商店")) {
        return "電子商務及貿易百貨業";
    }
    return null;
    }


export async function resolveStockProfile(
  ticker: string,
  stockName?: string
): Promise<StockProfile> {
  const code = ticker.replace(/\.(TW|TWO)$/, "");
  
  // 0. Static Mapping (SSOT for major stocks)
  if (MAJOR_STOCK_INDUSTRY_MAP[code]) {
      return {
          sectorZh: MAJOR_STOCK_INDUSTRY_MAP[code],
          subIndustryZh: MAJOR_STOCK_INDUSTRY_MAP[code],
          confidence: 100
      };
  }

  // 1. FinMind API Attempt
  try {

      const info = await getStockInfo(code);
      if (info.data && info.data.length > 0) {
          const category = info.data[0].industry_category;
          if (category) {
              return {
                  sectorZh: category,
                  subIndustryZh: category, // Fallback since finmind doesn't provide sub currently
                  confidence: 95
              };
          }
      }
  } catch (e) {
      console.warn(`[StockProfileResolver] FinMind failed for ${code}`, e);
  }

  // 2. Name Keyword Attempt
  if (stockName) {
      const guessed = resolveByName(stockName);
      if (guessed) {
          return {
              sectorZh: guessed,
              subIndustryZh: "未知子產業",
              confidence: 70
          };
      }
  }

  // 3. Complete Unknown
  return {
    sectorZh: null,
    subIndustryZh: null,
    confidence: 10,
  };
}
