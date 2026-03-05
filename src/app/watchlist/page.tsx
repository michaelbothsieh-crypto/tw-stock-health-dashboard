"use client";

import { useWatchlist } from "@/hooks/useWatchlist";
import { LayoutDashboard, Star, Search, Plus, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HealthCard } from "@/components/watchlist/HealthCard";
import { useState, useMemo, useEffect } from "react";
import { twStockNames } from "@/data/twStockNames";
import { ArrowUpDown, SortAsc, SortDesc } from "lucide-react";

type SortOrder = "original" | "score-desc" | "score-asc";

export default function WatchlistPage() {
  const { watchlist, removeStock, addStock } = useWatchlist();
  const [keyword, setKeyword] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("original");
  const [stockDataMap, setStockDataMap] = useState<Record<string, number>>({});

  // 接收子元件傳回的分數，供排序使用
  const handleScoreLoaded = (ticker: string, score: number) => {
    setStockDataMap(prev => ({ ...prev, [ticker]: score }));
  };

  const sortedWatchlist = useMemo(() => {
    const list = [...watchlist];
    if (sortOrder === "score-desc") {
      return list.sort((a, b) => (stockDataMap[b] ?? -1) - (stockDataMap[a] ?? -1));
    }
    if (sortOrder === "score-asc") {
      return list.sort((a, b) => (stockDataMap[a] ?? 101) - (stockDataMap[b] ?? 101));
    }
    return list;
  }, [watchlist, sortOrder, stockDataMap]);

  const fullWatchlist = useMemo(() => {
    return Object.entries(twStockNames).map(([code, name]) => ({ code, name }));
  }, []);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return [];

    return fullWatchlist.filter((item) => {
      if (watchlist.includes(item.code)) return false;
      return item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    }).slice(0, 5);
  }, [keyword, fullWatchlist, watchlist]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-6 lg:px-8 lg:pt-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-500/10 p-2.5 text-rose-500 font-black">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-neutral-100 sm:text-3xl">
            自選監控雷達
          </h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-xl border-neutral-800 bg-neutral-900 text-neutral-300">
            <Link href="/screener">
              <Search className="mr-2 h-4 w-4" />
              前往突破選股
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜尋代號或股名..."
            className="h-11 border-neutral-800 bg-neutral-900/50 pl-11 text-sm text-neutral-100 focus-visible:ring-rose-500/30 rounded-xl"
          />
          {keyword && (
            <Button type="button" variant="ghost" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full p-0 text-neutral-400" onClick={() => setKeyword("")}>
              <X className="h-4 w-4" />
            </Button>
          )}

          {keyword && filtered.length > 0 && (
            <div className="absolute top-12 left-0 right-0 z-50 rounded-xl border border-neutral-800 bg-neutral-900 p-2 shadow-2xl space-y-1">
              {filtered.map((item) => (
                <button key={item.code} onClick={() => { addStock(item.code); setKeyword(""); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-rose-400 font-bold">{item.code}</span>
                    <span className="text-neutral-200 text-sm">{item.name}</span>
                  </div>
                  <Plus className="h-4 w-4 text-neutral-500" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 bg-neutral-900/50 p-1 rounded-xl border border-neutral-800">
          <Button 
            variant={sortOrder === "original" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setSortOrder("original")}
            className="rounded-lg h-8 text-[11px] font-bold"
          >
            原始
          </Button>
          <Button 
            variant={sortOrder === "score-desc" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setSortOrder("score-desc")}
            className="rounded-lg h-8 text-[11px] font-bold flex gap-1"
          >
            <SortDesc className="h-3 w-3" /> 分數高至低
          </Button>
          <Button 
            variant={sortOrder === "score-asc" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setSortOrder("score-asc")}
            className="rounded-lg h-8 text-[11px] font-bold flex gap-1"
          >
            <SortAsc className="h-3 w-3" /> 分數低至高
          </Button>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/20 py-32 text-center">
          <Star className="h-12 w-12 text-neutral-800 mx-auto mb-4" />
          <p className="text-neutral-400 mb-2 text-xl font-bold">目前無觀察標的</p>
          <Button asChild className="bg-rose-600 hover:bg-rose-700 rounded-xl px-8 h-12 mt-4">
            <Link href="/">立即新增</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-6 gap-4">
          {sortedWatchlist.map((ticker) => (
            <HealthCard
              key={ticker}
              ticker={ticker}
              onRemove={(t) => removeStock(t)}
              onDataLoaded={(score) => handleScoreLoaded(ticker, score)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
