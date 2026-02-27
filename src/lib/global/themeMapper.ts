import { TW_TO_US_TWIN } from "./twinMapping";

export interface USThemeMapping {
  sector: { id: string; nameZh: string };
  hints: string[];
}

const SYMBOL_US_MAPPING_OVERRIDE: Record<string, USThemeMapping> = {
  // Memory segment overrides
  "2344": { sector: { id: "SOXX", nameZh: "費半指標ETF" }, hints: ["MU", "WDC", "SIMO"] },
  "2408": { sector: { id: "SOXX", nameZh: "費半指標ETF" }, hints: ["MU", "WDC", "SIMO"] },
  "8299": { sector: { id: "SOXX", nameZh: "費半指標ETF" }, hints: ["SIMO", "MU", "WDC"] },
  "6531": { sector: { id: "SOXX", nameZh: "費半指標ETF" }, hints: ["MU", "SIMO", "WDC"] },
};

function normalizeSymbol(raw?: string | null): string {
  if (!raw) return "";
  return raw.replace(/\.(TW|TWO)$/i, "").trim();
}

export function mapThemeToUS(themeName: string | null, symbol?: string): USThemeMapping {
  const code = normalizeSymbol(symbol);
  
  let result: USThemeMapping;

  if (code && SYMBOL_US_MAPPING_OVERRIDE[code]) {
    result = { ...SYMBOL_US_MAPPING_OVERRIDE[code] };
  } else if (!themeName) {
    result = { sector: { id: "SPY", nameZh: "標普500指數" }, hints: [] };
  } else {
    const t = themeName.toLowerCase();
    // Semiconductor / IC
    if (
      t.includes("半導體") ||
      t.includes("晶圓") ||
      t.includes("ic") ||
      t.includes("semiconductor") ||
      t.includes("chip")
    ) {
      result = {
        sector: { id: "SOXX", nameZh: "費半指標ETF" },
        hints: ["NVDA", "AMD", "TSM", "AVGO", "INTC"],
      };
    }
    // Financial / Insurance
    else if (
      t.includes("金融") ||
      t.includes("保險") ||
      t.includes("銀行") ||
      t.includes("financial") ||
      t.includes("bank")
    ) {
      result = {
        sector: { id: "XLF", nameZh: "美國金融ETF" },
        hints: ["JPM", "BAC", "WFC", "C", "PRU", "MET"],
      };
    }
    // Tech / electronics assembly
    else if (
      t.includes("電子") ||
      t.includes("科技") ||
      t.includes("組裝") ||
      t.includes("hardware") ||
      t.includes("technology")
    ) {
      result = {
        sector: { id: "QQQ", nameZh: "納斯達克科技ETF" },
        hints: ["AAPL", "MSFT", "GOOGL", "META"],
      };
    }
    // Shipping / transport
    else if (
      t.includes("航運") ||
      t.includes("運輸") ||
      t.includes("shipping") ||
      t.includes("transport")
    ) {
      result = {
        sector: { id: "IYT", nameZh: "美國運輸ETF" },
        hints: ["ZIM", "FDX", "UPS"],
      };
    }
    // Biotech / pharma
    else if (
      t.includes("生技") ||
      t.includes("製藥") ||
      t.includes("醫藥") ||
      t.includes("biotech") ||
      t.includes("pharma")
    ) {
      result = {
        sector: { id: "IBB", nameZh: "生技ETF" },
        hints: ["JNJ", "PFE", "MRK", "AMGN"],
      };
    }
    // Energy
    else if (t.includes("能源") || t.includes("原油") || t.includes("energy") || t.includes("oil")) {
      result = {
        sector: { id: "XLE", nameZh: "能源ETF" },
        hints: ["XOM", "CVX"],
      };
    }
    // EV / auto
    else if (t.includes("電動車") || t.includes("汽車") || t.includes("ev") || t.includes("auto")) {
      result = {
        sector: { id: "CARZ", nameZh: "電動車ETF" },
        hints: ["TSLA", "TM", "GM", "F"],
      };
    }
    // Steel / metals
    else if (t.includes("鋼鐵") || t.includes("金屬") || t.includes("steel")) {
      result = {
        sector: { id: "SLX", nameZh: "鋼鐵ETF" },
        hints: ["NUE", "STLD", "X"],
      };
    } else {
      result = { sector: { id: "SPY", nameZh: "標普500指數" }, hints: [] };
    }
  }

  // Inject US Twin if target is TW stock and has a US twin
  const usTwin = code ? TW_TO_US_TWIN[code] : null;
  if (usTwin && !result.hints.includes(usTwin)) {
    result.hints = [usTwin, ...result.hints];
  }

  return result;
}
