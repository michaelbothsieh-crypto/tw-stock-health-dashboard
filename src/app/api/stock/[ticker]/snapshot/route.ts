import { NextRequest, NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { getPriceDaily, getInstitutionalInvestors, getMarginShort, getMonthlyRevenue } from "@/lib/providers/finmind";
import { calculateTrend } from "@/lib/signals/trend";
import { calculateFlow } from "@/lib/signals/flow";
import { calculateFundamental } from "@/lib/signals/fundamental";
import { generateExplanation } from "@/lib/ai/explain";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ ticker: string }> }
) {
    try {
        const { ticker } = await params; // Next.js 15 params API change

        // 定義查詢區間
        const today = new Date();
        const endDate = format(today, 'yyyy-MM-dd');
        const startDate180 = format(subDays(today, 180), 'yyyy-MM-dd'); // 約半年交易日
        const startDate365 = format(subDays(today, 365), 'yyyy-MM-dd'); // 營收需要更長

        // 並行獲取資料
        const [prices, investors, margin, revenue] = await Promise.all([
            getPriceDaily(ticker, startDate180, endDate).catch(() => []),
            getInstitutionalInvestors(ticker, startDate180, endDate).catch(() => []),
            getMarginShort(ticker, startDate180, endDate).catch(() => []),
            getMonthlyRevenue(ticker, startDate365, endDate).catch(() => []),
        ]);

        if (!prices || prices.length === 0) {
            return NextResponse.json({ error: "No price data found for ticker" }, { status: 404 });
        }

        // 計算訊號
        const trendSignals = calculateTrend(prices);
        const flowSignals = calculateFlow(investors, margin);
        const fundamentalSignals = calculateFundamental(revenue);

        // AI 解釋
        const aiExplanation = generateExplanation(ticker, trendSignals, flowSignals, fundamentalSignals);

        return NextResponse.json({
            ticker,
            lastUpdate: prices[prices.length - 1].date,
            data: {
                prices: prices.map(p => ({
                    date: p.date,
                    close: p.close,
                    volume: p.Trading_Volume
                })).slice(-120), // 傳給前端畫圖，120天足夠
            },
            signals: {
                trend: trendSignals,
                flow: flowSignals,
                fundamental: fundamentalSignals,
            },
            explain: aiExplanation,
        });
    } catch (error: any) {
        console.error("Snapshot API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
