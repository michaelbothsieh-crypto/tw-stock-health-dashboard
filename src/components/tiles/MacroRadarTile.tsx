import { Tile } from "@/components/bento/Tile";
import { SnapshotResponse } from "@/components/layout/types";
import { Globe, Activity, Cpu, DollarSign, ShieldAlert, Clock, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MACRO_INFO = {
  VIX: "股市恐慌指數。衡量美股標普 500 未來 30 天的預期波動。數值越高代表市場越恐慌，超過 30 通常視為極端恐慌。",
  SOXX: "費城半導體指數 ETF。台股高度連動半導體產業，SOXX 走強代表科技股大趨勢健康；破線則需提防台股科技股修正。",
  DXY: "美元指數。衡量美元相對於全球主要貨幣的強弱。美元強勢(指數飆高)常伴隨外資將資金從台股等新興市場撤出；弱勢則有利資金流入。",
  MOVE: "債市恐慌指數 (債券版 VIX)。衡量美國公債市場波動。若 MOVE 異常飆高，通常預示嚴重的系統性流動性危機或央行政策轉向。",
};

export function MacroRadarTile({ snapshot }: { snapshot: SnapshotResponse }) {
  if (!snapshot.crashWarning || !snapshot.crashWarning.macroIndicators) return null;

  const { macroIndicators, lastUpdated } = snapshot.crashWarning;
  const { vix, soxx, liquidity, systemRisk } = macroIndicators;

  const getVariantStyles = (variant: string) => {
    if (variant === "positive") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";
    if (variant === "negative") return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-rose-200 dark:border-rose-500/20";
    return "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400 border-slate-200 dark:border-slate-500/20";
  };

  const getVariantText = (variant: string) => {
    if (variant === "positive") return "text-emerald-600 dark:text-emerald-400";
    if (variant === "negative") return "text-rose-600 dark:text-rose-400";
    return "text-slate-600 dark:text-slate-400";
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tile className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-slate-700 dark:text-neutral-300" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100">總經資金雷達</h3>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getVariantStyles(systemRisk.variant)}`}>
            {systemRisk.status}
          </div>
        </div>

        {/* Body: Bento Grid 2x2 */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 mt-2 md:mt-4">
          {/* VIX */}
          <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/20 p-3 md:p-4 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground dark:text-neutral-500">
                <Activity className="h-3 md:h-3.5 w-3 md:w-3.5" />
                市場情緒 VIX
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="p-1 -m-1 outline-none">
                    <Info className="h-3 md:h-3.5 w-3 md:w-3.5 text-muted-foreground cursor-help hover:text-slate-900 dark:hover:text-neutral-300 transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="z-[100]">
                  {MACRO_INFO.VIX}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-lg md:text-xl font-bold text-slate-900 dark:text-neutral-100 mb-1 tabular-nums">
              {vix.value?.toFixed(1)}
            </div>
            <div className={`text-[10px] md:text-[11px] font-medium ${getVariantText(vix.variant)}`}>
              {vix.status}
            </div>
          </div>

          {/* SOXX */}
          <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/20 p-3 md:p-4 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground dark:text-neutral-500">
                <Cpu className="h-3 md:h-3.5 w-3 md:w-3.5" />
                費半大局 SOXX
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="p-1 -m-1 outline-none">
                    <Info className="h-3 md:h-3.5 w-3 md:w-3.5 text-muted-foreground cursor-help hover:text-slate-900 dark:hover:text-neutral-300 transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="z-[100]">
                  {MACRO_INFO.SOXX}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className={`text-xs md:text-sm font-semibold mb-1 ${getVariantText(soxx.variant)}`}>
              {soxx.trend}
            </div>
            <div className="text-[10px] md:text-[11px] font-medium text-muted-foreground dark:text-neutral-500">
              {soxx.status}模式
            </div>
          </div>

          {/* Liquidity */}
          <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/20 p-3 md:p-4 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground dark:text-neutral-500">
                <DollarSign className="h-3 md:h-3.5 w-3 md:w-3.5" />
                資金流動性
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="p-1 -m-1 outline-none">
                    <Info className="h-3 md:h-3.5 w-3 md:w-3.5 text-muted-foreground cursor-help hover:text-slate-900 dark:hover:text-neutral-300 transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="z-[100]">
                  {MACRO_INFO.DXY}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className={`text-xs md:text-sm font-semibold ${getVariantText(liquidity.variant)}`}>
              {liquidity.status}
            </div>
          </div>

          {/* System Risk */}
          <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/20 p-3 md:p-4 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground dark:text-neutral-500">
                <ShieldAlert className="h-3 md:h-3.5 w-3 md:w-3.5" />
                預警模型
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="p-1 -m-1 outline-none">
                    <Info className="h-3 md:h-3.5 w-3 md:w-3.5 text-muted-foreground cursor-help hover:text-slate-900 dark:hover:text-neutral-300 transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="z-[100]">
                  {MACRO_INFO.MOVE}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className={`text-xs md:text-sm font-semibold ${getVariantText(systemRisk.variant)}`}>
              {snapshot.crashWarning.level}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-neutral-800/50 flex flex-col gap-1.5">
          <div className="text-[10px] text-muted-foreground dark:text-neutral-600 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            更新時間 {new Date(lastUpdated).toLocaleString("zh-TW", { hour12: false })}
          </div>
          <div className="text-[10px] text-muted-foreground dark:text-neutral-600 truncate">
            監控標的 ^VIX, ^MOVE, SOXX, QQQ, DXY, USDJPY
          </div>
        </div>
      </Tile>
    </TooltipProvider>
  );
}
