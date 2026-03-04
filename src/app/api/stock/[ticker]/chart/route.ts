import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { normalizeTicker } from "@/lib/ticker";
import { detectMarket } from "@/lib/market";
import { fetchRecentBars } from "@/lib/range";
import { renderStockChart, ChartDataPoint } from "@/lib/ux/chartRenderer";
import { calculateKeyLevels } from "@/lib/signals/keyLevels";

/**
 * GET /api/stock/{ticker}/chart
 * 回傳 K 線圖 PNG，供 LINE 等需要公開 URL 的平台使用。
 * Cache-Control: 5 分鐘（盤中）；可用 ?ts= 強制 bust。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params;
    let norm;
    try {
      norm = normalizeTicker(ticker);
    } catch {
      return new NextResponse("Invalid ticker", { status: 400 });
    }

    const marketInfo = await detectMarket(norm.symbol);
    norm.market = marketInfo.market;
    norm.yahoo = marketInfo.yahoo;

    const rangeResult = await fetchRecentBars(norm.symbol, 180);
    const prices = rangeResult.data;
    if (prices.length < 2) {
      return new NextResponse("Insufficient price data", { status: 404 });
    }

    const chartData: ChartDataPoint[] = prices.map((p) => ({
      date: p.date,
      open: p.open,
      high: p.max,
      low: p.min,
      close: p.close,
      volume: p.Trading_Volume,
    }));

    // Inject today's real-time bar if available
    try {
      const { yf } = await import("@/lib/providers/yahooFinanceClient");
      const yahooSym = norm.yahoo || `${norm.symbol}.TW`;
      const rtRaw = await yf.quote(yahooSym);
      const rt: any = Array.isArray(rtRaw) ? rtRaw[0] : rtRaw;
      if (rt && typeof rt.regularMarketPrice === "number") {
        const todayStr = new Date().toLocaleDateString("en-CA");
        const last = chartData[chartData.length - 1];
        const rtHigh = rt.regularMarketDayHigh ?? rt.regularMarketPrice;
        const rtLow  = rt.regularMarketDayLow  ?? rt.regularMarketPrice;
        const rtOpen = rt.regularMarketOpen     ?? rt.regularMarketPrice;
        if (last.date === todayStr) {
          chartData[chartData.length - 1] = {
            ...last,
            close: rt.regularMarketPrice,
            high: Math.max(last.high, rtHigh),
            low:  Math.min(last.low,  rtLow),
          };
        } else {
          chartData.push({ date: todayStr, open: rtOpen, high: rtHigh, low: rtLow, close: rt.regularMarketPrice, volume: rt.regularMarketVolume || 0 });
        }
      }
    } catch {
      // OK — proceed with historical data only
    }

    const keyLevels = calculateKeyLevels(chartData);
    const support    = keyLevels.supportLevel    ?? null;
    const resistance = keyLevels.breakoutLevel   ?? null;

    const pngBuffer = await renderStockChart(chartData, support, resistance, norm.symbol, 180);

    return new NextResponse(pngBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[Chart API] Error:", err);
    return new NextResponse("Chart generation failed", { status: 500 });
  }
}
