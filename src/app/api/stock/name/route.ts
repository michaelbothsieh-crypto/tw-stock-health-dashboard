
import { NextRequest, NextResponse } from "next/server";
import { twStockNames } from "@/data/twStockNames";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // Fallback map
  if (twStockNames[code]) {
    return NextResponse.json({ name: twStockNames[code] });
  }
  
  try {
    // Try Yahoo as a reliable name source
    const symbol = `${code}.TW`; // simplified, could be TWO
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
    if (res.ok) {
       const data = await res.json();
       const meta = data?.chart?.result?.[0]?.meta;
       if (meta && meta.shortName) {
          // Clean up "台積電" from something like "Taiwan Semiconductor..." 
          // Actually Yahoo TW often returns english for name if not local,
          // Let's rely on FinMind if possible, but FinMind /TaiwanStockInfo is an option
          return NextResponse.json({ name: meta.shortName });
       }
    }
  } catch (e) {
    console.error(e);
  }
  
  // Last resort
  return NextResponse.json({ name: "未知公司" });
}
