import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config(); // fallback to .env just in case

const TICKERS = ["2330", "2317"];

async function runSelfCheck() {
    console.log("=== 測試開始: 檢查新聞抓取邏輯 (含 v3/v4 備援) ===");

    let failCount = 0;

    for (const ticker of TICKERS) {
        console.log(`\n[檢查] 標的: ${ticker}`);

        try {
            const { getTaiwanStockNews } = require('../src/lib/providers/finmind');
            const { calculateCatalystScore } = require('../src/lib/news/catalystScore');
            const { format, subDays } = require('date-fns');

            const now = new Date();
            const startStr = format(subDays(now, 7), 'yyyy-MM-dd');
            const endStr = format(now, 'yyyy-MM-dd');

            console.log(`-> 呼叫: getTaiwanStockNews('${ticker}', '${startStr}', '${endStr}')`);

            const result = await getTaiwanStockNews(ticker, startStr, endStr);
            console.log(`-> API 正常回傳，沒有被 400 擋死。`);
            console.log(`-> 實際觸發的備援策略: ${result.fallback_used || '無 (原本的 v3 就成功了)'}`);
            console.log(`-> 總共抓到 ${result.data.length} 筆新聞`);

            const catalyst = await calculateCatalystScore(ticker, result.data);

            const isTimelineArray = Array.isArray(catalyst.timeline);
            const isScoreNumber = typeof catalyst.catalystScore === 'number';

            console.log(`-> timeline 格式是否正確解析為陣列？ ${isTimelineArray ? '是' : '否'}`);
            console.log(`-> catalystScore 是否為數字？ ${isScoreNumber ? '是' : '否'} (當前數值: ${catalyst.catalystScore})`);

            if (!isTimelineArray) {
                console.error(`[失敗] ${ticker} 解析 timeline 失敗，目前型別不是陣列。`);
                failCount++;
            }
            if (!isScoreNumber) {
                console.error(`[失敗] ${ticker} 算出來的 catalystScore 不是數字。`);
                failCount++;
            }

        } catch (e: any) {
            console.error(`[錯誤] ${ticker} 抓取或運算時發生例外:`, e.message);
            failCount++;
            if (e.message.includes('400')) {
                console.error(`-> 警告：踩到了 HTTP 400 錯誤！`);
            }
        }
    }

    console.log("\n=== 測試結束 ===");
    if (failCount > 0) {
        console.error(`[結果] 總共抓到 ${failCount} 個錯誤。`);
        process.exit(1);
    } else {
        console.log(`[結果] All pass! 沒有遇到 HTTP 400 地雷，型別也都正常。`);
    }
}

runSelfCheck();
