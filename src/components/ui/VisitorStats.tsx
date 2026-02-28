"use client";

import { useVisitorStats } from "@/hooks/useVisitorStats";
import { Users, Activity } from "lucide-react";

export function VisitorStats() {
  const { onlineUsers, totalVisitors } = useVisitorStats();

  if (onlineUsers === 0 && totalVisitors === 0) return null;

  return (
    <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
      {/* Online Users */}
      <div className="flex items-center gap-1.5 transition-all duration-300">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </div>
        <span>目前在線:</span>
        <span className="text-foreground font-bold tabular-nums">
          {onlineUsers}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-3 bg-border" />

      {/* Total Visitors */}
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-slate-400" />
        <span>總訪客:</span>
        <span className="text-foreground font-bold tabular-nums">
          {totalVisitors}
        </span>
      </div>
    </div>
  );
}
