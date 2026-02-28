"use client";

import { useWatchlist } from "@/hooks/useWatchlist";
import { LayoutDashboard, Star, Search, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HealthCard } from "@/components/watchlist/HealthCard";

export default function WatchlistPage() {
  const { watchlist, removeStock } = useWatchlist();

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

      {watchlist.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/20 py-32 text-center">
          <Star className="h-12 w-12 text-neutral-800 mx-auto mb-4" />
          <p className="text-neutral-400 mb-2 text-xl font-bold">您的戰情室目前為空</p>
          <p className="text-neutral-600 text-sm mb-8 max-w-xs mx-auto">
            請前往個股診斷頁面點擊「⭐ 星星」按鈕加入觀察清單，系統將自動在此產生健康評分卡。
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
