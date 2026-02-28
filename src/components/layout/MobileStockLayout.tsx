import { ChevronDown, Info, ArrowRight, AlertCircle, Shield, Target, Activity, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { HeroPlaybook } from "@/components/dashboard/HeroPlaybook";
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
      {/* ═══ AI 戰術沙盤主控台（置頂）═══ */}
      <HeroPlaybook
        snapshot={snapshot}
        currentStockLabel={currentStockLabel}
        onSwitchStock={() => setShowStockPicker(true)}
      />

      {/* Chart Section */}
      <Tile className="overflow-hidden rounded-2xl min-h-[240px]">
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
