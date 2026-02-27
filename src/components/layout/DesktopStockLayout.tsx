import { ChevronDown, Info, ArrowRight, AlertCircle, Shield, Target, Activity, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Tile } from "@/components/bento/Tile";
import { RadarOverview } from "@/components/charts/RadarOverview";
import { StockChart } from "@/components/StockChart";
import { GlobalLinkageTile } from "@/components/tiles/GlobalLinkageTile";
import { TechnicalTile } from "@/components/tiles/TechnicalTile";
import { MacroRadarTile } from "@/components/tiles/MacroRadarTile";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayoutProps, ExplainTab } from "./types";
import { EXPLAIN_TABS, formatScoreAsPercent, scoreToneClass, chipColorClass, chipBarColorClass, directionLabel, strategyLabel, ExplainComponentsTable } from "./utils";
import { riskFlagLabel } from "@/lib/riskFlags";

export function DesktopStockLayout({
  snapshot,
  currentStockLabel,
  showDetail,
  setShowDetail,
  activeMainTab,
  setActiveMainTab,
  activeExplainTab,
  setActiveExplainTab,
  setShowStockPicker,
  radarData
}: DashboardLayoutProps) {
  const activeExplainMeta = EXPLAIN_TABS.find((tab) => tab.key === activeExplainTab) ?? EXPLAIN_TABS[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.618fr_1fr] gap-6 items-start">
      {/* Primary Column (Left 61.8%) */}
      <div className="flex flex-col gap-6">

        {/* Hero Section */}
        <Tile className="min-h-[240px] bg-card p-8 relative rounded-2xl border shadow-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-4 flex-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowStockPicker(true)}
                className="h-10 rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 px-3 text-sm text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 max-w-[280px] w-full justify-between focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none transition-all duration-300"
              >
                <span className="truncate">{currentStockLabel}</span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{currentStockLabel}</h1>
                <div className={`rounded-xl border px-3 py-1 text-sm font-medium ${snapshot.aiSummary.stance === "Bullish" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                  snapshot.aiSummary.stance === "Bearish" ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                    "border-neutral-500/30 bg-neutral-500/10 text-neutral-600 dark:text-neutral-400"
                  }`}>
                  {directionLabel(snapshot.aiSummary.stance)}結構
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {snapshot.signals.flow.marginChange20D !== null && (
                  <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium ${
                    snapshot.signals.flow.marginChange20D <= 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}>
                    {snapshot.signals.flow.marginChange20D <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                    {snapshot.signals.flow.marginChange20D <= 0 ? "融資減少" : "融資大增"}
                  </div>
                )}
                {snapshot.consistency.score < 55 && (
                  <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium bg-amber-500/10 text-amber-600 dark:text-amber-500">
                    <Activity className="h-4 w-4" />
                    一致性低
                  </div>
                )}
              </div>

              {snapshot.crashWarning && snapshot.crashWarning.score !== null && snapshot.crashWarning.score >= 60 && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm font-medium text-rose-600 dark:text-rose-400 mt-4">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{snapshot.crashWarning.score >= 80 ? "系統性風險極高，建議現金觀望" : "市場風險升高，建議控管部位"}</span>
                </div>
              )}
            </div>

            <div className="text-right flex-1 max-w-[220px] shrink-0">
              <div className="text-sm text-muted-foreground flex items-center justify-end gap-1">
                策略信心
              </div>

              {(() => {
                const conf = snapshot.strategy.confidence;
                let confColor = "text-rose-600 dark:text-rose-500";
                let badgeColor = "bg-rose-500/10 text-rose-600 dark:text-rose-500";
                let badgeText = "保守";

                if (conf >= 70) {
                  confColor = "text-emerald-600 dark:text-emerald-500";
                  badgeColor = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500";
                  badgeText = "可出手";
                } else if (conf >= 50) {
                  confColor = "text-amber-600 dark:text-amber-500";
                  badgeColor = "bg-amber-500/10 text-amber-600 dark:text-amber-500";
                  badgeText = "觀察";
                }

                return (
                  <div className="flex flex-col items-end gap-1 mt-1">
                    <div className={`${confColor} text-4xl font-black tracking-tight tabular-nums`}>
                      {conf.toFixed(1)}%
                    </div>
                    <div className={`px-2.5 py-0.5 rounded-lg text-sm font-medium mt-1 ${badgeColor}`}>
                      {badgeText}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-neutral-900/50 p-4 rounded-xl mt-6 border border-slate-100 dark:border-neutral-800/50 shadow-sm">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-emerald-500" />
                轉強門檻
              </div>
              <div className="text-lg font-bold text-neutral-900 dark:text-neutral-200 tabular-nums">≥ {snapshot.keyLevels.breakoutLevel?.toFixed(2) ?? '--'}</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-blue-500" />
                支撐參考
              </div>
              <div className="text-lg font-bold text-neutral-900 dark:text-neutral-200 tabular-nums">{snapshot.keyLevels.supportLevel?.toFixed(2) ?? '--'}</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                失效門檻
              </div>
              <div className="text-lg font-bold text-neutral-900 dark:text-neutral-200 tabular-nums">&lt; {snapshot.keyLevels.invalidationLevel?.toFixed(2) ?? '--'}</div>
            </div>
          </div>

          {(snapshot.strategy.explain.contradictions.length > 0 || snapshot.consistency.score < 55) && (
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 p-3 rounded-lg mt-4 border border-amber-200 dark:border-amber-500/20">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>訊號分歧留意洗盤，法人由賣轉買前控管風險</span>
            </div>
          )}
        </Tile>

        {/* Chart Section */}
        <Tile className="overflow-hidden rounded-2xl p-6 min-h-[240px]">
          <div className="mb-4 flex items-center gap-2">
            <div className="text-[18px] font-semibold text-neutral-100">近期走勢與均線</div>
          </div>
          <div className="w-full overflow-x-auto pb-2">
            <div className="min-w-[500px]">
              <StockChart data={snapshot.data.prices} keyLevels={snapshot.keyLevels} />
            </div>
          </div>
        </Tile>

        {/* Detail Analysis Section */}
        {showDetail && (
          <Tile className="w-full min-w-0 rounded-2xl p-6">
            <div id="analysis" className="w-full min-w-0 scroll-mt-24">
              <div className="mb-6 flex items-center gap-6 border-b border-neutral-800 pb-2">
                <button
                  onClick={() => setActiveMainTab("數據判讀")}
                  className={`text-[18px] font-semibold pb-2 border-b-2 transition-all duration-150 ${activeMainTab === "數據判讀" ? "border-neutral-100 text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
                >
                  數據判讀
                </button>
                <button
                  onClick={() => setActiveMainTab("分析詳解")}
                  className={`text-[18px] font-semibold pb-2 border-b-2 transition-all duration-150 ${activeMainTab === "分析詳解" ? "border-neutral-100 text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
                >
                  分析詳解
                </button>
              </div>

              {activeMainTab === "數據判讀" ? (
                <div className="space-y-6">
                  <div className="mb-8 grid grid-cols-3 gap-6">
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 transition-all duration-150 hover:bg-neutral-900/60">
                      <div className="text-[16px] font-medium text-neutral-400 mb-4 flex items-center justify-between">
                        <span>階段 1：方向判定</span>
                      </div>
                      <div className="space-y-4 text-[15px]">
                        <div className="flex flex-col gap-1 text-neutral-300">
                          <div className="text-neutral-500">依據</div>
                          <div>技術(40%) + 籌碼(30%) + 催化劑(30%)</div>
                        </div>
                        <div className="flex items-center gap-3 text-neutral-100 font-medium pt-2 border-t border-neutral-800">
                          <span className={`px-3 py-1 rounded-lg ${snapshot.aiSummary.stance === "Bullish" ? "bg-emerald-500/15 text-emerald-400" :
                            snapshot.aiSummary.stance === "Bearish" ? "bg-rose-500/15 text-rose-400" :
                              "bg-neutral-500/15 text-neutral-300"
                            }`}>
                            {directionLabel(snapshot.aiSummary.stance)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 transition-all duration-150 hover:bg-neutral-900/60">
                      <div className="text-[16px] font-medium text-neutral-400 mb-4 flex items-center justify-between">
                        <span>階段 2：可出手度</span>
                      </div>
                      <div className="space-y-4 text-[15px]">
                        <div className="flex flex-col gap-1 text-neutral-300">
                          <div className="text-neutral-500">依據</div>
                          <div>短期機率 + 一致性 - 回檔風險</div>
                        </div>
                        <div className="flex items-center gap-3 text-neutral-100 font-medium pt-2 border-t border-neutral-800">
                          <span className="text-[22px] tabular-nums">{snapshot.strategy.confidence.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 transition-all duration-150 hover:bg-neutral-900/60">
                      <div className="text-[16px] font-medium text-neutral-400 mb-4 flex items-center justify-between">
                        <span>階段 3：策略類型</span>
                      </div>
                      <div className="space-y-4 text-[15px]">
                        <div className="flex flex-col gap-1 text-neutral-300">
                          <div className="text-neutral-500">依據</div>
                          <div>綜合多空條件與風險檢核</div>
                        </div>
                        <div className="flex items-center gap-3 text-neutral-100 font-medium pt-2 border-t border-neutral-800">
                          <span className="text-[16px]">{strategyLabel(snapshot.strategy.signal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 transition-all duration-150 hover:bg-neutral-900/60">
                      <h3 className="text-[18px] font-semibold text-neutral-200 mb-4">基本體質 & 新聞催化</h3>
                      <div className="text-[15px] text-neutral-400 space-y-3">
                        <p>基本面分數：<span className="tabular-nums text-neutral-200">{snapshot.signals.fundamental.fundamentalScore?.toFixed(1) ?? '--'}%</span></p>
                        <p>新聞催化：<span className="tabular-nums text-neutral-200">{snapshot.newsMeta?.catalystScore ?? 0}</span> (偏多 {snapshot.newsMeta?.bullishCount ?? 0} 則 / 偏空 {snapshot.newsMeta?.bearishCount ?? 0} 則)</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 transition-all duration-150 hover:bg-neutral-900/60">
                      <h3 className="text-[18px] font-semibold text-neutral-200 mb-4">波動狀態與機率</h3>
                      <div className="text-[15px] text-neutral-400 space-y-3">
                        <p>波動敏感度：<span className="tabular-nums text-neutral-200">{snapshot.shortTermVolatility.volatilityScore.toFixed(1)}%</span></p>
                        <p>5日上漲機率：<span className="tabular-nums text-neutral-200">{snapshot.predictions.upProb5D.toFixed(1)}%</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 mt-6">
                  <div className="flex w-full min-w-0 flex-wrap gap-3">
                    {EXPLAIN_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveExplainTab(tab.key)}
                        className={`min-w-0 rounded-xl border px-4 py-2 text-[15px] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none ${activeExplainTab === tab.key
                          ? "border-neutral-300 bg-neutral-100 text-neutral-900 shadow-sm"
                          : "border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-500 hover:brightness-105"
                          }`}
                      >
                        <span className="block min-w-0 truncate">{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 w-full min-w-0 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-[15px] text-neutral-400 whitespace-normal break-words">
                    {activeExplainMeta.description}
                  </div>

                  <div className="mt-6 w-full min-w-0 space-y-6">
                    {(activeExplainTab === "trend" ||
                      activeExplainTab === "flow" ||
                      activeExplainTab === "fundamental" ||
                      activeExplainTab === "volatility" ||
                      activeExplainTab === "prediction") &&
                      snapshot.explainBreakdown[activeExplainTab] ? (
                      <ExplainComponentsTable section={snapshot.explainBreakdown[activeExplainTab]} />
                    ) : null}

                    {activeExplainTab === "news" ? (
                      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 text-[15px] text-neutral-300 whitespace-normal break-words">
                        新聞分數：<span className="tabular-nums">{snapshot.newsMeta?.catalystScore ?? 0}</span>，偏多 <span className="tabular-nums">{snapshot.newsMeta?.bullishCount ?? 0}</span> 則，偏空 <span className="tabular-nums">{snapshot.newsMeta?.bearishCount ?? 0}</span> 則。
                      </div>
                    ) : null}

                    {activeExplainTab === "strategy" ? (
                      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 text-[15px] text-neutral-300 whitespace-normal break-words space-y-2">
                        <p>策略訊號：{snapshot.strategy.signal}</p>
                        <p>策略信心：<span className="tabular-nums">{snapshot.strategy.confidence.toFixed(1)}%</span></p>
                      </div>
                    ) : null}

                    {activeExplainTab === "consistency" ? (
                      <div className="space-y-6">
                        <ExplainComponentsTable section={snapshot.explainBreakdown.consistency} />
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </Tile>
        )}
      </div>

      {/* Secondary Column (Right 38.2%) */}
      <div className="flex flex-col gap-6">

        <GlobalLinkageTile snapshot={snapshot} />

                <TechnicalTile tactics={snapshot.technicalTactics} />
        
                <MacroRadarTile snapshot={snapshot} />
        
                {/* Evidence Strip */}
        <Tile className="rounded-2xl p-6 overflow-hidden">
          <div className="mb-4 text-[16px] font-medium text-neutral-400 flex items-center justify-between">
            <span>證據摘要</span>
            <Button variant="ghost" size="sm" onClick={() => {
              setShowDetail(true);
              setTimeout(() => document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
            }} className="h-8 px-3 text-[13px] rounded-lg hover:bg-neutral-800 hover:text-neutral-200 transition-all duration-150">
              詳細分析
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { key: "trend", label: "技術面強弱", score: snapshot.signals.trend.trendScore },
              { key: "flow", label: "法人動向", score: snapshot.signals.flow.flowScore },
              { key: "consistency", label: "訊號同向程度", score: snapshot.consistency.score },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => {
                  setShowDetail(true);
                  setActiveExplainTab(item.key as ExplainTab);
                  setTimeout(() => document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                }}
                className={`group relative flex items-center justify-between w-full rounded-xl border px-4 py-3 gap-0 transition-all duration-150 ${chipColorClass(item.score)} hover:brightness-110 focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none`}
              >
                <span className="text-[15px] font-medium">{item.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[16px] font-bold tabular-nums">{formatScoreAsPercent(item.score)}</span>
                  <div className={`h-2.5 w-2.5 rounded-full ${chipBarColorClass(item.score)}`} />
                </div>
              </button>
            ))}
          </div>
        </Tile>

        {/* Small Radar with List */}
        <Tile className="rounded-2xl p-6">
          <div className="mb-4 text-[16px] font-medium text-neutral-400">指標概覽</div>
          <div className="flex flex-col xl:flex-row items-center gap-6">
            <div className="w-[180px] h-[180px] shrink-0">
              <RadarOverview data={radarData} />
            </div>
            <div className="flex-1 w-full space-y-3 text-[15px]">
              {radarData.map(r => (
                <div key={r.label} className="flex justify-between items-center px-1">
                  <span className="text-neutral-400">{r.label}</span>
                  <span className={`tabular-nums font-medium ${scoreToneClass(r.value)}`}>{r.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Tile>

        {/* Institution Correlation */}
        <Tile className="rounded-2xl p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[16px] font-medium text-neutral-300 flex items-center gap-2">
              法人連動率 <span className="text-[13px] font-normal text-neutral-500">({snapshot.institutionCorrelation?.window || 60}日)</span>
            </div>
            <div className="text-[15px] font-normal text-neutral-400">
              最具連動：<span className="text-neutral-200 font-medium">{snapshot.institutionCorrelation?.strongest || "無"}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "外資", corr: snapshot.institutionCorrelation?.foreignCorr },
              { label: "投信", corr: snapshot.institutionCorrelation?.investTrustCorr },
              { label: "自營商", corr: snapshot.institutionCorrelation?.dealerCorr },
            ].map((item) => {
              const val = item.corr;
              let color = "text-neutral-400";
              let sign = "";
              if (val !== null) {
                if (val >= 0.15) color = "text-emerald-400";
                else if (val <= -0.15) color = "text-rose-400";
                sign = val > 0 ? "+" : "";
              }

              return (
                <div key={item.label} className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 transition-all duration-150 hover:bg-neutral-900/60">
                  <div className="mb-2 text-[13px] text-neutral-400">{item.label}</div>
                  <div className={`text-[22px] font-semibold tracking-tight tabular-nums ${color}`}>
                    {val === null ? "N/A" : `${sign}${(val * 100).toFixed(1)}%`}
                  </div>
                </div>
              );
            })}
          </div>
        </Tile>

      </div>
    </div>
  );
}
