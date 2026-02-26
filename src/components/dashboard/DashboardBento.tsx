"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultWatchlist, stockNameMap } from "@/i18n/zh-TW";
import { twStockNames } from "@/data/twStockNames";
import { resolveStockName } from "@/lib/stocks/nameResolver";
import { watchlistStore, WatchlistItem } from "@/lib/stores/watchlistStore";
import { useStockSnapshot } from "@/hooks/useStockSnapshot";
import { DesktopStockLayout } from "@/components/layout/DesktopStockLayout";
import { MobileStockLayout } from "@/components/layout/MobileStockLayout";
import { MainTab, ExplainTab, SnapshotResponse } from "@/components/layout/types";



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
  watchlist: Array<{code: string; name: string}>;
  currentTicker: string;
  onClose: () => void;
  onSelect: (ticker: string) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setKeyword("");
      setSelectedIndex(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return watchlist;
    
    return watchlist.filter((item) => {
      return item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    }).sort((a, b) => {
      const aCodeMatch = a.code.toLowerCase() === query;
      const bCodeMatch = b.code.toLowerCase() === query;
      if (aCodeMatch && !bCodeMatch) return -1;
      if (!aCodeMatch && bCodeMatch) return 1;
      
      const aCodeStarts = a.code.toLowerCase().startsWith(query);
      const bCodeStarts = b.code.toLowerCase().startsWith(query);
      if (aCodeStarts && !bCodeStarts) return -1;
      if (!aCodeStarts && bCodeStarts) return 1;
      
      return 0;
    });
  }, [keyword, watchlist]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      onSelect(filtered[selectedIndex].code);
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="text-emerald-400 font-medium">{part}</span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  if (!open) return null;

  const panelClass = isDesktop
    ? "w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
    : "fixed inset-x-0 bottom-0 max-h-[86vh] rounded-t-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className={`mx-auto ${isDesktop ? "flex min-h-full items-center justify-center" : ""}`}>
        <div className={panelClass}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-[22px] font-semibold text-neutral-100">切換股票</h3>
            <Button type="button" variant="ghost" className="h-11 w-11 rounded-full p-0 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-all duration-150" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
            <Input
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="輸入代號或股名"
              className="h-12 border-neutral-700 bg-neutral-950 pl-11 text-[15px] text-neutral-100 focus-visible:ring-emerald-500/30 rounded-xl"
            />
          </div>

          <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-center text-[15px] text-neutral-500">找不到符合條件的股票</div>
            ) : (
              filtered.map((item, idx) => {
                const itemTicker = item.code;
                const name = item.name;
                const isSelected = itemTicker === currentTicker;
                const isHovered = idx === selectedIndex;
                
                return (
                  <button
                    key={itemTicker}
                    type="button"
                    onClick={() => onSelect(itemTicker)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150 ${
                      isSelected
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : isHovered
                        ? "border-neutral-700 bg-neutral-800/80 brightness-105"
                        : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700 hover:brightness-105"
                    }`}
                  >
                    <div className={`w-[72px] shrink-0 font-mono text-[16px] tabular-nums ${isSelected ? "text-emerald-300" : "text-neutral-300"}`}>
                      {highlightMatch(itemTicker, keyword.trim())}
                    </div>
                    <div className={`flex-1 min-w-0 truncate text-[16px] font-sans ${name ? (isSelected ? "text-emerald-200" : "text-neutral-200") : "text-neutral-600"}`}>
                      {highlightMatch(name, keyword.trim())}
                    </div>
                    {isSelected && (
                      <div className="shrink-0 text-[13px] font-medium text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        目前
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-6">
            <Button asChild variant="secondary" className="h-11 w-full rounded-xl text-[16px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-all duration-150">
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
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [ticker, setTicker] = useState(initialTicker);
  const [showStockPicker, setShowStockPicker] = useState(false);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowStockPicker(v => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [showDetail, setShowDetail] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("evidence");
  const [activeExplainTab, setActiveExplainTab] = useState<ExplainTab>("trend");

  useEffect(() => setTicker(initialTicker), [initialTicker]);

  useEffect(() => {
    const unsubscribe = watchlistStore.subscribe((items) => {
      setWatchlist(items);
    });
    return unsubscribe;
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
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
  };

  const [currentName, setCurrentName] = useState("");
  useEffect(() => {
    resolveStockName(ticker).then(setCurrentName);
  }, [ticker]);

  const radarData = snapshot
    ? [
      { label: "技術", value: snapshot.signals.trend.trendScore ?? 50 },
      { label: "籌碼", value: snapshot.signals.flow.flowScore ?? 50 },
      { label: "基本", value: snapshot.signals.fundamental.fundamentalScore ?? 50 },
      { label: "波動", value: snapshot.shortTermVolatility.volatilityScore },
      { label: "機率", value: snapshot.predictions.upProb5D || snapshot.predictions.upProb3D },
      { label: "同向", value: snapshot.consistency.score },
    ]
    : [];

  const layoutProps = {
    snapshot: snapshot as SnapshotResponse,
    currentStockLabel: `${ticker} ${currentName || ""}`.trim(),
    showDetail,
    setShowDetail,
    activeMainTab,
    setActiveMainTab,
    activeExplainTab,
    setActiveExplainTab,
    setShowStockPicker,
    radarData
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-neutral-950 text-neutral-100 selection:bg-emerald-500/30">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur lg:hidden flex justify-between items-center">
        <div className="text-[15px] text-neutral-400">Dashboard</div>
        <Button asChild variant="outline" className="h-11 w-11 rounded-full border-neutral-700 bg-neutral-900 p-0 text-neutral-100 transition-all duration-150 hover:brightness-105">
          <Link href="/watchlist" aria-label="設定">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-6 lg:px-8 lg:pt-12">
        {query.isLoading && <div className="py-24 text-center text-[15px] text-neutral-400">載入中...</div>}
        {query.isError && <div className="py-24 text-center text-[15px] text-rose-400">{requestError}</div>}

        {snapshot && !query.isLoading && !query.isError && (
          isDesktop ? <DesktopStockLayout {...layoutProps} /> : <MobileStockLayout {...layoutProps} />
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