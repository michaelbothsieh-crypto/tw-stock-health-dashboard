import { NextRequest, NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { getInstitutionalInvestors, getMarginShort, getMonthlyRevenue } from "@/lib/providers/finmind";
import { calculateTrend } from "@/lib/signals/trend";
import { calculateFlow } from "@/lib/signals/flow";
import { calculateFundamental } from "@/lib/signals/fundamental";
import { generateExplanation } from "@/lib/ai/explain";
import { normalizeTicker } from "@/lib/ticker";
import { detectMarket } from "@/lib/market";
import { fetchRecentBars } from "@/lib/range";
import { getTaiwanStockNews } from "@/lib/providers/finmind";
import { calculateCatalystScore } from "@/lib/news/catalystScore";
import { getCompanyNameZh } from "@/lib/companyName";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ ticker: string }> }
) {
    try {
        const { ticker } = await params;
        const debugMode = req.nextUrl.searchParams.get('debug') === '1';
        const warnings: string[] = [];

        // 1. Ticker 正規化
        let norm;
        try {
            norm = normalizeTicker(ticker);
        } catch (e: any) {
            return NextResponse.json({ error: e.message || "Invalid Ticker" }, { status: 400 });
        }

        // 2. 市場探測
        const marketInfo = await detectMarket(norm.symbol);
        norm.market = marketInfo.market;
        norm.yahoo = marketInfo.yahoo;
        if (marketInfo.ambiguous) warnings.push("ambiguous_market");
        if (norm.market === 'UNKNOWN') warnings.push("市場未識別");

        // 2.5 取得中文股名
        const companyNameZh = await getCompanyNameZh(norm.symbol);
        const displayName = companyNameZh ? `${norm.symbol} ${companyNameZh}` : norm.symbol;

        // 3. 獲取 OHLCV (最近 180 根)
        const rangeResult = await fetchRecentBars(norm.symbol, 180);
        const prices = rangeResult.data;
        if (prices.length === 0) {
            warnings.push("完全無法取得價格資料");
            return NextResponse.json({ error: "No price data found for ticker" }, { status: 404 });
        }

        if (rangeResult.barsReturned < 130) {
            warnings.push(`價格資料不足 (僅 ${rangeResult.barsReturned} 筆，少於最低要求的 130 筆)`);
        }

        const tradingDates = prices.map(p => p.date);
        const t_end = prices[prices.length - 1].date;
        const tEndObj = new Date(t_end);

        // 4. 以 t_end 往前推算供其他資料抓取的區間
        // 法人/融資抓約 120 日曆天 (足夠涵蓋 60 根交易日)
        const flowStartDate = format(subDays(tEndObj, 120), 'yyyy-MM-dd');
        // 營收抓 18 個月 (540 日曆天)，確保有足夠的 YoY 資料 (包含容錯與前置期)
        const fundStartDate = format(subDays(tEndObj, 540), 'yyyy-MM-dd');
        // 新聞抓 7 日曆天 (偏敏感題材)
        const newsStartDate = format(subDays(tEndObj, 7), 'yyyy-MM-dd');

        const [investors, margin, revenue, rawNews] = await Promise.all([
            getInstitutionalInvestors(norm.symbol, flowStartDate, t_end).catch(() => []),
            getMarginShort(norm.symbol, flowStartDate, t_end).catch(() => []),
            getMonthlyRevenue(norm.symbol, fundStartDate, t_end).catch(() => []),
            getTaiwanStockNews(norm.symbol, newsStartDate, t_end).catch(() => []),
        ]);

        // 5. 計算訊號
        const trendSignals = calculateTrend(prices);
        const flowSignals = calculateFlow(tradingDates, investors, margin);
        const fundamentalSignals = calculateFundamental(revenue);

        // 整理 flow 的風險到頂層 warnings
        if (flowSignals.risks.includes("資料缺漏比例偏高，分數可信度下降。")) {
            warnings.push("法人資料缺漏比例偏高");
        }

        // 6. 計算 Catalyst Score (近期題材面)
        const catalystResult = calculateCatalystScore(rawNews, tEndObj, 7);

        // 7. AI 解釋
        const aiExplanation = generateExplanation(norm.symbol, trendSignals, flowSignals, fundamentalSignals, catalystResult);

        return NextResponse.json({
            normalizedTicker: {
                ...norm,
                companyNameZh,
                displayName
            },
            dataWindow: {
                barsRequested: rangeResult.barsRequested,
                barsReturned: rangeResult.barsReturned,
                endDate: rangeResult.endDate
            },
            warnings,
            lastUpdate: t_end,
            data: {
                prices: prices.map(p => ({
                    date: p.date,
                    close: p.close,
                    volume: p.Trading_Volume
                })).slice(-120),
            },
            signals: {
                trend: trendSignals,
                flow: flowSignals,
                fundamental: fundamentalSignals,
            },
            news: catalystResult,
            explain: {
                stance: aiExplanation.stance,
                confidence: aiExplanation.confidence,
                summary: aiExplanation.summary,
                key_points: aiExplanation.key_points,
                risks: aiExplanation.risks
            },
            ...(debugMode && {
                debug: {
                    request_params: {
                        symbol: norm.symbol,
                        market: norm.market,
                        flowStartDate,
                        fundStartDate,
                        revenue_fetched_count: revenue.length
                    },
                    ...aiExplanation.debug
                }
            })
        });
    } catch (error: any) {
        console.error("Snapshot API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
