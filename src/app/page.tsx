"use client";

import { useState, useEffect } from "react";
import { useStockSnapshot } from "@/hooks/useStockSnapshot";
import { StockChart } from "@/components/StockChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const [watchlist, setWatchlist] = useState<string[]>(["2330", "2317", "2454", "2382", "3231"]);
  const [ticker, setTicker] = useState<string>("2330");

  useEffect(() => {
    const stored = localStorage.getItem("watchlist");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWatchlist(parsed);
          setTicker(parsed[0]);
        }
      } catch (e) { }
    }
  }, []);

  const { data, isLoading, isError } = useStockSnapshot(ticker);

  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-green-600";
    if (score <= 40) return "text-red-600";
    return "text-yellow-600";
  };

  const getStanceBadge = (stance: string) => {
    switch (stance) {
      case 'Bullish': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">偏多 (Bullish)</Badge>;
      case 'Bearish': return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">偏空 (Bearish)</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">中立 (Neutral)</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold tracking-tight">台股健康儀表板</h1>
        <div className="w-48">
          <Select value={ticker} onValueChange={setTicker}>
            <SelectTrigger>
              <SelectValue placeholder="選擇股票代號" />
            </SelectTrigger>
            <SelectContent>
              {watchlist.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <div className="text-center py-20 text-muted-foreground animate-pulse">正在載入 {ticker} 的資料...</div>}
      {isError && <div className="text-center py-20 text-red-500">資料載入失敗，請檢查 API 狀態與 Token。</div>}

      {data && !isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">技術面分數 (Trend)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(data.signals.trend.trendScore)}`}>
                  {data.signals.trend.trendScore}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">籌碼面分數 (Flow)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(data.signals.flow.flowScore)}`}>
                  {data.signals.flow.flowScore}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">基本面分數 (Fundamental)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(data.signals.fundamental.fundamentalScore)}`}>
                  {data.signals.fundamental.fundamentalScore}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-primary">AI 多空判定與信心</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-1">
                  {getStanceBadge(data.explain.stance)}
                </div>
                <div className="text-sm text-muted-foreground">
                  信心指數： <span className="font-semibold">{data.explain.confidence}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>近 120 日價格走勢</CardTitle>
              </CardHeader>
              <CardContent>
                <StockChart data={data.data.prices} />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>AI 綜合分析摘要</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed mb-4">{data.explain.summary}</p>
                  <h4 className="font-semibold text-sm mb-2">關鍵指標與原因：</h4>
                  <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                    {data.explain.key_points.map((point: string, idx: number) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {data.explain.risks.length > 0 && (
                <Card className="border-red-200 bg-red-50/50">
                  <CardHeader>
                    <CardTitle className="text-red-700">潛在風險提示</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc pl-5 text-sm space-y-1 text-red-600/90">
                      {data.explain.risks.map((risk: string, idx: number) => (
                        <li key={idx}>{risk}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
