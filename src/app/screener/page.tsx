"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, TriangleAlert, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

type ScreenerRow = {
  symbol: string;
  code: string;
  name: string;
  exchange: string;
  close: number;
  fastEma: number;
  slowEma: number;
  trendEma: number;
  rsi: number;
  tradedValue: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  entrySignal: boolean;
  exitSignal: boolean;
  exitReasons: string[];
  crossAgeDays: number | null;
};

type BreakoutScreenerResponse = {
  generatedAt: string;
  strategy: {
    name: string;
    entry: string;
    exit: string;
  };
  entries: ScreenerRow[];
  exits: ScreenerRow[];
  counts: {
    entry: number;
    exit: number;
  };
  params: {
    minTurnover: number;
    minRsi: number;
    maxCrossAgeDays: number;
    minRelativeVolumeMultiplier: number;
    fastEma: number;
    slowEma: number;
    trendEma: number;
  };
};

const num = (value: number) => value.toFixed(2);

function formatHumanAmount(value: number): string {
  if (value >= 100_000_000) {
    const yi = value / 100_000_000;
    return `${yi >= 100 ? yi.toFixed(0) : yi.toFixed(1)} 億`;
  }
  if (value >= 10_000) {
    const wan = value / 10_000;
    return `${wan >= 100 ? wan.toFixed(0) : wan.toFixed(1)} 萬`;
  }
  return Math.round(value).toLocaleString();
}

