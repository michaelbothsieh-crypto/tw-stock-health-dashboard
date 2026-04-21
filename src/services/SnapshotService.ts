
import { getCache, setCache } from "@/infrastructure/providers/redisCache";
import { subDays } from "date-fns";
import { normalizeTicker } from "@/shared/utils/ticker";
import { detectMarket, isMarketOpen } from "@/shared/utils/market";
import { calculateTrend } from "@/domain/signals/trend";
import { calculateFlow } from "@/domain/signals/flow";
import { calculateFundamental } from "@/domain/signals/fundamental";
import { generateExplanation } from "@/domain/ai/explain";
import { calculateCatalystScore } from "@/domain/news/catalystScore";
import { calculateShortTermVolatility } from "@/domain/signals/shortTermVolatility";
import { calculateShortTermSignals } from "@/domain/signals/shortTerm";
import { predictProbabilities } from "@/domain/predict/probability";
import { getCalibrationModel } from "@/domain/predict/calibration";
import { generateStrategy } from "@/domain/strategy/strategyEngine";
import { buildExplainBreakdown } from "@/domain/explainBreakdown";
import { calculateConsistency } from "@/domain/consistency";
import { calculateInstitutionCorrelation } from "@/domain/analytics/correlation";
import { calculateKeyLevels } from "@/domain/signals/keyLevels";
import { buildUxSummary } from "@/shared/utils/summaryBuilder";
import { resolveStockProfile } from "@/domain/industry/stockProfileResolver";
import { getOrComputeClusters } from "@/infrastructure/clusteringEngine";
import { mapThemeToUS } from "@/infrastructure/themeMapper";
import { selectDrivers } from "@/infrastructure/driverSelector";
import { calculateRelativeStrength } from "@/domain/analytics/relativeStrength";
import { fetchYahooFinanceBars } from "@/infrastructure/yahooFinance";
import { evaluateCrashWarning } from "@/infrastructure/crash/crashEngine";
import { selectTwPeers } from "@/infrastructure/twPeerSelector";
import { getMarketIndicators } from "@/infrastructure/providers/marketIndicators";
import { getTvTechnicalIndicators } from "@/infrastructure/providers/tradingViewFetch";
import { translateTechnicals } from "@/shared/utils/technicalTranslator";
import { fetchStockSnapshot } from "@/infrastructure/stockRouter";
import { getTacticalPlaybook } from "@/domain/ai/playbookAgent";
import { getFilteredInsiderTransfers } from "@/infrastructure/providers/twseInsiderFetch";

export interface SnapshotOptions {
  debug?: boolean;
  mode?: "full" | "lite";
}

export class SnapshotService {
  private static isTaiwanStock(symbol: string) {
    return /[0-9]/.test(symbol) || symbol.endsWith(".TW") || symbol.endsWith(".TWO");
  }

