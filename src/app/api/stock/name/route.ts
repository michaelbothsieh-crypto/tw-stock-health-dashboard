import { NextRequest, NextResponse } from "next/server";
import { twStockNames } from "@/data/twStockNames";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const upperCode = code.toUpperCase();

  // Fallback map
  if (twStockNames[upperCode]) {
    return NextResponse.json({ name: twStockNames[upperCode] });
  }
  
  try {
    const isUS = /^[A-Z]+$/.test(upperCode);
    let symbol = upperCode;
    
    if (!isUS) {
      // For TW stocks, default to .TW
      symbol = `${upperCode}.TW`;
    }

    let quote = await yahooFinance.quote(symbol).catch(() => null);
    
    // If not found and it's a potential TW stock, try .TWO
    if (!quote && !isUS) {
      quote = await yahooFinance.quote(`${upperCode}.TWO`).catch(() => null);
    }

    if (quote) {
      const name = quote.longName || quote.shortName || "未知公司";
      return NextResponse.json({ name });
    }
  } catch (e) {
    console.error(`[Name API] Error for ${upperCode}:`, e);
  }
  
  // Last resort
  return NextResponse.json({ name: "未知公司" });
}
