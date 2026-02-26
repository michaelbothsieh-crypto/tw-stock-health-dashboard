import { NextResponse } from "next/server";
import { getMarketIndicators } from "@/lib/providers/marketIndicators";
import { evaluateCrashWarning } from "@/lib/global/crash/crashEngine";

// Using edge/server with revalidate to avoid spamming Yahoo
export const revalidate = 3600; // 1 hour

export async function GET() {
  try {
    const symbols = ["^VIX", "^MOVE", "SOXX", "QQQ", "DX-Y.NYB", "JPY=X"];
    
    const marketData = await getMarketIndicators({ symbols, rangeDays: 65 });
    const crashWarning = evaluateCrashWarning(marketData);

    return NextResponse.json({ crashWarning });
  } catch (error) {
    console.error("Crash Engine Error:", error);
    return NextResponse.json({ error: "Failed to compute crash warning" }, { status: 500 });
  }
}