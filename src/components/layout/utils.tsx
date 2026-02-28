import { ExplainTab, ExplainSection, MainTab } from "./types";
import { stockNameMap } from "@/i18n/zh-TW";
import { twStockNames } from "@/data/twStockNames";

export const EXPLAIN_TABS: Array<{ key: ExplainTab; label: string; description: string }> = [
  { key: "trend", label: "技術面強弱", description: "價格趨勢與技術訊號構成。" },
  { key: "flow", label: "法人動向", description: "法人(外資/投信)動能與融資籌碼(散戶)對分數的影響。融資減少(散戶退場)有助於籌碼安定，加分；反之扣分。" },
  { key: "fundamental", label: "基本體質", description: "營收與成長趨勢的分數來源。" },
  { key: "volatility", label: "波動狀態", description: "短期波動與風險敏感度。" },
  { key: "news", label: "新聞", description: "近期新聞催化方向與強度。" },
  { key: "prediction", label: "未來5日上漲機率", description: "短期上漲機率與校正結果。" },
  { key: "strategy", label: "策略", description: "策略信號、信心與規則命中。" },
  { key: "consistency", label: "訊號同向程度", description: "多因子是否同向，是否存在矛盾。" },
];

/**
 * 台股在地化色彩系統 (TWSE Color System)
 * 規則：> 0 紅色 (Red), < 0 綠色 (Green), = 0 灰色 (Slate)
 */
export function getTwseColor(value: number | null, type: 'text' | 'bg' | 'border' = 'text'): string {
  if (value === null || value === 0) {
    if (type === 'text') return "text-slate-500";
    if (type === 'bg') return "bg-slate-500/10";
    return "border-slate-500/20";
  }

  const isPositive = value > 0;
  
  if (type === 'text') {
    return isPositive ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";
  }
  if (type === 'bg') {
    return isPositive ? "bg-red-500/10" : "bg-green-500/10";
  }
  return isPositive ? "border-red-500/30" : "border-green-500/30";
}

export function formatScoreAsPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "--";
  return `${value.toFixed(1)}%`;
}

export function scoreToneClass(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "text-neutral-400";
  // 切換為台股邏輯：高分為紅，低分為綠
  if (value >= 70) return "text-red-500";
  if (value < 40) return "text-green-500";
  return "text-amber-400";
}

export function chipColorClass(score: number | null): string {
  if (score === null || Number.isNaN(score)) return "bg-neutral-600 border-neutral-700 text-neutral-400";
  // 切換為台股邏輯
  if (score >= 70) return "bg-red-500/10 border-red-500/30 text-red-400";
  if (score < 40) return "bg-green-500/10 border-green-500/30 text-green-400";
  return "bg-amber-500/10 border-amber-500/30 text-amber-400";
}

export function chipBarColorClass(score: number | null): string {
  if (score === null || Number.isNaN(score)) return "bg-neutral-600";
  // 切換為台股邏輯
  if (score >= 70) return "bg-red-500";
  if (score < 40) return "bg-green-500";
  return "bg-amber-500";
}

export function directionLabel(stance: "Bullish" | "Neutral" | "Bearish"): string {
  if (stance === "Bullish") return "偏多";
  if (stance === "Bearish") return "偏空";
  return "中性";
}

export function strategyLabel(signal: string): string {
  if (signal === "偏多") return "突破追蹤";
  if (signal === "偏空") return "反彈偏空";
  if (signal === "等待") return "等待";
  if (signal === "避開") return "觀望避險";
  return "回踩承接";
}

export function ExplainComponentsTable({ section }: { section: ExplainSection }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800">
      <div className="grid grid-cols-12 gap-2 border-b border-neutral-800 bg-neutral-900/80 px-4 py-3 text-[15px] text-neutral-300">
        <div className="col-span-5 min-w-0">項目</div>
        <div className="col-span-3 min-w-0">數值</div>
        <div className="col-span-2 min-w-0 text-right">比重</div>
        <div className="col-span-2 min-w-0 text-right">影響</div>
      </div>
      {section.components.map((row) => (
        <div key={row.key} className="grid grid-cols-12 gap-2 border-b border-neutral-900 px-4 py-3 text-[15px] text-neutral-200 last:border-b-0">
          <div className="col-span-5 min-w-0 whitespace-normal break-words">{row.label || row.key}</div>
          <div className="col-span-3 min-w-0 tabular-nums">{String(row.value ?? "--")}</div>
          <div className="col-span-2 min-w-0 text-right tabular-nums">{Number(row.weight).toFixed(2)}</div>
          <div className="col-span-2 min-w-0 text-right tabular-nums">{Number(row.contribution).toFixed(4)}</div>
        </div>
      ))}
    </div>
  );
}
