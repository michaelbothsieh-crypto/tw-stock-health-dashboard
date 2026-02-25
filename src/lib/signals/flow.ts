import { InstitutionalInvestor, MarginShort } from "../providers/finmind";

export interface FlowSignals {
    foreign5D: number;
    foreign20D: number;
    trust5D: number;
    trust20D: number;
    marginChange20D: number | null; // 融資 20 日變化率 (%)
    flowScore: number;
    reasons: string[];
    risks: string[];
}

export function calculateFlow(investors: InstitutionalInvestor[], marginShort: MarginShort[]): FlowSignals {
    // Sort data ascending
    const sortedInvestors = [...investors].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const sortedMargin = [...marginShort].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Extract unique dates for recent N days calculation based on Investor data
    const uniqueDates = Array.from(new Set(sortedInvestors.map(d => d.date))).sort();

    function getRecentNetBuy(days: number, typeIndicator: string): number {
        if (uniqueDates.length === 0) return 0;
        const targetDates = uniqueDates.slice(-days);

        let netBuy = 0;
        for (const record of sortedInvestors) {
            if (targetDates.includes(record.date) && record.name.includes(typeIndicator)) {
                netBuy += (record.buy - record.sell);
            }
        }
        return netBuy;
    }

    const foreign5D = getRecentNetBuy(5, "外資"); // 可能包含外資及陸資
    const foreign20D = getRecentNetBuy(20, "外資");
    const trust5D = getRecentNetBuy(5, "投信");
    const trust20D = getRecentNetBuy(20, "投信");

    let marginChange20D: number | null = null;
    if (sortedMargin.length >= 20) {
        const latestMargin = sortedMargin[sortedMargin.length - 1].MarginPurchaseTodayBalance || 0;
        const pastMargin = sortedMargin[sortedMargin.length - 20].MarginPurchaseTodayBalance || 0;
        if (pastMargin > 0) {
            marginChange20D = ((latestMargin - pastMargin) / pastMargin) * 100;
        }
    }

    let flowScore = 50;
    const reasons: string[] = [];
    const risks: string[] = [];

    // 外資評分 (+/- 25)
    let foreignScore = 0;
    if (foreign20D > 0 && foreign5D > 0) {
        foreignScore = 25;
        reasons.push("外資近 5 日與近 20 日皆呈現淨買超，外資籌碼偏多。");
    } else if (foreign20D < 0 && foreign5D < 0) {
        foreignScore = -25;
        reasons.push("外資近 5 日與近 20 日皆呈現淨賣超，外資籌碼偏空。");
        risks.push("外資連續倒貨，留意籌碼鬆動。");
    } else if (foreign5D > 0) {
        foreignScore = 10;
        reasons.push("外資近 5 日轉為淨買超，短線籌碼有偏多跡象。");
    } else if (foreign5D < 0) {
        foreignScore = -10;
        reasons.push("外資近 5 日轉為淨賣超，短線籌碼轉弱。");
    }

    // 投信評分 (+/- 25)
    let trustScore = 0;
    if (trust20D > 0 && trust5D > 0) {
        trustScore = 25;
        reasons.push("投信近 5 日與近 20 日皆呈現淨買超，內資籌碼穩定偏多。");
    } else if (trust20D < 0 && trust5D < 0) {
        trustScore = -20;
        reasons.push("投信近 5 日與近 20 日皆呈現淨賣超，投信籌碼偏空。");
        risks.push("投信停損或結帳壓力。");
    } else if (trust5D > 0) {
        trustScore = 15;
        reasons.push("投信近 5 日轉為淨買超，內資可能開始關注。");
    } else if (trust5D < 0) {
        trustScore = -15;
        reasons.push("投信近 5 日轉為淨賣超，內資籌碼鬆動。");
    }

    // 融資評分 (+/- 10)
    let marginScore = 0;
    if (marginChange20D !== null) {
        if (marginChange20D > 10) {
            marginScore = -10; // 融資暴增扣分
            reasons.push(`近 20 日融資餘額暴增 ${marginChange20D.toFixed(1)}%，散戶籌碼凌亂。`);
            risks.push("融資增幅過大，短線可能有籌碼清洗風險。");
        } else if (marginChange20D < -5) {
            marginScore = 10; // 融資大減加分
            reasons.push(`近 20 日融資餘額減少 ${Math.abs(marginChange20D).toFixed(1)}%，籌碼沉澱良好。`);
        } else {
            reasons.push(`近 20 日融資餘額變化 ${marginChange20D.toFixed(1)}%，變化不大。`);
        }
    }

    flowScore += foreignScore + trustScore + marginScore;

    // 確保分數在 0-100 之間
    flowScore = Math.max(0, Math.min(100, flowScore));

    return {
        foreign5D, foreign20D, trust5D, trust20D, marginChange20D,
        flowScore,
        reasons,
        risks
    };
}
