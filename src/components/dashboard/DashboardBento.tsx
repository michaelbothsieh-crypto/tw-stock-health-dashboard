"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, Settings, X } from "lucide-react";
import { BentoGrid } from "@/components/bento/BentoGrid";
import { Tile, TileHeader, TileValue } from "@/components/bento/Tile";
import { StockChart } from "@/components/StockChart";
import { RadarOverview, RadarOverviewDataItem } from "@/components/charts/RadarOverview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  defaultWatchlist,
  impactLabel,
  mapErrorCodeToZh,
  stanceLabelWithEn,
  stockNameMap,
  volatilitySummary,
  zhTW,
} from "@/i18n/zh-TW";
import { useStockSnapshot } from "@/hooks/useStockSnapshot";
import { riskFlagLabel } from "@/lib/riskFlags";

type ExplainTab =
  | "trend"
  | "flow"
  | "fundamental"
  | "confidence"
  | "shortTerm"
  | "prediction"
  | "volatility";

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
    mode: "波段" | "短線";
    signal: "觀察" | "偏多" | "偏空" | "等待" | "避開";
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

const EXPLAIN_TAB_LABEL: Record<ExplainTab, string> = {
  trend: zhTW.section.trend,
  flow: zhTW.section.flow,
  fundamental: zhTW.section.fundamental,
  confidence: zhTW.section.confidenceTab,
  shortTerm: zhTW.section.shortTerm,
  prediction: zhTW.section.prediction,
  volatility: zhTW.section.volatility,
};

function getScoreColor(score: number | null): string {
  if (score === null) return "text-neutral-400";
  if (score >= 70) return "text-emerald-400";
  if (score < 40) return "text-rose-400";
  return "text-yellow-400";
}

function formatScore(value: number | null): string {
  if (value === null || Number.isNaN(value)) return zhTW.states.noData;
  return value.toFixed(1);
}

function formatTickerLabel(ticker: string): string {
  const name = stockNameMap[ticker] ?? "";
  return name ? `${ticker} ${name}` : ticker;
}

function stanceClass(stance: "Bullish" | "Neutral" | "Bearish"): string {
  if (stance === "Bullish") return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
  if (stance === "Bearish") return "bg-rose-500/20 text-rose-300 border border-rose-500/40";
  return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40";
}

