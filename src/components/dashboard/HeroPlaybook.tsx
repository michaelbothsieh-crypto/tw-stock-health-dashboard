"use client";

import { ListChecks, Eye, AlertCircle, Globe, Search } from "lucide-react";
import { SnapshotResponse } from "@/components/layout/types";
import { generatePlaybook, VerdictColor } from "@/lib/ux/playbookGenerator";

// ── 色票映射 ─────────────────────────────────────────────────────────
const VERDICT_STYLES: Record<
    VerdictColor,
    {
        banner: string;
        badge: string;
        dot: string;
        stepNumber: string;
        accent: string;
    }
> = {
    emerald: {
        banner: "bg-emerald-900/30 border-emerald-700/40 text-emerald-300",
        badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        dot: "bg-emerald-500",
        stepNumber: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        accent: "text-emerald-400",
    },
    rose: {
        banner: "bg-rose-900/30 border-rose-700/40 text-rose-300",
        badge: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
        dot: "bg-rose-500",
        stepNumber: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
        accent: "text-rose-400",
    },
    amber: {
        banner: "bg-amber-900/30 border-amber-700/40 text-amber-300",
        badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        dot: "bg-amber-500",
        stepNumber: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        accent: "text-amber-400",
    },
    slate: {
        banner: "bg-slate-800/50 border-slate-700/40 text-slate-300",
        badge: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
        dot: "bg-slate-500",
        stepNumber: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
        accent: "text-slate-400",
    },
};

// ── 價格顯示 Helper ──────────────────────────────────────────────────
function PriceDisplay({
    prices,
    verdictColor,
}: {
    prices: SnapshotResponse["data"]["prices"];
    verdictColor: VerdictColor;
}) {
    if (!prices || prices.length < 2) return null;
    const latest = prices[prices.length - 1];
    const prev = prices[prices.length - 2];
    const change = latest.close - prev.close;
    const changePct = (change / prev.close) * 100;
    const isUp = change >= 0;
    const styles = VERDICT_STYLES[verdictColor];

    return (
        <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black tabular-nums text-neutral-100">
                {latest.close.toFixed(1)}
            </span>
            <span
                className={`text-sm font-semibold tabular-nums ${isUp ? styles.accent : "text-rose-400"}`}
            >
                {isUp ? "+" : ""}
                {change.toFixed(1)} ({isUp ? "+" : ""}
                {changePct.toFixed(2)}%)
            </span>
        </div>
    );
}

