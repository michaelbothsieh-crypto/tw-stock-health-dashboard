export interface USThemeMapping {
    sector: { id: string; nameZh: string };
    hints: string[];
}

export function mapThemeToUS(themeName: string | null): USThemeMapping {
    if (!themeName) {
        return { sector: { id: "SPY", nameZh: "標普500指數" }, hints: [] };
    }

    const t = themeName.toLowerCase();

    if (t.includes("半導體")) {
        return { sector: { id: "SOXX", nameZh: "費半指標ETF" }, hints: ["NVDA", "AMD", "TSM", "AVGO", "INTC"] };
    }
    if (t.includes("金融") || t.includes("保險") || t.includes("壽險") || t.includes("銀行")) {
        return { sector: { id: "XLF", nameZh: "美國金融ETF" }, hints: ["JPM", "BAC", "WFC", "C", "PRU", "MET"] };
    }
    if (t.includes("電子") || t.includes("電腦") || t.includes("週邊") || t.includes("光電") || t.includes("網通")) {
        return { sector: { id: "QQQ", nameZh: "納斯達克科技ETF" }, hints: ["AAPL", "MSFT", "GOOGL", "META"] };
    }
    if (t.includes("航運") || t.includes("海運") || t.includes("貨櫃")) {
        return { sector: { id: "IYT", nameZh: "美國運輸ETF" }, hints: ["ZIM", "FDX", "UPS"] };
    }
    if (t.includes("生技") || t.includes("生醫") || t.includes("藥")) {
        return { sector: { id: "IBB", nameZh: "生技ETF" }, hints: ["JNJ", "PFE", "MRK", "AMGN"] };
    }
    if (t.includes("能源") || t.includes("塑化") || t.includes("油")) {
        return { sector: { id: "XLE", nameZh: "能源ETF" }, hints: ["XOM", "CVX"] };
    }
    if (t.includes("汽車") || t.includes("車")) {
        return { sector: { id: "CARZ", nameZh: "電動汽車ETF" }, hints: ["TSLA", "TM", "GM", "F"] };
    }
    if (t.includes("鋼鐵")) {
        return { sector: { id: "SLX", nameZh: "鋼鐵ETF" }, hints: ["NUE", "STLD", "X"] };
    }
    
    // Default Fallback
    return { sector: { id: "SPY", nameZh: "標普500指數" }, hints: [] };
}
