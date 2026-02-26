"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, Settings, X } from "lucide-react";
import { BentoGrid } from "@/components/bento/BentoGrid";
import { Tile } from "@/components/bento/Tile";
import { RadarOverview, RadarOverviewDataItem } from "@/components/charts/RadarOverview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultWatchlist, stockNameMap } from "@/i18n/zh-TW";
import { useStockSnapshot } from "@/hooks/useStockSnapshot";

type ExplainTab = "trend" | "flow" | "fundamental" | "volatility" | "news" | "prediction" | "strategy" | "consistency";

type ExplainSection = {
  score: number | null;
  formula: string;
  components: Array<{ key: string; label: string; value: number | string; weight: number; contribution: number }>;
  reasons: string[];
  riskFlags: string[];
};

type ConsistencyDetail = ExplainSection & {
  level: "高一致性" | "中一致性" | "低一致性";
  consensusDirection: "偏多" | "偏空" | "不明確";
  consensusValue: number;
  disagreement: number;
  sameSignRatio: number;
  contradictions: string[];
};

type SnapshotResponse = {
  signals: {
    trend: { trendScore: number | null };
    flow: { flowScore: number | null };
    fundamental: { fundamentalScore: number | null };
  };
  shortTerm: {
    shortTermOpportunityScore: number;
  };
  predictions: {
    upProb3D: number;
    upProb5D: number;
  };
  strategy: {
    signal: string;
    confidence: number;
    debug: { chosenRuleId: string };
    actionCards: Array<{ summary: string }>;
  };
  aiSummary: { stance: "Bullish" | "Neutral" | "Bearish"; keyPoints: string[] };
  explainBreakdown: {
    trend: ExplainSection;
    flow: ExplainSection;
    fundamental: ExplainSection;
    volatility: ExplainSection;
    prediction: ExplainSection;
    consistency: ConsistencyDetail;
  };
  shortTermVolatility: { volatilityScore: number };
  newsMeta?: { bullishCount: number; bearishCount: number; catalystScore: number };
  consistency: {
    score: number;
    level: "高一致性" | "中一致性" | "低一致性";
    consensusDirection: "偏多" | "偏空" | "不明確";
    contradictions: string[];
    reasons: string[];
  };
};

const EXPLAIN_TABS: Array<{ key: ExplainTab; label: string; description: string }> = [
  { key: "trend", label: "技術面", description: "價格趨勢與技術訊號構成。" },
  { key: "flow", label: "籌碼面", description: "法人與融資籌碼對分數的影響。" },
  { key: "fundamental", label: "基本面", description: "營收與成長趨勢的分數來源。" },
  { key: "volatility", label: "波動", description: "短期波動與風險敏感度。" },
  { key: "news", label: "新聞", description: "近期新聞催化方向與強度。" },
  { key: "prediction", label: "機率", description: "短期上漲機率與校正結果。" },
  { key: "strategy", label: "策略", description: "策略信號、信心與規則命中。" },
  { key: "consistency", label: "一致性", description: "多因子是否同向，是否存在矛盾。" },
];

function formatScore(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "--";
  return value.toFixed(1);
}

function formatTickerLabel(ticker: string): string {
  const name = stockNameMap[ticker] ?? "";
  return name ? `${ticker} ${name}` : ticker;
}

function directionLabel(stance: "Bullish" | "Neutral" | "Bearish"): string {
  if (stance === "Bullish") return "偏多";
  if (stance === "Bearish") return "偏空";
  return "中性";
}

function strategyLabel(signal: string): string {
  if (signal === "偏多") return "突破追蹤";
  if (signal === "偏空") return "反彈偏空";
  if (signal === "等待") return "等待";
  if (signal === "避開") return "觀望避險";
  return "回踩承接";
}

function toneClass(direction: string): string {
  if (direction === "偏多") return "text-emerald-300";
  if (direction === "偏空") return "text-rose-300";
  return "text-amber-300";
}

function levelBadgeClass(level: "高一致性" | "中一致性" | "低一致性"): string {
  if (level === "高一致性") return "border-emerald-500/50 bg-emerald-500/15 text-emerald-300";
  if (level === "低一致性") return "border-rose-500/50 bg-rose-500/15 text-rose-300";
  return "border-amber-500/50 bg-amber-500/15 text-amber-300";
}

