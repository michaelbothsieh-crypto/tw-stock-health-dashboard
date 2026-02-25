"use client";

import { useState, useEffect } from "react";
import { useStockSnapshot } from "@/hooks/useStockSnapshot";
import { StockChart } from "@/components/StockChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

const NewsList = ({ items }: { items: any[] }) => {
  if (!items || items.length === 0) return <div className="text-sm text-muted-foreground py-4 text-center">近 7 天無可用新聞資料</div>;

  return (
    <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md gap-3 bg-card/50 hover:bg-accent/10 transition-colors">
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
              <span>{item.date?.substring(0, 16) || item.date}</span>
              <span>•</span>
              <span>{item.source || '未知來源'}</span>
            </div>
            <a href={item.link || '#'} target="_blank" rel="noopener noreferrer" className="font-medium text-sm hover:underline hover:text-primary line-clamp-2">
              {item.title}
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs bg-slate-100">{item.category}</Badge>
            {item.impact === 'BULLISH' && <Badge className="bg-green-100 text-green-800 hover:bg-green-200">利多 ({item.impactScore})</Badge>}
            {item.impact === 'BEARISH' && <Badge className="bg-red-100 text-red-800 hover:bg-red-200">利空 ({item.impactScore})</Badge>}
            {item.impact === 'NEUTRAL' && <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">中立</Badge>}
          </div>
        </div>
      ))}
    </div>
  );
};

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

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-400";
    if (score >= 60) return "text-green-600";
    if (score <= 40) return "text-red-600";
    return "text-yellow-600";
  };

  const formatFundamentalScore = (score: number | null) => {
    if (score === null) return 'N/A';
    // 考量到強勁成長不再爆分，UI 上大於等於 94 視為觸頂
    if (score >= 94) return '95.0';
    return Number(score).toFixed(1);
  };

  const getStanceBadge = (stance: string) => {
    switch (stance) {
      case 'Bullish': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">偏多 (Bullish)</Badge>;
      case 'Bearish': return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">偏空 (Bearish)</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">中立 (Neutral)</Badge>;
    }
  };

  const getCatalystScoreColor = (score: number) => {
    if (score >= 25) return "text-green-700 border-green-300 bg-green-100";
    if (score <= -25) return "text-red-700 border-red-300 bg-red-100";
    return "text-yellow-700 border-yellow-300 bg-yellow-100";
  };

  const getRiskLabel = (riskKey: string) => {
    const riskMap: Record<string, string> = {
      "overheated": "過熱 (RSI 偏高且乖離過大)",
      "breakdown_risk": "破線風險 (跌破短均線)",
      "whipsaw": "盤整洗盤風險 (目前無明顯方向)",
      "volume_missing": "近期交易量資料異常稀少",
      "margin_spike": "融資暴增 (波段籌碼不穩)",
      "inst_reversal_down": "法人高檔翻空 (外資短中期轉賣)",
      "inst_reversal_up": "法人低檔翻多 (外資短中期轉買)",
      "rev_turn_negative": "營收轉向衰退趨勢",
      "growth_decelerating": "營收成長動能大幅放緩",
    };
    // Include existing Chinese passthroughs implicitly
    return riskMap[riskKey] || riskKey;
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">台股健康儀表板</h1>
          {data?.normalizedTicker && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              代號: {data.normalizedTicker.displayName || data.normalizedTicker.display} | 市場: {data.normalizedTicker.market} | Yahoo: {data.normalizedTicker.yahoo}
            </p>
          )}
        </div>
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
      {isError && <div className="text-center py-20 text-red-500">資料載入失敗，請檢查 API 狀態與該股票代號是否存在。</div>}

      {data && !isLoading && !isError && (
        <>
          {data.warnings && data.warnings.length > 0 && (
            <Card className="mb-6 border-yellow-300 bg-yellow-50/50">
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-yellow-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> 注意事項
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 text-sm text-yellow-700">
                <ul className="list-disc pl-5">
                  {data.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">技術面分數 (Trend)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(data.signals.trend.trendScore)}`}>
                  {data.signals.trend.trendScore !== null ? Number(data.signals.trend.trendScore).toFixed(1) : 'N/A'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">籌碼面分數 (Flow)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(data.signals.flow.flowScore)}`}>
                  {data.signals.flow.flowScore !== null ? Number(data.signals.flow.flowScore).toFixed(1) : 'N/A'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">基本面分數 (Fundamental)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(data.signals.fundamental.fundamentalScore)}`}>
                  {formatFundamentalScore(data.signals.fundamental.fundamentalScore)}
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
                  信心指數： <span className="font-semibold">{Number(data.explain.confidence).toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>近期價格走勢</CardTitle>
                <CardDescription>顯示最近 {data.dataWindow?.barsReturned ?? 0} 筆交易日資料</CardDescription>
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
                        <li key={idx}>{getRiskLabel(risk)}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div className="mt-8">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 gap-4">
                <div>
                  <CardTitle className="text-xl">重大快訊與催化劑 (News & Catalysts)</CardTitle>
                  <CardDescription>近 7 日與該標的相關之動能事件分析</CardDescription>
                </div>
                {data.news && (
                  <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                    <span className="text-sm font-medium text-muted-foreground mr-1">Catalyst Score</span>
                    <Badge className={`px-3 py-1 text-base ${getCatalystScoreColor(data.news.catalystScore)}`} variant="outline">
                      {data.news.catalystScore > 0 ? '+' : ''}{data.news.catalystScore}
                    </Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">全部 (All)</TabsTrigger>
                    <TabsTrigger value="bullish">利多 (Bullish)</TabsTrigger>
                    <TabsTrigger value="bearish">利空 (Bearish)</TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="mt-0">
                    <NewsList items={data.news?.timeline || []} />
                  </TabsContent>
                  <TabsContent value="bullish" className="mt-0">
                    <NewsList items={data.news?.topBullishNews || []} />
                  </TabsContent>
                  <TabsContent value="bearish" className="mt-0">
                    <NewsList items={data.news?.topBearishNews || []} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
