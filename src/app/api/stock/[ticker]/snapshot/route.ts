import { NextRequest, NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import {
  FinmindProviderError,
  getInstitutionalInvestors,
  getMarginShort,
  getMonthlyRevenue,
  getTaiwanStockNews,
} from "@/lib/providers/finmind";
import { calculateTrend } from "@/lib/signals/trend";
import { calculateFlow } from "@/lib/signals/flow";
import { calculateFundamental } from "@/lib/signals/fundamental";
import { generateExplanation } from "@/lib/ai/explain";
import { normalizeTicker } from "@/lib/ticker";
import { detectMarket } from "@/lib/market";
import { fetchRecentBars } from "@/lib/range";
import { calculateCatalystScore } from "@/lib/news/catalystScore";
import { getCompanyNameZh } from "@/lib/companyName";
import { calculateShortTermVolatility } from "@/lib/signals/shortTermVolatility";
import { calculateShortTermSignals } from "@/lib/signals/shortTerm";
import { predictProbabilities } from "@/lib/predict/probability";
import { getCalibrationModel } from "@/lib/predict/calibration";
import { generateStrategy } from "@/lib/strategy/strategyEngine";
import { buildExplainBreakdown } from "@/lib/explainBreakdown";
import { calculateConsistency } from "@/lib/consistency";
import { calculateInstitutionCorrelation } from "@/lib/analytics/correlation";
import { calculateKeyLevels } from "@/lib/signals/keyLevels";
import { buildUxSummary } from "@/lib/ux/summaryBuilder";
import { resolveStockProfile } from "@/lib/industry/stockProfileResolver";
import { getOrComputeClusters } from "@/lib/global/clusteringEngine";
import { mapThemeToUS } from "@/lib/global/themeMapper";
import { selectDrivers } from "@/lib/global/driverSelector";
import { calculateRelativeStrength } from "@/lib/analytics/relativeStrength";
import { fetchYahooFinanceBars } from "@/lib/global/yahooFinance";
import { evaluateCrashWarning } from "@/lib/global/crash/crashEngine";
import { selectTwPeers } from "@/lib/global/twPeerSelector";
import { getMarketIndicators } from "@/lib/providers/marketIndicators";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params;
    const debugMode = req.nextUrl.searchParams.get("debug") === "1";
    const warnings: string[] = [];

    let norm;
    try {
      norm = normalizeTicker(ticker);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid Ticker";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const marketInfo = await detectMarket(norm.symbol);
    norm.market = marketInfo.market;
    norm.yahoo = marketInfo.yahoo;
    if (marketInfo.ambiguous) warnings.push("ambiguous_market");
    if (norm.market === "UNKNOWN") warnings.push("market_unknown");

    const companyNameZh = await getCompanyNameZh(norm.symbol);
    const displayName = companyNameZh ? `${norm.symbol} ${companyNameZh}` : norm.symbol;

    const rangeResult = await fetchRecentBars(norm.symbol, 180);
    const prices = rangeResult.data;

    if (prices.length === 0) {
      warnings.push("price_data_missing");
      return NextResponse.json({ error: "No price data found for ticker" }, { status: 404 });
    }

    if (rangeResult.barsReturned < 130) {
      warnings.push(`bars_insufficient_${rangeResult.barsReturned}`);
    }

    const tradingDates = prices.map((p) => p.date);
    const latestDate = prices[prices.length - 1].date;
    const latestDateObj = new Date(latestDate);

    const flowStartDate = format(subDays(latestDateObj, 120), "yyyy-MM-dd");
    const fundamentalStartDate = format(subDays(latestDateObj, 540), "yyyy-MM-dd");
    const newsStartDate = format(subDays(latestDateObj, 7), "yyyy-MM-dd");

    const [investorsResult, marginResult, revenueResult, newsResult] = await Promise.all([
      getInstitutionalInvestors(norm.symbol, flowStartDate, latestDate).catch((error) => {
        if (error instanceof FinmindProviderError) {
          warnings.push(`investors_error:${error.errorCode}`);
        }
        return { data: [], meta: { authUsed: "anon", fallbackUsed: false } };
      }),
      getMarginShort(norm.symbol, flowStartDate, latestDate).catch((error) => {
        if (error instanceof FinmindProviderError) {
          warnings.push(`margin_error:${error.errorCode}`);
        }
        return { data: [], meta: { authUsed: "anon", fallbackUsed: false } };
      }),
      getMonthlyRevenue(norm.symbol, fundamentalStartDate, latestDate).catch((error) => {
        if (error instanceof FinmindProviderError) {
          warnings.push(`revenue_error:${error.errorCode}`);
        }
        return { data: [], meta: { authUsed: "anon", fallbackUsed: false } };
      }),
      getTaiwanStockNews(norm.symbol, newsStartDate, latestDate).catch((error) => {
        if (error instanceof FinmindProviderError) {
          return {
            data: [],
            meta: {
              authUsed: error.meta.authUsed,
              fallbackUsed: error.meta.fallbackUsed,
              statusAnon: error.meta.statusAnon,
              statusEnv: error.meta.statusEnv,
              errorCode: error.errorCode,
              message: error.message,
            },
          };
        }

        const message = error instanceof Error ? error.message : String(error);
        return {
          data: [],
          meta: {
            authUsed: "anon" as const,
            fallbackUsed: false,
            errorCode: "news_fetch_failed",
            message,
          },
        };
      }),
    ]);

    const investors = investorsResult.data;
    const margin = marginResult.data;
    const revenue = revenueResult.data;
    const rawNews = newsResult.data;
    const newsErrorCode = newsResult.meta.errorCode ?? null;
    const newsErrorMessage = newsResult.meta.message ?? null;

    const trendSignals = calculateTrend(prices);
    const flowSignals = calculateFlow(tradingDates, investors, margin);
    const fundamentalSignals = calculateFundamental(revenue);
    const shortTermVolatility = calculateShortTermVolatility(prices);
    const shortTerm = calculateShortTermSignals(prices, trendSignals, shortTermVolatility);

    if (flowSignals.risks.includes("flow_data_missing")) {
      warnings.push("flow_data_missing");
    }

    const catalystResult = calculateCatalystScore(rawNews, latestDateObj, 7);
    const aiExplanation = generateExplanation(
      norm.symbol,
      trendSignals,
      flowSignals,
      fundamentalSignals,
      catalystResult,
    );
    const calibration = await getCalibrationModel(["2330", "2317", "2454", "3231"]);
    const predictions = predictProbabilities({
      trendScore: trendSignals.trendScore,
      flowScore: flowSignals.flowScore,
      fundamentalScore: fundamentalSignals.fundamentalScore,
      catalystScore: catalystResult.catalystScore,
      volatilityScore: shortTermVolatility.volatilityScore,
      shortTermOpportunityScore: shortTerm.shortTermOpportunityScore,
      pullbackRiskScore: shortTerm.pullbackRiskScore,
      volumeSpike: shortTermVolatility.volumeSpike,
      gap: shortTermVolatility.gap,
      calibration,
    });
    const consistency = calculateConsistency({
      trendScore: trendSignals.trendScore,
      flowScore: flowSignals.flowScore,
      fundamentalScore: fundamentalSignals.fundamentalScore,
      catalystScore: catalystResult.catalystScore,
      shortTermOpportunityScore: shortTerm.shortTermOpportunityScore,
      upProb5D: predictions.upProb5D,
    });
    const riskFlags = [
      ...trendSignals.risks,
      ...flowSignals.risks,
      ...fundamentalSignals.risks,
      ...shortTerm.breakdown.riskFlags,
    ];
    const mappedPrices = prices.map(p => ({
      date: p.date,
      open: p.open,
      high: p.max,
      low: p.min,
      close: p.close,
      volume: p.Trading_Volume
    }));
    const keyLevels = calculateKeyLevels(mappedPrices);

    const strategy = generateStrategy({
      trendScore: trendSignals.trendScore,
      flowScore: flowSignals.flowScore,
      fundamentalScore: fundamentalSignals.fundamentalScore,
      catalystScore: catalystResult.catalystScore,
      volatilityScore: shortTermVolatility.volatilityScore,
      shortTermOpportunityScore: shortTerm.shortTermOpportunityScore,
      pullbackRiskScore: shortTerm.pullbackRiskScore,
      breakoutScore: shortTerm.breakoutScore,
      upProb1D: predictions.upProb1D,
      upProb3D: predictions.upProb3D,
      upProb5D: predictions.upProb5D,
      bigMoveProb3D: predictions.bigMoveProb3D,
      consistencyScore: consistency.score,
      riskFlags,
    });

    const latestClose = prices[prices.length - 1].close;
    const explainBreakdown = buildExplainBreakdown({
      trend: trendSignals,
      flow: flowSignals,
      fundamental: fundamentalSignals,
      ai: aiExplanation,
      shortTermVolatility,
      shortTerm,
      predictions,
      consistency,
      latestClose,
    });


    const topContradiction = strategy.explain.contradictions.length > 0
      ? strategy.explain.contradictions[0].why
      : undefined;

    const uxSummary = buildUxSummary({
      direction: aiExplanation.stance,
      strategyConfidence: strategy.confidence,
      consistencyLevel: consistency.level,
      topRiskFlag: riskFlags[0],
      keyLevels,
    });

    const institutionCorrelation = calculateInstitutionCorrelation(prices, investors, 60);

    // --- New Global Linkage Pipeline (Clustering & Auto-Mapping) ---
    const stockProfile = await resolveStockProfile(norm.symbol, displayName);
    const mappedPricesTw = prices.map(p => ({ date: p.date, close: p.close }));
    
    // 1. Compute dynamic clusters
    const { members: allMembers, targetClusterId } = await getOrComputeClusters(
        norm.symbol,
        mappedPricesTw,
        15
    );
    
    // 2. Filter target's cluster members
    const clusterMembers = Array.from(allMembers.values()).filter(m => m.clusterId === targetClusterId);
    
    // 3. Resolve dominant theme (Sector name)
    const themeName = stockProfile.sectorZh;
    const usMapping = mapThemeToUS(themeName, norm.symbol);
    
    // 4. Local Peers (TW)
    const twPeerLinkage = await selectTwPeers(norm.symbol, clusterMembers, themeName);
    
    // 5. Overseas Drivers
    // Fetch Yahoo data for US candidates
    const allUsSymbols = Array.from(new Set([usMapping.sector.id, ...usMapping.hints]));
    const globalDataMap: Record<string, any[]> = {};
    let globalFetchSuccess = true;

    try {
      const globalBars = await Promise.all(
        allUsSymbols.map(async (sym) => {
          return { symbol: sym, bars: await fetchYahooFinanceBars(sym, 120) };
        })
      );
      for (const res of globalBars) {
        if (res.bars.length === 0) {
          globalFetchSuccess = false;
        }
        globalDataMap[res.symbol] = res.bars;
      }
    } catch (e) {
      console.error("Failed to fetch overseas data for Global Linkage", e);
      globalFetchSuccess = false;
    }

    let selectedDrivers = selectDrivers(mappedPricesTw, usMapping, globalDataMap);
    let relativeStrength = calculateRelativeStrength(mappedPricesTw, selectedDrivers.sector, globalDataMap);

    if (!globalFetchSuccess || !selectedDrivers.sector || selectedDrivers.peers.length === 0) {
      warnings.push("目前海外資料暫時無法取得，連動指標以可用資料估算或暫停顯示");
      if (!selectedDrivers.sector) {
         selectedDrivers = { sector: null, peers: [] };
      }
    }

    const globalLinkage = {
      profile: stockProfile,
      drivers: selectedDrivers,
      relativeStrength,
      twPeerLinkage
    };
    // ---------------------------------------------

    // Fetch Crash Warning Data
    const crashSymbols = ["^VIX", "^MOVE", "SOXX", "QQQ", "^DXY", "DX-Y.NYB", "UUP", "USDJPY=X", "JPY=X"];
    const marketData = await getMarketIndicators({ symbols: crashSymbols, rangeDays: 65 });
    const crashWarning = evaluateCrashWarning(marketData);

    // Adjust strategy confidence based on crash score
    if (crashWarning.score !== null) {
      strategy.confidence = Math.max(0, strategy.confidence * (1 - crashWarning.score / 150));
    }

    return NextResponse.json({
      normalizedTicker: {
        ...norm,
        companyNameZh,
        displayName,
      },
      dataWindow: {
        barsRequested: rangeResult.barsRequested,
        barsReturned: rangeResult.barsReturned,
        endDate: rangeResult.endDate,
      },
      providerMeta: {
        authUsed:
          rangeResult.providerMeta?.authUsed === "env" ||
            investorsResult.meta.authUsed === "env" ||
            marginResult.meta.authUsed === "env" ||
            revenueResult.meta.authUsed === "env"
            ? "env"
            : "anon",
        fallbackUsed:
          Boolean(rangeResult.providerMeta?.fallbackUsed) ||
          investorsResult.meta.fallbackUsed ||
          marginResult.meta.fallbackUsed ||
          revenueResult.meta.fallbackUsed,
      },
      newsMeta: {
        authUsed: newsResult.meta.authUsed,
        fallbackUsed: newsResult.meta.fallbackUsed,
        count: rawNews.length,
        bullishCount: catalystResult.bullishCount,
        bearishCount: catalystResult.bearishCount,
        catalystScore: catalystResult.catalystScore,
      },
      warnings,
      lastUpdate: latestDate,
      data: {
        prices: prices.slice(-120).map((p) => ({
          date: p.date,
          open: p.open,
          high: p.max,
          low: p.min,
          close: p.close,
          volume: p.Trading_Volume,
        })),
      },
      signals: {
        trend: trendSignals,
        flow: flowSignals,
        fundamental: fundamentalSignals,
      },
      shortTermVolatility,
      shortTerm,
      predictions,
      consistency,
      strategy,
      institutionCorrelation,
      globalLinkage,
      crashWarning,
      keyLevels,
      uxSummary,
      aiSummary: {
        stance: aiExplanation.stance,
        confidence: aiExplanation.confidence,
        keyPoints: aiExplanation.keyPoints.slice(0, 5),
        risks: aiExplanation.risks.slice(0, 3),
      },
      explainBreakdown,
      news: {
        ...catalystResult,
        errorCode: newsErrorCode,
        error: newsErrorMessage,
      },
      ...(debugMode && {
        debug: {
          requestParams: {
            symbol: norm.symbol,
            market: norm.market,
            flowStartDate,
            fundamentalStartDate,
            revenueFetchedCount: revenue.length,
            newsFallbackUsed: newsResult.meta.fallbackUsed,
            priceProviderMeta: rangeResult.providerMeta,
            investorsProviderMeta: investorsResult.meta,
            marginProviderMeta: marginResult.meta,
            revenueProviderMeta: revenueResult.meta,
            newsProviderMeta: newsResult.meta,
          },
          ai: aiExplanation.debug,
        },
      }),
    });
  } catch (error: unknown) {
    console.error("Snapshot API Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

