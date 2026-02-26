"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { watchlistStore, WatchlistItem } from "@/lib/stores/watchlistStore";
import { resolveCodeFromInput } from "@/lib/stocks/inputResolver";

export default function WatchlistPage() {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [newTicker, setNewTicker] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const unsubscribe = watchlistStore.subscribe((items) => {
            setWatchlist(items);
        });
        return unsubscribe;
    }, []);

    const handleAdd = async () => {
        setError("");
        const input = newTicker.trim();
        if (!input) return;

        setIsLoading(true);
        const resolvedCode = await resolveCodeFromInput(input);
        
        if (!resolvedCode) {
            setError(`找不到符合的股票：${input}`);
            setIsLoading(false);
            return;
        }

        if (watchlist.some((item) => item.code === resolvedCode)) {
            setError(`該代號 (${resolvedCode}) 已在自選清單中`);
            setIsLoading(false);
            return;
        }

        await watchlistStore.add(resolvedCode);
        setNewTicker("");
        setIsLoading(false);
    };

    const handleRemove = (code: string) => {
        watchlistStore.remove(code);
    };

    return (
        <div className="p-4 sm:p-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight mb-6 text-neutral-100">管理自選股</h1>

            <Card className="mb-6 bg-neutral-900/60 border-neutral-800">
                <CardHeader>
                    <CardTitle className="text-neutral-100">新增股票</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="輸入代號或股名 (例如：2330 或 台積電)"
                                value={newTicker}
                                onChange={(e) => setNewTicker(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !isLoading && handleAdd()}
                                className="bg-neutral-950 border-neutral-700 text-neutral-100 focus-visible:ring-emerald-500/30"
                            />
                        </div>
                        <Button onClick={handleAdd} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            {isLoading ? "新增中..." : "新增"}
                        </Button>
                    </div>
                    {error && <p className="text-[13px] text-rose-500 mt-3">{error}</p>}
                </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
                {watchlist.length === 0 && (
                    <p className="text-neutral-500 text-[15px] text-center py-8">您的自選清單目前為空。</p>
                )}
                {watchlist.map(item => (
                    <div key={item.code} className="flex justify-between items-center p-4 border border-neutral-800 rounded-xl bg-neutral-900/40 transition-colors hover:bg-neutral-900/60">
                        <div className="flex items-center gap-4">
                            <div className="font-mono text-[18px] text-emerald-400 tabular-nums w-[72px]">{item.code}</div>
                            <div className="font-sans text-[16px] text-neutral-200">{item.name}</div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(item.code)} className="text-neutral-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors rounded-lg h-9 w-9">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
