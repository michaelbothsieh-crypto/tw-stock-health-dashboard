"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tile } from "@/components/bento/Tile";
import { SnapshotResponse } from "@/components/layout/types";
import { Star, ArrowRight, Activity, Globe, MapPin, Link as LinkIcon } from "lucide-react";
import { watchlistStore } from "@/lib/stores/watchlistStore";

// Adapt legacy output gracefully
function useAdaptedLinkage(snapshot: SnapshotResponse) {
    return useMemo(() => {
        const data = snapshot.globalLinkage || (snapshot as any).globalDrivers;
        if (!data) return null;
        return {
            profile: data.profile || {},
            drivers: data.drivers || { sector: null, peers: [] },
            relativeStrength: data.relativeStrength || null,
            twPeerLinkage: data.twPeerLinkage || null,
        };
    }, [snapshot]);
}

export function GlobalLinkageTile({ snapshot, isMobile = false }: { snapshot: SnapshotResponse; isMobile?: boolean }) {
    const linkage = useAdaptedLinkage(snapshot);
    const [activeTab, setActiveTab] = useState<"local" | "overseas">("local");
    const [watchlistCodes, setWatchlistCodes] = useState<Set<string>>(new Set());
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = watchlistStore.subscribe((items) => {
            setWatchlistCodes(new Set(items.map(item => item.code)));
        });
        return unsubscribe;
    }, []);

    const handleAddToWatchlist = async (ticker: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (watchlistCodes.has(ticker)) {
            watchlistStore.remove(ticker);
        } else {
            await watchlistStore.add(ticker);
        }
    };

    const missingDataWarning = snapshot.warnings && snapshot.warnings.some(
        w => w.includes("海外資料暫時無法取得") || w.includes("連線逾時")
    );

    if (!linkage) {
        return (
            <Tile className="rounded-2xl p-6 border shadow-sm bg-card">
                <div className="mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-slate-700 dark:text-neutral-300" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100">同業對標</h3>
                </div>
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm">
                    <div>暫時無法取得連動資料</div>
                    <div className="text-xs mt-1">建議稍後重試</div>
                </div>
            </Tile>
        );
    }

    const { profile, drivers, relativeStrength, twPeerLinkage } = linkage;
    const { sector, peers } = drivers;

    const isOverseasPartial = !sector && peers.length === 0;
    let rsScore = relativeStrength?.rsScore ?? null;
    let rsState = relativeStrength?.state ?? "中性";

    // Filtering and sorting peers
    const filteredLocalPeers = useMemo(() => {
        if (!twPeerLinkage?.peers) return [];
        return [...twPeerLinkage.peers]
            .filter((p: any) => p.corr60 !== null && p.corr60 >= 0.3)
            .sort((a: any, b: any) => (b.corr60 || 0) - (a.corr60 || 0));
    }, [twPeerLinkage]);

    const filteredOverseasPeers = useMemo(() => {
        if (!peers) return [];
        return [...peers]
            .filter((p: any) => p.corr60 !== null && p.corr60 >= 0.3)
            .sort((a: any, b: any) => (b.corr60 || 0) - (a.corr60 || 0));
    }, [peers]);

    const getCorrColor = (corr: number | null) => {
        if (corr === null) return "text-muted-foreground";
        if (corr >= 0.7) return "text-emerald-600 dark:text-emerald-400";
        if (corr >= 0.3) return "text-amber-600 dark:text-amber-500";
        return "text-muted-foreground";
    };

    const isIndustrySame = profile.sectorZh === profile.subIndustryZh;

    return (
        <Tile className="rounded-2xl p-4 md:p-6 border shadow-sm bg-card hover:shadow-md transition-all duration-300">
            <div className="mb-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-slate-700 dark:text-neutral-300" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100">同業對標</h3>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-neutral-700">
                        {profile.sectorZh || "未知產業"}
                    </div>
                    {!isIndustrySame && (
                        <>
                            <span className="text-muted-foreground text-xs">/</span>
                            <div className="text-xs text-muted-foreground font-medium">
                                {profile.subIndustryZh || "未知子產業"}
                            </div>
                        </>
                    )}
                    {profile.confidence < 60 && (
                        <div className="bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200 dark:border-amber-500/20 ml-auto">
                            低度信心
                        </div>
                    )}
                </div>

                <div className="flex gap-6 border-b border-slate-100 dark:border-neutral-800/50">
                    <button
                        onClick={() => setActiveTab("local")}
                        className={`text-sm font-medium pb-2 transition-all relative flex items-center gap-1.5 ${activeTab === "local" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-slate-900 dark:hover:text-neutral-200"}`}
                    >
                        <MapPin className="h-4 w-4" />
                        台股對標
                        {activeTab === "local" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 dark:bg-emerald-400 rounded-t-full" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("overseas")}
                        className={`text-sm font-medium pb-2 transition-all relative flex items-center gap-1.5 ${activeTab === "overseas" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-slate-900 dark:hover:text-neutral-200"}`}
                    >
                        <Globe className="h-4 w-4" />
                        海外板塊
                        {activeTab === "overseas" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 dark:bg-emerald-400 rounded-t-full" />
                        )}
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-4">

                {/* Local Tab Content */}
                {activeTab === "local" && (
                    <div className="flex flex-col gap-4">
                        {!twPeerLinkage ? (
                            <div className="py-4 text-center rounded-xl bg-slate-50 dark:bg-neutral-900/40 border border-slate-100 dark:border-neutral-800/80 text-muted-foreground text-sm">
                                產生對標資料中或無台股對標設定
                            </div>
                        ) : (
                            <>
                                <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 p-4">
                                    <div className="text-xs text-muted-foreground mb-1">族群基準</div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-neutral-200 truncate">
                                        {twPeerLinkage.benchmark.nameZh}
                                    </div>
                                </div>

                                {filteredLocalPeers.length > 0 && (
                                    <div className="mt-1 space-y-2">
                                        <div className="text-xs text-muted-foreground mb-2">本地同業對標</div>
                                        {filteredLocalPeers.map((peer: any, i: number) => (
                                            <div 
                                                key={i} 
                                                onClick={() => router.push(`/stock/${peer.code}`)}
                                                className="group flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2.5 rounded-lg border border-slate-100 dark:border-neutral-800/50 bg-slate-50/50 dark:bg-neutral-900/20 hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer transition-all duration-300 gap-2"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm text-slate-900 dark:text-neutral-200">{peer.nameZh}</span>
                                                    <span className="text-xs text-muted-foreground">{peer.code}</span>
                                                    {peer.note === "關鍵對標 (Twin)" && (
                                                        <span className="bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-200 dark:border-blue-500/20">
                                                            TWIN
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <LinkIcon className={`h-3.5 w-3.5 ${peer.corr60 >= 0.7 ? "text-emerald-500" : "text-amber-500"}`} />
                                                        <span className={`text-sm font-medium tabular-nums ${getCorrColor(peer.corr60)}`}>
                                                            {(peer.corr60 * 100).toFixed(1)}% 連動
                                                        </span>
                                                    </div>
                                                    <button 
                                                        onClick={(e) => handleAddToWatchlist(peer.code, e)}
                                                        className={`p-2 rounded-md transition-all duration-300 ${watchlistCodes.has(peer.code) ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:hover:bg-slate-200 dark:md:hover:bg-neutral-700"}`}
                                                    >
                                                        <Star className={`h-4 w-4 transition-colors ${watchlistCodes.has(peer.code) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground md:hover:text-yellow-500"}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Overseas Tab Content */}
                {activeTab === "overseas" && (
                    <div className="flex flex-col gap-4">
                        {profile.confidence < 60 ? (
                            <div className="py-6 text-center rounded-xl bg-slate-50 dark:bg-neutral-900/40 border border-slate-100 dark:border-neutral-800/80 text-muted-foreground text-sm">
                                產業辨識信心不足，已暫停海外對標
                            </div>
                        ) : isOverseasPartial ? (
                            <div className="py-4 text-center rounded-xl bg-slate-50 dark:bg-neutral-900/40 border border-slate-100 dark:border-neutral-800/80 text-muted-foreground text-sm">
                                暫時無法取得海外連動資料，建議稍後重試
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 p-4">
                                        <div className="text-xs text-muted-foreground mb-1">海外主題對標強度</div>
                                        <div className="flex items-end gap-2">
                                            <div className={`text-xl font-bold tabular-nums ${rsScore === null ? "text-muted-foreground" :
                                                rsScore >= 60 ? "text-emerald-600 dark:text-emerald-400" :
                                                    rsScore <= 40 ? "text-rose-600 dark:text-rose-400" :
                                                        "text-amber-600 dark:text-amber-400"
                                                }`}>
                                                {rsScore === null ? "—" : rsScore.toFixed(0)}
                                            </div>
                                            <div className="text-xs font-medium text-muted-foreground mb-1">
                                                {rsScore !== null ? rsState : ""}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 p-4 flex flex-col justify-center">
                                        <div className="text-xs text-muted-foreground mb-1">主題板塊</div>
                                        <div className="text-sm font-semibold text-slate-900 dark:text-neutral-200 truncate">
                                            {sector?.nameZh || "—"} <span className="text-xs text-muted-foreground ml-1">{sector?.id}</span>
                                        </div>
                                    </div>
                                </div>

                                {missingDataWarning && (
                                    <div className="text-xs text-amber-600 dark:text-amber-500 mt-1 px-1">
                                        部分海外資料連線逾時
                                    </div>
                                )}

                                {/* Top Peers */}
                                {filteredOverseasPeers.length > 0 && !isMobile && (
                                    <div className="mt-1 space-y-2">
                                        <div className="text-xs text-muted-foreground mb-2">海外高度相關股</div>
                                        {filteredOverseasPeers.map((peer: any, i: number) => (
                                            <div 
                                                key={i} 
                                                onClick={() => router.push(`/stock/${peer.symbol}`)}
                                                className="group flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-100 dark:border-neutral-800/50 bg-slate-50/50 dark:bg-neutral-900/20 hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer transition-all duration-300"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm text-slate-900 dark:text-neutral-200">{peer.symbol.toUpperCase()}</span>
                                                    <span className="text-xs text-muted-foreground">{peer.nameEn}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <LinkIcon className={`h-3.5 w-3.5 ${peer.corr60 >= 0.7 ? "text-emerald-500" : "text-amber-500"}`} />
                                                        <span className={`text-sm font-medium tabular-nums ${getCorrColor(peer.corr60)}`}>
                                                            {(peer.corr60 * 100).toFixed(0)}% 連動
                                                        </span>
                                                    </div>
                                                    <button 
                                                        onClick={(e) => handleAddToWatchlist(peer.symbol, e)}
                                                        className={`p-2 rounded-md transition-all duration-300 ${watchlistCodes.has(peer.symbol) ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:hover:bg-slate-200 dark:md:hover:bg-neutral-700"}`}
                                                    >
                                                        <Star className={`h-4 w-4 transition-colors ${watchlistCodes.has(peer.symbol) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground md:hover:text-yellow-500"}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {filteredOverseasPeers.length > 0 && isMobile && (
                                    <div className="mt-1 space-y-2">
                                        {filteredOverseasPeers.slice(0, 2).map((peer: any, i: number) => (
                                            <div key={i} className="text-xs text-muted-foreground flex items-center justify-between border-b border-slate-100 dark:border-neutral-800/50 pb-2 last:border-0">
                                                <span className="flex items-center gap-1">
                                                    <span className="font-medium text-slate-700 dark:text-neutral-300">{peer.symbol.toUpperCase()}</span>
                                                    <span className="truncate max-w-[100px]">{peer.nameEn}</span>
                                                </span>
                                                <span className={`font-medium ${getCorrColor(peer.corr60)}`}>
                                                    {(peer.corr60 * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </Tile>
    );
}
