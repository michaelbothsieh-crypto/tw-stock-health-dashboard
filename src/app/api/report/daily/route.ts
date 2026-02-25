import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
// We will reuse the logic from the snapshot to build the daily report.
// In a real app we might modularize snapshot logic, but for now we fetch same endpoints.

const BodySchema = z.object({
    tickers: z.array(z.string()),
});

// 暫存機制 (因為展示版沒有持久化，先用 global variable 存起來)
declare global {
    var _latestReport: any;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = BodySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        const { tickers } = parsed.data;
        const protocol = req.headers.get("x-forwarded-proto") || "http";
        const host = req.headers.get("host") || "localhost:3000";
        const baseUrl = `${protocol}://${host}`;

        const reports = [];

        for (const ticker of tickers) {
            try {
                const res = await fetch(`${baseUrl}/api/stock/${ticker}/snapshot`);
                if (res.ok) {
                    const snapshot = await res.json();
                    reports.push(snapshot);
                }
            } catch (err) {
                console.error(`Failed to fetch report for ${ticker}`, err);
            }
        }

        // Generate Markdown payload
        let markdown = `# 每日台股健康檢查報告 (${new Date().toISOString().split('T')[0]})\n\n`;

        for (const report of reports) {
            markdown += `## ${report.ticker}\n`;
            markdown += `**AI 綜合判定**: ${report.explain.stance} (信心: ${report.explain.confidence}%)\n\n`;
            markdown += `### 分析摘要\n${report.explain.summary}\n\n`;

            markdown += `### 關鍵指標\n`;
            markdown += `- **技術面 (Trend)**: ${report.signals.trend.trendScore} 分\n`;
            markdown += `- **籌碼面 (Flow)**: ${report.signals.flow.flowScore} 分\n`;
            markdown += `- **基本面 (Fundamental)**: ${report.signals.fundamental.fundamentalScore} 分\n\n`;

            markdown += `### 主要原因\n`;
            report.explain.key_points.forEach((rk: string) => {
                markdown += `- ${rk}\n`;
            });
            markdown += `\n`;

            if (report.explain.risks.length > 0) {
                markdown += `### 潛在風險\n`;
                report.explain.risks.forEach((rk: string) => {
                    markdown += `- ${rk}\n`;
                });
                markdown += `\n`;
            }

            markdown += `---\n\n`;
        }

        const reportPayload = {
            date: new Date().toISOString(),
            tickers,
            reports,
            markdown
        };

        // 儲存到 Memory 供 latest 使用
        global._latestReport = reportPayload;

        return NextResponse.json({ success: true, message: "Report generated", payload: reportPayload });
    } catch (error: any) {
        console.error("Daily Report Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
