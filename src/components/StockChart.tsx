"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

interface ChartProps {
    data: { date: string; close: number }[];
}

export function StockChart({ data }: ChartProps) {
    if (!data || data.length === 0) return <div>暫無股價圖表資料。</div>;

    return (
        <div className="h-64 sm:h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(tick) => tick.substring(5)}
                        minTickGap={30}
                    />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line
                        type="monotone"
                        dataKey="close"
                        stroke="#8884d8"
                        dot={false}
                        strokeWidth={2}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
