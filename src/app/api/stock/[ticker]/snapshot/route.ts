
import { NextRequest, NextResponse } from "next/server";
import { SnapshotService } from "@/services/SnapshotService";

export const dynamic = "force-dynamic";

/**
 * 股票健康檢查快照 API (重構後遵循 SOLID 原則)
 * 核心邏輯已搬移至 SnapshotService，此處僅作為 API 介面層
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params;
    const debug = req.nextUrl.searchParams.get("debug") === "1";
    const mode = (req.nextUrl.searchParams.get("mode") as "full" | "lite") || "full";

    const snapshot = await SnapshotService.getSnapshot(ticker, { debug, mode });
    
    return NextResponse.json(snapshot, {
      headers: {
        // Keep repeat visits fast while allowing the CDN to refresh stock data in the background.
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      },
    });
  } catch (error: unknown) {
    console.error("[API] Snapshot Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
