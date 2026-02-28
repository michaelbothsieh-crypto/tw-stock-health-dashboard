"use client";

import { ListChecks, Eye, AlertCircle, Globe, Search, Target, Zap, TrendingUp, TrendingDown, Activity, Bot, Shield, ArrowRight, Database, Clock, DollarSign, Cpu, AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { SnapshotResponse } from "@/components/layout/types";
import { generatePlaybook, VerdictColor } from "@/lib/ux/playbookGenerator";
import { getTwseColor } from "../layout/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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
        badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
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

const MACRO_INFO = {
    VIX: "股市恐慌指數。衡量標普500未來30天預期波動，越高代表市場越恐慌。",
    DXY: "美元指數。美元強勢常伴隨外資將資金從新興市場(台股)撤出；弱勢則有利資金流入。",
    SOXX: "費城半導體指數。台股高度連動半導體，費半走強代表科技股大趨勢健康。",
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
        <div className="flex flex-col gap-1.5 mt-4">
            <div className="text-[10px] md:text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-80">最新收盤</div>
            <div className="flex items-center gap-3 md:gap-4">
                <span className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-neutral-100 tabular-nums leading-none">
                    {latest.close.toFixed(1)}
                </span>
                <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] md:text-sm font-black ${colorClass} ${bgColorClass} border border-current/10 whitespace-nowrap`}>
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

    const indicators = crashWarning?.macroIndicators;

    // 解析名稱與代號 (格式預期為 "2330 台積電")
    const parts = currentStockLabel.split(" ");
    const tickerCode = parts[0];
    const stockName = parts.slice(1).join(" ") || "台灣上市";

    return (
        <TooltipProvider delayDuration={200}>
            <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                {/* ── 頂部環境橫幅 (Macro Banner) ── */}
                <div
                    className={`h-10 flex items-center justify-between px-4 md:px-5 border-b text-[11px] font-semibold tracking-wide ${isCrashRisk
                        ? styles.banner
                        : "bg-slate-50 dark:bg-neutral-900/60 border-slate-100 dark:border-neutral-800 text-muted-foreground"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        {isCrashRisk
                            ? <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            : <Globe className="h-3.5 w-3.5 shrink-0" />
                        }
                        <span className="truncate">
                            {isCrashRisk
                                ? `系統性風險：${crashWarning?.score?.toFixed(0)}% — ${(crashWarning?.score ?? 0) >= 80 ? "現金觀望" : "市場風險升"}`
                                : "宏觀環境：市場平穩"}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar ml-4">
                        {indicators && (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-muted-foreground hover:bg-white/10 transition-colors cursor-help whitespace-nowrap">
                                            <Activity className="h-3 w-3" />
                                            VIX {indicators.vix.value?.toFixed(1)}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-xs z-[100] bg-neutral-900 border-neutral-800">
                                        <p>{MACRO_INFO.VIX}</p>
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-muted-foreground hover:bg-white/10 transition-colors cursor-help whitespace-nowrap">
                                            <DollarSign className="h-3 w-3" />
                                            DXY {indicators.liquidity.status}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-xs z-[100] bg-neutral-900 border-neutral-800">
                                        <p>{MACRO_INFO.DXY}</p>
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-muted-foreground hover:bg-white/10 transition-colors cursor-help whitespace-nowrap">
                                            <Cpu className="h-3 w-3" />
                                            費半 {indicators.soxx.trend}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-xs z-[100] bg-neutral-900 border-neutral-800">
                                        <p>{MACRO_INFO.SOXX}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </>
                        )}
                    </div>
                </div>

                {/* ── 主體：Split Grid ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-0 min-h-0 md:min-h-[520px]">

                    {/* ── 左側 1/3：判決與數據區 ── */}
                    <div className="md:border-r border-slate-100 dark:border-neutral-800 p-5 md:p-8 flex flex-col justify-between gap-6 md:gap-8">
                        <div className="space-y-6 md:space-y-8">
                            {/* 股票 Header Identity */}
                            <button
                                type="button"
                                onClick={onSwitchStock}
                                className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl p-3 -m-3 transition-all group text-left outline-none"
                            >
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-neutral-100 leading-none truncate">
                                    {stockName}
                                </h1>
                                <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-sm font-medium text-muted-foreground dark:text-neutral-400 tracking-widest font-mono">
                                    {tickerCode}
                                </div>
                                <Search className="h-4 w-4 shrink-0 text-slate-300 dark:text-neutral-600 group-hover:text-slate-900 dark:group-hover:text-neutral-300 transition-colors" />
                            </button>

                            {/* 股價儀表 (Visual Focus) */}
                            <PriceTicker prices={snapshot.data.prices} />

                            {/* AI 策略結論與信心 (Merged Block) */}
                            <div className="bg-slate-50 dark:bg-neutral-900/40 border border-slate-100 dark:border-neutral-800 p-4 md:p-5 rounded-2xl flex items-center justify-between shadow-inner">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">
                                        <Bot className="h-3.5 w-3.5" />
                                        AI 策略結論
                                    </div>
                                    <div className={`text-lg md:text-xl font-black ${styles.accent}`}>
                                        {playbook.verdict}
                                    </div>
                                </div>
                                <div className="text-right space-y-1">
                                    <div className="text-[10px] md:text-xs font-bold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">
                                        出手信心
                                    </div>
                                    <div className={`text-xl md:text-2xl font-black tabular-nums tracking-tighter ${
                                        snapshot.strategy.confidence >= 70 ? "text-red-600 dark:text-red-500" : 
                                        snapshot.strategy.confidence >= 50 ? "text-amber-600 dark:text-amber-500" : 
                                        "text-green-600 dark:text-green-500"
                                    }`}>
                                        {snapshot.strategy.confidence.toFixed(1)}%
                                    </div>
                                </div>
                            </div>

                            {/* 內部人動向警報 (Redesigned Bento Section) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground dark:text-neutral-500 uppercase tracking-widest">
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                        內部人動向監控
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                        </span>
                                        <span className="text-[9px] font-bold text-emerald-600/80 dark:text-emerald-400/80">系統監控中</span>
                                    </div>
                                </div>

                                {snapshot.insiderTransfers && snapshot.insiderTransfers.length > 0 ? (
                                    <div className="space-y-3">
                                        {/* LLM 戰術短評 */}
                                        {playbook.insiderComment && (
                                            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
                                                <p className="text-sm font-black leading-snug">
                                                    {playbook.insiderComment.replace(/^【內部人短評】：/, "")}
                                                </p>
                                            </div>
                                        )}

                                        {/* 轉讓列表 */}
                                        <div className="max-h-[180px] overflow-y-auto pr-1 hide-scrollbar space-y-2">
                                            {snapshot.insiderTransfers.map((item, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className={`relative overflow-hidden p-3 rounded-xl border transition-all duration-300 ${
                                                        item.type === "市場拋售" 
                                                        ? "bg-red-500/5 border-red-500/10 hover:border-red-500/30" 
                                                        : "bg-blue-400/5 border-blue-400/10 hover:border-blue-400/30"
                                                    }`}
                                                >
                                                    {/* Side color bar */}
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.type === "市場拋售" ? "bg-red-500" : "bg-blue-400"}`} />
                                                    
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">[{item.role.substring(0, 2)}]</span>
                                                                <span className="text-xs font-bold text-slate-700 dark:text-neutral-200 truncate">{item.declarer}</span>
                                                            </div>
                                                            <span className="text-[10px] font-medium text-muted-foreground opacity-50 tabular-nums">{item.date}</span>
                                                        </div>

                                                        <div className="flex items-center justify-between">
                                                            <span className={`text-[11px] font-black ${item.type === "市場拋售" ? "text-red-500" : "text-blue-400"}`}>
                                                                {item.humanMode}
                                                            </span>
                                                            <div className="text-right">
                                                                <span className="text-[11px] font-black text-slate-900 dark:text-neutral-100 tabular-nums">{item.valueText}</span>
                                                                <span className="text-[10px] text-muted-foreground ml-1 tabular-nums">({item.lots.toLocaleString()}張)</span>
                                                            </div>
                                                        </div>

                                                        {/* Progress Bar (Transfer Ratio) */}
                                                        {item.transferRatio > 0 && (
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-tighter opacity-60">
                                                                    <span>轉讓比例</span>
                                                                    <span>{(item.transferRatio * 100).toFixed(1)}%</span>
                                                                </div>
                                                                <div className="h-1 w-full bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className={`h-full rounded-full transition-all duration-1000 ${item.type === "市場拋售" ? "bg-red-500" : "bg-blue-400"}`} 
                                                                        style={{ width: `${Math.max(2, item.transferRatio * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 p-4 rounded-xl bg-slate-50/50 dark:bg-neutral-900/30 border border-slate-100 dark:border-neutral-800 text-[11px] text-muted-foreground">
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/60" />
                                        近 30 日無重大內部人拋售
                                    </div>
                                )}
                            </div>

                            {/* 極簡動態標籤 */}
                            <div className="flex flex-wrap gap-2 pt-2">
                                {snapshot.signals.flow.marginChange20D !== null && snapshot.signals.flow.marginChange20D > 0.05 && (
                                    <div className="flex items-center gap-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 text-[10px] md:text-[11px] font-bold border border-green-500/20">
                                        <TrendingUp className="h-3.5 w-3.5" />
                                        融資大增
                                    </div>
                                )}
                                {snapshot.consistency.score < 55 && (
                                    <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 text-[10px] md:text-[11px] font-bold border border-amber-500/20">
                                        <Activity className="h-3.5 w-3.5" />
                                        一致性低
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="hidden md:flex mt-8 pt-4 border-t border-slate-100 dark:border-neutral-800/50 items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-neutral-600 uppercase tracking-widest">
                            <Clock className="h-3 w-3" />
                            最後更新 {new Date().toLocaleTimeString('zh-TW', { hour12: false })}
                        </div>
                    </div>

                    {/* ── 右側 2/3：戰術沙盤區 ── */}
                    <div className="md:col-span-2 flex flex-col divide-y divide-slate-100 dark:divide-neutral-800 h-full">

                        {/* 上區塊：SOP 操作順序 */}
                        <div className="p-5 md:p-8 flex-1">
                            <div className="flex items-center gap-2 mb-4 md:mb-6">
                                <ListChecks className={`h-4 w-4 ${styles.accent}`} />
                                <span className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-widest">
                                    SOP 操作順序
                            </span>
                            </div>
                            <div className="space-y-4 md:space-y-5">
                                {playbook.actionSteps.map((step, idx) => (
                                    <div key={idx} className="flex items-start gap-3 md:gap-4 group">
                                        <div
                                            className={`mt-0.5 shrink-0 flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full text-[10px] md:text-[11px] font-black transition-all duration-300 group-hover:scale-110 ${styles.stepNumber}`}
                                        >
                                            {idx + 1}
                                        </div>
                                        <div className="flex flex-col flex-1">
                                            <p className="text-sm md:text-[15px] font-medium text-slate-700 dark:text-neutral-200 leading-snug">
                                                {step.replace(/^\d+\.\s*/, "")}
                                            </p>
                                            {idx < playbook.actionSteps.length - 1 && (
                                                <div className="mt-3 ml-[-24px] md:ml-[-28px] pl-[35px] md:pl-[39px] h-4 md:h-5 border-l-2 border-dashed border-slate-100 dark:border-neutral-800" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 中區塊：重要觀察對象 */}
                        <div className="p-5 md:p-8 flex-1">
                            <div className="flex items-center gap-2 mb-4">
                                <Eye className={`h-4 w-4 ${styles.accent}`} />
                                <span className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-widest">
                                    重要觀察對象
                                </span>
                            </div>
                            
                            <div className="flex flex-col gap-2 mt-3">
                                {playbook.watchTargets.map((target, idx) => (
                                    <div key={idx} className="flex items-start gap-3 bg-slate-50/50 dark:bg-white/5 px-4 py-3 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-white/10 group">
                                        <ArrowRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" />
                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-snug">
                                            {target}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 下區塊：AI 決策底層數據 (Mobile swipeable) */}
                        <div className="p-5 md:p-8 bg-slate-50/30 dark:bg-neutral-950/40 border-t border-slate-100 dark:border-neutral-800/50">
                            <div className="flex items-center gap-2 mb-4">
                                <Database className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] font-bold text-muted-foreground dark:text-neutral-500 uppercase tracking-wider">
                                    AI 決策底層數據
                                </span>
                            </div>
                                                    <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2.5 mt-4">
                                                        <div className="inline-flex items-center h-8 md:h-6 rounded-md px-2.5 text-[11px] font-bold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 gap-1.5 whitespace-nowrap justify-center md:justify-start">
                                                            <Globe className="h-3 w-3" />
                                                            總經 {snapshot.crashWarning?.level || "平穩"}
                                                        </div>
                                                        <div className="inline-flex items-center h-8 md:h-6 rounded-md px-2.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 gap-1.5 whitespace-nowrap justify-center md:justify-start">
                                                            <Activity className="h-3 w-3" />
                                                            籌碼 {snapshot.signals.flow.flowScore ? (snapshot.signals.flow.flowScore > 60 ? "偏多" : "中性") : "評估"}
                                                        </div>
                                                        <div className="inline-flex items-center h-8 md:h-6 rounded-md px-2.5 text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 gap-1.5 whitespace-nowrap justify-center md:justify-start">
                                                            <Shield className="h-3 w-3" />
                                                            支撐 {snapshot.keyLevels.supportLevel?.toFixed(1) ?? '--'}
                                                        </div>
                                                        <div className="inline-flex items-center h-8 md:h-6 rounded-md px-2.5 text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 gap-1.5 whitespace-nowrap justify-center md:justify-start">
                                                            <Target className="h-3 w-3" />
                                                            壓力 {snapshot.keyLevels.breakoutLevel?.toFixed(1) ?? '--'}
                                                        </div>
                                                    </div>                        </div>

                        {/* 獨立風險提示橫幅 */}
                        {(snapshot.strategy.explain.contradictions.length > 0 || snapshot.consistency.score < 55) && (
                            <div className="px-5 md:px-8 py-5 md:py-8 border-t border-slate-100 dark:border-neutral-800">
                                <div className="flex items-center gap-3 text-xs font-bold text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 rounded-xl border border-amber-200/50 dark:border-amber-500/20">
                                    <Zap className="h-4 w-4 shrink-0 fill-current" />
                                    <span>訊號分歧留意洗盤，法人由賣轉買前控管風險</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
