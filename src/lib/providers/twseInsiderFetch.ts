import { subDays, format } from "date-fns";

export interface InsiderTransfer {
  date: string;
  declarer: string;
  role: string;
  transferMode: string;
  humanMode: string;
  type: "市場拋售" | "持股調整" | "其他";
  lots: number;
  valueText: string;
  estimatedValue: number;
  currentHoldings: number;
  transferRatio: number; // 轉讓佔持股比例 (0-1)
}

/**
 * 獲取並過濾重大內部人申報轉讓 (門檻 1000 萬)
 * 修復：修正 TWSE OpenAPI 欄位 Key 值，擴大搜尋窗口至 60 天，並優化身分判斷
 */
export async function getFilteredInsiderTransfers(ticker: string): Promise<InsiderTransfer[]> {
  try {
    // 1. 同步抓取最新報表與收盤價
    const [transfersRes, pricesRes] = await Promise.all([
      fetch("https://openapi.twse.com.tw/v1/opendata/t187ap12_L", { next: { revalidate: 3600 } }),
      fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL", { next: { revalidate: 3600 } })
    ]);

    if (!transfersRes.ok || !pricesRes.ok) return [];

    const rawTransfers = await transfersRes.json();
    const rawPrices = await pricesRes.json();

    // 2. 建立股價快速索引 (Key: 股票代號, Value: 收盤價)
    const priceMap = new Map<string, number>();
    if (Array.isArray(rawPrices)) {
      rawPrices.forEach((p: any) => {
        const priceStr = p["ClosingPrice"] || p["收盤價"] || "0";
        const code = p["Code"] || p["證券代號"];
        const price = parseFloat(priceStr.replace(/,/g, ""));
        if (!isNaN(price) && code) priceMap.set(code, price);
      });
    }

    const currentPrice = priceMap.get(ticker) || 0;
    const sixtyDaysAgo = subDays(new Date(), 60);

    if (!Array.isArray(rawTransfers)) return [];

    // 3. 解析並過濾
    const liveRecords: InsiderTransfer[] = rawTransfers
      .filter((item: any) => item["公司代號"] === ticker)
      .map((item: any) => {
        const declarer = item["姓名"] || item["申報人姓名"] || "未知";
        const role = item["申報人身分"] || item["身分"] || item["申報人身份"] || "內部人";
        const mode = item["預定轉讓方式及股數-轉讓方式"] || item["轉讓方式"] || "";
        const sharesStr = item["預定轉讓方式及股數-轉讓股數"] || item["申報股數"] || "0";
        const holdingsStr = item["目前持股"] || "0";
        const dateRaw = item["出表日期"] || item["申報日期"] || "";

        // 日期轉換
        let adDate = "";
        if (dateRaw && dateRaw.length === 7) {
          try {
            const year = parseInt(dateRaw.substring(0, 3)) + 1911;
            const month = dateRaw.substring(3, 5);
            const day = dateRaw.substring(5, 7);
            adDate = `${year}/${month}/${day}`;
          } catch (e) {
            adDate = format(new Date(), "yyyy/MM/dd");
          }
        } else {
          adDate = dateRaw || format(new Date(), "yyyy/MM/dd");
        }

        const shares = parseInt(sharesStr.replace(/,/g, ""));
        const holdings = parseInt(holdingsStr.replace(/,/g, ""));
        const lots = Math.round(shares / 1000);
        const estimatedValue = shares * currentPrice;
        
        let type: "市場拋售" | "持股調整" | "其他" = "其他";
        let humanMode = mode;
        if (mode.includes("一般交易")) {
          type = "市場拋售";
          humanMode = "⚠️ 市場拋售 (賣出)";
        } else if (mode.includes("鉅額")) {
          type = "市場拋售";
          humanMode = "盤後大筆轉讓 (賣出)";
        } else if (mode.includes("信託") || mode.includes("贈與")) {
          type = "持股調整";
          humanMode = "持股結構調整 (中性)";
        }

        let valueText = "";
        if (estimatedValue >= 100000000) {
          valueText = `${(estimatedValue / 100000000).toFixed(1)}億`;
        } else {
          valueText = `${Math.round(estimatedValue / 10000)}萬`;
        }

        const transferRatio = holdings > 0 ? shares / holdings : 0;

        return {
          date: adDate,
          declarer,
          role,
          transferMode: mode,
          humanMode,
          type,
          lots,
          valueText,
          estimatedValue,
          currentHoldings: holdings,
          transferRatio: Math.min(1, transferRatio)
        };
      })
      .filter(item => {
        const d = new Date(item.date);
        return d >= sixtyDaysAgo && item.estimatedValue >= 10000000;
      });

    return liveRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error("[Insider Fetch] Critical Error:", error);
    return [];
  }
}
