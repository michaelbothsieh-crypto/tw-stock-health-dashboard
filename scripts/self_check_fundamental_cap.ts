import fs from 'fs';
import path from 'path';

const TICKERS = ["2330", "2317", "2454", "3231"];

async function runSelfCheck() {
    console.log("=== 基本面分數自動診斷報告 (Fundamental Score Cap Check) ===");
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

            const fundScore = signals.fundamental.fundamentalScore;

            console.log(`[${ticker}] Fundamental Features:`);
            console.log(`  months_count=${debug.request_params.revenue_fetched_count}`);
            console.log(`  y3=${signals.fundamental.recent3MoYoyAverage}`);
            console.log(`  y6=${signals.fundamental.recent6MoYoyAverage}`);
            console.log(`  trend3=${signals.fundamental.yoyTrend}`);
            console.log(`  score=${fundScore}`);
            console.log(`  capped (>=99.5)? ${fundScore >= 99.5}`);

            if (fundScore === null) {
                console.warn(`[${ticker}] ⚠️ fundamentalScore is null. Data count (${debug.request_params.revenue_fetched_count}) may be too low.`);
            }

        } catch (e: any) {
            console.error(`[${ticker}] Error:`, e.message);
        }
    }

    console.log("\n=== 潛在異常根因診斷 (Diagnostics) ===");

    // Determine suspects
    const suspects: string[] = [];
    let anyCapped = false;
    let allIdentical = true;
    let baselineFund = results[TICKERS[0]]?.signals?.fundamental?.fundamentalScore;
    let nullCount = 0;

    for (const ticker of TICKERS) {
        const score = results[ticker]?.signals?.fundamental?.fundamentalScore;
        if (score >= 99.5) anyCapped = true;
        if (score !== null && baselineFund !== null && Math.abs((score ?? -999) - (baselineFund ?? -999)) > 1.0) {
            allIdentical = false;
        }
        if (score === null) nullCount++;
    }

    if (anyCapped) {
        suspects.push("base + accel + consistency 加總超過 100 被 clamp。");
        suspects.push("yoy 單位可能錯誤 (如 0.25 被當成 25% 或直接乘以 100 兩次) 導致 base 過大。");
    }

    if (allIdentical && nullCount !== TICKERS.length) {
        suspects.push("分數映射太激進或區間太粗 (例如只要 y3>0 就給高分)。");
    }

    if (nullCount >= TICKERS.length - 1) {
        suspects.push("多數回傳 null: 資料抓取不足 18 個月、schema parse 失敗吞掉、或 fallback 值給錯。");
    }

    if (suspects.length > 0) {
        console.log("Suspects:");
        suspects.forEach(s => console.log(` - ${s}`));

        console.log("\n建議修復策略:");
        console.log(" - 將分數模型改成 tanh(y3/25) 形式的連續映射，設定絕對上限 95");
        console.log(" - 確保原始資料 YoY 皆統一為百分比 (例如 +12.3 代表 12.3%)");
        console.log(" - accel / consistency 分別加入合理 clamp 上下限");
    } else {
        console.log("-> 分數與映射看起來正常。無明顯根因嫌疑犯。");
    }

    console.log("\n=== 最終結果 (Final Output) ===");
    if (anyCapped) {
        console.log("FAIL: fundamentalScore reaches 100 (or >= 99.5).");
    } else {
        console.log("PASS: no fundamentalScore reaches 100.");
    }

    if (allIdentical && nullCount < TICKERS.length) {
        console.log("FAIL: fundamentalScore is identical across tickers (gap < 1.0).");
    } else {
        console.log("PASS: fundamentalScore differs across tickers.");
    }

    if (nullCount >= TICKERS.length - 1) {
        console.log("FAIL: majority of fundamentalScores are null.");
    } else {
        console.log("PASS: acceptable null data handling.");
    }
}

runSelfCheck();
