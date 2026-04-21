
/**
 * 暫時存放尚未完全重構至 Service 的輔助函式
 */

export async function fetchTopGainers(market: "taiwan" | "america", limit = 10): Promise<Array<{ symbol: string; change: number }>> {
   const url = `https://scanner.tradingview.com/${market}/scan`;
   const filter: any[] = [
      { left: "type", operation: "equal", right: "stock" },
      { left: "change", operation: "greater", right: 0 }
   ];

   if (market === "america") {
      filter.push({ left: "market_cap_basic", operation: "greater", right: 1000000000 }); // 美股市值 > 10億
      filter.push({ left: "close", operation: "greater", right: 5 }); // 股價 > 5美元，避免水餃股
   } else {
      filter.push({ left: "market_cap_basic", operation: "greater", right: 500000000 }); // 台股市值 > 5億
      filter.push({ left: "exchange", operation: "in_range", right: ["TWSE", "TPEX"] });
   }

   const body = {
      filter,
      options: { lang: "en" },
      symbols: { query: { types: [] }, tickers: [] },
      columns: ["name", "change"],
      sort: { sortBy: "change", sortOrder: "desc" },
      range: [0, limit],
   };

   try {
      const res = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(body),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return (payload.data || []).map((item: any) => {
         const fullSymbol = item.s;
         const ticker = fullSymbol.split(":")[1] || fullSymbol;
         return {
            symbol: ticker,
            change: item.d[1],
         };
      });
   } catch { return []; }
}
