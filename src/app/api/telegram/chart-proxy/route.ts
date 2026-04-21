import { NextRequest, NextResponse } from "next/server";
import { getCache } from "@/infrastructure/providers/redisCache";

/**
 * 專門給 LINE 等平台讀取暫存在 Redis 中的圖表 Buffer
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cacheId = searchParams.get("id");

  if (!cacheId) {
    return new NextResponse("Missing ID", { status: 400 });
  }

  try {
    const base64 = await getCache<string>(`line:chart:${cacheId}`);
    if (!base64) {
      return new NextResponse("Chart expired or not found", { status: 404 });
    }

    const buffer = Buffer.from(base64, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
