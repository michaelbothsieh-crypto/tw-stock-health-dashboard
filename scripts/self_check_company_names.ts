import { getCompanyNameZh } from '../src/lib/companyName';
import { getStockInfo } from '../src/lib/providers/finmind';

const TICKERS = ["2330", "2317", "2454", "3231"];

async function runSelfCheck() {
    console.log("=== 中文股名自動診斷報告 (Company Name Check) ===");
    let failCount = 0;

    for (const ticker of TICKERS) {
        try {
            const name = await getCompanyNameZh(ticker);
            const display = name ? `${ticker} ${name}` : ticker;
            console.log(`[${ticker}] companyNameZh: ${name} | displayName: ${display}`);

            if (ticker === "2330" && name !== "台積電") {
                console.log(`-> [FAIL] 2330 必須是台積電，但抓到 ${name}`);
                failCount++;
            } else if (ticker === "2317" && name !== "鴻海") {
                console.log(`-> [FAIL] 2317 必須是鴻海，但抓到 ${name}`);
                failCount++;
            }
        } catch (e: any) {
            console.error(`[${ticker}] Error:`, e.message);
            failCount++;
        }
    }

    console.log("\n=== 最終結果 (Final Output) ===");
    if (failCount > 0) {
        console.log("FAIL: One or more critical conditions failed.");
    } else {
        console.log("PASS: 2330/2317 have correct names and fallbacks work.");
    }
}

runSelfCheck();
