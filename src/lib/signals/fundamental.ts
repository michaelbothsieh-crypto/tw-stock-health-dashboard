import { MonthlyRevenue } from "../providers/finmind";

export interface FundamentalSignals {
    recent3MoYoyAverage: number | null;
    recent6MoYoyAverage: number | null;
    yoyTrend: 'up' | 'down' | 'flat' | null;
    fundamentalScore: number;
    reasons: string[];
}

export function calculateFundamental(revenue: MonthlyRevenue[]): FundamentalSignals {
    if (!revenue || revenue.length < 3) {
        return {
            recent3MoYoyAverage: null,
            recent6MoYoyAverage: null,
            yoyTrend: null,
            fundamentalScore: 50,
            reasons: ["營收資料不足，無法評估基本面。"]
        };
    }

    // 排序確保時間順序由舊到新
    const sortedRev = [...revenue].sort((a, b) => {
        if (a.revenue_year === b.revenue_year) {
            return a.revenue_month - b.revenue_month;
        }
        return a.revenue_year - b.revenue_year;
    });

    // 如果 API 有提供 revenue_year_on_year 則直接使用，否則我們需要往前找去年同月來計算 (但這較複雜，通常 FinMind 會給)
    // FinMind revenue_year_on_year 單位通常是 10.5 代表 10.5%
    const getYoY = (item: MonthlyRevenue) => {
        if (typeof item.revenue_year_on_year === 'number') {
            return item.revenue_year_on_year;
        }
        return 0; // 若無提供直接忽略
    };

    const validYoYs = sortedRev.map(getYoY);
    const latest3 = validYoYs.slice(-3);
    const latest6 = validYoYs.slice(-6);

    const avg3 = latest3.length > 0 ? latest3.reduce((a, b) => a + b, 0) / latest3.length : null;
    const avg6 = latest6.length > 0 ? latest6.reduce((a, b) => a + b, 0) / latest6.length : null;

    let yoyTrend: 'up' | 'down' | 'flat' | null = null;
    if (latest3.length === 3) {
        if (latest3[2] > latest3[1] && latest3[1] > latest3[0]) {
            yoyTrend = 'up';
        } else if (latest3[2] < latest3[1] && latest3[1] < latest3[0]) {
            yoyTrend = 'down';
        } else {
            yoyTrend = 'flat';
        }
    }

    let fundamentalScore = 50;
    const reasons: string[] = [];

    if (avg3 !== null) {
        if (avg3 > 20) {
            fundamentalScore += 30;
            reasons.push(`近三月營收 YoY 平均達 ${avg3.toFixed(1)}%，成長動能強勁。`);
        } else if (avg3 > 5) {
            fundamentalScore += 15;
            reasons.push(`近三月營收 YoY 平均為 ${avg3.toFixed(1)}%，穩定成長。`);
        } else if (avg3 < -10) {
            fundamentalScore -= 30;
            reasons.push(`近三月營收 YoY 平均衰退 ${Math.abs(avg3).toFixed(1)}%，基本面疲弱。`);
        } else if (avg3 < 0) {
            fundamentalScore -= 10;
            reasons.push(`近三月營收 YoY 平均小幅衰退 ${Math.abs(avg3).toFixed(1)}%。`);
        } else {
            reasons.push(`近三月營收 YoY 平均為 ${avg3.toFixed(1)}%，表現持平。`);
        }
    }

    if (yoyTrend === 'up') {
        fundamentalScore += 20;
        reasons.push("近三個月營收 YoY 呈現連續上升趨勢，動能轉強。");
    } else if (yoyTrend === 'down') {
        fundamentalScore -= 20;
        reasons.push("近三個月營收 YoY 呈現連續下滑趨勢，動能轉弱。");
    }

    fundamentalScore = Math.max(0, Math.min(100, fundamentalScore));

    return {
        recent3MoYoyAverage: avg3,
        recent6MoYoyAverage: avg6,
        yoyTrend,
        fundamentalScore,
        reasons
    };
}
