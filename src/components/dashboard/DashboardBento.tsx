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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { defaultWatchlist, stockNameMap, zhTW } from "@/i18n/zh-TW";
import { useStockSnapshot } from "@/hooks/useStockSnapshot";

type ExplainTab = "trend" | "flow" | "fundamental" | "volatility" | "prediction";

type ExplainSection = {
  score: number | null;
  formula: string;
  components: Array<{ key: string; label: string; value: number | string; weight: number; contribution: number }>;
  reasons: string[];
  riskFlags: string[];
};

type NewsItem = {
  date?: string;
  source?: string;
  title: string;
  link?: string;
  category?: string;
  impact?: "BULLISH" | "BEARISH" | "NEUTRAL";
  impactScore?: number;
};

type SnapshotResponse = {
  normalizedTicker: { symbol?: string; displayName?: string; market?: string; yahoo?: string };
  signals: {
    trend: { trendScore: number | null };
    flow: { flowScore: number | null };
    fundamental: { fundamentalScore: number | null };
  };
  shortTerm: {
    pullbackRiskScore: number;
    shortTermOpportunityScore: number;
  };
  predictions: {
    upProb1D: number;
    upProb3D: number;
    upProb5D: number;
    upProb1DRaw: number;
    upProb3DRaw: number;
    upProb5DRaw: number;
    bigMoveProb3D: number;
    calibration: { sampleSize: number };
  };
  strategy: {
    mode: string;
    signal: string;
    confidence: number;
    actionCards: Array<{
      title: string;
      summary: string;
      conditions: string[];
      invalidation: string[];
      riskNotes: string[];
      plan: string[];
      tags: string[];
    }>;
    debug: {
      chosenRuleId: string;
      matchedRules: string[];
    };
  };
  aiSummary: { stance: "Bullish" | "Neutral" | "Bearish"; confidence: number; keyPoints: string[] };
  explainBreakdown: {
    trend: ExplainSection;
    flow: ExplainSection;
    fundamental: ExplainSection;
    confidence: ExplainSection;
    shortTerm: ExplainSection;
    prediction: ExplainSection;
    volatility: ExplainSection;
  };
  shortTermVolatility: { volatilityScore: number };
  newsMeta?: { bullishCount: number; bearishCount: number; catalystScore: number };
  news?: {
    errorCode?: string | null;
    timeline: NewsItem[];
    topBullishNews: NewsItem[];
    topBearishNews: NewsItem[];
  };
  dataWindow?: { barsReturned?: number };
  data: { prices: Array<{ date: string; close: number; volume?: number }> };
};

function formatScore(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "--";
  return value.toFixed(1);
}

function formatTickerLabel(ticker: string): string {
  const name = stockNameMap[ticker] ?? "";
  return name ? `${ticker} ${name}` : ticker;
}

function stanceTone(stance: "Bullish" | "Neutral" | "Bearish"): string {
  if (stance === "Bullish") return "text-emerald-300";
  if (stance === "Bearish") return "text-rose-300";
  return "text-amber-300";
}

function directionLabel(stance: "Bullish" | "Neutral" | "Bearish"): string {
  if (stance === "Bullish") return "偏多";
  if (stance === "Bearish") return "偏空";
  return "中性";
}

function strategyLabel(signal: string): string {
  if (signal.includes("偏多") || signal.includes("Bull") || signal.includes("看多")) return "突破追蹤";
  if (signal.includes("偏空") || signal.includes("Bear") || signal.includes("看空")) return "等待";
  if (signal.includes("觀望") || signal.includes("Wait")) return "等待";
  return "回踩承接";
}

function trimSummary(input?: string): string {
  if (!input) return "等待訊號確認再執行";
  return input.length > 20 ? `${input.slice(0, 20)}…` : input;
}

