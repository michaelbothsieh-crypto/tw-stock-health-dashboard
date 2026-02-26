import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  tickers: z.array(z.string()),
});

declare global {
  // eslint-disable-next-line no-var
  var _latestReport: unknown;
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

    const reports: any[] = [];

    for (const ticker of tickers) {
      try {
        const res = await fetch(`${baseUrl}/api/stock/${ticker}/snapshot`);
        if (res.ok) {
          const snapshot = await res.json();
          reports.push(snapshot);
        }
      } catch (error) {
        console.error(`Failed to fetch report for ${ticker}`, error);
      }
    }

    let markdown = `# 每日台股健康報告 (${new Date().toISOString().split("T")[0]})\n\n`;

    for (const report of reports) {
      const symbol = report?.normalizedTicker?.symbol || report?.normalizedTicker?.display || "N/A";
      const ai = report?.aiSummary ?? {};

      markdown += `## ${symbol}\n`;
      markdown += `**AI 判定**: ${ai.stance ?? "Neutral"} (信心: ${Number(ai.confidence ?? 0).toFixed(1)}%)\n\n`;

      markdown += `### 三大分數\n`;
      markdown += `- **Trend**: ${report?.signals?.trend?.trendScore ?? "N/A"}\n`;
      markdown += `- **Flow**: ${report?.signals?.flow?.flowScore ?? "N/A"}\n`;
      markdown += `- **Fundamental**: ${report?.signals?.fundamental?.fundamentalScore ?? "N/A"}\n\n`;

      markdown += `### 主要依據\n`;
      const keyPoints = Array.isArray(ai.keyPoints) ? ai.keyPoints : [];
      keyPoints.forEach((point: string) => {
        markdown += `- ${point}\n`;
      });
      markdown += "\n";

      const risks = Array.isArray(ai.risks) ? ai.risks : [];
      if (risks.length > 0) {
        markdown += `### 風險提示\n`;
        risks.forEach((risk: string) => {
          markdown += `- ${risk}\n`;
        });
        markdown += "\n";
      }

      markdown += "---\n\n";
    }

    const reportPayload = {
      date: new Date().toISOString(),
      tickers,
      reports,
      markdown,
    };

    global._latestReport = reportPayload;

    return NextResponse.json({ success: true, message: "Report generated", payload: reportPayload });
  } catch (error: unknown) {
    console.error("Daily Report Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
