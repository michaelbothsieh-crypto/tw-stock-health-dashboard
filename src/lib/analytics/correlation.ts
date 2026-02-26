export function pearsonCorrelation(x: number[], y: number[]): number | null {
    if (x.length !== y.length || x.length === 0) return null;

    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }

    if (denX === 0 || denY === 0) return 0;
    return num / Math.sqrt(denX * denY);
}

export interface CorrelationResult {
    window: number;
    foreignCorr: number | null;
    investTrustCorr: number | null;
    dealerCorr: number | null;
    strongest: "外資" | "投信" | "自營商" | null;
    interpretation: string[];
}

export function calculateInstitutionCorrelation(
    prices: Array<{ date: string; close: number }>,
    investors: Array<{
        date: string;
        name: string;
        buy: number;
        sell: number;
    }>,
    window: number = 60,
): CorrelationResult {
    // 建立 prices 的快速查找表
    const priceMap = new Map<string, number>();
    for (const p of prices) {
        if (p.date && p.close != null) {
            priceMap.set(p.date, p.close);
        }
    }

    // 將 investors 依照日期彙整
    const flowByDate = new Map<string, { f: number; t: number; d: number }>();
    for (const inv of investors) {
        if (!flowByDate.has(inv.date)) {
            flowByDate.set(inv.date, { f: 0, t: 0, d: 0 });
        }
        const dayFlow = flowByDate.get(inv.date)!;
        const net = inv.buy - inv.sell;
        if (inv.name.includes("Foreign_Investor") || inv.name.includes("外資")) {
            dayFlow.f += net;
        } else if (inv.name.includes("Investment_Trust") || inv.name.includes("投信")) {
            dayFlow.t += net;
        } else if (inv.name.includes("Dealer") || inv.name.includes("自營商")) {
            dayFlow.d += net;
        }
    }

    // 對齊 investors 與 prices 的報酬率
    const returns: number[] = [];
    const foreignFlows: number[] = [];
    const trustFlows: number[] = [];
    const dealerFlows: number[] = [];

    // 只迭代有價有量(有報酬率)的日子
    // 從 i=1 開始以確保有前一天收盤價
    for (let i = 1; i < prices.length; i++) {
        const todayStr = prices[i].date;
        const currentClose = prices[i].close;
        const prevClose = prices[i - 1].close;

        if (currentClose == null || prevClose == null || prevClose <= 0) continue;

        const dailyReturn = currentClose / prevClose - 1;
        const dayFlow = flowByDate.get(todayStr) || { f: 0, t: 0, d: 0 };

        returns.push(dailyReturn);
        foreignFlows.push(dayFlow.f);
        trustFlows.push(dayFlow.t);
        dealerFlows.push(dayFlow.d);
    }
    // 截取最近 window 筆資料
    const r = returns.slice(-window);
    const ff = foreignFlows.slice(-window);
    const tf = trustFlows.slice(-window);
    const df = dealerFlows.slice(-window);

    if (r.length < 20) {
        return {
            window,
            foreignCorr: null,
            investTrustCorr: null,
            dealerCorr: null,
            strongest: null,
            interpretation: ["資料不足，無法計算有效連動率"],
        };
    }

    const foreignCorr = pearsonCorrelation(r, ff);
    const investTrustCorr = pearsonCorrelation(r, tf);
    const dealerCorr = pearsonCorrelation(r, df);

    let strongest: "外資" | "投信" | "自營商" | null = null;
    let maxAbs = 0;

    if (foreignCorr !== null && Math.abs(foreignCorr) > maxAbs) {
        maxAbs = Math.abs(foreignCorr);
        strongest = "外資";
    }
    if (investTrustCorr !== null && Math.abs(investTrustCorr) > maxAbs) {
        maxAbs = Math.abs(investTrustCorr);
        strongest = "投信";
    }
    if (dealerCorr !== null && Math.abs(dealerCorr) > maxAbs) {
        maxAbs = Math.abs(dealerCorr);
        strongest = "自營商";
    }

    const interpretation: string[] = [];
    const maxAbsCorr = maxAbs;

    if (maxAbsCorr >= 0.35) {
        interpretation.push(`正向連動明顯：${strongest}買超常伴隨上漲`);
    } else if (maxAbsCorr >= 0.15) {
        interpretation.push(`連動中等：${strongest}動作對短線價格有部分解釋力`);
    } else {
        interpretation.push(`連動弱：近期三大法人動作與價格關聯性低`);
    }

    // Find significant negative correlation
    const checkNegative = (corr: number | null, name: string) => {
        if (corr !== null && corr <= -0.35) {
            interpretation.push(`反向連動：${name}買超可能逢高調節，或市場遭吸收`);
        }
    };
    checkNegative(foreignCorr, "外資");
    checkNegative(investTrustCorr, "投信");
    checkNegative(dealerCorr, "自營商");

    return {
        window,
        foreignCorr,
        investTrustCorr,
        dealerCorr,
        strongest,
        interpretation,
    };
}