// ── HeroPlaybook 主元件 ───────────────────────────────────────────────
export function HeroPlaybook({
    snapshot,
    currentStockLabel,
    onSwitchStock,
}: {
    snapshot: SnapshotResponse;
    currentStockLabel: string;
    onSwitchStock?: () => void;
}) {
    const playbook = generatePlaybook(snapshot);
    const styles = VERDICT_STYLES[playbook.verdictColor];
    const crashWarning = snapshot.crashWarning;
    const isCrashRisk =
        crashWarning?.score !== null && (crashWarning?.score ?? 0) >= 60;

    return (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 shadow-sm overflow-hidden">
            {/* ── 頂部環境橫幅 (Macro Banner) ── */}
            <div
                className={`h-9 flex items-center justify-between px-5 border-b text-xs font-medium ${isCrashRisk
                    ? styles.banner
                    : "bg-neutral-900/60 border-neutral-800 text-neutral-400"
                    }`}
            >
                {/* 左側：狀態文字 */}
                <div className="flex items-center gap-2">
                    {isCrashRisk
                        ? <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        : <Globe className="h-3.5 w-3.5 shrink-0" />
                    }
                    <span>
                        {isCrashRisk
                            ? `系統性風險警示：崩盤預警分數 ${crashWarning?.score?.toFixed(0)} — ${(crashWarning?.score ?? 0) >= 80 ? "建議現金觀望，嚴控部位" : "市場風險上升，注意控管"}`
                            : "宏觀環境：市場平穩"}
                    </span>
                </div>
                {/* 右側：靜態市場數據欄（僅在非風險模式顯示） */}
                {!isCrashRisk && (
                    <div className="hidden sm:flex items-center gap-3 text-neutral-500 tabular-nums">
                        <span>VIX 16.4</span>
                        <span className="text-neutral-700">·</span>
                        <span>DXY 104.2</span>
                        <span className="text-neutral-700">·</span>
                        <span>SOXX 多頭</span>
                    </div>
                )}
            </div>

            {/* ── 主體：Split Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0">

                {/* ── 左側 1/3：判決區 ── */}
                <div className="md:border-r border-neutral-800 p-6 flex flex-col justify-between gap-4">
                    {/* 股票 Header：可互動，點擊即切換股票 */}
                    <button
                        type="button"
                        onClick={onSwitchStock}
                        className="flex items-start gap-2 cursor-pointer hover:bg-white/5 rounded-lg p-2 -ml-2 transition-colors group text-left"
                        aria-label="切換股票"
                    >
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-neutral-100 leading-none">
                                {currentStockLabel.split(" ")[0]}
                            </h1>
                            <div className="text-sm font-medium text-neutral-400 mt-1">
                                {currentStockLabel.split(" ").slice(1).join(" ") || "台灣上市"}
                            </div>
                        </div>
                        <Search className="h-4 w-4 mt-1 shrink-0 text-neutral-600 group-hover:text-neutral-300 transition-colors" />
                    </button>

                    {/* Verdict Badge：柔和邊框風格，不喧賓奪主 */}
                    <div>
                        <div
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold ${styles.badge}`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                            {playbook.verdict}
                        </div>
                    </div>

                    {/* 最新股價 */}
                    <div>
                        <div className="text-sm text-muted-foreground mb-0.5">最新收盤</div>
                        <PriceDisplay
                            prices={snapshot.data.prices}
                            verdictColor={playbook.verdictColor}
                        />
                    </div>

                    {/* 策略信心度 */}
                    <div className="pt-3 border-t border-neutral-800/60">
                        <div className="text-sm text-muted-foreground mb-1">策略出手信心</div>
                        <div
                            className={`text-2xl font-bold tabular-nums ${styles.accent}`}
                        >
                            {snapshot.strategy.confidence.toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* ── 右側 2/3：戰術沙盤區 ── */}
                <div className="md:col-span-2 flex flex-col divide-y divide-neutral-800">

                    {/* 上半：SOP 操作順序 */}
                    <div className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ListChecks className={`h-4 w-4 ${styles.accent}`} />
                            <span className="text-sm font-semibold text-neutral-300">
                                SOP 操作順序
                            </span>
                        </div>
                        <div className="space-y-3">
                            {playbook.actionSteps.map((step, idx) => (
                                <div key={idx} className="flex items-start gap-3">
                                    {/* Step 序號圓點 */}
                                    <div
                                        className={`mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${styles.stepNumber}`}
                                    >
                                        {idx + 1}
                                    </div>
                                    {/* 連接豎線（非最後一項） */}
                                    <div className="flex flex-col flex-1 gap-0">
                                        <p className="text-[14px] text-neutral-200 leading-snug">
                                            {/* 去除 "1." "2." "3." 前綴（已由圓點表示） */}
                                            {step.replace(/^\d+\.\s*/, "")}
                                        </p>
                                        {idx < playbook.actionSteps.length - 1 && (
                                            <div className="mt-2 ml-[-24px] pl-[34px] h-3 border-l-2 border-dashed border-neutral-800" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 下半：重要觀察對象 */}
                    <div className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Eye className={`h-4 w-4 ${styles.accent}`} />
                            <span className="text-sm font-semibold text-neutral-300">
                                重要觀察對象
                            </span>
                        </div>
                        <div className="space-y-2.5">
                            {playbook.watchTargets.map((target, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-start gap-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800/70 px-4 py-3"
                                >
                                    <div
                                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`}
                                    />
                                    <p className="text-[13px] text-neutral-300 leading-snug">
                                        {target}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