export default function ScreenerPage() {
  const [turnoverYi, setTurnoverYi] = useState("5");
  const [minRsi, setMinRsi] = useState("60");
  const [crossDays, setCrossDays] = useState("3");
  const [relativeVolumeMultiplier, setRelativeVolumeMultiplier] = useState("2");
  const [fastEma, setFastEma] = useState("8");
  const [slowEma, setSlowEma] = useState("21");
  const [trendEma, setTrendEma] = useState("200");

  const { data, isLoading, isError, refetch, isFetching } = useQuery<BreakoutScreenerResponse>({
    queryKey: [
      "breakoutScreener",
      turnoverYi,
      minRsi,
      crossDays,
      relativeVolumeMultiplier,
      fastEma,
      slowEma,
      trendEma,
    ],
    queryFn: async () => {
      const query = new URLSearchParams({
        limit: "80",
        turnoverYi,
        rsi: minRsi,
        crossDays,
        relativeVolumeMultiplier,
        fastEma,
        slowEma,
        trendEma,
      });
      const response = await fetch(`/api/screener/breakout?${query.toString()}`);
      if (!response.ok) {
        throw new Error("取得突破選股資料失敗");
      }
      return response.json();
    },
  });

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-12 pt-6 lg:px-8 lg:pt-10">
      {/* Header Area */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-500/80">Real-time Breakout Radar</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-neutral-100 sm:text-4xl">
            突破選股戰情室
          </h1>
          <p className="mt-2 text-sm text-neutral-500 max-w-xl">
            掃描全台股「多頭排列」且「爆量突破」的潛力標的。系統只抓取近期剛發生黃金交叉、且具備相對成交量倍數支撐的股票。
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="w-fit rounded-xl border-neutral-800 bg-neutral-900/50 backdrop-blur-sm text-neutral-200 hover:bg-neutral-800 transition-all px-6"
          disabled={isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          立即更新雷達
        </Button>
      </div>

      {/* Stats Summary Area */}
      {!isLoading && !isError && data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 flex flex-col">
            <span className="text-xs font-bold text-rose-400/70 mb-1 uppercase tracking-wider">今日突破訊號</span>
            <span className="text-3xl font-black text-rose-500 tabular-nums">{data.counts.entry} <span className="text-sm font-medium">檔</span></span>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex flex-col">
            <span className="text-xs font-bold text-emerald-400/70 mb-1 uppercase tracking-wider">觸發賣出警訊</span>
            <span className="text-3xl font-black text-emerald-500 tabular-nums">{data.counts.exit} <span className="text-sm font-medium">檔</span></span>
          </div>
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-neutral-500" />
              <span className="text-xs font-medium text-neutral-400">雷達最後掃描時間：{new Date(data.generatedAt).toLocaleTimeString("zh-TW")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Parameters Sidebar/Top Bar */}
      <Card className="mb-8 border-neutral-800 bg-neutral-900/20 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-bold text-neutral-300 flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> 濾網參數調整
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">最低金額(億)</label>
              <Input type="number" value={turnoverYi} onChange={(e) => setTurnoverYi(e.target.value)} className="h-9 border-neutral-800 bg-neutral-950 text-neutral-200 rounded-lg text-xs" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">RSI 下限</label>
              <Input type="number" value={minRsi} onChange={(e) => setMinRsi(e.target.value)} className="h-9 border-neutral-800 bg-neutral-950 text-neutral-200 rounded-lg text-xs" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">交叉天數</label>
              <Input type="number" value={crossDays} onChange={(e) => setCrossDays(e.target.value)} className="h-9 border-neutral-800 bg-neutral-950 text-neutral-200 rounded-lg text-xs" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">相對爆量倍率</label>
              <Input type="number" value={relativeVolumeMultiplier} onChange={(e) => setRelativeVolumeMultiplier(e.target.value)} className="h-9 border-neutral-800 bg-neutral-950 text-neutral-200 rounded-lg text-xs" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">快 EMA</label>
              <Input type="number" value={fastEma} onChange={(e) => setFastEma(e.target.value)} className="h-9 border-neutral-800 bg-neutral-950 text-neutral-200 rounded-lg text-xs" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">慢 EMA</label>
              <Input type="number" value={slowEma} onChange={(e) => setSlowEma(e.target.value)} className="h-9 border-neutral-800 bg-neutral-950 text-neutral-200 rounded-lg text-xs" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">趨勢 EMA</label>
              <Input type="number" value={trendEma} onChange={(e) => setTrendEma(e.target.value)} className="h-9 border-neutral-800 bg-neutral-950 text-neutral-200 rounded-lg text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <RefreshCw className="h-10 w-10 animate-spin text-rose-500/20" />
          <span className="text-sm font-bold text-neutral-600 uppercase tracking-[0.3em]">Scanning Markets...</span>
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Main List Column */}
          <div className="lg:col-span-8 space-y-8">
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-1.5 bg-rose-500 rounded-full" />
                <h2 className="text-xl font-black text-neutral-100 italic">BUY LIST / 突破買進清單</h2>
              </div>
              
              <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/30">
                <Table>
                  <TableHeader className="bg-neutral-900/50">
                    <TableRow className="border-neutral-800 hover:bg-transparent">
                      <TableHead className="text-[11px] font-black uppercase text-neutral-500">股票標的</TableHead>
                      <TableHead className="text-[11px] font-black uppercase text-neutral-500">收盤現價</TableHead>
                      <TableHead className="text-[11px] font-black uppercase text-neutral-500 text-center">RSI</TableHead>
                      <TableHead className="text-[11px] font-black uppercase text-neutral-500 text-center">量比</TableHead>
                      <TableHead className="text-[11px] font-black uppercase text-neutral-500 text-right pr-6">成交量</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.entries.length > 0 ? data.entries.map((item) => (
                      <TableRow 
                        key={item.symbol} 
                        className="border-neutral-800/50 hover:bg-rose-500/5 cursor-pointer group transition-colors"
                        onClick={() => window.open(`/stock/${item.code}`, "_blank")}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-black text-neutral-200 group-hover:text-rose-400 transition-colors">{item.name}</span>
                            <span className="text-[10px] font-bold text-neutral-500 tabular-nums">{item.code}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-lg font-black text-rose-500 tabular-nums tracking-tighter">{num(item.close)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="border-neutral-800 text-neutral-400 font-mono text-[10px]">{num(item.rsi)}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-black text-neutral-300 tabular-nums">
                          {item.volumeRatio.toFixed(2)}x
                        </TableCell>
                        <TableCell className="text-right pr-6 text-[11px] font-bold text-neutral-500 tabular-nums">
                          {formatHumanAmount(item.tradedValue)}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-20 text-center text-neutral-600 font-bold uppercase tracking-widest text-xs">
                          今日無突破訊號標的
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-1.5 bg-emerald-500 rounded-full" />
                <h2 className="text-xl font-black text-neutral-100 italic">EXIT WATCH / 賣出觀察清單</h2>
              </div>
              <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/10">
                <Table>
                  <TableHeader className="bg-neutral-900/30">
                    <TableRow className="border-neutral-800 hover:bg-transparent">
                      <TableHead className="text-[11px] font-black uppercase text-neutral-500">股票標的</TableHead>
                      <TableHead className="text-[11px] font-black uppercase text-neutral-500 text-right pr-6">賣出觸發原因</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.exits.map((item) => (
                      <TableRow key={item.symbol} className="border-neutral-800/30 hover:bg-emerald-500/5 cursor-pointer" onClick={() => window.open(`/stock/${item.code}`, "_blank")}>
                        <TableCell>
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-neutral-400">{item.name}</span>
                            <span className="text-[10px] font-mono text-neutral-600">{item.code}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-1">
                            {item.exitReasons.map((reason) => (
                              <Badge key={reason} className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black uppercase tracking-tighter">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          {/* Strategy Detail Column */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-rose-500/20 bg-rose-500/5 overflow-hidden relative">
              <CardHeader className="pb-2">
                <CardTitle className="text-rose-400 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  進場邏輯架構
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] text-rose-400/60 font-black uppercase block">核心策略</span>
                  <p className="text-xs text-neutral-300 font-medium leading-relaxed">
                    {data.strategy.entry.split('，').join('\n')}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-3 pt-3 border-t border-rose-500/10">
                  <div className="bg-rose-500/10 rounded-lg p-2.5">
                    <span className="text-[9px] text-rose-400 font-black uppercase block mb-1">技術過濾</span>
                    <span className="text-[11px] text-neutral-400">短天期均線與長天期均線發生多頭排列，確認多方動能啟動。</span>
                  </div>
                  <div className="bg-rose-500/10 rounded-lg p-2.5">
                    <span className="text-[9px] text-rose-400 font-black uppercase block mb-1">量能過濾</span>
                    <span className="text-[11px] text-neutral-400">單日成交量需大於 5 日平均量 2 倍以上，確保突破具備實質買盤。</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-emerald-400 text-xs font-black uppercase tracking-widest">
                  退場管理規則
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {data.strategy.exit}
                </p>
                <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-500/60">
                  <div className="h-1 w-1 rounded-full bg-emerald-500/60" />
                  風險控管優於獲利
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
