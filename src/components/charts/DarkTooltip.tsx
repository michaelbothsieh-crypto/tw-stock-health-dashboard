"use client";

import { zhTW } from "@/i18n/zh-TW";

function formatValue(value: unknown): string {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric.toFixed(2);
  return zhTW.states.noData;
}

type DarkTooltipProps = {
  active?: boolean;
  payload?: Array<{ dataKey?: string; name?: string; value?: number | string; payload?: { volume?: number } }>;
  label?: string | number;
};

export function DarkTooltip({ active, payload, label }: DarkTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload as { volume?: number } | undefined;
  const volumeText =
    row?.volume !== undefined && Number.isFinite(Number(row.volume))
      ? Number(row.volume).toLocaleString("zh-TW")
      : zhTW.states.noData;

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900/95 p-3 text-neutral-100 shadow-xl">
      <div className="mb-2 text-sm text-neutral-400">
        {zhTW.chart.date}：{String(label)}
      </div>
      <div className="space-y-1 text-sm">
        {payload.map((entry) => (
          <div key={`${entry.dataKey}-${entry.name}`} className="flex items-center justify-between gap-3">
            <span className="text-neutral-400">{entry.name}</span>
            <span className="font-medium text-neutral-100">{formatValue(entry.value)}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-neutral-700 pt-2">
          <span className="text-neutral-400">{zhTW.chart.volume}</span>
          <span className="font-medium text-neutral-100">{volumeText}</span>
        </div>
      </div>
    </div>
  );
}