function pullbackRiskBadge(score: number): { text: string; className: string } {
  if (score >= 70) return { text: zhTW.riskLevel.high, className: "bg-rose-500/20 text-rose-300 border border-rose-500/40" };
  if (score >= 40) return { text: zhTW.riskLevel.medium, className: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" };
  return { text: zhTW.riskLevel.low, className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" };
}

function strategySignalClass(signal: SnapshotResponse["strategy"]["signal"]): string {
  if (signal === "偏多") return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
  if (signal === "偏空" || signal === "避開") return "bg-rose-500/20 text-rose-300 border border-rose-500/40";
  if (signal === "等待") return "bg-amber-500/20 text-amber-300 border border-amber-500/40";
  return "bg-neutral-500/20 text-neutral-200 border border-neutral-500/40";
}

function ExplainSectionContent({ section }: { section: ExplainSection }) {
  return (
    <div className="space-y-4 text-sm lg:text-base">
      <div>
        <div className="mb-1 font-semibold text-neutral-200">{zhTW.explain.formula}</div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-300 whitespace-pre-wrap break-words">
          {section.formula || zhTW.states.noData}
        </div>
      </div>

      <div>
        <div className="mb-1 font-semibold text-neutral-200">{zhTW.explain.components}</div>
        <div className="rounded-xl border border-neutral-800">
          <div className="grid grid-cols-12 gap-2 border-b border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm font-medium text-neutral-300">
            <div className="col-span-5 min-w-0 whitespace-normal break-words">{zhTW.explain.columns.label}</div>
            <div className="col-span-4 min-w-0 whitespace-normal break-words">{zhTW.explain.columns.value}</div>
            <div className="col-span-1 min-w-0 text-right tabular-nums">{zhTW.explain.columns.weight}</div>
            <div className="col-span-2 min-w-0 text-right tabular-nums">{zhTW.explain.columns.contribution}</div>
          </div>
          {section.components.map((row) => (
            <div key={row.key} className="grid grid-cols-12 gap-2 border-b border-neutral-900 px-3 py-2 text-sm text-neutral-300 last:border-b-0">
              <div className="col-span-5 min-w-0 whitespace-normal break-words">{row.label || row.key}</div>
              <div className="col-span-4 min-w-0 font-mono text-sm break-all">{String(row.value ?? zhTW.states.noData)}</div>
              <div className="col-span-1 min-w-0 text-right tabular-nums">{Number(row.weight).toFixed(2)}</div>
              <div className="col-span-2 min-w-0 text-right tabular-nums">{Number(row.contribution).toFixed(4)}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 font-semibold text-neutral-200">{zhTW.explain.reasons}</div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
          {(section.reasons.length > 0 ? section.reasons : [zhTW.states.noData]).map((item, idx) => (
            <li key={`${item}-${idx}`}>{item}</li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 font-semibold text-neutral-200">{zhTW.explain.riskFlags}</div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
          {(section.riskFlags.length > 0 ? section.riskFlags : [zhTW.states.none]).map((item, idx) => (
            <li key={`${item}-${idx}`}>{riskFlagLabel(item)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function NewsList({ items, error }: { items: NewsItem[]; error?: string | null }) {
  if (error) {
    return (
      <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-base text-rose-300">
        <div className="font-semibold">{zhTW.states.newsLoadFailed}</div>
        <div className="mt-1 text-sm">{error}</div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-base text-neutral-400">{zhTW.states.noNews}</div>;
  }

  return (
    <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
      {items.map((item, idx) => (
        <article key={`${item.title}-${idx}`} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
          <div className="mb-1 flex flex-wrap items-center gap-1 text-sm text-neutral-400">
            <span>{item.date?.slice(0, 16) ?? zhTW.states.noData}</span>
            <span>·</span>
            <span>{item.source ?? zhTW.states.unknownSource}</span>
          </div>
          <a href={item.link || "#"} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-base font-medium text-neutral-100 hover:underline">
            {item.title}
          </a>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-sm font-medium">
              {item.category || zhTW.states.otherCategory}
            </Badge>
            <Badge className="rounded-full px-3 py-1 text-sm font-medium">
              {impactLabel(item.impact)} {item.impactScore ?? 0}
            </Badge>
          </div>
        </article>
      ))}
    </div>
  );
}

function ScoreTile({
  title,
  score,
  description,
  onExplain,
  children,
  inlineExplain,
}: {
  title: string;
  score: number | null;
  description: string;
  onExplain: () => void;
  children?: React.ReactNode;
  inlineExplain?: React.ReactNode;
}) {
  return (
    <Tile>
      <TileHeader
        title={title}
        description={description}
        action={
          <Button type="button" variant="outline" className="h-11 rounded-full text-base" onClick={onExplain}>
            {zhTW.actions.openExplain}
          </Button>
        }
      />
      <TileValue value={formatScore(score)} toneClassName={getScoreColor(score)} />
      {children ? <div className="mt-3 text-sm text-neutral-300 lg:text-base">{children}</div> : null}
      {inlineExplain ? <div className="mt-3">{inlineExplain}</div> : null}
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
            <h3 className="text-xl font-semibold text-neutral-100 lg:text-2xl">{zhTW.actions.switchStockTitle}</h3>
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
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-base text-neutral-400">
                {zhTW.stockPicker.noResult}
              </div>
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
                  {ticker === currentTicker ? <span className="text-sm">{zhTW.states.current}</span> : null}
                </button>
              ))
            )}
          </div>

          <div className="mt-4">
            <Button asChild variant="outline" className="h-11 w-full rounded-xl text-base">
              <Link href="/watchlist" onClick={onClose}>
                {zhTW.actions.manageWatchlist}
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
  const [showGuide, setShowGuide] = useState(false);
  const [showStrategyDetail, setShowStrategyDetail] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeExplainTab, setActiveExplainTab] = useState<ExplainTab>("trend");
  const [mobileExpanded, setMobileExpanded] = useState<Record<ExplainTab, boolean>>({
    trend: false,
    flow: false,
    fundamental: false,
    confidence: false,
    shortTerm: false,
    prediction: false,
    volatility: false,
  });
  const explainTileRef = useRef<HTMLElement | null>(null);

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
  const requestError = query.error instanceof Error ? query.error.message : zhTW.states.snapshotError;

  const onTickerChange = (nextTicker: string) => {
    setTicker(nextTicker);
    setShowStockPicker(false);
    router.push(`/stock/${nextTicker}`);
  };

  const openExplain = (tab: ExplainTab) => {
    setActiveExplainTab(tab);
    if (isDesktop) {
      explainTileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setMobileExpanded((prev) => ({ ...prev, [tab]: !prev[tab] }));
    }
  };

  const explainSectionMap: Record<ExplainTab, ExplainSection | undefined> = {
    trend: snapshot?.explainBreakdown.trend,
    flow: snapshot?.explainBreakdown.flow,
    fundamental: snapshot?.explainBreakdown.fundamental,
    confidence: snapshot?.explainBreakdown.confidence,
    shortTerm: snapshot?.explainBreakdown.shortTerm,
    prediction: snapshot?.explainBreakdown.prediction,
    volatility: snapshot?.explainBreakdown.volatility,
  };

  const newsError = snapshot?.news?.errorCode ? `${mapErrorCodeToZh(snapshot.news.errorCode)}（${snapshot.news.errorCode}）` : null;
  const bullishNews = useMemo(() => snapshot?.news?.topBullishNews ?? [], [snapshot?.news?.topBullishNews]);
  const bearishNews = useMemo(() => snapshot?.news?.topBearishNews ?? [], [snapshot?.news?.topBearishNews]);
  const currentStockLabel = formatTickerLabel(ticker);
  const pullbackBadge = snapshot ? pullbackRiskBadge(snapshot.shortTerm.pullbackRiskScore) : null;
  const currentStrategyCard = snapshot?.strategy.actionCards[0];
  const radarData: RadarOverviewDataItem[] = snapshot
    ? [
        { label: "技術面", value: snapshot.signals.trend.trendScore ?? 50 },
        { label: "籌碼面", value: snapshot.signals.flow.flowScore ?? 50 },
        {
          label: "基本面",
          value: snapshot.signals.fundamental.fundamentalScore ?? 50,
          note: snapshot.signals.fundamental.fundamentalScore === null ? "資料不足" : undefined,
        },
        { label: "新聞催化", value: Math.max(0, Math.min(100, 50 + (snapshot.newsMeta?.catalystScore ?? 0) / 2)) },
        { label: "波動敏感度", value: snapshot.shortTermVolatility.volatilityScore },
        { label: "短期機會", value: snapshot.shortTerm.shortTermOpportunityScore },
        { label: "5日上漲機率", value: snapshot.predictions.upProb5D },
      ]
    : [];

  return (
    <div className="min-h-screen overflow-x-hidden bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-2">
          <div className="text-sm text-neutral-400">{zhTW.appTitle}</div>
          <button
            type="button"
            onClick={() => setShowStockPicker(true)}
            className="mx-auto inline-flex h-11 max-w-full items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-4 text-sm text-neutral-100"
          >
            <span className="truncate">{currentStockLabel}</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          <Button asChild variant="outline" className="h-11 w-11 rounded-full border-neutral-700 bg-neutral-900 p-0 text-neutral-100">
            <Link href="/watchlist" aria-label={zhTW.actions.settings}>
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 lg:px-8 lg:pt-8">
        {query.isLoading && <div className="py-20 text-center text-base text-neutral-400">{zhTW.states.loading}</div>}
        {query.isError && <div className="py-20 text-center text-base text-rose-400">{requestError}</div>}

        {snapshot && !query.isLoading && !query.isError && (
          <BentoGrid>
            <Tile className="order-1 bg-gradient-to-br from-neutral-900 to-neutral-800 lg:col-span-7 lg:row-span-2">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-neutral-400">{zhTW.section.currentStock}</div>
                  <h2 className="text-3xl font-semibold tracking-tight text-neutral-100 lg:text-4xl">{currentStockLabel}</h2>
                  <div className="mt-1 text-sm text-neutral-400 lg:text-base">
                    {zhTW.section.market} {snapshot.normalizedTicker.market || zhTW.states.noData} · {zhTW.section.yahoo}{" "}
                    {snapshot.normalizedTicker.yahoo || zhTW.states.noData}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="hidden h-11 rounded-full border-neutral-700 bg-neutral-900 text-base lg:inline-flex"
                    onClick={() => setShowGuide(true)}
                  >
                    {zhTW.actions.showGuide}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full border-neutral-700 bg-neutral-900 text-base"
                    onClick={() => setShowStockPicker(true)}
                  >
                    {zhTW.actions.switchStock} <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button asChild variant="outline" className="hidden h-11 w-11 rounded-full border-neutral-700 bg-neutral-900 p-0 lg:inline-flex">
                    <Link href="/watchlist" aria-label={zhTW.actions.settings}>
                      <Settings className="h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="space-y-4 text-base">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`rounded-full px-3 py-1 text-sm font-medium ${stanceClass(snapshot.aiSummary.stance)}`}>
                    {stanceLabelWithEn(snapshot.aiSummary.stance)}
                  </Badge>
                  <span className="text-base text-neutral-300">
                    {zhTW.section.confidence} {snapshot.aiSummary.confidence.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <div className="mb-1 text-xl font-semibold text-neutral-100 lg:text-2xl">{zhTW.section.heroBasis}</div>
                  <ul className="list-disc space-y-1 pl-5 text-base text-neutral-200">
                    {snapshot.aiSummary.keyPoints.slice(0, 3).map((point, idx) => (
                      <li key={`${point}-${idx}`}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Tile>

            <Tile className="order-2 lg:col-span-5 lg:row-span-2">
              <TileHeader title={zhTW.section.radar} description={zhTW.section.radarDesc} />
              <RadarOverview data={radarData} />
            </Tile>

            <div className="order-3 lg:col-span-5 lg:row-span-1">
              <ScoreTile
                title={zhTW.section.trend}
                score={snapshot.signals.trend.trendScore}
                description={zhTW.section.trendDesc}
                onExplain={() => openExplain("trend")}
                inlineExplain={mobileExpanded.trend ? <ExplainSectionContent section={snapshot.explainBreakdown.trend} /> : undefined}
              />
            </div>

            <div className="order-4 lg:col-span-5 lg:row-span-1">
              <ScoreTile
                title={zhTW.section.flow}
                score={snapshot.signals.flow.flowScore}
                description={zhTW.section.flowDesc}
                onExplain={() => openExplain("flow")}
                inlineExplain={mobileExpanded.flow ? <ExplainSectionContent section={snapshot.explainBreakdown.flow} /> : undefined}
              />
            </div>

            <div className="order-5 lg:col-span-4 lg:row-span-1">
              <ScoreTile
                title={zhTW.section.fundamental}
                score={snapshot.signals.fundamental.fundamentalScore}
                description={zhTW.section.fundamentalDesc}
                onExplain={() => openExplain("fundamental")}
                inlineExplain={mobileExpanded.fundamental ? <ExplainSectionContent section={snapshot.explainBreakdown.fundamental} /> : undefined}
              />
            </div>

            <div className="order-6 lg:col-span-4 lg:row-span-1">
              <ScoreTile
                title={zhTW.section.shortTerm}
                score={snapshot.shortTerm.shortTermOpportunityScore}
                description={zhTW.section.shortTermDesc}
                onExplain={() => openExplain("shortTerm")}
                inlineExplain={mobileExpanded.shortTerm ? <ExplainSectionContent section={snapshot.explainBreakdown.shortTerm} /> : undefined}
              >
                <div className="flex items-center gap-2">
                  <span>{zhTW.section.pullbackRisk}：</span>
                  {pullbackBadge ? <Badge className={`rounded-full px-3 py-1 text-sm ${pullbackBadge.className}`}>{pullbackBadge.text}</Badge> : null}
                </div>
              </ScoreTile>
            </div>

            <div className="order-7 lg:col-span-4 lg:row-span-1">
              <ScoreTile
                title={zhTW.section.prediction}
                score={snapshot.predictions.upProb3D}
                description={zhTW.section.predictionDesc}
                onExplain={() => openExplain("prediction")}
                inlineExplain={mobileExpanded.prediction ? <ExplainSectionContent section={snapshot.explainBreakdown.prediction} /> : undefined}
              >
                <div className="space-y-1">
                  <div>{zhTW.section.upProb1D}：{snapshot.predictions.upProb1D.toFixed(1)}%</div>
                  <div>{zhTW.section.upProb3D}：{snapshot.predictions.upProb3D.toFixed(1)}%</div>
                  <div>{zhTW.section.upProb5D}：{snapshot.predictions.upProb5D.toFixed(1)}%</div>
                  <div>{zhTW.section.bigMoveProb3D}：{snapshot.predictions.bigMoveProb3D.toFixed(1)}%</div>
                  <div className="text-xs text-neutral-500">
                    {zhTW.section.rawProb} {snapshot.predictions.upProb5DRaw.toFixed(1)}% · {zhTW.section.calibratedProb}{" "}
                    {snapshot.predictions.upProb5D.toFixed(1)}%
                  </div>
                  <div className="text-xs text-neutral-500">{zhTW.disclaimer}</div>
                </div>
              </ScoreTile>
            </div>

            <div className="order-8 lg:col-span-4 lg:row-span-1">
              <Tile>
                <TileHeader
                  title={zhTW.section.strategy}
                  description={zhTW.section.strategyDesc}
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-full text-base"
                      onClick={() => setShowStrategyDetail((prev) => !prev)}
                    >
                      {showStrategyDetail ? zhTW.strategy.hideDetail : zhTW.strategy.viewDetail}
                    </Button>
                  }
                />
                <div className="mb-3 flex items-center gap-2">
                  <Badge className={`rounded-full px-3 py-1 text-sm font-medium ${strategySignalClass(snapshot.strategy.signal)}`}>
                    {snapshot.strategy.signal}
                  </Badge>
                  <span className="text-sm text-neutral-300">
                    {zhTW.strategy.confidence} {snapshot.strategy.confidence.toFixed(1)}%
                  </span>
                </div>
                <div className="text-sm text-neutral-200">
                  <div className="font-semibold">{currentStrategyCard?.title || zhTW.strategy.noCard}</div>
                  <div className="text-neutral-400">{currentStrategyCard?.summary}</div>
                </div>
                {showStrategyDetail && currentStrategyCard ? (
                  <div className="mt-3 space-y-3 text-sm text-neutral-300">
                    <div>
                      <div className="font-semibold text-neutral-200">{zhTW.strategy.conditions}</div>
                      <ul className="list-disc pl-5">
                        {currentStrategyCard.conditions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-neutral-200">{zhTW.strategy.invalidation}</div>
                      <ul className="list-disc pl-5">
                        {currentStrategyCard.invalidation.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-neutral-200">{zhTW.strategy.plan}</div>
                      <ul className="list-disc pl-5">
                        {currentStrategyCard.plan.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-neutral-200">{zhTW.strategy.riskNotes}</div>
                      <ul className="list-disc pl-5">
                        {currentStrategyCard.riskNotes.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </Tile>
            </div>

            <div className="order-9 lg:col-span-4 lg:row-span-1">
              <ScoreTile
                title={zhTW.section.volatilityCard}
                score={snapshot.shortTermVolatility.volatilityScore}
                description={zhTW.section.volatilityDesc}
                onExplain={() => openExplain("volatility")}
                inlineExplain={mobileExpanded.volatility ? <ExplainSectionContent section={snapshot.explainBreakdown.volatility} /> : undefined}
              >
                {volatilitySummary(snapshot.shortTermVolatility.volatilityScore)}
              </ScoreTile>
            </div>

            <Tile className="order-11 lg:order-10 lg:col-span-4 lg:row-span-2">
              <TileHeader
                title={zhTW.section.newsCatalyst}
                description={zhTW.section.newsDesc
                  .replace("{bull}", String(snapshot.newsMeta?.bullishCount ?? 0))
                  .replace("{bear}", String(snapshot.newsMeta?.bearishCount ?? 0))}
                action={
                  <Badge className="rounded-full px-3 py-1 text-sm font-medium bg-neutral-800 text-neutral-100">
                    {zhTW.section.score} {snapshot.newsMeta?.catalystScore ?? 0}
                  </Badge>
                }
              />
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="mb-2 grid h-12 w-full grid-cols-3">
                  <TabsTrigger value="all">{zhTW.actions.viewAll}</TabsTrigger>
                  <TabsTrigger value="bull">{zhTW.impact.bullish}</TabsTrigger>
                  <TabsTrigger value="bear">{zhTW.impact.bearish}</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                  <NewsList items={snapshot.news?.timeline ?? []} error={newsError} />
                </TabsContent>
                <TabsContent value="bull">
                  <NewsList items={bullishNews} error={newsError} />
                </TabsContent>
                <TabsContent value="bear">
                  <NewsList items={bearishNews} error={newsError} />
                </TabsContent>
              </Tabs>
            </Tile>

            <Tile className="order-10 lg:order-11 lg:col-span-8 lg:row-span-2">
              <TileHeader
                title={zhTW.section.chart}
                description={zhTW.section.chartDesc.replace("{count}", String(snapshot.dataWindow?.barsReturned ?? 0))}
              />
              <StockChart data={snapshot.data.prices} />
            </Tile>

            <Tile className="order-12 lg:col-span-4 lg:row-span-2" ref={explainTileRef}>
              <TileHeader
                title={zhTW.section.explain}
                description={zhTW.section.explainDesc}
                action={
                  <Button type="button" variant="outline" className="h-11 rounded-full text-base lg:hidden" onClick={() => openExplain(activeExplainTab)}>
                    {mobileExpanded[activeExplainTab] ? zhTW.actions.collapse : zhTW.actions.expand}
                  </Button>
                }
              />
              <Tabs value={activeExplainTab} onValueChange={(value) => setActiveExplainTab(value as ExplainTab)}>
                <TabsList className="grid h-auto w-full grid-cols-4 gap-1 p-1 lg:grid-cols-7">
                  {Object.entries(EXPLAIN_TAB_LABEL).map(([key, label]) => (
                    <TabsTrigger key={key} value={key}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {(Object.keys(EXPLAIN_TAB_LABEL) as ExplainTab[]).map((tab) => (
                  <TabsContent key={tab} value={tab} className="mt-3">
                    {!isDesktop && !mobileExpanded[tab] ? (
                      <CardDescription>{zhTW.explain.openHint}</CardDescription>
                    ) : explainSectionMap[tab] ? (
                      <ExplainSectionContent section={explainSectionMap[tab]!} />
                    ) : (
                      <CardDescription>{zhTW.states.noData}</CardDescription>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </Tile>
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

      {showGuide ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-neutral-100 lg:text-2xl">{zhTW.actions.showGuide}</h3>
              <Button type="button" variant="ghost" className="h-11 w-11 rounded-full p-0" onClick={() => setShowGuide(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-base text-neutral-300">
              {zhTW.guide.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
