"use client";

import { ListChecks, Eye, AlertCircle, Globe, Search, Target, Zap, TrendingUp, TrendingDown, Activity, Bot, Shield } from "lucide-react";
import { SnapshotResponse } from "@/components/layout/types";
import { generatePlaybook, VerdictColor } from "@/lib/ux/playbookGenerator";
import { getTwseColor } from "../layout/utils";

// ── 色票映射 (配合 TWSE 邏輯) ───────────────────────────────────────
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
    red: {
        banner: "bg-red-900/30 border-red-700/40 text-red-300",
        badge: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
        dot: "bg-red-500",
        stepNumber: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
        accent: "text-red-600 dark:text-red-400",
    },
    green: {
        banner: "bg-green-900/30 border-green-700/40 text-green-300",
        badge: "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20",
        dot: "bg-green-500",
        stepNumber: "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20",
        accent: "text-green-600 dark:text-green-400",
    },
    amber: {
        banner: "bg-amber-900/30 border-amber-700/40 text-amber-300",
        badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
        dot: "bg-amber-500",
        stepNumber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
        accent: "text-amber-600 dark:text-amber-400",
    },
    slate: {
        banner: "bg-slate-800/50 border-slate-700/40 text-slate-300",
        badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20",
        dot: "bg-slate-500",
        stepNumber: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20",
        accent: "text-slate-600 dark:text-slate-400",
    },
};

