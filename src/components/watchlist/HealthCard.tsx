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

  // 資料清洗邏輯 (確保股名防呆)
  const rawName = data?.stockName || '';
  const cleanName = rawName.replace(ticker, '').trim() || rawName || ticker;
  
  // 讀取與主控台 100% 同步的分數 (Data.score 已經在 API 中對齊 strategy.confidence)
  const realScore = data?.score !== undefined && data?.score !== null ? Math.round(data.score) : null;
  
  // 讀取專屬短評 (若 API 未回傳或抓取失敗，給予預設提示)
  const aiSummary = data?.shortSummary || 'AI 深度分析中...';

  // 套用與主頁面完全相同的顏色邏輯
  const config = getSharedScoreStyle(realScore);

  return (
    <div 
      onClick={() => router.push(`/stock/${ticker}`)}
      className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border p-6 min-h-[220px] cursor-pointer transition-all duration-500 ${config.container}`}
    >
      {/* Side color bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${config.dot}`} />

      {/* 左上角：名稱與膠囊代號 */}
      <div className="absolute top-4 left-5 flex items-center min-w-0 max-w-[85%]">
        <span className="text-base font-black text-slate-100 truncate">
          {cleanName}
        </span>
        <span className="ml-2 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider tabular-nums shrink-0">
          {ticker}
        </span>
      </div>
      
      {/* 右上角：移除按鈕 */}
      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(ticker); }}
        className="absolute top-3 right-3 p-2 rounded-lg text-neutral-600 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 md:opacity-100 z-10"
      >
        <X className="h-4 w-4" />
      </button>

      {/* 正中央：真實共用分數 */}
      <div className="flex flex-col items-center justify-center mt-6">
        <span className={`text-6xl font-black tabular-nums tracking-tighter transition-transform duration-500 group-hover:scale-110 ${config.text}`}>
          {realScore !== null ? realScore : '-'}
        </span>
        <div className={`mt-2 text-[11px] font-bold opacity-80 flex items-center gap-1 ${config.text}`}>
          {config.weather}
        </div>
      </div>

      {/* 底部：LLM 真實短評 */}
      <div className="mt-4 px-2 text-center w-full">
        <p className="text-[11px] font-medium text-slate-300 dark:text-neutral-300 line-clamp-2 leading-relaxed">
          {aiSummary}
        </p>
      </div>
    </div>
  );
}
