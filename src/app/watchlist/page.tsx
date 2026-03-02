"use client";

import { useWatchlist } from "@/hooks/useWatchlist";
import { LayoutDashboard, Star, Search, Plus, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HealthCard } from "@/components/watchlist/HealthCard";
import { useState, useMemo, useEffect } from "react";
import { defaultWatchlist, stockNameMap } from "@/i18n/zh-TW";
import { resolveStockName } from "@/lib/stocks/nameResolver";

export default function WatchlistPage() {
  const { watchlist, removeStock, addStock } = useWatchlist();
  const [keyword, setKeyword] = useState("");
  const [fullWatchlist, setFullWatchlist] = useState<Array<{ code: string; name: string }>>([]);

  useEffect(() => {
    Promise.all(defaultWatchlist.map(async code => ({ code, name: await resolveStockName(code) })))
      .then(setFullWatchlist);
  }, []);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return [];

    return fullWatchlist.filter((item) => {
      // Don't show already added stocks
      if (watchlist.includes(item.code)) return false;
      return item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    }).slice(0, 5); // Max 5 suggestions
  }, [keyword, fullWatchlist, watchlist]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-6 lg:px-8 lg:pt-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-500">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-neutral-100 sm:text-3xl">
            AI 健康戰情室
          </h1>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="rounded-xl border-neutral-800 bg-neutral-900 text-neutral-300">
            <Link href="/">
              <Search className="mr-2 h-4 w-4" />
              前往個股診斷
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-8 relative max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="輸入代號或股名來新增自選股"
            className="h-12 border-neutral-800 bg-neutral-900/50 pl-11 text-[15px] text-neutral-100 focus-visible:ring-emerald-500/30 rounded-xl"
          />
          {keyword && (
            <Button type="button" variant="ghost" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full p-0 text-neutral-400 hover:text-neutral-100" onClick={() => setKeyword("")}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {keyword && filtered.length > 0 && (
          <div className="absolute top-14 left-0 right-0 z-50 rounded-xl border border-neutral-800 bg-neutral-900 p-2 shadow-2xl space-y-1">
            {filtered.map((item) => (
              <button
                key={item.code}
                onClick={() => {
                  addStock(item.code);
                  setKeyword("");
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-emerald-400">{item.code}</span>
                  <span className="text-neutral-200">{item.name}</span>
                </div>
                <Plus className="h-4 w-4 text-neutral-500" />
              </button>
            ))}
          </div>
        )}
        {keyword && filtered.length === 0 && (
          <div className="absolute top-14 left-0 right-0 z-50 rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl text-center text-sm text-neutral-500">
            找不到股票或已在清單中
          </div>
        )}
      </div>

      {watchlist.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/20 py-32 text-center">
          <Star className="h-12 w-12 text-neutral-800 mx-auto mb-4" />
          <p className="text-neutral-400 mb-2 text-xl font-bold">您的戰情室目前為空</p>
          <p className="text-neutral-600 text-sm mb-8 max-w-xs mx-auto">
            請在上方的搜尋框輸入股票代號或名稱，或前往個股診斷頁面點擊「⭐ 星星」按鈕加入觀察清單。
          </p>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 rounded-xl px-8 h-12">
            <Link href="/">立即開始診斷</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-6 gap-4">
          {watchlist.map((ticker) => (
            <HealthCard
              key={ticker}
              ticker={ticker}
              onRemove={(t) => removeStock(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
