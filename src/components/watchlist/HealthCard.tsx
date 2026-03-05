"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, AlertCircle } from "lucide-react";
import { SnapshotResponse } from "@/components/layout/types";
import { getSharedScoreStyle } from "@/lib/ux/scoreStyles";

interface HealthCardProps {
  ticker: string;
  onRemove: (ticker: string) => void;
}

/**
 * Watchlist Health Card - 深層對齊主頁面狀態與 AI 短評
 */
export function HealthCard({ ticker, onRemove }: HealthCardProps) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/stock/${ticker}/snapshot`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(`[HealthCard] Error fetching ${ticker}`, e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-neutral-800 p-6 flex flex-col items-center justify-center min-h-[220px] animate-pulse">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-600 mb-2" />
        <span className="text-xs text-neutral-600 font-bold uppercase tracking-widest">{ticker}</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card rounded-2xl border border-rose-500/20 p-6 flex flex-col items-center justify-center min-h-[220px] relative group overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" />
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(ticker); }}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-neutral-600 hover:text-rose-500 hover:bg-rose-500/10 transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>
        <AlertCircle className="h-6 w-6 text-rose-500 mb-2" />
        <span className="text-xs text-rose-500 font-bold uppercase tracking-widest">載入失敗</span>
        <span className="text-[10px] text-neutral-600 mt-1">{ticker}</span>
      </div>
    );
  }

  // 讀取即時報價 (來自 snapshot API 內部)
  const price = data?.price !== undefined ? data.price : data?.data?.prices?.[data.data.prices.length - 1]?.close;
  const changePct = data?.changePct !== undefined ? data.changePct : 0;
  const isUp = changePct > 0;
  const isDown = changePct < 0;

  // 資料清洗邏輯
  const rawName = data?.normalizedTicker?.companyNameZh || data?.stockName || '';
  const cleanName = rawName.replace(ticker, '').trim() || rawName || ticker;
  
  // 讀取與主控台 100% 同步的分數
  const realScore = data?.score !== undefined && data?.score !== null ? Math.round(data.score) : null;
  
  // 讀取專屬短評
  const aiSummary = data?.shortSummary || data?.strategy?.verdict || 'AI 深度分析中...';

  // 套用與主頁面完全相同的顏色邏輯
  const config = getSharedScoreStyle(realScore);

  return (
    <div 
      onClick={() => router.push(`/stock/${ticker}`)}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border p-5 min-h-[220px] cursor-pointer transition-all duration-500 hover:z-10 hover:scale-[1.02] ${config.container}`}
    >
      {/* Side color bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 opacity-80 ${config.dot}`} />

      {/* Header: Name and Ticker */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col min-w-0">
          <span className="text-base font-black text-slate-100 truncate leading-tight">
            {cleanName}
          </span>
          <span className="text-[10px] font-bold text-neutral-500 tabular-nums">
            {ticker}
          </span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(ticker); }}
          className="p-1.5 rounded-lg text-neutral-600 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Content: Price and Change */}
      <div className="flex flex-col mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-neutral-100 tabular-nums">
            {price?.toFixed(2) || '—'}
          </span>
          <span className={`text-xs font-bold tabular-nums ${isUp ? 'text-rose-500' : isDown ? 'text-emerald-500' : 'text-neutral-500'}`}>
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Health Score Badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`flex items-center justify-center h-8 w-8 rounded-full border-2 text-[13px] font-black ${config.text} ${config.dot.replace('bg-', 'border-').replace('500', '500/30')}`}>
          {realScore ?? '-'}
        </div>
        <div className={`text-[11px] font-bold uppercase tracking-wider ${config.text}`}>
          {config.weather}
        </div>
      </div>

      {/* Bottom: AI Summary */}
      <div className="mt-auto pt-4 border-t border-white/5">
        <p className="text-[11px] font-medium text-slate-400 line-clamp-2 leading-relaxed group-hover:text-slate-200 transition-colors italic">
          "{aiSummary}"
        </p>
      </div>
    </div>
  );
}
