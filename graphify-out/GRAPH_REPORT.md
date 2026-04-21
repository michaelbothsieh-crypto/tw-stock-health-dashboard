# Graph Report - .  (2026-04-21)

## Corpus Check
- 187 files · ~163,778 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 550 nodes · 760 edges · 95 communities detected
- Extraction: 77% EXTRACTED · 23% INFERRED · 0% AMBIGUOUS · INFERRED: 173 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 66 edges
2. `buildRow()` - 24 edges
3. `test()` - 19 edges
4. `buildExplainBreakdown()` - 15 edges
5. `POST()` - 13 edges
6. `fetchStockSnapshot()` - 13 edges
7. `calculateShortTermSignals()` - 10 edges
8. `calculateShortTermVolatility()` - 10 edges
9. `WatchlistStore` - 10 edges
10. `setCache()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `handleTelegramMessage()`  [INFERRED]
  scripts/test_telegram_chart.ts → src/lib/telegram/botEngine.ts
- `test()` --calls--> `renderMultiRoiChart()`  [INFERRED]
  scripts/test_simple_draw.ts → src/lib/ux/chartRenderer.ts
- `buildRow()` --calls--> `getCompanyNameZh()`  [INFERRED]
  scripts/generateDailyReport.ts → src/lib/companyName.ts
- `buildRow()` --calls--> `fetchRecentBars()`  [INFERRED]
  scripts/generateDailyReport.ts → src/lib/range.ts
- `buildRow()` --calls--> `getInstitutionalInvestors()`  [INFERRED]
  scripts/generateDailyReport.ts → src/lib/providers/finmind.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (29): formatTurnover(), getBreakoutFastEma(), getBreakoutMaxCrossAgeDays(), getBreakoutMinRsi(), getBreakoutMinTurnover(), getBreakoutRelativeVolumeMultiplier(), getBreakoutSlowEma(), getBreakoutTrendEma() (+21 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (21): calcVolumeVs5d(), fetchFugleQuote(), detectMarket(), isMarketOpen(), containsTooMuchEnglish(), resolveBatch(), resolveStockName(), setCache() (+13 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (27): getCompanyNameZh(), alignSeries(), calcCorrelation(), calcReturns(), selectDrivers(), fetchFromFinMind(), FinmindProviderError, getInstitutionalInvestors() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (19): buildNewsFlag(), buildNewsLine(), buildStanceText(), calcSupportResistance(), clampTextLength(), escapeHtml(), formatPct(), formatPrice() (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (18): deleteMessage(), editMessage(), ensureTelegramCommandsSynced(), generateBotReply(), handleTelegramMessage(), replyWithCard(), sendMessage(), getAllChatIds() (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (17): calculateCatalystScore(), clamp(), includesAny(), toImpact(), classifyNews(), calculateFlow(), calculateFundamental(), buildMarkdown() (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (13): combineImages(), drawText(), ensureFonts(), getOtFont(), renderMultiRoiChart(), renderProfitChart(), renderRankChart(), renderStockChart() (+5 more)

### Community 7 - "Community 7"
Cohesion: 0.16
Nodes (7): calcReturns(), euclideanDistanceSq(), getOrComputeClusters(), normalizeToZScore(), runKMeans(), handleAddToWatchlist(), WatchlistStore

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (16): evaluatePredictionSignal(), runBacktest(), buildCalibrationModel(), clamp(), computeBins(), getCalibrationModel(), identityCalibration(), linearRegression() (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.26
Nodes (16): buildExplainBreakdown(), clamp(), clamp01(), scoreFromAlignment(), scoreFromAtrPct(), scoreFromFlowPressure(), scoreFromGap(), scoreFromMacdHistogram() (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.2
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 0.27
Nodes (5): calculateManualReturn(), fetchEtfTopHoldings(), tryQuote(), tryQuoteSummary(), EtfHandler

### Community 12 - "Community 12"
Cohesion: 0.2
Nodes (3): CommandRouter, fetchTopGainers(), TrendRankHandler

### Community 13 - "Community 13"
Cohesion: 0.44
Nodes (8): baseRiskNotes(), buildExplain(), clamp(), downgradeSignalByConsistency(), finalizeStrategy(), generateStrategy(), signalFromProb(), strategyConfidence()

### Community 14 - "Community 14"
Cohesion: 0.46
Nodes (7): buildBreakoutRow(), findCrossAgeDays(), getBreakoutExitReasons(), isBreakoutEntry(), isBreakoutExit(), isFiniteNumber(), parseTvSymbol()

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.54
Nodes (7): calculateShortTermSignals(), clamp(), linearMap(), mean(), percentileRank(), stdev(), toContribution()

### Community 17 - "Community 17"
Cohesion: 0.57
Nodes (7): calculateAtr14(), calculateShortTermVolatility(), clamp(), mapAtrPctScore(), mapGapScore(), mapVolumeSpikeScore(), safeDiv()

### Community 18 - "Community 18"
Cohesion: 0.54
Nodes (7): calibrated(), clamp(), computeRawProbabilities(), normalizeScore(), predictProbabilities(), round1(), sigmoid()

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (3): generatePushAlert(), callLLMWithFallback(), getAvailableGroqModels()

### Community 20 - "Community 20"
Cohesion: 0.52
Nodes (6): alignSeries(), calcBeta(), calcCorrelation(), calcReturns(), calculateGlobalDrivers(), interpretCorr()

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (6): calcDrawdown20(), calcRet20(), calcVixStats(), clamp(), evaluateCrashWarning(), safeNumber()

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (5): calculateConsistency(), clamp(), directionToText(), levelFromScore(), toDirection()

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (2): HotHandler, fetchYahooCommunityRank()

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (2): formatLineValue(), truncate2()

### Community 25 - "Community 25"
Cohesion: 0.4
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 0.4
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 0.5
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 0.5
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 0.5
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 0.5
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 0.5
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 0.5
Nodes (2): useVisitorStats(), VisitorStats()

### Community 33 - "Community 33"
Cohesion: 0.83
Nodes (3): calculateATR(), calculateKeyLevels(), calculateSMA()

### Community 34 - "Community 34"
Cohesion: 0.83
Nodes (3): clamp(), formatSignedPercent(), generateExplanation()

### Community 35 - "Community 35"
Cohesion: 0.67
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 0.67
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (2): buildAnalystPrompt(), generateStockAnalysis()

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (2): fetchLatestReport(), readLatestLocalReport()

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (2): mapThemeToUS(), normalizeSymbol()

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Community 78"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "Community 81"
Cohesion: 1.0
Nodes (0): 

### Community 82 - "Community 82"
Cohesion: 1.0
Nodes (0): 

### Community 83 - "Community 83"
Cohesion: 1.0
Nodes (0): 

### Community 84 - "Community 84"
Cohesion: 1.0
Nodes (0): 

### Community 85 - "Community 85"
Cohesion: 1.0
Nodes (0): 

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (0): 

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (0): 

### Community 88 - "Community 88"
Cohesion: 1.0
Nodes (0): 

### Community 89 - "Community 89"
Cohesion: 1.0
Nodes (0): 

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (0): 

### Community 91 - "Community 91"
Cohesion: 1.0
Nodes (0): 

### Community 92 - "Community 92"
Cohesion: 1.0
Nodes (0): 

### Community 93 - "Community 93"
Cohesion: 1.0
Nodes (0): 

### Community 94 - "Community 94"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 43`** (2 nodes): `test_etf_api.ts`, `test()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `clearCache()`, `clear_whatis_cache.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `RootLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `HomePage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `StockPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `handleScoreLoaded()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `handleGenerate()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `Sidebar()`, `Sidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `Providers()`, `Providers.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `tabs.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `Badge()`, `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (2 nodes): `cn()`, `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (2 nodes): `Input()`, `input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (2 nodes): `MacroRadarTile()`, `MacroRadarTile.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (2 nodes): `TechnicalTile.tsx`, `TechnicalTile()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (2 nodes): `FlowRadarTile()`, `FlowRadarTile.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (2 nodes): `BentoGrid()`, `BentoGrid.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (2 nodes): `fetchData()`, `HealthCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (2 nodes): `useWatchlist.ts`, `useWatchlist()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (2 nodes): `yahooFinance.ts`, `fetchYahooQuote()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (2 nodes): `generateRevenueData()`, `fundamental.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (2 nodes): `trend.test.ts`, `generateMockData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (2 nodes): `resolveCodeFromInput()`, `inputResolver.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (2 nodes): `getSharedScoreStyle()`, `scoreStyles.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (2 nodes): `generatePlaybook()`, `playbookGenerator.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `test_fugle.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `patch_verify.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `patch_bot_engine.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `tooltip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `DesktopStockLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `MobileStockLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `HeroPlaybook.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `stock.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `breakout.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `yahooFinanceClient.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `fontData.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `market.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (1 nodes): `range.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `ticker.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `sentiment.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `catalystScore.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `classify.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `explain.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (1 nodes): `stockPool.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (1 nodes): `glossary.zh-TW.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `twStockNames.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 13`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 33`, `Community 34`?**
  _High betweenness centrality (0.370) - this node is a cross-community bridge._
- **Why does `test()` connect `Community 1` to `Community 0`, `Community 2`, `Community 11`, `Community 7`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `POST()` connect `Community 4` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 46 inferred relationships involving `GET()` (e.g. with `POST()` and `getBreakoutMinTurnover()`) actually correct?**
  _`GET()` has 46 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `buildRow()` (e.g. with `getCompanyNameZh()` and `fetchRecentBars()`) actually correct?**
  _`buildRow()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `test()` (e.g. with `getTvLatestNewsHeadline()` and `isTaiwanStock()`) actually correct?**
  _`test()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `POST()` (e.g. with `GET()` and `generateBotReply()`) actually correct?**
  _`POST()` has 5 INFERRED edges - model-reasoned connections that need verification._