import { InstitutionalInvestor, MarginShort } from "../providers/finmind";

export interface FlowSignals {
    foreign5D: number;
    foreign20D: number;
    trust5D: number;
    trust20D: number;
    marginChange20D: number | null; // 融資 20 日變化率 (%)
    
    // --- 籌碼對抗雷達 (2x2 滿血版) ---
    institutionalLots: number; // 三大法人近 5 日淨買賣張數
    trustLots: number;         // 投信近 5 日淨買賣張數
    marginLots: number;        // 融資近 5 日增減張數
    shortLots: number;         // 融券近 5 日增減張數
    
    smartMoneyFlow: number; // 5D 法人淨買賣張數 (原邏輯保留，股數單位)
    retailSentiment: number; // 5D 融資張數變化 (原邏輯保留，股數單位)
    flowVerdict: "籌碼集中 (黃金背離)" | "散戶接刀 (籌碼凌亂)" | "中性震盪";
    
    flowScore: number | null;
    reasons: string[];
    risks: string[];
}

export function calculateFlow(
    tradingDates: string[], 
    investors: InstitutionalInvestor[], 
    marginShort: MarginShort[]
): FlowSignals {
    const defaultReturn: FlowSignals = {
        foreign5D: 0, foreign20D: 0, trust5D: 0, trust20D: 0, marginChange20D: null,
        institutionalLots: 0, trustLots: 0, marginLots: 0, shortLots: 0,
        smartMoneyFlow: 0, retailSentiment: 0, flowVerdict: "中性震盪",
        flowScore: null, reasons: ["資料量不足，無法評估籌碼面。"], risks: []
    };

    if (!investors || investors.length === 0 || tradingDates.length < 30) return defaultReturn;

    // Sort data ascending
    const sortedInvestors = [...investors].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const sortedMargin = [...marginShort].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const risks: string[] = [];

    // 計算特定投資人的特定天數買賣超
    function getRecentNetBuyStats(days: number, typeIndicator: string) {
        const targetDates = tradingDates.slice(-days);
        let netBuy = 0;
        let daysWithData = 0;
        let dailyAbsSum = 0;

        for (const date of targetDates) {
            let found = false;
            let dailyNet = 0;
            for (const record of sortedInvestors) {
                // FinMind 原始資料名稱處理
                const isForeign = typeIndicator === "外資" && (record.name.includes("Foreign_Investor") || record.name.includes("外資"));
                const isTrust = typeIndicator === "投信" && (record.name.includes("Investment_Trust") || record.name.includes("投信"));
                const isDealer = typeIndicator === "自營商" && (record.name.includes("Dealer") || record.name.includes("自營商"));
                
                if (record.date === date && (isForeign || isTrust || isDealer)) {
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

        return {
            total: netBuy,
            meanAbs: daysWithData > 0 ? dailyAbsSum / daysWithData : 0,
            missingCount: days - daysWithData
        };
    }

    const foreignStats20 = getRecentNetBuyStats(20, "外資");
    const foreignStats5 = getRecentNetBuyStats(5, "外資");
    const trustStats20 = getRecentNetBuyStats(20, "投信");
    const trustStats5 = getRecentNetBuyStats(5, "投信");
    const dealerStats5 = getRecentNetBuyStats(5, "自營商");

    const foreign20D = foreignStats20.total;
    const foreign5D = foreignStats5.total;
    const trust20D = trustStats20.total;
    const trust5D = trustStats5.total;
    const dealer5D = dealerStats5.total;

    // 單位換算：股 -> 張
    const institutionalLots = Math.round((foreign5D + trust5D + dealer5D) / 1000);
    const trustLots = Math.round(trust5D / 1000);

    // 檢查缺值比例 > 20%
    let penalty = 0;
    if (foreignStats20.missingCount / 20 > 0.2) {
        risks.push("flow_data_missing");
        penalty = 10;
    }

    // --- 融資融券趨勢 ---
    let marginChange20D: number | null = null;
    let retailSentiment = 0; // 5D 變化 (股)
    let marginLots = 0;      // 5D 變化 (張)
    let shortLots = 0;       // 5D 變化 (張)

    const marginTargetDates = tradingDates.slice(-20);
    if (marginTargetDates.length >= 20) {
        const latestDate = marginTargetDates[marginTargetDates.length - 1];
        const date5D = marginTargetDates[marginTargetDates.length - 5];
        const pastDate = marginTargetDates[0];

        const latestMarginRecord = sortedMargin.find(m => m.date === latestDate);
        const marginRecord5D = sortedMargin.find(m => m.date === date5D);
        const pastMarginRecord = sortedMargin.find(m => m.date === pastDate);

        const latestMargin = latestMarginRecord?.MarginPurchaseTodayBalance ?? 0;
        const margin5D = marginRecord5D?.MarginPurchaseTodayBalance ?? 0;
        const pastMargin = pastMarginRecord?.MarginPurchaseTodayBalance ?? 0;

        const latestShort = latestMarginRecord?.ShortSaleTodayBalance ?? 0;
        const short5D = marginRecord5D?.ShortSaleTodayBalance ?? 0;

        if (pastMargin > 0) {
            marginChange20D = ((latestMargin - pastMargin) / pastMargin);
        }
        retailSentiment = latestMargin - margin5D;
        marginLots = Math.round(retailSentiment / 1000);
        shortLots = Math.round((latestShort - short5D) / 1000);
    }

    // --- 籌碼對抗雷達邏輯 ---
    const smartMoneyFlow = foreign5D + trust5D;
    let flowVerdict: "籌碼集中 (黃金背離)" | "散戶接刀 (籌碼凌亂)" | "中性震盪" = "中性震盪";

    if (smartMoneyFlow > 0 && retailSentiment < 0) {
        flowVerdict = "籌碼集中 (黃金背離)";
    } else if (smartMoneyFlow < 0 && retailSentiment > 0) {
        flowVerdict = "散戶接刀 (籌碼凌亂)";
    }

    const allReasons: { priority: number; text: string }[] = [];

    // A) 法人方向 (70%)
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
            allReasons.push({ priority: 3, text: `近 20 日融資餘額減少 ${(Math.abs(marginChange20D) * 100).toFixed(1)}%，籌碼沉澱風險降，散戶退場。` });
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
        mScore = 50;
        risks.push("margin_data_missing");
    }

    // 綜合對抗結論的額外權重
    let synergyBonus = 0;
    if (flowVerdict === "籌碼集中 (黃金背離)") synergyBonus = 5;
    if (flowVerdict === "散戶接刀 (籌碼凌亂)") synergyBonus = -10;

    const rawFlowScore = 0.70 * inst + 0.30 * mScore + synergyBonus;
    let flowScore = Math.max(0, Math.min(100, rawFlowScore - penalty));

    // Risk Flags
    if (marginChange20D !== null && marginChange20D >= 0.15) {
        risks.push("margin_spike");
    }
    if (flowVerdict === "散戶接刀 (籌碼凌亂)") {
        risks.push("retail_taking_knives");
    }
    // 偵測融券大增 (軋空潛力)
    if (shortLots > 500) { // 超過 500 張算顯著
        risks.push("short_squeeze_potential");
    }

    const finalReasons = Array.from(new Set(allReasons.sort((a, b) => a.priority - b.priority).map(r => r.text))).slice(0, 3);

    return {
        foreign5D, foreign20D, trust5D, trust20D, 
        marginChange20D: marginChange20D !== null ? marginChange20D * 100 : null,
        institutionalLots,
        trustLots,
        marginLots,
        shortLots,
        smartMoneyFlow,
        retailSentiment,
        flowVerdict,
        flowScore,
        reasons: finalReasons.length > 0 ? finalReasons : ["資料短缺"],
        risks
    };
}
