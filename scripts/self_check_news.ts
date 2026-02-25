import { getTaiwanStockNews } from '../src/lib/providers/finmind';
import { calculateCatalystScore } from '../src/lib/news/catalystScore';

const TICKERS = ["2330", "2317", "2454"];

async function runSelfCheck() {
    console.log("=== 新聞與快訊自動診斷報告 (News Catalyst Check) ===");
    let failCount = 0;

    const newsData: Record<string, any[]> = {};

    for (const ticker of TICKERS) {
        console.log(`\nFetching ${ticker}...`);
        try {
            const res = await fetch(`http://localhost:3000/api/stock/${ticker}/snapshot`);
            const json = await res.json();

            if (!res.ok) {
                console.log(`[${ticker}] Fetch failed:`, json.error || res.statusText);
                failCount++;
                continue;
            }

            const catalyst = json.news;
            newsData[ticker] = catalyst.timeline || [];

            console.log(`[${ticker}] API array length: ${newsData[ticker].length}`);
            console.log(`[${ticker}] catalystScore (number expected): ${catalyst.catalystScore} (${typeof catalyst.catalystScore})`);
            console.log(`[${ticker}] timeline is array? ${Array.isArray(catalyst.timeline)} (${(catalyst.timeline || []).length} items)`);

            if (typeof catalyst.catalystScore !== 'number') {
                console.log(`-> [FAIL] catalystScore is not a number.`);
                failCount++;
            }
            if (!Array.isArray(catalyst.timeline)) {
                console.log(`-> [FAIL] timeline is not an array.`);
                failCount++;
            }

        } catch (e: any) {
            console.error(`[${ticker}] Error:`, e.message);
            failCount++;
        }
    }

    console.log("\n=== 跨股重複驗證 (Cross-Ticker Duplication Check) ===");
    const t1 = newsData["2330"];
    const t2 = newsData["2317"];
    const t3 = newsData["2454"];

    if (t1 && t2 && t3 && t1.length > 0 && t2.length > 0 && t3.length > 0) {
        const t1Title = t1[0].title;
        const t2Title = t2[0].title;
        const t3Title = t3[0].title;

        if (t1Title === t2Title && t2Title === t3Title) {
            console.log("-> [FAIL] 2330, 2317, 2454 新聞完全相同，極大機率是 Cache Key 共用錯誤。");
            failCount++;
        } else {
            console.log("-> [PASS] 各檔股票新聞標題不同，Cache 切分正確。");
        }
    } else {
        console.log("-> [PASS] 新聞數量不同或部分為空，沒有全部相同的情況。");
    }

    console.log("\n=== 最終結果 (Final Output) ===");
    if (failCount > 0) {
        console.log("FAIL: One or more news conditions failed.");
    } else {
        console.log("PASS: News fetched correctly with distinct API endpoints.");
    }
}

runSelfCheck();
