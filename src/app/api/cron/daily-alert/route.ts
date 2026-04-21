import { NextRequest, NextResponse } from "next/server";
import { getFilteredInsiderTransfers } from "@/infrastructure/providers/twseInsiderFetch";
import { fetchStockSnapshot } from "@/infrastructure/stockRouter";
import { normalizeTicker } from "@/shared/utils/ticker";
import { detectMarket } from "@/shared/utils/market";
import { calculateFlow } from "@/domain/signals/flow";
import { generatePushAlert } from "@/domain/ai/alertAgent";
import { sendTelegramAlert } from "@/infrastructure/notifications/telegram";

function getWatchlist(): string[] {
  const envVal = process.env.WATCHLIST_TW?.trim();
  if (!envVal) return [];

  try {
    const parsed = JSON.parse(envVal);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item));
  } catch (e) {
    // Fallback to CSV if not JSON
    return envVal.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export async function GET(req: NextRequest) {
  const watchList = getWatchlist();
  
  if (watchList.length === 0) {
    return NextResponse.json({ status: "skipped", reason: "WATCHLIST_TW is empty" });
  }

  try {
    const alertsSent = [];

    for (const ticker of watchList) {
      const cleanTicker = ticker.trim().toUpperCase();
      const norm = normalizeTicker(cleanTicker);
      const marketInfo = await detectMarket(norm.symbol);
      norm.market = marketInfo.market;
      norm.yahoo = marketInfo.yahoo;

      // 1. 獲取數據
      const snapshotData = await fetchStockSnapshot(norm);
      const prices = snapshotData.prices;
      if (!prices || prices.length < 2) continue;

      const investors = snapshotData.flow?.investors || [];
      const margin = snapshotData.flow?.margin || [];
      const tradingDates = (prices as any[]).map((p: any) => p.date);
      
      const flowSignals = calculateFlow(tradingDates, investors, margin);
      const insiderTransfers = marketInfo.market === "TWSE" ? await getFilteredInsiderTransfers(norm.symbol) : [];

      // 2. 核心警報邏輯
      const hasMajorInsiderSell = insiderTransfers.some(t => t.type === "市場拋售");
      const isRetailTakingKnives = flowSignals.flowVerdict === "散戶接刀 (籌碼凌亂)";

      if (hasMajorInsiderSell || isRetailTakingKnives) {
        // 3. 呼叫 AI 生成犀利文案
        const pushContent = await generatePushAlert(
          snapshotData.displayName || cleanTicker,
          cleanTicker,
          insiderTransfers.filter(t => t.type === "市場拋售"),
          { verdict: flowSignals.flowVerdict, lots: flowSignals.institutionalLots }
        );

        // 4. 送出 Telegram
        const dashboardLink = `https://tw-stock-health.vercel.app/stock/${cleanTicker}`;
        const finalMessage = `${pushContent}

<a href="${dashboardLink}">🔍 點此查看完整 AI 沙盤</a>`;
        
        await sendTelegramAlert(finalMessage);
        alertsSent.push(cleanTicker);
      }
    }

    return NextResponse.json({ success: true, alertsSent });
  } catch (error) {
    console.error("[Cron Watchlist Alert] Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
