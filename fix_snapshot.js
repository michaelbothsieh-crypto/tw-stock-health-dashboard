const fs = require('fs');
const path = require('path');

const targetPath = path.join(process.cwd(), 'src/app/api/stock/[ticker]/snapshot/route.ts');
let content = fs.readFileSync(targetPath, 'utf8');

// 尋找最後的 `finalPayload = {` 和 `});` (我們預期原本應該寫入快取的地方)
const startIdx = content.lastIndexOf('finalPayload = {');
// 我們直接把這個錯亂的尾部砍掉重寫

const cleanContent = content.slice(0, startIdx);

const newTail = `
      finalPayload = {
      // Watchlist specific fields (Single Source of Truth)
      stockName: companyNameZh || norm.symbol,
      score: Math.round(strategy.confidence),
      shortSummary: playbook.shortSummary || "數據整理中",

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

    // 寫入快取 (10分鐘)
    await setCache(cacheKey, finalPayload, 600);
    } // end of cache miss

    return NextResponse.json(finalPayload);
  } catch (error: unknown) {
    console.error("Snapshot API Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
`;

fs.writeFileSync(targetPath, cleanContent + newTail);
console.log("Syntax fixed");