function ExplainComponentsTable({ section }: { section: ExplainSection }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800">
      <div className="grid grid-cols-12 gap-2 border-b border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-300">
        <div className="col-span-5 min-w-0">項目</div>
        <div className="col-span-3 min-w-0">數值</div>
        <div className="col-span-2 min-w-0 text-right">權重</div>
        <div className="col-span-2 min-w-0 text-right">貢獻</div>
      </div>
      {section.components.map((row) => (
        <div key={row.key} className="grid grid-cols-12 gap-2 border-b border-neutral-900 px-4 py-3 text-sm text-neutral-200 last:border-b-0">
          <div className="col-span-5 min-w-0 whitespace-normal break-words">{row.label || row.key}</div>
          <div className="col-span-3 min-w-0 font-mono">{String(row.value ?? "--")}</div>
          <div className="col-span-2 min-w-0 text-right tabular-nums">{Number(row.weight).toFixed(2)}</div>
          <div className="col-span-2 min-w-0 text-right tabular-nums">{Number(row.contribution).toFixed(4)}</div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ title, score }: { title: string; score: number | null }) {
  return (
    <Tile className="h-full p-5">
      <div className="text-base font-medium text-neutral-300">{title}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-neutral-100">{formatScore(score)}</div>
    </Tile>
  );
}

function StockPicker({
  open,
  isDesktop,
  watchlist,
  currentTicker,
  onClose,
  onSelect,
}: {
  open: boolean;
  isDesktop: boolean;
  watchlist: string[];
  currentTicker: string;
  onClose: () => void;
  onSelect: (ticker: string) => void;
}) {
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (!open) setKeyword("");
  }, [open]);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return watchlist;
    return watchlist.filter((ticker) => {
      const label = formatTickerLabel(ticker).toLowerCase();
      return ticker.toLowerCase().includes(query) || label.includes(query);
    });
  }, [keyword, watchlist]);

  if (!open) return null;

  const panelClass = isDesktop
    ? "w-full max-w-xl rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
    : "fixed inset-x-0 bottom-0 max-h-[86vh] rounded-t-3xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl";

  return (
    <div className="fixed inset-0 z-50 bg-black/55 p-4" role="dialog" aria-modal="true">
      <div className={`mx-auto ${isDesktop ? "flex min-h-full items-center justify-center" : ""}`}>
        <div className={panelClass}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xl font-semibold text-neutral-100">切換股票</h3>
            <Button type="button" variant="ghost" className="h-11 w-11 rounded-full p-0" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜尋代碼或名稱"
              className="h-12 border-neutral-700 bg-neutral-950 pl-10 text-base text-neutral-100"
            />
          </div>

          <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">找不到符合條件的股票</div>
            ) : (
              filtered.map((itemTicker) => (
                <button
                  key={itemTicker}
                  type="button"
                  onClick={() => onSelect(itemTicker)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-base transition ${
                    itemTicker === currentTicker
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : "border-neutral-800 bg-neutral-950 text-neutral-100 hover:border-neutral-600"
                  }`}
                >
                  <span>{formatTickerLabel(itemTicker)}</span>
                  {itemTicker === currentTicker ? <span className="text-sm">目前</span> : null}
                </button>
              ))
            )}
          </div>

          <div className="mt-4">
            <Button asChild variant="outline" className="h-11 w-full rounded-xl text-base">
              <Link href="/watchlist" onClick={onClose}>
                管理自選股
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardBento({ initialTicker = "2330" }: { initialTicker?: string }) {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<string[]>(defaultWatchlist);
  const [ticker, setTicker] = useState(initialTicker);
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeExplainTab, setActiveExplainTab] = useState<ExplainTab>("trend");

  useEffect(() => setTicker(initialTicker), [initialTicker]);

  useEffect(() => {
    const stored = localStorage.getItem("watchlist");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) setWatchlist(parsed);
    } catch {
      // ignore malformed watchlist
    }
  }, []);

  useEffect(() => {
    const sync = () => setIsDesktop(window.innerWidth >= 1024);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const query = useStockSnapshot(ticker);
  const snapshot = query.data as SnapshotResponse | undefined;
  const requestError = query.error instanceof Error ? query.error.message : "讀取快照失敗";

  const onTickerChange = (nextTicker: string) => {
    setTicker(nextTicker);
    setShowStockPicker(false);
    router.push(`/stock/${nextTicker}`);
  };

  const currentStockLabel = formatTickerLabel(ticker);
  const activeExplainMeta = EXPLAIN_TABS.find((tab) => tab.key === activeExplainTab) ?? EXPLAIN_TABS[0];

  const radarData: RadarOverviewDataItem[] = snapshot
    ? [
        { label: "技術", value: snapshot.signals.trend.trendScore ?? 50 },
        { label: "籌碼", value: snapshot.signals.flow.flowScore ?? 50 },
        { label: "基本面", value: snapshot.signals.fundamental.fundamentalScore ?? 50 },
        { label: "波動", value: snapshot.shortTermVolatility.volatilityScore },
        { label: "機率", value: snapshot.predictions.upProb3D },
        { label: "一致性", value: snapshot.consistency.score },
      ]
    : [];

  const consistencySummary = snapshot?.consistency.contradictions[0] || snapshot?.consistency.reasons[0] || "多因子方向尚可";

  return (
    <div className="min-h-screen overflow-x-hidden bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-2">
          <div className="text-sm text-neutral-400">Dashboard</div>
          <button
            type="button"
            onClick={() => setShowStockPicker(true)}
            className="mx-auto inline-flex h-11 max-w-full items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-4 text-sm text-neutral-100"
          >
            <span className="truncate">{currentStockLabel}</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          <Button asChild variant="outline" className="h-11 w-11 rounded-full border-neutral-700 bg-neutral-900 p-0 text-neutral-100">
            <Link href="/watchlist" aria-label="設定">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 lg:px-8 lg:pt-10">
        {query.isLoading && <div className="py-20 text-center text-sm text-neutral-400">載入中...</div>}
        {query.isError && <div className="py-20 text-center text-sm text-rose-400">{requestError}</div>}

        {snapshot && !query.isLoading && !query.isError && (
          <BentoGrid className="gap-6">
            <Tile className="order-1 min-h-[240px] bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 lg:col-span-12 lg:p-10">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-4">
                  <div className="text-sm text-neutral-400">股票</div>
                  <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">{currentStockLabel}</h1>
                  <div className={`text-xl font-semibold ${toneClass(directionLabel(snapshot.aiSummary.stance))}`}>{directionLabel(snapshot.aiSummary.stance)}</div>
                  <div className="text-xl text-neutral-200">策略建議：{strategyLabel(snapshot.strategy.signal)}</div>
                  <div className="max-w-xl text-sm text-neutral-400 whitespace-normal break-words">
                    {snapshot.strategy.actionCards[0]?.summary || snapshot.aiSummary.keyPoints[0] || "等待訊號確認再執行"}
                  </div>
                </div>

                <div className="space-y-2 lg:text-right">
                  <div className="text-sm text-neutral-400">策略信心</div>
                  <div className="text-6xl font-semibold tracking-tight text-neutral-100">{snapshot.strategy.confidence.toFixed(0)}%</div>
                  <Button type="button" variant="outline" className="h-11 rounded-full text-base" onClick={() => setShowDetail((prev) => !prev)}>
                    詳細分析
                  </Button>
                </div>
              </div>
            </Tile>

            <div className="order-2 grid grid-cols-2 gap-6 lg:col-span-12 lg:grid-cols-5">
              <MetricCard title="Trend" score={snapshot.signals.trend.trendScore} />
              <MetricCard title="Flow" score={snapshot.signals.flow.flowScore} />
              <MetricCard title="Fundamental" score={snapshot.signals.fundamental.fundamentalScore} />
              <MetricCard title="Volatility" score={snapshot.shortTermVolatility.volatilityScore} />
              <MetricCard title="Probability" score={snapshot.predictions.upProb3D} />
            </div>

            <Tile className="order-3 lg:col-span-12">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-base font-medium text-neutral-300">一致性指數</div>
                <div className={`rounded-full border px-3 py-1 text-sm ${levelBadgeClass(snapshot.consistency.level)}`}>{snapshot.consistency.level}</div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div className="min-w-0">
                  <div className="text-3xl font-semibold text-neutral-100">{snapshot.consistency.score.toFixed(1)}</div>
                  <div className="mt-2 text-base text-neutral-300">共識方向：{snapshot.consistency.consensusDirection}</div>
                </div>
                <div className="min-w-0 text-sm text-neutral-400 whitespace-normal break-words">{consistencySummary}</div>
              </div>
            </Tile>

            <Tile className="order-4 lg:col-span-12">
              <div className="mb-3 text-base font-medium text-neutral-300">雷達總覽</div>
              <RadarOverview data={radarData} />
            </Tile>

            {showDetail ? (
              <Tile className="order-5 w-full min-w-0 lg:col-span-12">
                <div className="w-full min-w-0">
                  <div className="mb-4 text-xl font-semibold text-neutral-100">詳細分析</div>

                  <div className="hidden w-full min-w-0 flex-wrap gap-2 lg:flex">
                    {EXPLAIN_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveExplainTab(tab.key)}
                        className={`min-w-0 max-w-full rounded-full border px-4 py-2 text-base transition ${
                          activeExplainTab === tab.key
                            ? "border-neutral-300 bg-neutral-100 text-neutral-900"
                            : "border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-500"
                        }`}
                      >
                        <span className="block min-w-0 truncate">{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex w-full min-w-0 lg:hidden">
                    <Select value={activeExplainTab} onValueChange={(value) => setActiveExplainTab(value as ExplainTab)}>
                      <SelectTrigger className="h-11 w-full min-w-0 max-w-full border-neutral-700 bg-neutral-900 text-base">
                        <SelectValue placeholder="選擇分析分類" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPLAIN_TABS.map((tab) => (
                          <SelectItem key={tab.key} value={tab.key}>
                            {tab.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-3 w-full min-w-0 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 text-sm text-neutral-400 whitespace-normal break-words">
                    {activeExplainMeta.description}
                  </div>

                  <div className="mt-4 w-full min-w-0 space-y-4">
                    {(activeExplainTab === "trend" ||
                      activeExplainTab === "flow" ||
                      activeExplainTab === "fundamental" ||
                      activeExplainTab === "volatility" ||
                      activeExplainTab === "prediction") &&
                    snapshot.explainBreakdown[activeExplainTab] ? (
                      <ExplainComponentsTable section={snapshot.explainBreakdown[activeExplainTab]} />
                    ) : null}

                    {activeExplainTab === "news" ? (
                      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-300 whitespace-normal break-words">
                        新聞分數：{snapshot.newsMeta?.catalystScore ?? 0}，偏多 {snapshot.newsMeta?.bullishCount ?? 0} 則，偏空 {snapshot.newsMeta?.bearishCount ?? 0} 則。
                      </div>
                    ) : null}

                    {activeExplainTab === "strategy" ? (
                      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-300 whitespace-normal break-words">
                        策略訊號：{snapshot.strategy.signal}；策略信心：{snapshot.strategy.confidence.toFixed(1)}%；規則：
                        {snapshot.strategy.debug.chosenRuleId || "--"}
                      </div>
                    ) : null}

                    {activeExplainTab === "consistency" ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-300">
                            共識方向：{snapshot.explainBreakdown.consistency.consensusDirection}
                            <br />
                            共識值：{snapshot.explainBreakdown.consistency.consensusValue.toFixed(3)}
                          </div>
                          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-300">
                            分歧度：{snapshot.explainBreakdown.consistency.disagreement.toFixed(3)}
                            <br />
                            同向比例：{(snapshot.explainBreakdown.consistency.sameSignRatio * 100).toFixed(1)}%
                          </div>
                          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-300">
                            等級：{snapshot.explainBreakdown.consistency.level}
                            <br />
                            分數：{snapshot.explainBreakdown.consistency.score?.toFixed(1) ?? "--"}
                          </div>
                        </div>

                        <ExplainComponentsTable section={snapshot.explainBreakdown.consistency} />

                        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
                          <div className="mb-2 text-base font-medium text-neutral-200">主要矛盾</div>
                          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
                            {(snapshot.explainBreakdown.consistency.contradictions.length > 0
                              ? snapshot.explainBreakdown.consistency.contradictions
                              : ["目前未出現明顯強烈對立訊號"]
                            ).map((item, idx) => (
                              <li key={`${item}-${idx}`} className="whitespace-normal break-words">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Tile>
            ) : null}
          </BentoGrid>
        )}
      </div>

      <StockPicker
        open={showStockPicker}
        isDesktop={isDesktop}
        watchlist={watchlist}
        currentTicker={ticker}
        onClose={() => setShowStockPicker(false)}
        onSelect={onTickerChange}
      />
    </div>
  );
}
