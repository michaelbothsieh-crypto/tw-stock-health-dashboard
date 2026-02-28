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
import { getTvTechnicalIndicators } from "@/lib/providers/tradingViewFetch";
import { translateTechnicals } from "@/lib/ux/technicalTranslator";
import { fetchStockSnapshot } from "@/lib/api/stockRouter";
import { getTacticalPlaybook } from "@/lib/ai/playbookAgent";
import { getFilteredInsiderTransfers } from "@/lib/providers/twseInsiderFetch";

function isTaiwanStock(symbol: string) {
  return /^\d+$/.test(symbol) || symbol.endsWith(".TW") || symbol.endsWith(".TWO");
}

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

    const snapshotData = await fetchStockSnapshot(norm);
    const displayName = snapshotData.displayName ? `${norm.symbol} ${snapshotData.displayName}` : norm.symbol;
    const companyNameZh = snapshotData.displayName;
    
    if (snapshotData.warnings.length > 0) {
      warnings.push(...snapshotData.warnings);
    }
    
    const prices = snapshotData.prices;
    const investors = snapshotData.flow?.investors || [];
    const margin = snapshotData.flow?.margin || [];
    const revenue = snapshotData.fundamentals.revenue || [];
    const rawNews = snapshotData.news || [];
    const technicals = snapshotData.technicals;
    
    const tradingDates = prices.map((p) => p.date);
        const latestDate = prices[prices.length - 1].date;
        const latestDateObj = new Date(latestDate);
    
        // Map unified prices to legacy PriceBar format for internal signals
        const legacyPrices = prices.map(p => ({
          date: p.date,
          stock_id: norm.symbol,
          Trading_Volume: p.volume,
          open: p.open,
          max: p.high,
          min: p.low,
          close: p.close
        }));
    
        const technicalTactics = technicals ? translateTechnicals(technicals) : null;
        const newsErrorCode = snapshotData.meta.newsMeta.errorCode ?? null;
        const newsErrorMessage = snapshotData.meta.newsMeta.message ?? null;
    
        const trendSignals = calculateTrend(legacyPrices);
        const flowSignals = calculateFlow(tradingDates, investors, margin);
        
        // Calculate fundamentals
        let fundamentalSignals = calculateFundamental(revenue);
        // US Stock fundamental fallback
        if (!isTaiwanStock(norm.symbol) && snapshotData.fundamentals.eps !== null) {
          // Basic fallback scoring for US stocks
          let score = 50;
          let reasons = [];
          if ((snapshotData.fundamentals.revenueGrowth ?? 0) > 0.1) { score += 15; reasons.push("營收成長大於10%"); }
          else if ((snapshotData.fundamentals.revenueGrowth ?? 0) < 0) { score -= 15; reasons.push("營收出現衰退"); }
          if ((snapshotData.fundamentals.peRatio ?? 50) < 30) { score += 10; reasons.push("本益比在合理範圍"); }
          if (reasons.length === 0) reasons.push("基本面穩健");
          
          fundamentalSignals = {
            recent3MoYoyAverage: (snapshotData.fundamentals.revenueGrowth ?? 0) * 100,
            recent6MoYoyAverage: (snapshotData.fundamentals.revenueGrowth ?? 0) * 100,
            yoyTrend: (snapshotData.fundamentals.revenueGrowth ?? 0) > 0 ? 'up' : 'flat',
            fundamentalScore: score,
            reasons,
            risks: []
          };
        }
    
        const shortTermVolatility = calculateShortTermVolatility(legacyPrices);
        const shortTerm = calculateShortTermSignals(legacyPrices, trendSignals, shortTermVolatility);

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
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume
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
    const twPeerLinkage = await selectTwPeers(norm.symbol, clusterMembers, themeName, allMembers);
    
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

    // Fetch Insider Transfers (Taiwan Only)
    let insiderTransfers: import("@/lib/providers/twseInsiderFetch").InsiderTransfer[] = [];
    if (isTaiwanStock(norm.symbol)) {
      try {
        insiderTransfers = await getFilteredInsiderTransfers(norm.symbol);
      } catch (e) {
        console.warn("[Snapshot] Failed to fetch insider transfers", e);
      }
    }

    const playbook = await getTacticalPlaybook({
      ticker: norm.symbol,
      stockName: companyNameZh || norm.symbol,
      price: latestClose,
      support: keyLevels.supportLevel || (technicalTactics?.levels.support ?? 0),
      resistance: keyLevels.breakoutLevel || (technicalTactics?.levels.resistance ?? 0),
      macroRisk: crashWarning.score ?? 0,
      technicalTrend: technicalTactics?.signals[0]?.status || "趨勢不明",
      flowScore: flowSignals.flowScore ?? 50,
      smartMoneyFlow: flowSignals.smartMoneyFlow,
      retailSentiment: flowSignals.retailSentiment,
      flowVerdict: flowSignals.flowVerdict,
      institutionalLots: flowSignals.institutionalLots,
      trustLots: flowSignals.trustLots,
      marginLots: flowSignals.marginLots,
      shortLots: flowSignals.shortLots,
      insiderTransfers,
    });

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
        barsRequested: 180,
        barsReturned: prices.length,
        endDate: latestDate,
      },
      providerMeta: {
        authUsed: snapshotData.meta.providerAuthUsed,
        fallbackUsed: snapshotData.meta.fallbackUsed,
      },
      newsMeta: {
        authUsed: snapshotData.meta.newsMeta.authUsed,
        fallbackUsed: snapshotData.meta.newsMeta.fallbackUsed,
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
          high: p.high,
          low: p.low,
          close: p.close,
          volume: p.volume,
        })),
      },
      technicals,
      technicalTactics,
      playbook,
      insiderTransfers,
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
            revenueFetchedCount: revenue.length,
            newsFallbackUsed: snapshotData.meta.newsMeta.fallbackUsed,
            providerMeta: snapshotData.meta,
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

