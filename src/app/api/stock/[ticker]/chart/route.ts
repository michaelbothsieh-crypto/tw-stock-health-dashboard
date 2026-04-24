import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { normalizeTicker } from "@/shared/utils/ticker";
import { detectMarket, isMarketOpen } from "@/shared/utils/market";
import { fetchRecentBars } from "@/shared/utils/range";
import { renderStockChart, ChartDataPoint } from "@/shared/utils/chartRenderer";
import { calculateKeyLevels } from "@/domain/signals/keyLevels";
import { getCache, setCache } from "@/infrastructure/providers/redisCache";
import { fetchFugleQuote } from "@/infrastructure/providers/fugleQuote";

/**
 * GET /api/stock/{ticker}/chart
 * 回傳 K 線圖 PNG，供 LINE 等需要公開 URL 的平台使用。
 * Cache-Control: 5 分鐘（盤中）；可用 ?ts= 強制 bust。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params;
    const isMobile = req.nextUrl.searchParams.get("mobile") === "1";
    let norm;
    try {
      norm = normalizeTicker(ticker);
    } catch {
      return new NextResponse("Invalid ticker", { status: 400 });
    }

    const marketInfo = await detectMarket(norm.symbol);
    norm.market = marketInfo.market;
    norm.yahoo = marketInfo.yahoo;

    // Redis 快取：同一檔股票 5 分鐘內不重複渲染（防 LINE CDN 重複抓）
    const todayStr = new Date().toLocaleDateString("en-CA");
    const cacheKey = `chart:png:${norm.symbol}:${todayStr}:${isMobile ? "m" : "d"}`;
    const cachedPng = await getCache<string>(cacheKey);
    if (cachedPng) {
      const buf = Buffer.from(cachedPng, "base64");
      return new NextResponse(buf as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
      });
    }

    // 美股（字母代號）：直接 proxy Finviz 圖片
    if (!/^\d/.test(norm.symbol)) {
      const isUsOpen = isMarketOpen(norm.symbol);
      const period = isUsOpen ? 'd' : 'i5';
      const finvizUrl = `https://finviz.com/chart.ashx?t=${norm.symbol}&ty=c&ta=1&p=${period}&ext=1`;
      const chartRes = await fetch(finvizUrl, {
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://finviz.com/" },
      });
      if (!chartRes.ok) return new NextResponse("Chart not available", { status: 404 });
      const ab = await chartRes.arrayBuffer();
      const pngBuffer = Buffer.from(ab);
      await setCache(cacheKey, pngBuffer.toString("base64"), 300);
      return new NextResponse(pngBuffer as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
      });
    }

    const rangeResult = await fetchRecentBars(norm.symbol, 180);
    const prices = rangeResult.data;
    if (prices.length < 2) {
      return new NextResponse("Insufficient price data", { status: 404 });
    }

    const chartData: ChartDataPoint[] = prices.map((p: any) => ({
      date: p.date,
      open: p.open,
      high: p.high || p.max,
      low: p.low || p.min,
      close: p.close,
      volume: p.volume || p.Trading_Volume,
    }));

    // 即時報價：優先 Fugle（台股），fallback Yahoo
    try {
      const fugle = await fetchFugleQuote(norm.symbol);
      let rtPrice: number | null = null, rtHigh: number | null = null, rtLow: number | null = null, rtOpen: number | null = null, rtVol: number | null = null;

      if (fugle) {
        rtPrice = fugle.price; rtHigh = fugle.high; rtLow = fugle.low; rtOpen = fugle.open; rtVol = fugle.volume;
      } else {
        const { yf } = await import("@/infrastructure/providers/yahooFinanceClient");
        const yahooSym = norm.yahoo || `${norm.symbol}.TW`;
        const rtRaw = await yf.quote(yahooSym);
        const rt: any = Array.isArray(rtRaw) ? rtRaw[0] : rtRaw;
        if (rt && typeof rt.regularMarketPrice === "number") {
          rtPrice = rt.regularMarketPrice;
          rtHigh = rt.regularMarketDayHigh ?? rtPrice;
          rtLow = rt.regularMarketDayLow ?? rtPrice;
          rtOpen = rt.regularMarketOpen ?? rtPrice;
          rtVol = rt.regularMarketVolume ?? 0;
        }
      }

      if (rtPrice !== null) {
        const last = chartData[chartData.length - 1];
        if (last.date === todayStr) {
          chartData[chartData.length - 1] = {
            ...last, close: rtPrice,
            high: Math.max(last.high, rtHigh ?? rtPrice),
            low: Math.min(last.low, rtLow ?? rtPrice),
          };
        } else {
          chartData.push({ date: todayStr, open: rtOpen ?? rtPrice, high: rtHigh ?? rtPrice, low: rtLow ?? rtPrice, close: rtPrice, volume: rtVol ?? 0 });
        }
      }
    } catch {
      // 無即時報價，沿用歷史資料
    }

    const keyLevels = calculateKeyLevels(chartData);
    const support    = keyLevels.supportLevel  ?? null;
    const resistance = keyLevels.breakoutLevel ?? null;

    const chartOpts = isMobile ? { width: 800, height: 500 } : {};
    const pngBuffer = await renderStockChart(chartData, support, resistance, norm.symbol, 180, chartOpts);

    // 快取 5 分鐘（base64 存 Redis）
    await setCache(cacheKey, (pngBuffer as Buffer).toString("base64"), 300);

    return new NextResponse(pngBuffer as unknown as BodyInit, {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[Chart API] Error:", err);
    return new NextResponse("Chart generation failed", { status: 500 });
  }
}
