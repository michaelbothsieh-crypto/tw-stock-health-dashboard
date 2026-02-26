"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { DarkTooltip } from "@/components/charts/DarkTooltip";
import { zhTW } from "@/i18n/zh-TW";

interface ChartPoint {
  date: string;
  close: number;
  volume?: number;
}

interface ChartProps {
  data: ChartPoint[];
  keyLevels?: {
    breakoutLevel: number | null;
    supportLevel: number | null;
    invalidationLevel: number | null;
  };
}

function truncate2(value: number): number {
  return Math.trunc(value * 100) / 100;
}

function calculateSma(series: number[], period: number): Array<number | null> {
  return series.map((_, index) => {
    if (index + 1 < period) return null;
    const window = series.slice(index + 1 - period, index + 1);
    const sum = window.reduce((acc, value) => acc + value, 0);
    return truncate2(sum / period);
  });
}

function formatLineValue(value: number | null): string {
  if (value === null) return zhTW.states.noData;
  return truncate2(value).toFixed(2);
}

export function StockChart({ data, keyLevels }: ChartProps) {
  if (!data || data.length === 0) {
    return <div className="py-8 text-center text-base text-neutral-400">{zhTW.chart.noPrice}</div>;
  }

  const closes = data.map((item) => item.close);
  const sma20 = calculateSma(closes, 20);
  const sma60 = calculateSma(closes, 60);

  const latestClose = closes[closes.length - 1] ?? null;
  const latestSma20 = sma20[sma20.length - 1] ?? null;
  const latestSma60 = sma60[sma60.length - 1] ?? null;

  const chartData = data.map((item, index) => ({
    ...item,
    sma20: sma20[index],
    sma60: sma60[index],
    volume: item.volume,
  }));

  return (
    <div className="mt-1 w-full space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-sm lg:text-base">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> {zhTW.chart.close}：{formatLineValue(latestClose)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> {zhTW.chart.sma20}：{formatLineValue(latestSma20)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-teal-400" /> {zhTW.chart.sma60}：{formatLineValue(latestSma60)}
        </span>
      </div>

      <div className="h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 40, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tickFormatter={(tick) => tick.slice(5)} minTickGap={22} />
            <YAxis width={58} domain={["auto", "auto"]} tickFormatter={(value) => formatLineValue(Number(value))} />
            <Tooltip content={<DarkTooltip />} />
            <Legend />
            {keyLevels?.breakoutLevel && (
               <ReferenceLine y={keyLevels.breakoutLevel} stroke="#10b981" strokeDasharray="4 4" label={{ position: 'right', value: '轉強', fill: '#10b981', fontSize: 12 }} />
            )}
            {keyLevels?.supportLevel && (
               <ReferenceLine y={keyLevels.supportLevel} stroke="#f59e0b" strokeDasharray="4 4" label={{ position: 'right', value: '支撐', fill: '#f59e0b', fontSize: 12 }} />
            )}
            {keyLevels?.invalidationLevel && (
               <ReferenceLine y={keyLevels.invalidationLevel} stroke="#f43f5e" strokeDasharray="4 4" label={{ position: 'right', value: '失效', fill: '#f43f5e', fontSize: 12 }} />
            )}
            <Line type="monotone" dataKey="close" name={zhTW.chart.close} stroke="#3b82f6" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="sma20" name={zhTW.chart.sma20} stroke="#f59e0b" dot={false} strokeWidth={1.8} />
            <Line type="monotone" dataKey="sma60" name={zhTW.chart.sma60} stroke="#2dd4bf" dot={false} strokeWidth={1.8} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
