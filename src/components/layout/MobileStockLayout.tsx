import { ChevronDown, Info, ArrowRight, AlertCircle, Shield, Target, Activity, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Tile } from "@/components/bento/Tile";
import { StockChart } from "@/components/StockChart";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlobalLinkageTile } from "@/components/tiles/GlobalLinkageTile";
import { TechnicalTile } from "@/components/tiles/TechnicalTile";
import { MacroRadarTile } from "@/components/tiles/MacroRadarTile";
import { DashboardLayoutProps, ExplainTab } from "./types";
import { EXPLAIN_TABS, formatScoreAsPercent, chipColorClass, chipBarColorClass, directionLabel, strategyLabel, ExplainComponentsTable } from "./utils";

export function MobileStockLayout({
  snapshot,
  currentStockLabel,
  showDetail,
  setShowDetail,
  activeExplainTab,
  setActiveExplainTab,
  setShowStockPicker
}: DashboardLayoutProps) {
  const activeExplainMeta = EXPLAIN_TABS.find((tab) => tab.key === activeExplainTab) ?? EXPLAIN_TABS[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Hero Section */}
      <Tile className="min-h-[200px] bg-card p-5 rounded-2xl border shadow-sm">
        <div className="flex flex-col gap-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowStockPicker(true)}
            className="h-10 rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 px-3 text-sm text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 w-full justify-between focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none transition-all duration-300"
          >
            <span className="truncate">{currentStockLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>

          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-none">{currentStockLabel.split(' ')[0]}</h1>
                <div className={`rounded-xl border px-2 py-0.5 text-sm font-medium ${snapshot.aiSummary.stance === "Bullish" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                  snapshot.aiSummary.stance === "Bearish" ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                    "border-neutral-500/30 bg-neutral-500/10 text-neutral-600 dark:text-neutral-400"
                  }`}>
                  {directionLabel(snapshot.aiSummary.stance)}結構
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {snapshot.signals.flow.marginChange20D !== null && (
                  <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
                    snapshot.signals.flow.marginChange20D <= 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}>
                    {snapshot.signals.flow.marginChange20D <= 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                    {snapshot.signals.flow.marginChange20D <= 0 ? "融資減少" : "融資大增"}
                  </div>
                )}
                {snapshot.consistency.score < 55 && (
                  <div className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-500">
                    <Activity className="h-3.5 w-3.5" />
                    一致性低
                  </div>
                )}
              </div>
              
              {snapshot.crashWarning && snapshot.crashWarning.score !== null && snapshot.crashWarning.score >= 60 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs font-medium text-rose-600 dark:text-rose-400 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{snapshot.crashWarning.score >= 80 ? "系統性風險極高，建議現金觀望" : "市場風險升高，建議控管部位"}</span>
                </div>
              )}
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
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="text-xs text-muted-foreground mb-0.5">策略信心</div>
                  <div className={`${confColor} text-3xl font-black tracking-tight tabular-nums leading-none`}>
                    {conf.toFixed(1)}<span className="text-xl opacity-70">%</span>
                  </div>
                  <div className={`px-2 py-0.5 rounded-md text-xs font-medium mt-1 ${badgeColor}`}>
                    {badgeText}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-neutral-900/50 p-3.5 rounded-xl mt-2 border border-slate-100 dark:border-neutral-800/50 shadow-sm">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Target className="h-3 w-3 text-emerald-500" />
                轉強門檻
              </div>
              <div className="text-[15px] font-bold text-neutral-900 dark:text-neutral-200 tabular-nums">≥ {snapshot.keyLevels.breakoutLevel?.toFixed(2) ?? '--'}</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Shield className="h-3 w-3 text-blue-500" />
                支撐參考
              </div>
              <div className="text-[15px] font-bold text-neutral-900 dark:text-neutral-200 tabular-nums">{snapshot.keyLevels.supportLevel?.toFixed(2) ?? '--'}</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <AlertCircle className="h-3 w-3 text-rose-500" />
                失效門檻
              </div>
              <div className="text-[15px] font-bold text-neutral-900 dark:text-neutral-200 tabular-nums">&lt; {snapshot.keyLevels.invalidationLevel?.toFixed(2) ?? '--'}</div>
            </div>
          </div>

          {(snapshot.strategy.explain.contradictions.length > 0 || snapshot.consistency.score < 55) && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-lg mt-1 border border-amber-200 dark:border-amber-500/20">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>訊號分歧留意洗盤，控管風險</span>
            </div>
          )}
        </div>
      </Tile>

      {/* Chart Section */}
      <Tile className="overflow-hidden rounded-2xl p-4 min-h-[240px]">
        <div className="mb-4 flex items-center gap-2">
          <div className="text-[18px] font-semibold text-neutral-100">近期走勢與均線</div>
        </div>
        <div className="w-full overflow-x-auto pb-2">
          <div className="min-w-[500px]">
            <StockChart data={snapshot.data.prices} keyLevels={snapshot.keyLevels} />
          </div>
        </div>
      </Tile>


      <GlobalLinkageTile snapshot={snapshot} isMobile />

      <TechnicalTile tactics={snapshot.technicalTactics} />

      <MacroRadarTile snapshot={snapshot} />

      {/* Evidence Section (Card list instead of chips) */}
      <Tile className="rounded-2xl p-5 overflow-hidden">
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
              className={`group relative flex flex-row items-center justify-between w-full rounded-xl border px-4 py-4 transition-all duration-150 ${chipColorClass(item.score)} focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none`}
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


      {/* Detail Analysis Section */}
      {showDetail && (
        <Tile className="w-full min-w-0 rounded-2xl p-4">
          <div id="analysis" className="w-full min-w-0 scroll-mt-24">
            <div className="mb-6 border-b border-neutral-800 pb-2 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-neutral-100">詳細分析</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)} className="h-8 px-2 text-neutral-400">收合</Button>
            </div>

            <div className="space-y-4">
              <details className="group rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
                <summary className="p-4 text-[16px] font-medium text-neutral-200 cursor-pointer select-none outline-none focus-visible:bg-neutral-800/50 hover:bg-neutral-900/60 list-none flex justify-between items-center">
                  決策邏輯
                  <ChevronDown className="h-5 w-5 text-neutral-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="p-4 pt-0 border-t border-neutral-800/50">
                  <div className="space-y-6 mt-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex flex-col gap-1 text-neutral-300 text-[15px]">
                        <div className="text-neutral-500 text-[13px]">階段 1：方向判定</div>
                        <div className="flex items-center gap-3">
                          <span>技術 + 籌碼 + 催化劑</span>
                          <ArrowRight className="h-4 w-4 text-neutral-600" />
                          <span className="font-medium text-neutral-200">{directionLabel(snapshot.aiSummary.stance)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 text-neutral-300 text-[15px]">
                        <div className="text-neutral-500 text-[13px]">階段 2：可出手度</div>
                        <div className="flex items-center gap-3">
                          <span>短期機率 + 一致性 - 回檔風險</span>
                          <ArrowRight className="h-4 w-4 text-neutral-600" />
                          <span className="font-medium tabular-nums text-neutral-200">{snapshot.strategy.confidence.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 text-neutral-300 text-[15px]">
                        <div className="text-neutral-500 text-[13px]">階段 3：策略類型</div>
                        <div className="flex items-center gap-3">
                          <span>綜合多空條件與風險檢核</span>
                          <ArrowRight className="h-4 w-4 text-neutral-600" />
                          <span className="font-medium text-neutral-200">{strategyLabel(snapshot.strategy.signal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>

              <details className="group rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
                <summary className="p-4 text-[16px] font-medium text-neutral-200 cursor-pointer select-none outline-none focus-visible:bg-neutral-800/50 hover:bg-neutral-900/60 list-none flex justify-between items-center">
                  綜合證據
                  <ChevronDown className="h-5 w-5 text-neutral-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="p-4 pt-0 border-t border-neutral-800/50">
                  <div className="space-y-6 mt-4">
                    <div>
                      <h3 className="text-[15px] font-semibold text-neutral-300 mb-3">基本體質 & 新聞催化</h3>
                      <div className="text-[15px] text-neutral-400 space-y-2">
                        <p>基本面分數：<span className="tabular-nums text-neutral-200">{snapshot.signals.fundamental.fundamentalScore?.toFixed(1) ?? '--'}%</span></p>
                        <p>新聞催化：<span className="tabular-nums text-neutral-200">{snapshot.newsMeta?.catalystScore ?? 0}</span> (多 {snapshot.newsMeta?.bullishCount ?? 0} / 空 {snapshot.newsMeta?.bearishCount ?? 0})</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-neutral-300 mb-3">波動狀態與機率</h3>
                      <div className="text-[15px] text-neutral-400 space-y-2">
                        <p>波動敏感度：<span className="tabular-nums text-neutral-200">{snapshot.shortTermVolatility.volatilityScore.toFixed(1)}%</span></p>
                        <p>5日上漲機率：<span className="tabular-nums text-neutral-200">{snapshot.predictions.upProb5D.toFixed(1)}%</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </details>

              <details className="group rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
                <summary className="p-4 text-[16px] font-medium text-neutral-200 cursor-pointer select-none outline-none focus-visible:bg-neutral-800/50 hover:bg-neutral-900/60 list-none flex justify-between items-center">
                  分數計算說明
                  <ChevronDown className="h-5 w-5 text-neutral-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="p-4 pt-0 border-t border-neutral-800/50">
                  <div className="space-y-6 mt-4">
                    <div className="flex w-full min-w-0">
                      <Select value={activeExplainTab} onValueChange={(value) => setActiveExplainTab(value as ExplainTab)}>
                        <SelectTrigger className="h-12 w-full min-w-0 rounded-xl border-neutral-700 bg-neutral-900 text-[15px]">
                          <SelectValue placeholder="選擇分析分類" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {EXPLAIN_TABS.map((tab) => (
                            <SelectItem key={tab.key} value={tab.key} className="text-[15px] rounded-lg">
                              {tab.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mt-4 w-full min-w-0 space-y-6">
                      {(activeExplainTab === "trend" ||
                        activeExplainTab === "flow" ||
                        activeExplainTab === "fundamental" ||
                        activeExplainTab === "volatility" ||
                        activeExplainTab === "prediction") &&
                        snapshot.explainBreakdown[activeExplainTab] ? (
                        <ExplainComponentsTable section={snapshot.explainBreakdown[activeExplainTab]} />
                      ) : null}

                      {activeExplainTab === "consistency" ? (
                        <ExplainComponentsTable section={snapshot.explainBreakdown.consistency} />
                      ) : null}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </Tile>
      )}
    </div>
  );
}
