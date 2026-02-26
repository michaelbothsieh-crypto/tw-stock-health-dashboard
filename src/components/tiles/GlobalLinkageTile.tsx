"use client";

import { useMemo, useState } from "react";
import { Tile } from "@/components/bento/Tile";
import { SnapshotResponse } from "@/components/layout/types";

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

    const missingDataWarning = snapshot.warnings && snapshot.warnings.some(
        w => w.includes("目前海外資料暫時無法取得")
    );

    if (!linkage) {
        return (
            <Tile className="rounded-2xl p-6">
                <div className="mb-4 text-[16px] font-medium text-neutral-400">🌍 板塊與對標連動</div>
                <div className="flex flex-col items-center justify-center py-6 text-neutral-500 text-[14px]">
                    <div>暫時無法取得連動資料</div>
                    <div className="text-[13px] mt-1">建議稍後重試</div>
                </div>
            </Tile>
        );
    }

    const { profile, drivers, relativeStrength, twPeerLinkage } = linkage;
    const { sector, peers } = drivers;

    // Overseas logic
    const isOverseasPartial = !sector && peers.length === 0;
    
    // UI Helpers
    let rsScore = relativeStrength?.rsScore ?? null;
    let rsState = relativeStrength?.state ?? "中性";

    return (
        <Tile className="rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-4 border-b border-neutral-800 pb-2 w-full">
                    <button
                        onClick={() => setActiveTab("local")}
                        className={`text-[16px] font-medium transition-colors ${activeTab === "local" ? "text-neutral-100 border-b-2 border-emerald-500" : "text-neutral-500 hover:text-neutral-300"}`}
                    >
                        🇹🇼 台股對標
                    </button>
                    <button
                        onClick={() => setActiveTab("overseas")}
                        className={`text-[16px] font-medium transition-colors ${activeTab === "overseas" ? "text-neutral-100 border-b-2 border-emerald-500" : "text-neutral-500 hover:text-neutral-300"}`}
                    >
                        🌎 海外板塊
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-5">
                {/* Profile Common Header */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-medium text-neutral-200">
                        {profile.sectorZh || "未知產業"}
                    </span>
                    <span className="text-neutral-600 text-[14px]">/</span>
                    <span className="text-[14px] text-neutral-400">
                        {profile.subIndustryZh || "未知子產業"}
                    </span>
                    {profile.confidence < 60 && (
                        <span className="text-[12px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded border border-neutral-700 ml-auto">
                            產業辨識低度信心
                        </span>
                    )}
                </div>

                {/* Local Tab Content */}
                {activeTab === "local" && (
                    <div className="flex flex-col gap-4">
                        {!twPeerLinkage ? (
                            <div className="py-4 text-center rounded-xl bg-neutral-900/40 border border-neutral-800/80 text-neutral-500 text-[14px]">
                                產生對標資料中，或無台股對標設定。
                            </div>
                        ) : (
                            <>
                                <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                                    <div className="text-[13px] text-neutral-500 mb-1">族群名稱 ({twPeerLinkage.benchmark.kind})</div>
                                    <div className="text-[16px] font-medium text-neutral-200 truncate">
                                        {twPeerLinkage.benchmark.nameZh}
                                    </div>
                                </div>

                                {twPeerLinkage.peers.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                        <div className="text-[13px] text-neutral-500 mb-2">本地同業對標：</div>
                                        {twPeerLinkage.peers.map((peer: any, i: number) => (
                                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between text-[14px] px-3 py-2.5 rounded-xl border border-neutral-800/50 bg-neutral-900/20 hover:bg-neutral-800/50 transition-colors gap-2">
                                                <div className="font-medium text-neutral-200">{peer.nameZh} <span className="text-neutral-500 text-[13px]">({peer.code})</span></div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`tabular-nums font-semibold ${peer.corr60 !== null ? "text-emerald-400/90" : "text-neutral-600"}`}>
                                                        {peer.corr60 !== null ? `相關 ${(peer.corr60 * 100).toFixed(1)}%` : "—"}
                                                    </span>
                                                    <span className={`text-[13px] ${peer.note === "連動不明顯" || peer.note === "資料不足" ? "text-amber-500/80" : "text-neutral-400"}`}>
                                                        {peer.note}
                                                    </span>
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
                            <div className="py-6 text-center rounded-xl bg-neutral-900/40 border border-neutral-800/80 text-neutral-400 text-[14px]">
                                【產業辨識信心不足，已暫停海外對標】<br /><span className="text-[13px] text-neutral-500 mt-1 block">請參考台股對標即可</span>
                            </div>
                        ) : isOverseasPartial ? (
                            <div className="py-4 text-center rounded-xl bg-neutral-900/40 border border-neutral-800/80 text-neutral-500 text-[14px]">
                                暫時無法取得海外連動資料，建議稍後重試。
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
                                        <div className="text-[13px] text-neutral-500 mb-1">海外主題對標強度 (RS)</div>
                                        <div className={`text-[20px] font-bold tabular-nums ${rsScore === null ? "text-neutral-500" :
                                            rsScore >= 60 ? "text-emerald-400" :
                                                rsScore <= 40 ? "text-rose-400" :
                                                    "text-amber-400"
                                            }`}>
                                            {rsScore === null ? "—" : rsScore.toFixed(0)} <span className="text-[14px] font-normal text-neutral-400 ml-1">{rsScore !== null ? rsState : ""}</span>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 flex flex-col justify-center">
                                        <div className="text-[13px] text-neutral-500 mb-1">主題板塊</div>
                                        <div className="text-[16px] font-medium text-neutral-200 truncate">
                                            {sector?.nameZh || "—"} <span className="text-[13px] text-neutral-500">({sector?.id})</span>
                                        </div>
                                    </div>
                                </div>

                                {missingDataWarning && (
                                    <div className="text-[13px] text-amber-500 mt-1 px-1">
                                        * 部分海外資料連線逾時，數值與清單可能短缺。
                                    </div>
                                )}

                                {/* Top Peers */}
                                {peers.length > 0 && !isMobile && (
                                    <div className="mt-2 space-y-2">
                                        <div className="text-[13px] text-neutral-500 mb-2">海外高度相關股：</div>
                                        {peers.map((peer: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between text-[14px] px-3 py-2 rounded-lg bg-neutral-900/20 border border-neutral-800/40 hover:bg-neutral-800/50 transition-colors">
                                                <div className="font-medium text-neutral-300">{peer.symbol} <span className="text-neutral-500 text-[12px] ml-1">{peer.nameEn}</span></div>
                                                <div className="flex gap-4 items-center">
                                                    <span className={`tabular-nums ${peer.reason === "連動不明顯" ? "text-neutral-500" : "text-emerald-400/90"}`}>
                                                        {peer.corr60 ? `相關 ${(peer.corr60 * 100).toFixed(0)}%` : "—"}
                                                    </span>
                                                    <span className={`text-[13px] ${peer.reason === "連動不明顯" ? "text-amber-500/80" : "text-neutral-400"}`}>{peer.reason}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {peers.length > 0 && isMobile && (
                                    <div className="mt-2 space-y-2">
                                        {peers.slice(0, 2).map((peer: any, i: number) => (
                                            <div key={i} className="text-[13px] text-neutral-400 flex items-center justify-between border-b border-neutral-800/50 pb-2 last:border-0">
                                                <span>{peer.symbol} <span className="text-neutral-500 text-[11px] ml-1">{peer.nameEn}</span></span>
                                                <span className={peer.reason === "連動不明顯" ? "text-neutral-500" : "text-emerald-400/90"}>
                                                    {peer.corr60 ? `${(peer.corr60 * 100).toFixed(0)}%` : "—"}
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
