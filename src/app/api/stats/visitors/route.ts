import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/providers/redisCache";

export async function POST(req: NextRequest) {
  if (!redis) {
    return NextResponse.json({ totalVisitors: 0, onlineUsers: 0 });
  }

  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const now = Date.now();
    const FIVE_MINUTES_AGO = now - 300000;

    // 1. Total Unique Visitors (HyperLogLog)
    await redis.pfadd("site:total_visitors", sessionId);
    const totalVisitors = await redis.pfcount("site:total_visitors");

    // 2. Online Users (Sorted Set)
    await redis.zadd("site:online_users", { score: now, member: sessionId });
    
    // Cleanup inactive users
    await redis.zremrangebyscore("site:online_users", 0, FIVE_MINUTES_AGO);
    
    // Get count
    const onlineUsers = await redis.zcard("site:online_users");

    return NextResponse.json({
      totalVisitors,
      onlineUsers,
    });
  } catch (error) {
    console.error("[Stats API] Error:", error);
    return NextResponse.json({ totalVisitors: 0, onlineUsers: 0 });
  }
}