// ── 價格顯示 Helper ──────────────────────────────────────────────────
function PriceTicker({
    prices,
}: {
    prices: SnapshotResponse["data"]["prices"];
}) {
    if (!prices || prices.length < 2) return null;
    const latest = prices[prices.length - 1];
    const prev = prices[prices.length - 2];
    const change = latest.close - prev.close;
    const changePct = (change / prev.close) * 100;
    
    const colorClass = getTwseColor(change, 'text');
    const bgColorClass = getTwseColor(change, 'bg');

    return (
        <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">最新收盤</div>
            <div className="flex items-center gap-3">
                <span className="text-4xl font-black tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">
                    {latest.close.toFixed(1)}
                </span>
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold ${colorClass} ${bgColorClass} border border-current/10`}>
                    {change >= 0 ? "+" : ""}{change.toFixed(1)} {change >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                </div>
            </div>
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
    // Use AI generated playbook from API, fallback to local generator if missing
    const playbook = snapshot.playbook || generatePlaybook(snapshot);
    const styles = VERDICT_STYLES[playbook.verdictColor as VerdictColor];
    const crashWarning = snapshot.crashWarning;
    const isCrashRisk =
        crashWarning?.score !== null && (crashWarning?.score ?? 0) >= 60;

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
            {/* ── 頂部環境橫幅 (Macro Banner) ── */}
            <div
                className={`h-9 flex items-center justify-between px-5 border-b text-[11px] font-semibold tracking-wide ${isCrashRisk
                    ? styles.banner
                    : "bg-slate-50 dark:bg-neutral-900/60 border-slate-100 dark:border-neutral-800 text-muted-foreground"
                    }`}
            >
                <div className="flex items-center gap-2">
                    {isCrashRisk
                        ? <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        : <Globe className="h-3.5 w-3.5 shrink-0" />
                    }
                    <span>
                        {isCrashRisk
                            ? `系統性風險警示：崩盤預警分數 ${crashWarning?.score?.toFixed(0)} — ${(crashWarning?.score ?? 0) >= 80 ? "建議現金觀望" : "市場風險上升"}`
                            : "宏觀環境：市場平穩"}
                    </span>
                </div>
                {!isCrashRisk && (
                    <div className="hidden sm:flex items-center gap-3 text-slate-400 dark:text-neutral-500 tabular-nums font-medium">
                        <span>VIX 16.4</span>
                        <span className="opacity-30">·</span>
                        <span>DXY 104.2</span>
                        <span className="opacity-30">·</span>
                        <span>SOXX 多頭</span>
                    </div>
                )}
            </div>

            {/* ── 主體：Split Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0">

                {/* ── 左側 1/3：判決與數據區 ── */}
                <div className="md:border-r border-slate-100 dark:border-neutral-800 p-8 flex flex-col gap-8">
                    {/* 股票 Header */}
                    <button
                        type="button"
                        onClick={onSwitchStock}
                        className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl p-3 -m-3 transition-all group text-left"
                    >
                        <div className="min-w-0">
                            <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-neutral-100 leading-none truncate">
                                {currentStockLabel.split(" ")[0]}
                            </h1>
                            <div className="text-xs font-bold text-muted-foreground mt-1.5 uppercase tracking-widest">
                                {currentStockLabel.split(" ").slice(1).join(" ") || "台灣上市"}
                            </div>
                        </div>
                        <Search className="h-4 w-4 mt-1 shrink-0 text-slate-300 dark:text-neutral-600 group-hover:text-slate-900 dark:group-hover:text-neutral-300 transition-colors" />
                    </button>

                    {/* 股價儀表 */}
                    <PriceTicker prices={snapshot.data.prices} />

                    {/* AI 策略結論與信心 (Merged Block) */}
                    <div className="bg-slate-50 dark:bg-neutral-900/40 border border-slate-100 dark:border-neutral-800 p-5 rounded-2xl flex items-center justify-between shadow-inner">
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">
                                <Bot className="h-3.5 w-3.5" />
                                AI 策略結論
                            </div>
                            <div className={`text-xl font-black ${styles.accent}`}>
                                {playbook.verdict}
                            </div>
                        </div>
                        <div className="text-right space-y-1">
                            <div className="text-xs font-bold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">
                                出手信心
                            </div>
                            <div className={`text-2xl font-black tabular-nums tracking-tighter ${
                                snapshot.strategy.confidence >= 70 ? "text-red-600 dark:text-red-500" : 
                                snapshot.strategy.confidence >= 50 ? "text-amber-600 dark:text-amber-500" : 
                                "text-green-600 dark:text-green-500"
                            }`}>
                                {snapshot.strategy.confidence.toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    {/* 極簡動態標籤 */}
                    <div className="flex flex-wrap gap-2">
                        {snapshot.signals.flow.marginChange20D !== null && snapshot.signals.flow.marginChange20D > 0.05 && (
                            <div className="flex items-center gap-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 text-[11px] font-bold border border-green-500/20">
                                <TrendingUp className="h-3.5 w-3.5" />
                                融資大增
                            </div>
                        )}
                        {snapshot.consistency.score < 55 && (
                            <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 text-[11px] font-bold border border-amber-500/20">
                                <Activity className="h-3.5 w-3.5" />
                                一致性低
                            </div>
                        )}
                    </div>
                </div>

                {/* ── 右側 2/3：戰術沙盤區 ── */}
                <div className="md:col-span-2 flex flex-col divide-y divide-slate-100 dark:divide-neutral-800">

                    {/* 上半：SOP 操作順序 */}
                    <div className="p-8">
                        <div className="flex items-center gap-2 mb-6">
                            <ListChecks className={`h-4 w-4 ${styles.accent}`} />
                            <span className="text-xs font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-widest">
                                SOP 操作順序
                            </span>
                        </div>
                        <div className="space-y-4">
                            {playbook.actionSteps.map((step, idx) => (
                                <div key={idx} className="flex items-start gap-4 group">
                                    <div
                                        className={`mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black transition-all duration-300 group-hover:scale-110 ${styles.stepNumber}`}
                                    >
                                        {idx + 1}
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <p className="text-[15px] font-medium text-slate-700 dark:text-neutral-200 leading-snug">
                                            {step.replace(/^\d+\.\s*/, "")}
                                        </p>
                                        {idx < playbook.actionSteps.length - 1 && (
                                            <div className="mt-3 ml-[-28px] pl-[39px] h-4 border-l-2 border-dashed border-slate-100 dark:border-neutral-800" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 下半：關鍵點位與風險橫幅 */}
                    <div className="p-8 space-y-6">
                        <div className="grid grid-cols-3 gap-6 bg-slate-50/50 dark:bg-neutral-900/30 p-5 rounded-2xl border border-slate-100 dark:border-neutral-800/50 shadow-inner">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">
                                    <Target className="h-3.5 w-3.5 text-red-500" />
                                    轉強門檻
                                </div>
                                <div className="text-lg font-black text-slate-900 dark:text-neutral-100 tabular-nums">
                                    ≥ {snapshot.keyLevels.breakoutLevel?.toFixed(2) ?? '--'}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">
                                    <Shield className="h-3.5 w-3.5 text-blue-500" />
                                    支撐參考
                                </div>
                                <div className="text-lg font-black text-slate-900 dark:text-neutral-100 tabular-nums">
                                    {snapshot.keyLevels.supportLevel?.toFixed(2) ?? '--'}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">
                                    <AlertCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                                    失效門檻
                                </div>
                                <div className="text-lg font-black text-slate-900 dark:text-neutral-100 tabular-nums text-green-600 dark:text-green-500">
                                    &lt; {snapshot.keyLevels.invalidationLevel?.toFixed(2) ?? '--'}
                                </div>
                            </div>
                        </div>

                        {(snapshot.strategy.explain.contradictions.length > 0 || snapshot.consistency.score < 55) && (
                            <div className="flex items-center gap-3 text-xs font-bold text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 rounded-xl border border-amber-200/50 dark:border-amber-500/20">
                                <Zap className="h-4 w-4 shrink-0 fill-current" />
                                <span>訊號分歧留意洗盤，法人由賣轉買前控管風險</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
