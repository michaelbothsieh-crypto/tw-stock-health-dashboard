"use client";

import { Tile } from "@/components/bento/Tile";
import { SnapshotResponse } from "@/components/layout/types";
import { Activity, TrendingUp, TrendingDown, Users, Zap, Landmark, Flame } from "lucide-react";

export function FlowRadarTile({ snapshot }: { snapshot: SnapshotResponse }) {
  const flow = snapshot.signals.flow;
  if (!flow || flow.smartMoneyFlow === undefined) return null;

  const institutionalLots = flow.institutionalLots ?? 0;
  const trustLots = flow.trustLots ?? 0;
  const marginLots = flow.marginLots ?? 0;
  const shortLots = flow.shortLots ?? 0;
  const flowVerdict = flow.flowVerdict ?? "中性震盪";

  const isPositive = flowVerdict === "籌碼集中 (黃金背離)";
  const isNegative = flowVerdict === "散戶接刀 (籌碼凌亂)";

  const verdictStyles = isPositive
    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
    : isNegative
    ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
    : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";

  const formatLots = (val: number) => {
    const sign = val > 0 ? "+" : "";
    return `${sign}${val.toLocaleString()} 張`;
  };

  const getLotsColor = (val: number) => {
    if (val > 0) return "text-red-600 dark:text-red-400";
    if (val < 0) return "text-green-600 dark:text-green-400";
    return "text-muted-foreground";
  };

  return (
    <Tile className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Activity className="h-5 w-5 text-slate-700 dark:text-neutral-300" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100">籌碼對抗雷達</h3>
      </div>

      {/* Body: 2x2 Bento Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Block 1: Institutional */}
        <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/20 p-4 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Landmark className="h-3 w-3" />
            三大法人 (5D)
          </div>
          <div className={`text-lg font-black tabular-nums leading-none ${getLotsColor(institutionalLots)}`}>
            {formatLots(institutionalLots)}
          </div>
        </div>

        {/* Block 2: Trust Fund */}
        <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/20 p-4 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            投信動向 (5D)
          </div>
          <div className={`text-lg font-black tabular-nums leading-none ${getLotsColor(trustLots)}`}>
            {formatLots(trustLots)}
          </div>
        </div>

        {/* Block 3: Margin Purchase */}
        <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/20 p-4 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            融資變化 (5D)
          </div>
          <div className={`text-lg font-black tabular-nums leading-none ${getLotsColor(marginLots)}`}>
            {formatLots(marginLots)}
          </div>
        </div>

        {/* Block 4: Short Sale */}
        <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/20 p-4 transition-all duration-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Flame className="h-3 w-3" />
            融券變化 (5D)
          </div>
          <div className={`text-lg font-black tabular-nums leading-none ${getLotsColor(shortLots)}`}>
            {formatLots(shortLots)}
          </div>
        </div>
      </div>

      {/* Verdict Banner */}
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border font-bold text-sm ${verdictStyles}`}>
        <Zap className="h-4 w-4 shrink-0 fill-current" />
        <span>結論：{flowVerdict}</span>
      </div>
    </Tile>
  );
}
