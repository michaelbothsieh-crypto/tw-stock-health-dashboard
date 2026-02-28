import { NextRequest, NextResponse } from "next/server";
import { getFilteredInsiderTransfers } from "@/lib/providers/twseInsiderFetch";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  }

  try {
    const data = await getFilteredInsiderTransfers(ticker.toUpperCase());
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Insider API] Error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
