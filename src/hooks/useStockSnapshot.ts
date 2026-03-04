import { useQuery } from "@tanstack/react-query";
import { mapErrorCodeToZh } from "@/i18n/zh-TW";

/** 判斷目前對應市場是否在交易時段 */
function isMarketOpen(ticker: string): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const isTW = /^\d{4,5}$/.test(ticker) || /\.(TW|TWO)$/i.test(ticker);

  if (isTW) {
    // 台股：9:00–13:30 CST = 01:00–05:30 UTC
    return utcMins >= 60 && utcMins <= 330;
  } else {
    // 美股：9:30–16:00 ET ≈ 13:30–21:00 UTC（含夏令/冬令寬裕）
    return utcMins >= 810 && utcMins <= 1260;
  }
}

export function useStockSnapshot(ticker: string) {
  return useQuery({
    queryKey: ["stockSnapshot", ticker.toUpperCase()],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker.toUpperCase()}/snapshot`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const errorCode = body?.errorCode ?? null;
        const fallbackMessage = typeof body?.error === "string" ? body.error : "資料載入失敗";
        const message = errorCode ? mapErrorCodeToZh(errorCode) : fallbackMessage;
        throw new Error(message);
      }
      return body;
    },
    enabled: !!ticker,
    refetchInterval: isMarketOpen(ticker) ? 30_000 : false,
    staleTime: 25_000,
  });
}
