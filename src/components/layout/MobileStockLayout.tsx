import { ChevronDown, Info, ArrowRight } from "lucide-react";
import { Tile } from "@/components/bento/Tile";
import { StockChart } from "@/components/StockChart";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlobalLinkageTile } from "@/components/tiles/GlobalLinkageTile";
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
      <Tile className="min-h-[200px] bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-800/80 p-5 rounded-2xl border border-neutral-800/60 shadow-lg">
        <div className="flex flex-col gap-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowStockPicker(true)}
            className="h-11 rounded-xl border-neutral-700 bg-neutral-950/50 px-4 text-[16px] text-neutral-100 hover:bg-neutral-800 w-full justify-between focus-visible:ring-2 focus-visible:ring-emerald-500/50 outline-none transition-all duration-150"
          >
            <span className="truncate">{currentStockLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-neutral-400" />
          </Button>

          <div className="flex items-center justify-between">
            <div className={`rounded-xl border px-3 py-1 text-[24px] leading-tight font-medium ${snapshot.aiSummary.stance === "Bullish" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" :
              snapshot.aiSummary.stance === "Bearish" ? "border-rose-500/50 bg-rose-500/15 text-rose-300" :
                "border-neutral-500/50 bg-neutral-500/15 text-neutral-300"
              }`}>
              {directionLabel(snapshot.aiSummary.stance)}
            </div>

            {(() => {
              const conf = snapshot.strategy.confidence;
              let confColor = "text-rose-500";
              let badgeColor = "bg-rose-500/15 text-rose-400 border-rose-500/30";
              let badgeText = "保守";

              if (conf >= 70) {
                confColor = "text-emerald-500";
                badgeColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
                badgeText = "可出手";
              } else if (conf >= 50) {
                confColor = "text-amber-500";
                badgeColor = "bg-amber-500/15 text-amber-400 border-amber-500/30";
                badgeText = "觀察";
              }

              return (
                <div className="flex flex-col items-end gap-1.5">
                  <div className={`${confColor} text-[44px] leading-none font-bold tracking-tight tabular-nums`}>
                    {conf.toFixed(1)}<span className="text-[28px] opacity-70">%</span>
                  </div>
                  <div className={`px-2 py-0.5 rounded border text-[13px] font-medium ${badgeColor}`}>
                    {badgeText}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="text-[15px] text-neutral-300 whitespace-normal break-words mt-1">
            {(() => {
              const dir = snapshot.aiSummary.stance;
              const conf = snapshot.strategy.confidence;
              const cons = snapshot.consistency.score;
              if (dir === "Neutral") return "等待訊號一致性回升";
              if (conf < 50) {
                let msg = "可出手度偏低：";
                if (cons < 55) msg += "一致性低 + ";
                msg += "回檔風險偏高";
                return msg;
              }
              if (cons < 55) return "請留意洗盤風險";
              return "各項訊號具一致性";
            })()}
          </div>


          {snapshot.crashWarning && snapshot.crashWarning.score !== null && snapshot.crashWarning.score >= 60 && (
            <div className="mt-2 p-3 rounded-xl border border-rose-500/50 bg-rose-500/10 text-[15px] font-medium text-rose-300">
              {snapshot.crashWarning.score >= 80 ? "🧨 崩盤風險：建議以防守為主或採對沖" : "⚠ 市場風險升高：建議降低部位、嚴設停損"}
            </div>
          )}

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-left shadow-inner">
            <div className="text-[15px] text-neutral-300 space-y-3">
              <div className="flex justify-between items-center gap-4">
                <span className="text-neutral-400">轉強門檻</span>
                <span className="tabular-nums text-emerald-400 font-medium text-[16px]">≥ {snapshot.keyLevels.breakoutLevel?.toFixed(2) ?? '--'}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-neutral-400">失效門檻</span>
                <span className="tabular-nums text-rose-400 font-medium text-[16px]">&lt; {snapshot.keyLevels.invalidationLevel?.toFixed(2) ?? '--'}</span>
              </div>
            </div>
          </div>
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

      {/* Crash Early Warning Engine (Mobile) */}
      {snapshot.crashWarning && (
        <Tile className="rounded-2xl p-5 border-rose-900/30">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[16px] font-medium text-neutral-300">🧨 崩盤早期預警</span>
            <span className={`px-2.5 py-1 rounded-lg text-[13px] font-semibold ${snapshot.crashWarning.level === "資料不足" ? "bg-neutral-800 text-neutral-400 border border-neutral-700" :
              snapshot.crashWarning.score !== null && snapshot.crashWarning.score >= 80 ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                snapshot.crashWarning.score !== null && snapshot.crashWarning.score >= 60 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                  snapshot.crashWarning.score !== null && snapshot.crashWarning.score >= 30 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                    "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              }`}>
              {snapshot.crashWarning.level}
            </span>
          </div>

          <div className="mb-4">
            <div className="text-[18px] font-bold text-neutral-100">{snapshot.crashWarning.headline}</div>
            <div className="text-[15px] text-neutral-400 mt-1">{snapshot.crashWarning.summary}</div>
          </div>

          <div className="space-y-2 mb-2">
            {snapshot.crashWarning.triggersTop.map((r, i) => (
              <div key={i} className="text-[15px] text-neutral-300 flex items-start gap-2">
                <span className="text-neutral-600 mt-0.5">•</span>
                <span>{r}</span>
              </div>
            ))}
          </div>

          <details className="group mt-5">
            <summary className="text-[14px] text-neutral-500 cursor-pointer outline-none flex items-center justify-center bg-neutral-900/40 hover:bg-neutral-800/60 rounded-xl py-2 transition-all">
              <span>查看原因與細節</span>
            </summary>
            <div className="space-y-4 mt-4 pt-4 border-t border-neutral-800/50">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[14px] text-neutral-400">總體風險指數</span>
                <span className={`text-[20px] font-bold tabular-nums ${snapshot.crashWarning.score === null ? "text-neutral-500" :
                  snapshot.crashWarning.score >= 60 ? "text-rose-400" :
                    snapshot.crashWarning.score >= 30 ? "text-amber-400" :
                      "text-emerald-400"
                  }`}>
                  {snapshot.crashWarning.score !== null ? snapshot.crashWarning.score.toFixed(1) + "%" : "—"}
                </span>
              </div>

              {[
                { label: "波動壓力 (30%)", factor: snapshot.crashWarning.factors.volatilityStress },
                { label: "板塊破位 (30%)", factor: snapshot.crashWarning.factors.sectorBreakdown },
                { label: "跨資產壓力 (20%)", factor: snapshot.crashWarning.factors.crossAssetStress },
                { label: "流動性代理 (20%)", factor: snapshot.crashWarning.factors.liquidityStress },
              ].map(f => (
                <div key={f.label} className="border-b border-neutral-800/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center text-neutral-200 mb-2">
                    <span className="text-[14px] font-medium">{f.label}</span>
                    <span className="text-[14px] tabular-nums font-semibold">{f.factor.available && f.factor.score !== null ? `${f.factor.score.toFixed(1)} 分` : "—"}</span>
                  </div>
                  <div className="text-[13px] text-neutral-400 space-y-1.5">
                    {f.factor.available ? (
                      f.factor.triggers.length > 0 ? f.factor.triggers.map((t, idx) => <div key={idx}>- {t}</div>) : <div>- 正常平穩</div>
                    ) : (
                      <div className="text-amber-500/80">- {f.factor.triggers[0] || "資料不足"}</div>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-neutral-800/50 mt-2 text-[12px] text-neutral-600 text-left space-y-1.5">
                <div>流動性壓力目前以代理指標估算</div>
                {snapshot.crashWarning.meta && (
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 text-neutral-500 mt-1">
                    <span>引擎版本：</span><span>{snapshot.crashWarning.meta.engineVersion}</span>
                    <span>資料充足：</span><span>最少 {snapshot.crashWarning.meta.usedPointsMin} 天</span>
                    <span>可用標的：</span><span className="break-words">{snapshot.crashWarning.meta.usedSymbols.join(", ")}</span>
                  </div>
                )}
                <div className="pt-1 text-neutral-600">最後更新：{new Date(snapshot.crashWarning.lastUpdated).toLocaleString("zh-TW", { hour12: false })}</div>
              </div>
            </div>
          </details>
        </Tile>
      )}
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
