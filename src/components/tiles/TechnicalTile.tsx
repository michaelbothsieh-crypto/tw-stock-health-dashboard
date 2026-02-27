import { Tile } from "@/components/bento/Tile";
import { TranslatedTechnicals } from "@/lib/ux/technicalTranslator";
import { Activity, TrendingUp, TrendingDown, Target, Shield, Zap } from "lucide-react";

export function TechnicalTile({ tactics }: { tactics?: TranslatedTechnicals | null }) {
  if (!tactics) return null;

  const { rating, signals, levels, action } = tactics;

  const getVariantStyles = (variant: string) => {
    if (variant === "positive") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
    if (variant === "negative") return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400";
    return "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400";
  };

  const getVariantText = (variant: string) => {
    if (variant === "positive") return "text-emerald-600 dark:text-emerald-400";
    if (variant === "negative") return "text-rose-600 dark:text-rose-400";
    return "text-slate-600 dark:text-slate-400";
  };

  return (
    <Tile className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      {/* Header */}
      <div className="p-5 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-neutral-800/50">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-slate-700 dark:text-neutral-300" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100">技術戰術</h3>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${getVariantStyles(rating.variant)}`}>
          {rating.text}
        </div>
      </div>

      {/* Body: Signals Grid */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-neutral-800/50">
        {signals.map((sig, idx) => (
          <div key={idx} className="p-4 flex flex-col items-center justify-center text-center group transition-all duration-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40">
            <div className="text-xs text-muted-foreground dark:text-neutral-500 mb-1">{sig.name}</div>
            <div className="text-lg font-bold text-slate-900 dark:text-neutral-100 mb-1 tracking-tight tabular-nums">
              {sig.value}
            </div>
            <div className={`text-xs font-medium ${getVariantText(sig.variant)}`}>
              {sig.status}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: Levels */}
      <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-neutral-800/50 border-t border-slate-100 dark:border-neutral-800/50 bg-slate-50/50 dark:bg-neutral-950/20">
        <div className="p-4 flex items-center gap-3 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40">
          <Shield className="h-4 w-4 text-emerald-500 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground dark:text-neutral-500 truncate">{levels.supportLabel}</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-neutral-200 tabular-nums">{levels.support.toFixed(2)}</span>
          </div>
        </div>
        <div className="p-4 flex items-center gap-3 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40">
          <Target className="h-4 w-4 text-rose-500 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground dark:text-neutral-500 truncate">{levels.resistanceLabel}</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-neutral-200 tabular-nums">{levels.resistance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Action Banner */}
      <div className="px-5 py-3.5 bg-slate-50 dark:bg-neutral-800/40 border-t border-slate-100 dark:border-neutral-800/50 flex items-start gap-2">
        <Zap className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-sm font-medium text-slate-700 dark:text-neutral-300 leading-snug">
          {action}
        </div>
      </div>
    </Tile>
  );
}
