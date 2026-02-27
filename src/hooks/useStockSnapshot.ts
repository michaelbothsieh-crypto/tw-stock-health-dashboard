import { useQuery } from "@tanstack/react-query";
import { mapErrorCodeToZh } from "@/i18n/zh-TW";

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
  });
}
