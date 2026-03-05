import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/providers/redisCache";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
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
    const mode = req.nextUrl.searchParams.get("mode") || "full";
    const isLite = mode === "lite";
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

    // --- 1. 無論如何，先抓最新的即時報價 ---
    let liveQuote: { price: number; changePct: number; previousClose: number; high?: number; low?: number } | null = null;
    try {
      const { yf } = await import("@/lib/providers/yahooFinanceClient");
      const yahooSym = isTaiwanStock(norm.symbol)
        ? (norm.yahoo || `${norm.symbol}.TW`)
        : norm.symbol;
      const rtRaw = await yf.quote(yahooSym);
      const rt: any = Array.isArray(rtRaw) ? rtRaw[0] : rtRaw;
      if (rt && typeof rt.regularMarketPrice === "number") {
        liveQuote = {
          price: rt.regularMarketPrice,
          previousClose: rt.regularMarketPreviousClose || 0, // Fallback updated later
          changePct: typeof rt.regularMarketChangePercent === "number"
            ? rt.regularMarketChangePercent
            : rt.regularMarketPreviousClose ? ((rt.regularMarketPrice - rt.regularMarketPreviousClose) / rt.regularMarketPreviousClose) * 100 : 0,
          high: rt.regularMarketDayHigh,
          low: rt.regularMarketDayLow,
        };
      }
    } catch (e) {
      console.warn("[Snapshot] yahoo-finance2 live quote failed", e);
    }

    // --- 2. 檢查 Redis 快取 ---
    const cacheKey = `snapshot:${norm.symbol}:v3:${mode}`; // v3 區隔舊有快取與 mode
    if (!debugMode) {
      const cachedData = await getCache<any>(cacheKey);
      if (cachedData) {
        // 命中快取！覆蓋最新的即時報價
        if (liveQuote) {
          cachedData.realTimeQuote = {
            price: liveQuote.price,
            changePct: liveQuote.changePct,
            isRealTime: true,
            time: new Date().toISOString()
          };
        }
        return NextResponse.json(cachedData);
      }
    }


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

    // ── 即時報價（提前抓，讓 keyLevels 也能納入今日盤中 H/L）──────────
    const fLatestClose = prices[prices.length - 1].close;
    const fPrevClose = prices.length >= 2 ? prices[prices.length - 2].close : fLatestClose;
    if (liveQuote && !liveQuote.previousClose) {
      liveQuote.previousClose = fPrevClose;
      if (fPrevClose !== 0) liveQuote.changePct = ((liveQuote.price - fPrevClose) / fPrevClose) * 100;
    }
    const latestClose = liveQuote ? liveQuote.price : fLatestClose;
    const realTimeChangePct = liveQuote ? liveQuote.changePct : undefined;

    // 建立含今日即時 bar 的 mappedPrices（供 keyLevels 計算）
    const baseMappedPrices = prices.map(p => ({
      date: p.date,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume
    }));
    const todayStr = new Date().toLocaleDateString('en-CA');
    const mappedPrices = [...baseMappedPrices];
    if (liveQuote) {
      const lastBar = mappedPrices[mappedPrices.length - 1];
      const rtHigh = liveQuote.high ?? latestClose;
      const rtLow = liveQuote.low ?? latestClose;
      if (lastBar.date === todayStr) {
        mappedPrices[mappedPrices.length - 1] = {
          ...lastBar,
          close: latestClose,
          high: Math.max(lastBar.high, rtHigh),
          low: Math.min(lastBar.low, rtLow),
        };
      } else {
        mappedPrices.push({ date: todayStr, open: latestClose, high: rtHigh, low: rtLow, close: latestClose, volume: 0 });
      }
    }
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

    const mappedPricesTw = prices.map(p => ({ date: p.date, close: p.close }));

    // Parallelize Global Linkage, Crash Warning, and Insider Transfers
    const [globalLinkageResult, marketData, insiderTransfersResult] = await Promise.all([
      (async () => {
        // --- New Global Linkage Pipeline (Clustering & Auto-Mapping) ---
        const stockProfile = await resolveStockProfile(norm.symbol, displayName);

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
          if (!selectedDrivers.sector) {
            selectedDrivers = { sector: null, peers: [] };
          }
          return {
            linkage: {
              profile: stockProfile,
              drivers: selectedDrivers,
              relativeStrength,
              twPeerLinkage
            },
            warning: "目前海外資料暫時無法取得，連動指標以可用資料估算或暫停顯示"
          };
        }

        return {
          linkage: {
            profile: stockProfile,
            drivers: selectedDrivers,
            relativeStrength,
            twPeerLinkage
          },
          warning: null
        };
      })(),

      // Fetch Crash Warning Data
      getMarketIndicators({
        symbols: ["^VIX", "^MOVE", "SOXX", "QQQ", "^DXY", "DX-Y.NYB", "UUP", "USDJPY=X", "JPY=X"],
        rangeDays: 65
      }),

      // Fetch Insider Transfers (Taiwan Only)
      (async () => {
        if (!isTaiwanStock(norm.symbol)) return [];
        try {
          return await getFilteredInsiderTransfers(norm.symbol);
        } catch (e) {
          console.warn("[Snapshot] Failed to fetch insider transfers", e);
          return [];
        }
      })()
    ]);

    const globalLinkage = globalLinkageResult.linkage;
    if (globalLinkageResult.warning) {
      warnings.push(globalLinkageResult.warning);
    }

    const crashWarning = evaluateCrashWarning(marketData);
    const insiderTransfers = insiderTransfersResult;
    // Calculate Recent Trend String for AI Context（含即時價格數字）
    let recentTrend = "區間震盪 / 橫盤整理";
    const sma20 = trendSignals.sma20;
    const sma60 = trendSignals.sma60;
    if (sma20 && sma60) {
      if (latestClose > sma20 && sma20 > sma60) {
        recentTrend = shortTerm.breakoutScore > 70 ? "多頭排列 / 突破創高" : "多頭排列 / 強勢續航";
      } else if (latestClose < sma20 && sma20 < sma60) {
        recentTrend = "空頭排列 / 弱勢整理";
      } else if (latestClose > sma20 && latestClose > sma60) {
        recentTrend = "均線糾結 / 股價轉強";
      }
    }
    // 加入即時價格上下文，讓 LLM 能做精確判斷
    const rtLabel = liveQuote ? "即時" : "昨收";
    recentTrend += `；${rtLabel}價 ${latestClose.toFixed(1)}`;
    if (sma20) recentTrend += `，SMA20 ${sma20.toFixed(1)}`;
    if (sma60) recentTrend += `，SMA60 ${sma60.toFixed(1)}`;

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
      recentTrend,
      recentNews: snapshotData.news
        .filter((n: any) => {
          if (typeof n === 'string') return true;
          if (!n.date) return true;
          const newsDate = new Date(n.date);
          const twoDaysAgo = subDays(new Date(), 2);
          return newsDate >= twoDaysAgo;
        })
        .slice(0, 5)
        .map((n: any) => typeof n === 'string' ? n : `[${n.date.split(' ')[0]}] ${n.title}`),
    });

    // Adjust strategy confidence based on crash score
    if (crashWarning.score !== null) {
      strategy.confidence = Math.max(0, strategy.confidence * (1 - crashWarning.score / 150));
    }

    // --- Lite Mode Logic: Skip heavy computations if requested ---
    let playbookResult = { shortSummary: "數據整理中", tacticalScript: "", telegramCaption: "" };
    let globalLinkageResultData = null;
    let insiderTransfersResultData: any[] = [];

    if (isLite) {
      // 在精簡模式下，我們只回傳基礎分數與數據，不進行 AI 與複雜運算
      playbookResult.shortSummary = explainBreakdown.trend.reasons[0]?.replace('。', '') || "趨勢分析中";
    } else {
      // Parallelize Global Linkage, Crash Warning, and Insider Transfers (Full Mode Only)
      const [glRes, marketData, itRes] = await Promise.all([
        (async () => {
          const stockProfile = await resolveStockProfile(norm.symbol, displayName);
          const { members: allMembers, targetClusterId } = await getOrComputeClusters(norm.symbol, mappedPricesTw, 15);
          const clusterMembers = Array.from(allMembers.values()).filter(m => m.clusterId === targetClusterId);
          const themeName = stockProfile.sectorZh;
          const usMapping = mapThemeToUS(themeName, norm.symbol);
          const twPeerLinkage = await selectTwPeers(norm.symbol, clusterMembers, themeName, allMembers);
          const allUsSymbols = Array.from(new Set([usMapping.sector.id, ...usMapping.hints]));
          const globalDataMap: Record<string, any[]> = {};
          let globalFetchSuccess = true;
          try {
            const globalBars = await Promise.all(allUsSymbols.map(async (sym) => ({ symbol: sym, bars: await fetchYahooFinanceBars(sym, 120) })));
            for (const res of globalBars) { if (res.bars.length === 0) globalFetchSuccess = false; globalDataMap[res.symbol] = res.bars; }
          } catch (e) { globalFetchSuccess = false; }
          let selectedDrivers = selectDrivers(mappedPricesTw, usMapping, globalDataMap);
          let relativeStrength = calculateRelativeStrength(mappedPricesTw, selectedDrivers.sector, globalDataMap);
          return { linkage: { profile: stockProfile, drivers: selectedDrivers, relativeStrength, twPeerLinkage }, warning: null };
        })(),
        getMarketIndicators({
          symbols: ["^VIX", "^MOVE", "SOXX", "QQQ", "^DXY", "DX-Y.NYB", "UUP", "USDJPY=X", "JPY=X"],
          rangeDays: 65
        }),
        (async () => {
          if (!isTaiwanStock(norm.symbol)) return [];
          try { return await getFilteredInsiderTransfers(norm.symbol); } catch (e) { return []; }
        })()
      ]);

      globalLinkageResultData = glRes.linkage;
      insiderTransfersResultData = itRes;
      
      playbookResult = await getTacticalPlaybook({
        ticker: norm.symbol,
        stockName: companyNameZh || norm.symbol,
        price: latestClose,
        support: keyLevels.supportLevel || (technicalTactics?.levels.support ?? 0),
        resistance: keyLevels.breakoutLevel || (technicalTactics?.levels.resistance ?? 0),
        macroRisk: evaluateCrashWarning(marketData).score ?? 0,
        technicalTrend: technicalTactics?.signals[0]?.status || "趨勢不明",
        flowScore: flowSignals.flowScore ?? 50,
        smartMoneyFlow: flowSignals.smartMoneyFlow,
        retailSentiment: flowSignals.retailSentiment,
        flowVerdict: flowSignals.flowVerdict,
        institutionalLots: flowSignals.institutionalLots,
        trustLots: flowSignals.trustLots,
        marginLots: flowSignals.marginLots,
        shortLots: flowSignals.shortLots,
        insiderTransfers: insiderTransfersResultData,
        recentTrend,
        recentNews: snapshotData.news.slice(0, 5).map((n: any) => typeof n === 'string' ? n : `[${n.date?.split(' ')[0]}] ${n.title}`),
      });
    }

    const finalPayload = {
      // Watchlist specific fields (Single Source of Truth)
      stockName: companyNameZh || norm.symbol,
      score: Math.round(strategy.confidence),
      shortSummary: playbookResult.shortSummary || "數據整理中",

      overallHealthScore: Math.round(strategy.confidence), // Maintain backward compatibility if used elsewhere
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
      playbook: playbookResult,
      insiderTransfers: insiderTransfersResultData,
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
      globalLinkage: globalLinkageResultData,
      crashWarning,
      keyLevels,
      realTimeQuote: {
        price: latestClose,
        changePct: realTimeChangePct,
        isRealTime: !!liveQuote,
        time: new Date().toISOString()
      },
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
    };

    if (!debugMode) {
      // 寫入快取 (10分鐘 = 600秒)
      await setCache(cacheKey, finalPayload, 600);
    }
    return NextResponse.json(finalPayload);
  } catch (error: unknown) {
    console.error("Snapshot API Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

