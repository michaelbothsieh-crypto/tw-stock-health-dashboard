import fs from 'fs';
import path from 'path';

const TICKERS = ["2330", "2317", "2454"];

async function runSelfCheck() {
    console.log("=== 自動診斷報告 (Self-Check Report) ===");
    const results: Record<string, any> = {};

    for (const ticker of TICKERS) {
        console.log(`\nFetching ${ticker}...`);
        try {
            const res = await fetch(`http://localhost:3000/api/stock/${ticker}/snapshot?debug=1`);
            const json = await res.json();

            if (!res.ok) {
                console.log(`[${ticker}] Fetch failed:`, json.error || res.statusText);
                results[ticker] = { error: json.error };
                continue;
            }

            const { signals, debug } = json;
            results[ticker] = { signals, debug };

            console.log(`[${ticker}] Provider Cache Keys / Request Params:`);
            console.log(JSON.stringify(debug.request_params, null, 2));

            console.log(`[${ticker}] Flow Features: F5=${signals.flow.foreign5D}, F20=${signals.flow.foreign20D}, I5=${signals.flow.trust5D}, I20=${signals.flow.trust20D}, mchg20=${signals.flow.marginChange20D}`);
            console.log(`[${ticker}] Fundamental Features: months_count=${debug.request_params.revenue_fetched_count}, y3=${signals.fundamental.recent3MoYoyAverage}, y6=${signals.fundamental.recent6MoYoyAverage}, trend3=${signals.fundamental.yoyTrend}`);
            console.log(`[${ticker}] flowScoreRaw=${debug.flowScoreRaw}, fundamentalScoreRaw=${debug.fundamentalScoreRaw}`);

            if (signals.fundamental.fundamentalScore === null) {
                console.warn(`[${ticker}] ⚠️ fundamentalScore is null. Possible cause: data count (${debug.request_params.revenue_fetched_count}) too low or JSON parsing failed.`);
            }

        } catch (e: any) {
            console.error(`[${ticker}] Error:`, e.message);
        }
    }

    console.log("\n=== 診斷判定 (Diagnosis) ===");

    // 1. Check if cache ignores ticker
    const finmindSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/providers/finmind.ts'), 'utf-8');
    if (finmindSrc.includes('unstable_cache') && !finmindSrc.includes('${ticker}') && !finmindSrc.includes('${symbol}')) {
        console.log("-> [FAIL] 判定根因: Cache key 缺 ticker. (發現在 provider 中使用了固定 cache key)");
    } else {
        console.log("-> [PASS] Cache key 正確包含 symbol.");
    }

    // 2. Check if provider ignores ticker
    let allFlowScoresIdentical = true;
    let allFundScoresIdentical = true;
    let baselineFlow = results[TICKERS[0]]?.debug?.flowScoreRaw;
    let baselineFund = results[TICKERS[0]]?.debug?.fundamentalScoreRaw;

    let allF5Zero = true;

    for (const ticker of TICKERS) {
        if (!results[ticker]) continue;
        if (Math.abs((results[ticker].debug?.flowScoreRaw ?? -999) - (baselineFlow ?? -999)) > 0.5) allFlowScoresIdentical = false;
        if (Math.abs((results[ticker].debug?.fundamentalScoreRaw ?? -999) - (baselineFund ?? -999)) > 0.5) allFundScoresIdentical = false;
        if (results[ticker].signals?.flow?.foreign5D !== 0) allF5Zero = false;
    }

    if (allF5Zero && finmindSrc.includes('// parse error')) {
        console.log("-> [FAIL] 判定根因: Schema parse 失敗導致 fallback. (請修復 Zod 或 fallback 邏輯)");
    } else if (allF5Zero) {
        console.log("-> [FAIL] 判定根因: Provider request 沒帶對 ticker 或 Schema mapping 失敗 (例如中英文對不上導致數據全為 0).");
    }

    if (allFlowScoresIdentical && !allF5Zero) {
        console.log("-> [FAIL] 判定根因: 映射太粗 (mapping too coarse). Raw features 不同但 flowScore 完全相同.");
    }

    console.log("\n=== 最終結果 (Final Output) ===");
    if (allFlowScoresIdentical) {
        console.log("FAIL: flowScore is identical across tickers.");
    } else {
        console.log("PASS: flowScore differs across tickers.");
    }

    if (allFundScoresIdentical) {
        console.log("FAIL: fundamentalScore is identical across tickers (or all null).");
    } else {
        console.log("PASS: fundamentalScore differs across tickers.");
    }
}

runSelfCheck();
