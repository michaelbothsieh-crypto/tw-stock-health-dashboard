import { getStockInfo } from "../providers/finmind";

export interface StockProfile {
  sectorZh: string | null;
  subIndustryZh: string | null;
  confidence: number;
}

// Very basic fallback rules based on name keywords
function resolveByName(name: string): string | null {
    if (name.includes("金") || name.includes("保") || name.includes("壽") || name.includes("產險")) {
        return "金融保險";
    }
    if (name.includes("半導體") || name.includes("積體") || name.includes("光電") || name.includes("電子")) {
        return "半導體及電子";
    }
    if (name.includes("航") || name.includes("船") || name.includes("海")) {
        return "航運業";
    }
    if (name.includes("鋼") || name.includes("鐵")) {
        return "鋼鐵工業";
    }
    if (name.includes("建") || name.includes("營") || name.includes("地產")) {
        return "建材營造";
    }
    if (name.includes("生技") || name.includes("生醫") || name.includes("藥")) {
        return "生技醫療業";
    }
    if (name.includes("車") || name.includes("汽車")) {
        return "汽車工業";
    }
    return null;
}

export async function resolveStockProfile(
  ticker: string,
  stockName?: string
): Promise<StockProfile> {
  const code = ticker.replace(/\.(TW|TWO)$/, "");
  
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
