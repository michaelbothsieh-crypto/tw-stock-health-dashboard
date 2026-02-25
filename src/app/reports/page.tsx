"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export default function ReportsPage() {
    const [generating, setGenerating] = useState(false);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['latestReport'],
        queryFn: async () => {
            const res = await fetch("/api/report/latest");
            if (!res.ok) {
                if (res.status === 404) return null;
                throw new Error("無法載入最新報告");
            }
            return res.json();
        },
    });

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            // Fetch user's watchlist to generate report
            let tickers = ["2330", "2317", "2454", "2382", "3231"];
            const stored = localStorage.getItem("watchlist");
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.length > 0) tickers = parsed;
            }

            const res = await fetch("/api/report/daily", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tickers }),
            });
            if (res.ok) {
                await refetch();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold tracking-tight">每日 AI 分析報告</h1>
                <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                    <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                    {generating ? '產生中...' : '立即產生'}
                </Button>
            </div>

            {isLoading && <div className="text-center py-20 text-muted-foreground animate-pulse">正在檢查最新報告...</div>}

            {isError && <div className="text-center py-20 text-red-500">無法載入報告資料。</div>}

            {!isLoading && !isError && !data && (
                <Card className="text-center py-20 border-dashed">
                    <CardContent className="pt-6">
                        <p className="text-muted-foreground mb-4">目前尚未產生任何報告。</p>
                        <Button variant="outline" onClick={handleGenerate} disabled={generating}>
                            產生第一份報告
                        </Button>
                    </CardContent>
                </Card>
            )}

            {data && (
                <Card className="bg-card">
                    <CardHeader>
                        <CardTitle className="text-muted-foreground text-sm font-normal">
                            報告產生時間： {new Date(data.date).toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Simple Markdown Rendering manually or using a library. MVP: Pre-formatted text */}
                        <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none space-y-4 whitespace-pre-wrap font-sans">
                            {data.markdown}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
