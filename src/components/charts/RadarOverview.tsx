"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface RadarOverviewDataItem {
  label: string;
  value: number;
  note?: string;
}

function levelText(value: number): string {
  if (value >= 70) return "高";
  if (value >= 40) return "中";
  return "低";
}

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: RadarOverviewDataItem }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900/95 p-3 text-neutral-100 shadow-xl">
      <div className="text-sm font-medium">{row.label}</div>
      <div className="mt-1 text-sm text-neutral-300">分數：{row.value.toFixed(1)}</div>
      <div className="mt-1 text-sm text-neutral-400">
        等級：{levelText(row.value)}
        {row.note ? ` (${row.note})` : ""}
      </div>
    </div>
  );
}

export function RadarOverview({ data }: { data: RadarOverviewDataItem[] }) {
  return (
    <div className="h-56 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis dataKey="label" tick={{ fill: "#a3a3a3", fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#737373", fontSize: 11 }} />
          <Radar name="雷達總覽" dataKey="value" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.14} strokeWidth={1.5} />
          <Tooltip content={<RadarTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
