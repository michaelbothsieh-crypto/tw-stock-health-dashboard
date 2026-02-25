import { MonthlyRevenue } from "../providers/finmind";

export interface FundamentalSignals {
    recent3MoYoyAverage: number | null;
    recent6MoYoyAverage: number | null;
    yoyTrend: 'up' | 'down' | 'flat' | null;
    fundamentalScore: number | null;
    reasons: string[];
    risks: string[];
}

export function calculateFundamental(revenue: MonthlyRevenue[]): FundamentalSignals {
    const defaultReturn: FundamentalSignals = {
        recent3MoYoyAverage: null,
        recent6MoYoyAverage: null,
        yoyTrend: null,
        fundamentalScore: null,
        reasons: ["營收資料不足，無法評估基本面。"],
        risks: []
    };

    if (!revenue || revenue.length < 8) return defaultReturn;

    // 排序確保時間順序由舊到新
    const sortedRev = [...revenue].sort((a, b) => {
        if (a.revenue_year === b.revenue_year) {
            return a.revenue_month - b.revenue_month;
        }
        return a.revenue_year - b.revenue_year;
    });

    const getYoY = (item: MonthlyRevenue, _: number, arr: MonthlyRevenue[]) => {
        let yoyValue: number | null = null;
        if (typeof item.revenue_year_on_year === 'number') {
            yoyValue = item.revenue_year_on_year;
        } else {
            // Fallback calculation manually if yoy field is missing
            const lastYearItem = arr.find(a => a.revenue_year === item.revenue_year - 1 && a.revenue_month === item.revenue_month);
            if (lastYearItem && lastYearItem.revenue > 0) {
                yoyValue = (item.revenue / lastYearItem.revenue - 1) * 100;
            }
        }

        // Standardize: If yoyValue is raw decimals like 0.12 (less than 1 but not 0), 
        // normally YoY is returned in percentages by finmind. Sometimes it's safe to assume Finmind gives percentages directly.
        // We will assume FinMind returns percentages (e.g., 12.5 = 12.5%).
        return yoyValue;
    };

    const yoyList = sortedRev.map((item, i, arr) => getYoY(item, i, arr)).filter(y => y !== null) as number[];

    // 要求最近 6 個月可用月份 >= 5
    const latest6List = yoyList.slice(-6);
    if (latest6List.length < 5) {
        return defaultReturn;
    }

    const latest3List = yoyList.slice(-3);
    const prev3List = yoyList.slice(-6, -3);

    const checkAvg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const y3 = checkAvg(latest3List);
    const y6 = checkAvg(latest6List);
    const prev3 = checkAvg(prev3List);
    const trend3 = (y3 !== null && prev3 !== null) ? y3 - prev3 : null;

    let yoyTrend: 'up' | 'down' | 'flat' | null = null;
    if (latest3List.length === 3) {
        if (latest3List[2] > latest3List[1] && latest3List[1] > latest3List[0]) {
            yoyTrend = 'up';
        } else if (latest3List[2] < latest3List[1] && latest3List[1] < latest3List[0]) {
            yoyTrend = 'down';
        } else {
            yoyTrend = 'flat';
        }
    }

    let fundamentalScore: number | null = 50;
    const allReasons: { priority: number; text: string }[] = [];
    const risks: string[] = [];

    // C3) 新分數公式
    if (y3 !== null) {
        // 連續映射：避免爆分 (中心點 50，以 25% 為一個 tanh 斜率標準，最高加 30 到 80 分區間)
        const level = 50 + Math.tanh(y3 / 25) * 30;

        // 加速度修正：clamp(trend3 * 1.2, -10, 10)
        let accel = 0;
        if (trend3 !== null) {
            accel = Math.max(-10, Math.min(10, trend3 * 1.2));
        }

        // 一致性修正
        let consistency = 0;
        const negCount = latest3List.filter(y => y < 0).length;
        const highGrowthCount = latest3List.filter(y => y > 20).length;

        if (negCount >= 2) {
            consistency = -8;
            risks.push("rev_turn_negative");
        } else if (highGrowthCount >= 2) {
            consistency = 4;
        }

        // Risk: growth_decelerating
        if (trend3 !== null && trend3 <= -10) {
            risks.push("growth_decelerating");
        }

        const raw = level + accel + consistency;
        const roundedRaw = Math.round(raw * 10) / 10;
        fundamentalScore = Math.max(10, Math.min(95, roundedRaw));

        // Reasons
        allReasons.push({ priority: 1, text: `近 3 個月營收 YoY 平均為 ${y3.toFixed(1)}%。` });

        if (trend3 !== null) {
            if (trend3 >= 3) {
                allReasons.push({ priority: 2, text: `動能加速：YoY 平均近期上升 ${trend3.toFixed(1)} 個百分點。` });
            } else if (trend3 <= -3) {
                allReasons.push({ priority: 2, text: `動能放緩：YoY 平均近期下滑 ${Math.abs(trend3).toFixed(1)} 個百分點。` });
            }
        }

        if (negCount >= 2) {
            allReasons.push({ priority: 3, text: "連續數月營收衰退，基本面疲弱。" });
        } else if (highGrowthCount >= 2) {
            allReasons.push({ priority: 3, text: "營收維持多次高成長，趨勢一致且強勁。" });
        }
    } else {
        // 可用月份不足 (理論上前面已被擋下，但確保安全)
        fundamentalScore = null;
        allReasons.push({ priority: 1, text: `月營收資料不足 (可用 ${latest6List.length} 筆)。` });
    }

    const finalReasons = Array.from(new Set(allReasons.sort((a, b) => a.priority - b.priority).map(r => r.text))).slice(0, 3);

    return {
        recent3MoYoyAverage: y3,
        recent6MoYoyAverage: y6,
        yoyTrend,
        fundamentalScore,
        reasons: finalReasons.length > 0 ? finalReasons : ["基本面資料中性。"],
        risks
    };
}
