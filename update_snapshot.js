const fs = require('fs');
const path = require('path');

const targetPath = path.join(process.cwd(), 'src/app/api/stock/[ticker]/snapshot/route.ts');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. 匯入 redisCache
if (!content.includes('getCache')) {
  content = content.replace(
    'import { NextRequest, NextResponse } from "next/server";',
    'import { NextRequest, NextResponse } from "next/server";\nimport { getCache, setCache } from "@/lib/providers/redisCache";'
  );
}

// 2. 將核心邏輯包裝到快取機制中
// 尋找 `let norm;` 作為插入點
const fetchLogicStart = content.indexOf('const snapshotData = await fetchStockSnapshot(norm);');
const fetchLogicEnd = content.lastIndexOf('return NextResponse.json({');

if (fetchLogicStart === -1 || fetchLogicEnd === -1) {
  console.error("Could not find logic bounds");
  process.exit(1);
}

const beforeLogic = content.slice(0, fetchLogicStart);
const theLogic = content.slice(fetchLogicStart, fetchLogicEnd);
const responseObjStart = content.slice(fetchLogicEnd);

// 我們要把 Live Quote 的抓取抽離出來，放在快取判斷的外面
const liveQuoteExtraction = `
    // --- 1. 無論如何，先抓最新的即時報價 ---
    let liveQuote: { price: number; changePct: number; previousClose: number; high?: number; low?: number } | null = null;
    try {
      const { yf } = await import("@/lib/providers/yahooFinanceClient");
      const yahooSym = (norm.symbol.match(/^\\d+$/) || norm.symbol.endsWith(".TW") || norm.symbol.endsWith(".TWO"))
        ? (norm.yahoo || \`\${norm.symbol}.TW\`)
        : norm.symbol;
      const rtRaw = await yf.quote(yahooSym);
      const rt: any = Array.isArray(rtRaw) ? rtRaw[0] : rtRaw;
      if (rt && typeof rt.regularMarketPrice === "number") {
        liveQuote = {
          price: rt.regularMarketPrice,
          previousClose: rt.regularMarketPreviousClose,
          changePct: typeof rt.regularMarketChangePercent === "number"
            ? rt.regularMarketChangePercent
            : rt.regularMarketPreviousClose !== 0 ? ((rt.regularMarketPrice - rt.regularMarketPreviousClose) / rt.regularMarketPreviousClose) * 100 : 0,
          high: rt.regularMarketDayHigh,
          low: rt.regularMarketDayLow,
        };
      }
    } catch (e) {
      console.warn("[Snapshot] yahoo-finance2 live quote failed", e);
    }

    // --- 2. 檢查 Redis 快取 ---
    const cacheKey = \`snapshot:\${norm.symbol}:v2\`; // v2 區隔舊有快取
    let finalPayload: any = null;
    const cachedData = await getCache<any>(cacheKey);

    if (cachedData && !debugMode) {
      // 命中快取！覆蓋最新的即時報價
      finalPayload = cachedData;
      if (liveQuote) {
        finalPayload.realTimeQuote = {
          price: liveQuote.price,
          changePct: liveQuote.changePct,
          isRealTime: true,
          time: new Date().toISOString()
        };
        // 若需要極致精確，這裡也可以重算 cachedData.keyLevels，但為了效能與不破壞現有結構，直接回傳
      }
    } else {
      // --- 3. 快取未命中，執行重度運算 ---
`;

// 把原本 logic 裡的 liveQuote 抓取清掉，因為我們已經在外面抓了
const modifiedLogic = theLogic
  .replace(/let liveQuote: \{[\s\S]*?const realTimeChangePct = liveQuote \? liveQuote\.changePct : undefined;/m, `
    const latestClose = liveQuote ? liveQuote.price : fLatestClose;
    const realTimeChangePct = liveQuote ? liveQuote.changePct : undefined;
  `)
  .replace(/const fPrevClose = prices\.length >= 2 \? prices\[prices\.length - 2\]\.close : fLatestClose;/m, `
    const fPrevClose = liveQuote?.previousClose ?? (prices.length >= 2 ? prices[prices.length - 2].close : fLatestClose);
  `);

const endLogic = `
      finalPayload = {
`;

const responseObjEnd = responseObjStart.replace('return NextResponse.json({', '');

const completeLogic = beforeLogic + liveQuoteExtraction + modifiedLogic + endLogic + responseObjEnd.replace(/}\);\s*\} catch/, `};
      // 寫入快取 (10分鐘)
      await setCache(cacheKey, finalPayload, 600);
    } // end of cache miss

    return NextResponse.json(finalPayload);
  } catch`);

fs.writeFileSync(targetPath, completeLogic);
console.log("Patch applied successfully");