  static async getSnapshot(ticker: string, options: SnapshotOptions = {}) {
    const debugMode = options.debug || false;
    const mode = options.mode || "full";
    const isLite = mode === "lite";
    const warnings: string[] = [];

    const norm = normalizeTicker(ticker);
    const marketInfo = await detectMarket(norm.symbol);
    norm.market = marketInfo.market;
    norm.yahoo = marketInfo.yahoo;
    if (marketInfo.ambiguous) warnings.push("ambiguous_market");
    if (norm.market === "UNKNOWN") warnings.push("market_unknown");

    // 1. 即時報價
    let liveQuote: any = null;
    try {
      const { yf } = await import("@/infrastructure/providers/yahooFinanceClient");
      const yahooSym = this.isTaiwanStock(norm.symbol) ? (norm.yahoo || `${norm.symbol}.TW`) : norm.symbol;
      const rtRaw = await yf.quote(yahooSym);
      const rt: any = Array.isArray(rtRaw) ? rtRaw[0] : rtRaw;
      if (rt && typeof rt.regularMarketPrice === "number") {
        liveQuote = {
          price: rt.regularMarketPrice,
          previousClose: rt.regularMarketPreviousClose || 0,
          changePct: typeof rt.regularMarketChangePercent === "number"
            ? rt.regularMarketChangePercent
            : rt.regularMarketPreviousClose ? ((rt.regularMarketPrice - rt.regularMarketPreviousClose) / rt.regularMarketPreviousClose) * 100 : 0,
          high: rt.regularMarketDayHigh,
          low: rt.regularMarketDayLow,
        };
      }
    } catch (e) { console.warn("[SnapshotService] live quote failed", e); }

    // 2. 快取檢查
    const cacheKey = `snapshot:${norm.symbol}:v3:${mode}`;
    if (!debugMode) {
      const cached = await getCache<any>(cacheKey);
      if (cached) {
        if (liveQuote) {
          cached.realTimeQuote = { price: liveQuote.price, changePct: liveQuote.changePct, isRealTime: true, time: new Date().toISOString() };
        }
        return cached;
      }
    }

    // 3. 抓取基礎 Snapshot 資料
    const snapshotData = await fetchStockSnapshot(norm);
    const displayName = snapshotData.displayName ? `${norm.symbol} ${snapshotData.displayName}` : norm.symbol;
    const companyNameZh = snapshotData.displayName;
    if (snapshotData.warnings.length > 0) warnings.push(...snapshotData.warnings);

    const prices = snapshotData.prices;
    const legacyPrices = (prices as any[]).map((p: any) => ({ 
      date: p.date, 
      stock_id: norm.symbol, 
      volume: p.volume || p.Trading_Volume, 
      open: p.open, 
      high: p.high || p.max, 
      low: p.low || p.min, 
      close: p.close 
    }));
    const latestDate = prices[prices.length - 1].date;

    // 4. 指標計算
    const trendSignals = calculateTrend(legacyPrices as any);
    const flowSignals = calculateFlow((prices as any[]).map((p: any) => p.date), snapshotData.flow?.investors || [], snapshotData.flow?.margin || []);
    let fundamentalSignals = calculateFundamental(snapshotData.fundamentals.revenue || []);
    
    // US Fundamental Fallback
    if (!this.isTaiwanStock(norm.symbol) && snapshotData.fundamentals.eps !== null) {
      fundamentalSignals = {
        recent3MoYoyAverage: (snapshotData.fundamentals.revenueGrowth ?? 0) * 100,
        recent6MoYoyAverage: (snapshotData.fundamentals.revenueGrowth ?? 0) * 100,
        yoyTrend: (snapshotData.fundamentals.revenueGrowth ?? 0) > 0 ? 'up' : 'flat',
        fundamentalScore: 50 + ((snapshotData.fundamentals.revenueGrowth ?? 0) > 0.1 ? 15 : (snapshotData.fundamentals.revenueGrowth ?? 0) < 0 ? -15 : 0),
        reasons: ["基本面穩健"], risks: []
      };
    }

    const shortTermVolatility = calculateShortTermVolatility(legacyPrices);
    const shortTerm = calculateShortTermSignals(legacyPrices, trendSignals, shortTermVolatility);
    const catalystResult = calculateCatalystScore(snapshotData.news || [], new Date(latestDate), 7);
    const aiExplanation = generateExplanation(norm.symbol, trendSignals, flowSignals, fundamentalSignals, catalystResult);
    const calibration = await getCalibrationModel(["2330", "2317", "2454", "3231"]);
    const predictions = predictProbabilities({ ...trendSignals, ...flowSignals, ...fundamentalSignals, ...catalystResult, ...shortTermVolatility, ...shortTerm, calibration });
    const consistency = calculateConsistency({ ...trendSignals, ...flowSignals, ...fundamentalSignals, ...catalystResult, ...shortTerm, upProb5D: predictions.upProb5D });
    const riskFlags = [...trendSignals.risks, ...flowSignals.risks, ...fundamentalSignals.risks, ...shortTerm.breakdown.riskFlags];

    // 即時價格對接
    const fLatestClose = prices[prices.length - 1].close;
    if (liveQuote && !liveQuote.previousClose) liveQuote.previousClose = prices.length >= 2 ? prices[prices.length - 2].close : fLatestClose;
    
    let latestClose = liveQuote ? liveQuote.price : fLatestClose;
    if (!isMarketOpen(norm.symbol) && liveQuote && Math.abs(liveQuote.price - fLatestClose) / fLatestClose > 0.05) latestClose = fLatestClose;

    // 關鍵價位
    const mappedPrices = (prices as any[]).map((p: any) => ({ ...p }));
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (liveQuote) {
       const last = mappedPrices[mappedPrices.length - 1];
       if (last.date === todayStr) {
          last.close = latestClose;
          last.high = Math.max(last.high, liveQuote.high ?? latestClose);
          last.low = Math.min(last.low, liveQuote.low ?? latestClose);
       } else mappedPrices.push({ date: todayStr, open: latestClose, high: liveQuote.high ?? latestClose, low: liveQuote.low ?? latestClose, close: latestClose, volume: 0 });
    }
    const keyLevels = calculateKeyLevels(mappedPrices);

    const strategy = generateStrategy({ ...trendSignals, ...flowSignals, ...fundamentalSignals, ...catalystResult, ...shortTermVolatility, ...shortTerm, ...predictions, consistencyScore: consistency.score, riskFlags });
    const explainBreakdown = buildExplainBreakdown({ trend: trendSignals, flow: flowSignals, fundamental: fundamentalSignals, ai: aiExplanation, shortTermVolatility, shortTerm, predictions, consistency, latestClose });
    const uxSummary = buildUxSummary({ direction: aiExplanation.stance, strategyConfidence: strategy.confidence, consistencyLevel: consistency.level, topRiskFlag: riskFlags[0], keyLevels });
    
    // 5. 複雜數據組裝 (Full Mode Only)
    let playbookResult: any = { shortSummary: explainBreakdown.trend.reasons[0]?.replace('。', '') || "趨勢分析中" };
    let globalLinkage: any = null, insiderTransfers: any[] = [], crashWarning: any = { score: 0 };

    if (!isLite) {
       const [gl, mkt, it] = await Promise.all([
          (async () => {
             const profile = await resolveStockProfile(norm.symbol, displayName);
             const { members: all, targetClusterId: tid } = await getOrComputeClusters(norm.symbol, (prices as any[]).map((p: any)=>({date:p.date,close:p.close})), 15);
             const theme = profile.sectorZh;
             const usMap = mapThemeToUS(theme, norm.symbol);
             const peers = await selectTwPeers(norm.symbol, Array.from(all.values()).filter(m=>m.clusterId === tid), theme, all);
             
             const globalData: any = {};
             try {
                const globalBars = await Promise.all(Array.from(new Set([usMap.sector.id, ...usMap.hints])).map(async sym => ({ symbol: sym, bars: await fetchYahooFinanceBars(sym, 120) })));
                globalBars.forEach(r => globalData[r.symbol] = r.bars);
             } catch {}
             
             const drivers = selectDrivers((prices as any[]).map((p: any)=>({date:p.date,close:p.close})), usMap, globalData);
             return { linkage: { profile, drivers, relativeStrength: calculateRelativeStrength((prices as any[]).map((p: any)=>({date:p.date,close:p.close})), drivers.sector, globalData), twPeerLinkage: peers } };
          })(),
          getMarketIndicators({ symbols: ["^VIX", "^MOVE", "SOXX", "QQQ", "^DXY", "DX-Y.NYB", "UUP", "USDJPY=X", "JPY=X"], rangeDays: 65 }),
          this.isTaiwanStock(norm.symbol) ? getFilteredInsiderTransfers(norm.symbol).catch(()=>[]) : Promise.resolve([])
       ]);
       globalLinkage = gl.linkage;
       insiderTransfers = it;
       crashWarning = evaluateCrashWarning(mkt);
       if (crashWarning.score !== null) strategy.confidence *= (1 - crashWarning.score / 150);

       playbookResult = await getTacticalPlaybook({
          ticker: norm.symbol, stockName: companyNameZh || norm.symbol, price: latestClose,
          support: keyLevels.supportLevel || 0, resistance: keyLevels.breakoutLevel || 0,
          macroRisk: crashWarning.score ?? 0, technicalTrend: (trendSignals.trendScore ?? 0) > 60 ? "偏多" : "中立",
          flowScore: flowSignals.flowScore ?? 50,
          smartMoneyFlow: flowSignals.smartMoneyFlow,
          retailSentiment: flowSignals.retailSentiment,
          flowVerdict: flowSignals.flowVerdict,
          institutionalLots: flowSignals.institutionalLots,
          trustLots: flowSignals.trustLots,
          marginLots: flowSignals.marginLots,
          shortLots: flowSignals.shortLots,
          insiderTransfers,
          recentTrend: `目前價 ${latestClose.toFixed(1)}，SMA20 ${trendSignals.sma20?.toFixed(1)}`,
          recentNews: snapshotData.news.slice(0, 5).map((n:any) => typeof n === 'string' ? n : `[${n.date?.split(' ')[0]}] ${n.title}`)
       });
    }

    const payload = {
      stockName: companyNameZh || norm.symbol, score: Math.round(strategy.confidence), shortSummary: playbookResult.shortSummary,
      normalizedTicker: { ...norm, companyNameZh, displayName },
      newsMeta: { ...snapshotData.meta.newsMeta, count: snapshotData.news.length, catalystScore: catalystResult.catalystScore },
      warnings, lastUpdate: latestDate,
      data: { prices: prices.slice(-120) },
      playbook: playbookResult, insiderTransfers, signals: { trend: trendSignals, flow: flowSignals, fundamental: fundamentalSignals },
      shortTermVolatility, shortTerm, predictions, consistency, strategy, globalLinkage, crashWarning, keyLevels,
      realTimeQuote: { price: latestClose, changePct: liveQuote?.changePct, isRealTime: !!liveQuote, time: new Date().toISOString() },
      uxSummary, aiSummary: { stance: aiExplanation.stance, confidence: aiExplanation.confidence, keyPoints: aiExplanation.keyPoints.slice(0, 5), risks: aiExplanation.risks.slice(0, 3) },
      explainBreakdown, news: { ...catalystResult, errorCode: snapshotData.meta.newsMeta.errorCode, error: snapshotData.meta.newsMeta.message }
    };

    if (!debugMode) await setCache(cacheKey, payload, 600);
    return payload;
  }
}