function ExplainComponentsTable({ section }: { section: ExplainSection }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800">
      <div className="grid grid-cols-12 gap-2 border-b border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-300">
        <div className="col-span-5">項目</div>
        <div className="col-span-3">數值</div>
        <div className="col-span-2 text-right">權重</div>
        <div className="col-span-2 text-right">貢獻</div>
      </div>
      {section.components.map((row) => (
        <div key={row.key} className="grid grid-cols-12 gap-2 border-b border-neutral-900 px-4 py-3 text-sm text-neutral-200 last:border-b-0">
          <div className="col-span-5 break-words">{row.label || row.key}</div>
          <div className="col-span-3 font-mono">{String(row.value ?? "--")}</div>
          <div className="col-span-2 text-right tabular-nums">{Number(row.weight).toFixed(2)}</div>
          <div className="col-span-2 text-right tabular-nums">{Number(row.contribution).toFixed(4)}</div>
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
              placeholder={zhTW.stockPicker.searchPlaceholder}
              className="h-12 border-neutral-700 bg-neutral-950 pl-10 text-base text-neutral-100"
            />
          </div>

          <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">找不到符合條件的股票</div>
            ) : (
              filtered.map((ticker) => (
                <button
                  key={ticker}
                  type="button"
                  onClick={() => onSelect(ticker)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-base transition ${
                    ticker === currentTicker
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : "border-neutral-800 bg-neutral-950 text-neutral-100 hover:border-neutral-600"
                  }`}
                >
                  <span>{formatTickerLabel(ticker)}</span>
                  {ticker === currentTicker ? <span className="text-sm">目前</span> : null}
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

  const explainSectionMap: Record<ExplainTab, ExplainSection | undefined> = {
    trend: snapshot?.explainBreakdown.trend,
    flow: snapshot?.explainBreakdown.flow,
    fundamental: snapshot?.explainBreakdown.fundamental,
    volatility: snapshot?.explainBreakdown.volatility,
    prediction: snapshot?.explainBreakdown.prediction,
  };

  const currentStockLabel = formatTickerLabel(ticker);
  const currentStrategyCard = snapshot?.strategy.actionCards[0];
  const heroSummary = trimSummary(currentStrategyCard?.summary || snapshot?.aiSummary.keyPoints?.[0]);

  const radarData: RadarOverviewDataItem[] = snapshot
    ? [
        { label: "技術", value: snapshot.signals.trend.trendScore ?? 50 },
        { label: "籌碼", value: snapshot.signals.flow.flowScore ?? 50 },
        { label: "基本面", value: snapshot.signals.fundamental.fundamentalScore ?? 50 },
        { label: "波動", value: snapshot.shortTermVolatility.volatilityScore },
        { label: "機率", value: snapshot.predictions.upProb3D },
      ]
    : [];

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
                  <div className={`text-xl font-semibold ${stanceTone(snapshot.aiSummary.stance)}`}>{directionLabel(snapshot.aiSummary.stance)}</div>
                  <div className="text-xl text-neutral-200">策略建議：{strategyLabel(snapshot.strategy.signal)}</div>
                  <div className="max-w-xl text-sm text-neutral-400">{heroSummary}</div>
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
              <div className="mb-3 text-base font-medium text-neutral-300">雷達總覽</div>
              <RadarOverview data={radarData} />
            </Tile>

            {showDetail ? (
              <Tile className="order-4 lg:col-span-12">
                <div className="mb-4 text-xl font-semibold text-neutral-100">詳細分析</div>
                <Tabs value={activeExplainTab} onValueChange={(value) => setActiveExplainTab(value as ExplainTab)}>
                  <TabsList className="grid h-auto w-full grid-cols-2 gap-2 p-1 lg:grid-cols-5">
                    <TabsTrigger value="trend" className="text-base">技術面</TabsTrigger>
                    <TabsTrigger value="flow" className="text-base">籌碼面</TabsTrigger>
                    <TabsTrigger value="fundamental" className="text-base">基本面</TabsTrigger>
                    <TabsTrigger value="volatility" className="text-base">波動</TabsTrigger>
                    <TabsTrigger value="prediction" className="text-base">機率</TabsTrigger>
                  </TabsList>

                  {(Object.keys(explainSectionMap) as ExplainTab[]).map((tab) => (
                    <TabsContent key={tab} value={tab} className="mt-4">
                      {explainSectionMap[tab] ? (
                        <ExplainComponentsTable section={explainSectionMap[tab]!} />
                      ) : (
                        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-400">無資料</div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
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
