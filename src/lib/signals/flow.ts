import { InstitutionalInvestor, MarginShort } from "../providers/finmind";

export interface FlowSignals {
    foreign5D: number;
    foreign20D: number;
    trust5D: number;
    trust20D: number;
    marginChange20D: number | null; // 融資 20 日變化率 (%)
    flowScore: number | null;
    reasons: string[];
    risks: string[];
}

export function calculateFlow(tradingDates: string[], investors: InstitutionalInvestor[], marginShort: MarginShort[]): FlowSignals {
    const defaultReturn: FlowSignals = {
        foreign5D: 0, foreign20D: 0, trust5D: 0, trust20D: 0, marginChange20D: null,
        flowScore: null, reasons: ["資料量不足，無法評估籌碼面。"], risks: []
    };

    if (!investors || investors.length === 0 || tradingDates.length < 30) return defaultReturn;

    // Sort data ascending
    const sortedInvestors = [...investors].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const sortedMargin = [...marginShort].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


    const risks: string[] = [];

    // 計算缺值比例 (近 20 日)
    let missingDays = 0;

    // 計算特定投資人的特定天數買賣超，並一併檢查缺值與絕對值均值
    function getRecentNetBuyStats(days: number, typeIndicator: string, recordMissing: boolean = false) {
        const targetDates = tradingDates.slice(-days);
        let netBuy = 0;
        let daysWithData = 0;
        let dailyAbsSum = 0;

        for (const date of targetDates) {
            let found = false;
            let dailyNet = 0;
            for (const record of sortedInvestors) {
                // 修正: FinMind 原始資料使用英文名稱 (Foreign_Investor, Investment_Trust)
                const isForeign = typeIndicator === "外資" && record.name.includes("Foreign_Investor");
                const isTrust = typeIndicator === "投信" && record.name.includes("Investment_Trust");
                if (record.date === date && (record.name.includes(typeIndicator) || isForeign || isTrust)) {
                    const diff = record.buy - record.sell;
                    netBuy += diff;
                    dailyNet += diff;
                    found = true;
                }
            }
            if (found) {
                daysWithData++;
                dailyAbsSum += Math.abs(dailyNet);
            }
        }

        if (recordMissing) {
            missingDays = days - daysWithData;
        }

        return {
            total: netBuy,
            meanAbs: daysWithData > 0 ? dailyAbsSum / daysWithData : 0
        };
    }

    const foreignStats20 = getRecentNetBuyStats(20, "外資", true); // 外資通常最齊全，用它當作基準計算 missing
    const foreignStats5 = getRecentNetBuyStats(5, "外資");
    const trustStats20 = getRecentNetBuyStats(20, "投信");
    const trustStats5 = getRecentNetBuyStats(5, "投信");

    const foreign20D = foreignStats20.total;
    const foreign5D = foreignStats5.total;
    const trust20D = trustStats20.total;
    const trust5D = trustStats5.total;

    // 檢查缺值比例 > 20%
    let penalty = 0;
    if (missingDays / 20 > 0.2) {
        risks.push("法人資料缺漏比例偏高，分數可信度下降。");
        penalty = 10;
    }

    let marginChange20D: number | null = null;

    // 取最近 20 日的融資資料 (用 OHLCV 日期對齊)
    const marginTargetDates = tradingDates.slice(-20);
    if (marginTargetDates.length >= 20) {
        const latestDate = marginTargetDates[marginTargetDates.length - 1];
        const pastDate = marginTargetDates[0];

        const latestMarginRecord = sortedMargin.find(m => m.date === latestDate);
        const pastMarginRecord = sortedMargin.find(m => m.date === pastDate);

        const latestMargin = latestMarginRecord?.MarginPurchaseTodayBalance ?? 0;
        const pastMargin = pastMarginRecord?.MarginPurchaseTodayBalance ?? 0;

        if (pastMargin > 0) {
            marginChange20D = ((latestMargin - pastMargin) / pastMargin);
        }
    }

    const allReasons: { priority: number; text: string }[] = [];

    // A) 法人方向 (70%)
    // 連續映射：用 F5 / (mean(abs(F20daily))+1) 衡量動能強度
    const fRatio = foreign5D / (foreignStats20.meanAbs + 1);
    let sF = 50;
    if (fRatio > 0) {
        sF = 50 + Math.min(45, fRatio * 15);
        if (sF >= 80) allReasons.push({ priority: 1, text: "外資近 5 日買超動能強勁且連續。" });
        else allReasons.push({ priority: 1, text: "外資近期籌碼偏多，呈現買超跡象。" });
    } else {
        sF = 50 + Math.max(-40, fRatio * 15);
        if (sF <= 20) allReasons.push({ priority: 1, text: "外資近 5 日出現沉重賣壓且動能強勁。" });
        else allReasons.push({ priority: 1, text: "外資近期籌碼偏空，轉為賣超。" });
    }

    const tRatio = trust5D / (trustStats20.meanAbs + 1);
    let sI = 50;
    if (tRatio > 0) {
        sI = 50 + Math.min(45, tRatio * 20);
        if (sI >= 80) allReasons.push({ priority: 2, text: "投信近 5 日買超力道放大，內資籌碼穩定。" });
        else allReasons.push({ priority: 2, text: "投信近期偏多操作，內資具撐盤力道。" });
    } else {
        sI = 50 + Math.max(-40, tRatio * 20);
        if (sI <= 20) allReasons.push({ priority: 2, text: "投信近期賣壓沉重，內資籌碼明顯鬆動。" });
        else allReasons.push({ priority: 2, text: "投信近期偏空操作，轉為賣超。" });
    }

    const inst = 0.6 * sF + 0.4 * sI;

    // B) 融資風險 (30%)
    let mScore = 50;
    if (marginChange20D !== null) {
        if (marginChange20D <= -0.05) {
            mScore = 75;
            allReasons.push({ priority: 3, text: `近 20 日融資餘額減少 ${(Math.abs(marginChange20D) * 100).toFixed(1)}%，籌碼沉澱風險降。` });
        } else if (marginChange20D <= 0.05) {
            mScore = 60 - ((marginChange20D - (-0.05)) / 0.1) * 10;
        } else if (marginChange20D < 0.15) {
            mScore = 50 - ((marginChange20D - 0.05) / 0.1) * 25;
            allReasons.push({ priority: 3, text: `近 20 日融資餘額增加 ${(marginChange20D * 100).toFixed(1)}%，稍微增加籌碼壓力。` });
        } else {
            mScore = 10;
            allReasons.push({ priority: 3, text: `近 20 日融資餘額暴增 ${(marginChange20D * 100).toFixed(1)}%，散戶籌碼凌亂且風險極高。` });
        }
    } else {
        // 缺融資資料
        mScore = 50;
        risks.push("融資資料缺漏，實質分數可能略有校正偏誤。");
    }

    const rawFlowScore = 0.70 * inst + 0.30 * mScore;
    let flowScore = Math.max(0, Math.min(100, rawFlowScore - penalty));

    // Risk Flags
    if (marginChange20D !== null && marginChange20D >= 0.15) {
        risks.push("margin_spike");
    }
    if (foreign5D < 0 && foreign20D > 0) {
        risks.push("inst_reversal_down");
    }
    if (foreign5D > 0 && foreign20D < 0) {
        risks.push("inst_reversal_up");
    }

    const finalReasons = Array.from(new Set(allReasons.sort((a, b) => a.priority - b.priority).map(r => r.text))).slice(0, 3);

    return {
        foreign5D, foreign20D, trust5D, trust20D, marginChange20D: marginChange20D !== null ? marginChange20D * 100 : null, // 為了相容 interface, 傳出百分比
        flowScore,
        reasons: finalReasons.length > 0 ? finalReasons : ["資料短缺"],
        risks
    };
}
