"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, AlertCircle } from "lucide-react";
import { getSharedScoreStyle } from "@/lib/ux/scoreStyles";

interface HealthCardProps {
  ticker: string;
  onRemove: (ticker: string) => void;
  onDataLoaded?: (score: number) => void;
}

/**
 * Watchlist Health Card - 強化版 (放大字體、4行短評、價格變色)
 */
export function HealthCard({ ticker, onRemove, onDataLoaded }: HealthCardProps) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/stock/${ticker}/snapshot?mode=lite`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setData(json);
        
        const score = json?.score !== undefined ? Math.round(json.score) : 0;
        if (onDataLoaded) onDataLoaded(score);
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
      <div className="bg-card rounded-2xl border border-neutral-800 p-6 flex flex-col items-center justify-center min-h-[240px] animate-pulse">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-600 mb-2" />
        <span className="text-xs text-neutral-600 font-bold uppercase tracking-widest">{ticker}</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card rounded-2xl border border-rose-500/20 p-6 flex flex-col items-center justify-center min-h-[240px] relative group overflow-hidden">
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

  const rt = data?.realTimeQuote;
  const prices = data?.data?.prices || [];
  const latestPrice = rt?.price !== undefined ? rt.price : (prices.length > 0 ? prices[prices.length - 1].close : null);
  
  let changePct = 0;
  if (rt?.changePct !== undefined && rt?.changePct !== null) {
    changePct = rt.changePct;
  } else if (prices.length >= 2) {
    const last = prices[prices.length - 1].close;
    const prev = prices[prices.length - 2].close;
    changePct = prev !== 0 ? ((last - prev) / prev) * 100 : 0;
  }

  const isUp = changePct > 0.001;
  const isDown = changePct < -0.001;

  const rawName = data?.normalizedTicker?.companyNameZh || data?.stockName || '';
  const cleanName = rawName.replace(ticker, '').trim() || rawName || ticker;
  const realScore = data?.score !== undefined && data?.score !== null ? Math.round(data.score) : null;
  
  // 底部文字：保持內斂但移除截斷邏輯，給予完整展現空間
  const aiSummary = data?.shortSummary || '趨勢分析中';

  const config = getSharedScoreStyle(realScore);

  return (
    <div 
      onClick={() => router.push(`/stock/${ticker}`)}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border p-5 min-h-[240px] cursor-pointer transition-all duration-500 hover:z-10 hover:scale-[1.02] ${config.container}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 opacity-80 ${config.dot}`} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col min-w-0">
          <span className="text-[16px] font-black text-slate-100 truncate leading-tight">
            {cleanName}
          </span>
          <span className="text-[11px] font-bold text-neutral-500 tabular-nums">
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

      {/* Price Section - 新增價格變色 */}
      <div className="flex flex-col mb-4">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-black tabular-nums tracking-tighter ${isUp ? 'text-rose-500' : isDown ? 'text-emerald-500' : 'text-neutral-100'}`}>
            {latestPrice !== null ? latestPrice.toFixed(2) : '—'}
          </span>
          <span className={`text-[14px] font-black tabular-nums ${isUp ? 'text-rose-500' : isDown ? 'text-emerald-500' : 'text-neutral-500'}`}>
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Health Score Badge - 放大分數與標籤 */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`flex items-center justify-center h-9 w-9 rounded-full border-2 text-[14px] font-black ${config.text} ${config.dot.replace('bg-', 'border-').replace('500', '500/30')}`}>
          {realScore ?? '-'}
        </div>
        <div className={`text-[12px] font-black uppercase tracking-wider ${config.text}`}>
          {config.weather}
        </div>
      </div>

      {/* Bottom: AI Summary - 增加為 4 行與字體放大 */}
      <div className="mt-auto pt-3 border-t border-white/5">
        <p className="text-[13px] font-semibold text-slate-300 line-clamp-4 leading-snug group-hover:text-slate-100 transition-colors">
          {aiSummary}
        </p>
      </div>
    </div>
  );
}
