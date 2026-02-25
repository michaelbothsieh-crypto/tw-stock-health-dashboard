"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";

export default function WatchlistPage() {
    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [newTicker, setNewTicker] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const stored = localStorage.getItem("watchlist");
        if (stored) {
            try {
                setWatchlist(JSON.parse(stored));
            } catch (e) { }
        } else {
            setWatchlist(["2330", "2317", "2454", "2382", "3231"]);
        }
    }, []);

    const saveWatchlist = (newList: string[]) => {
        setWatchlist(newList);
        localStorage.setItem("watchlist", JSON.stringify(newList));
    };

    const handleAdd = () => {
        setError("");
        const ticker = newTicker.trim().toUpperCase();

        // 配合新的正規化邏輯簡單防呆
        const pureNumberMatch = ticker.match(/^(\d{4})$/);
        const suffixMatch = ticker.match(/^(\d{4})\.(TW|TWO)$/);

        if (!pureNumberMatch && !suffixMatch) {
            setError("請輸入正確的 4 碼台股代號 (例如：2330 或 2330.TW)");
            return;
        }

        const symbolToSave = pureNumberMatch ? pureNumberMatch[1] : (suffixMatch ? suffixMatch[1] : ticker);

        if (watchlist.includes(symbolToSave)) {
            setError("該代號已在自選清單中");
            return;
        }
        const newList = [...watchlist, symbolToSave];
        saveWatchlist(newList);
        setNewTicker("");
    };

    const handleRemove = (ticker: string) => {
        const newList = watchlist.filter(t => t !== ticker);
        saveWatchlist(newList);
    };

    return (
        <div className="p-4 sm:p-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight mb-6">管理自選股清單</h1>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>新增股號</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="輸入台股代號 (例如：2330)"
                                value={newTicker}
                                onChange={(e) => setNewTicker(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                            />
                        </div>
                        <Button onClick={handleAdd}>新增</Button>
                    </div>
                    {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
                {watchlist.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">您的自選清單目前為空。</p>
                )}
                {watchlist.map(ticker => (
                    <div key={ticker} className="flex justify-between items-center p-4 border rounded-md bg-card">
                        <div className="font-semibold text-lg">{ticker}</div>
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(ticker)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
