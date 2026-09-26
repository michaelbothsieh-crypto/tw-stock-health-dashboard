import { useQuery } from "@tanstack/react-query";
import { mapErrorCodeToZh } from "@/i18n/zh-TW";

import { isMarketOpen } from "@/shared/utils/market";

export function useStockSnapshot(ticker: string) {
  const normalizedTicker = ticker.toUpperCase();
  const liteQuery = useQuery({
    queryKey: ["stockSnapshot", normalizedTicker, "lite"],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${normalizedTicker}/snapshot?mode=lite`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const errorCode = body?.errorCode ?? null;
        const fallbackMessage = typeof body?.error === "string" ? body.error : "資料載入失敗";
        const message = errorCode ? mapErrorCodeToZh(errorCode) : fallbackMessage;
        throw new Error(message);
      }
      return body;
    },
    enabled: !!normalizedTicker,
    staleTime: 25_000,
  });

  const fullQuery = useQuery({
    queryKey: ["stockSnapshot", normalizedTicker, "full"],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${normalizedTicker}/snapshot?mode=full`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : "完整分析載入失敗");
      return body;
    },
    enabled: !!liteQuery.data,
    refetchInterval: isMarketOpen(normalizedTicker) ? 30_000 : false,
    staleTime: 25_000,
  });

  return {
    ...liteQuery,
    data: fullQuery.data ?? liteQuery.data,
    isLoading: liteQuery.isLoading,
    isError: !liteQuery.data && liteQuery.isError,
    error: liteQuery.error,
  };
}
