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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-100 sm:text-3xl">
            突破選股
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            只抓近期剛發生黃金交叉，且有明顯相對爆量的股票。
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="w-fit rounded-xl border-neutral-800 bg-neutral-900 text-neutral-200"
          disabled={isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      <Card className="mb-6 border-neutral-800 bg-neutral-950/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-neutral-100">篩選參數</CardTitle>
          <CardDescription className="text-neutral-400">
            支援調整 EMA、RSI、成交金額與相對爆量倍率。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <label className="flex min-w-[180px] flex-col gap-2 text-sm text-neutral-300">
            最低成交金額（億）
            <Input
              type="number"
              min="1"
              step="1"
              value={turnoverYi}
              onChange={(e) => setTurnoverYi(e.target.value)}
              className="border-neutral-800 bg-neutral-900"
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-2 text-sm text-neutral-300">
            RSI 下限
            <Input
              type="number"
              min="1"
              max="99"
              step="1"
              value={minRsi}
              onChange={(e) => setMinRsi(e.target.value)}
              className="border-neutral-800 bg-neutral-900"
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-2 text-sm text-neutral-300">
            交叉有效天數
            <Input
              type="number"
              min="0"
              max="10"
              step="1"
              value={crossDays}
              onChange={(e) => setCrossDays(e.target.value)}
              className="border-neutral-800 bg-neutral-900"
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-2 text-sm text-neutral-300">
            相對爆量倍率
            <Input
              type="number"
              min="0.5"
              max="10"
              step="0.1"
              value={relativeVolumeMultiplier}
              onChange={(e) => setRelativeVolumeMultiplier(e.target.value)}
              className="border-neutral-800 bg-neutral-900"
            />
          </label>

          <label className="flex min-w-[180px] flex-col gap-2 text-sm text-neutral-300">
            快線 EMA
            <Input
              type="number"
              min="2"
              max="60"
              step="1"
              value={fastEma}
              onChange={(e) => setFastEma(e.target.value)}
              className="border-neutral-800 bg-neutral-900"
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-2 text-sm text-neutral-300">
            慢線 EMA
            <Input
              type="number"
              min="3"
              max="120"
              step="1"
              value={slowEma}
              onChange={(e) => setSlowEma(e.target.value)}
              className="border-neutral-800 bg-neutral-900"
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-2 text-sm text-neutral-300">
            趨勢 EMA
            <Input
              type="number"
              min="20"
              max="300"
              step="1"
              value={trendEma}
              onChange={(e) => setTrendEma(e.target.value)}
              className="border-neutral-800 bg-neutral-900"
            />
          </label>
          <div className="flex items-end">
            <Badge variant="outline" className="border-neutral-700 text-neutral-300">
              目前門檻：{formatHumanAmount(data?.params.minTurnover ?? 0)} / RSI &gt; {data?.params.minRsi ?? "-"} / 量比 &gt;= {data?.params.minRelativeVolumeMultiplier ?? "-"}x
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="border-emerald-900/40 bg-emerald-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-300">
              <TrendingUp className="h-4 w-4" />
              買進條件
            </CardTitle>
            <CardDescription className="text-neutral-300">{data?.strategy.entry}</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-amber-900/40 bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-300">
              <TriangleAlert className="h-4 w-4" />
              賣出條件
            </CardTitle>
            <CardDescription className="text-neutral-300">{data?.strategy.exit}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {isLoading && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-10 text-center text-neutral-400">
          正在掃描突破名單...
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-10 text-center text-red-300">
          無法載入選股資料，請稍後重試。
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-6">
          <Card className="border-neutral-800 bg-neutral-950/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-neutral-100">
                <Activity className="h-4 w-4 text-emerald-400" />
                買進清單
                <Badge variant="outline" className="ml-1 border-emerald-700 text-emerald-300">
                  {data.entries.length} 檔
                </Badge>
              </CardTitle>
              <CardDescription className="text-neutral-400">
                更新時間：{new Date(data.generatedAt).toLocaleString("zh-TW")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead>代號</TableHead>
                    <TableHead>收盤</TableHead>
                    <TableHead>快/慢/趨勢 EMA</TableHead>
                    <TableHead>RSI</TableHead>
                    <TableHead>成交金額</TableHead>
                    <TableHead>量比</TableHead>
                    <TableHead>交叉天數</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map((item) => (
                    <TableRow key={item.symbol} className="border-neutral-800">
                      <TableCell>
                        <Link href={`/stock/${item.code}`} className="font-semibold text-emerald-300 hover:underline">
                          {item.code}
                        </Link>
                        <div className="text-xs text-neutral-400">{item.name}</div>
                      </TableCell>
                      <TableCell>{num(item.close)}</TableCell>
                      <TableCell className="text-neutral-300">
                        {num(item.fastEma)} / {num(item.slowEma)} / {num(item.trendEma)}
                      </TableCell>
                      <TableCell>{num(item.rsi)}</TableCell>
                      <TableCell>{formatHumanAmount(item.tradedValue)}</TableCell>
                      <TableCell>{item.volumeRatio.toFixed(2)}x</TableCell>
                      <TableCell>{item.crossAgeDays ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-neutral-800 bg-neutral-950/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-neutral-100">
                <TriangleAlert className="h-4 w-4 text-amber-400" />
                賣出清單
                <Badge variant="outline" className="ml-1 border-amber-700 text-amber-300">
                  {data.exits.length} 檔
                </Badge>
              </CardTitle>
              <CardDescription className="text-neutral-400">
                條件：Close &lt; 慢 EMA 或 RSI &lt; 50
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-800">
                    <TableHead>代號</TableHead>
                    <TableHead>收盤</TableHead>
                    <TableHead>慢 EMA</TableHead>
                    <TableHead>RSI</TableHead>
                    <TableHead>成交金額</TableHead>
                    <TableHead>賣出原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.exits.map((item) => (
                    <TableRow key={item.symbol} className="border-neutral-800">
                      <TableCell>
                        <Link href={`/stock/${item.code}`} className="font-semibold text-amber-300 hover:underline">
                          {item.code}
                        </Link>
                        <div className="text-xs text-neutral-400">{item.name}</div>
                      </TableCell>
                      <TableCell>{num(item.close)}</TableCell>
                      <TableCell>{num(item.slowEma)}</TableCell>
                      <TableCell>{num(item.rsi)}</TableCell>
                      <TableCell>{formatHumanAmount(item.tradedValue)}</TableCell>
                      <TableCell className="space-x-1">
                        {item.exitReasons.map((reason) => (
                          <Badge
                            key={`${item.symbol}-${reason}`}
                            variant="outline"
                            className="border-amber-700 text-amber-200"
                          >
                            {reason}
                          </Badge>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
