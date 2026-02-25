import { getPriceDaily, PriceDaily } from './providers/finmind';

export interface FetchRangeResult {
    data: PriceDaily[];
    barsRequested: number;
    barsReturned: number;
    endDate: string;
}

function formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function fetchRecentBars(
    symbol: string,
    targetBars: number = 180
): Promise<FetchRangeResult> {
    let fetchCalendarDays = 365;
    const maxRetries = 2; // 最多重試 2 次
    let retryCount = 0;
    const maxDaysCap = 900; // 上限 900 天

    let validData: PriceDaily[] = [];
    let currentEndDateStr = '';

    while (retryCount <= maxRetries) {
        // 使用當時日期作為終點 (Asia/Taipei 的時間對應，在此可用系統日期近似)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - fetchCalendarDays);

        const startStr = formatDateToYYYYMMDD(startDate);
        const endStr = formatDateToYYYYMMDD(endDate);
        currentEndDateStr = endStr;

        try {
            const rawData = await getPriceDaily(symbol, startStr, endStr);

            // 排序與過濾
            const sortedAndFiltered = rawData
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .filter(d => typeof d.close === 'number');

            if (sortedAndFiltered.length >= targetBars) {
                validData = sortedAndFiltered;
                break;
            } else {
                // 不足 targetBars，記錄下來，準備放大檢查範圍
                validData = sortedAndFiltered;
            }
        } catch (error) {
            console.error(`Failed to fetch data for ${symbol} with range ${startStr} to ${endStr}:`, error);
            // 如果 API 報錯，視為嚴重問題不一定重試，但為了容錯我們當作拿到 0 筆，繼續重試或中斷
        }

        retryCount++;
        fetchCalendarDays *= 2;
        if (fetchCalendarDays > maxDaysCap) {
            fetchCalendarDays = maxDaysCap;
        }

        // 如果次數滿了或是天數到達上限 (第二次重試如果是 730，第三次如果設定滿900) 
        // 其實最多 2 次重試代表最多嘗試 3 次 (365, 730, 900)
    }

    // 取最後 targetBars 筆
    const finalData = validData.slice(-targetBars);

    return {
        data: finalData,
        barsRequested: targetBars,
        barsReturned: finalData.length,
        endDate: currentEndDateStr
    };
}
