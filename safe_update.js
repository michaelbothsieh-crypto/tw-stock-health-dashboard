const fs = require('fs');
const path = require('path');

const targetPath = path.join(process.cwd(), 'src/app/api/stock/[ticker]/snapshot/route.ts');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add Redis import
if (!content.includes('import { getCache, setCache }')) {
  content = content.replace(
    'import { NextRequest, NextResponse } from "next/server";',
    'import { NextRequest, NextResponse } from "next/server";\nimport { getCache, setCache } from "@/lib/providers/redisCache";'
  );
}

// 2. Inject early liveQuote and cache logic
const injectionPoint1 = 'if (norm.market === "UNKNOWN") warnings.push("market_unknown");';
const cacheLogic = `
    // --- 1. 無論如何，先抓最新的即時報價 ---
    let liveQuote: { price: number; changePct: number; previousClose: number; high?: number; low?: number } | null = null;
    try {
      const { yf } = await import("@/lib/providers/yahooFinanceClient");
      const yahooSym = isTaiwanStock(norm.symbol)
        ? (norm.yahoo || \`\${norm.symbol}.TW\`)
        : norm.symbol;
      const rtRaw = await yf.quote(yahooSym);
      const rt: any = Array.isArray(rtRaw) ? rtRaw[0] : rtRaw;
      if (rt && typeof rt.regularMarketPrice === "number") {
        liveQuote = {
          price: rt.regularMarketPrice,
          previousClose: rt.regularMarketPreviousClose || 0, // Fallback updated later
          changePct: typeof rt.regularMarketChangePercent === "number"
            ? rt.regularMarketChangePercent
            : rt.regularMarketPreviousClose ? ((rt.regularMarketPrice - rt.regularMarketPreviousClose) / rt.regularMarketPreviousClose) * 100 : 0,
          high: rt.regularMarketDayHigh,
          low: rt.regularMarketDayLow,
        };
      }
    } catch (e) {
      console.warn("[Snapshot] yahoo-finance2 live quote failed", e);
    }

    // --- 2. 檢查 Redis 快取 ---
    const cacheKey = \`snapshot:\${norm.symbol}:v2\`; // v2 區隔舊有快取
    if (!debugMode) {
      const cachedData = await getCache<any>(cacheKey);
      if (cachedData) {
        // 命中快取！覆蓋最新的即時報價
        if (liveQuote) {
          cachedData.realTimeQuote = {
            price: liveQuote.price,
            changePct: liveQuote.changePct,
            isRealTime: true,
            time: new Date().toISOString()
          };
        }
        return NextResponse.json(cachedData);
      }
    }
`;
content = content.replace(injectionPoint1, injectionPoint1 + '\n' + cacheLogic);

// 3. Remove old liveQuote logic
const oldLiveQuoteRegex = /const fPrevClose = prices\.length >= 2 \? prices\[prices\.length - 2\]\.close : fLatestClose;\s*let liveQuote: \{[\s\S]*?const realTimeChangePct = liveQuote \? liveQuote\.changePct : undefined;/;

const newLiveQuoteLogic = `const fPrevClose = prices.length >= 2 ? prices[prices.length - 2].close : fLatestClose;
    if (liveQuote && !liveQuote.previousClose) {
      liveQuote.previousClose = fPrevClose;
      if (fPrevClose !== 0) liveQuote.changePct = ((liveQuote.price - fPrevClose) / fPrevClose) * 100;
    }
    const latestClose = liveQuote ? liveQuote.price : fLatestClose;
    const realTimeChangePct = liveQuote ? liveQuote.changePct : undefined;`;

content = content.replace(oldLiveQuoteRegex, newLiveQuoteLogic);

// 4. Wrap the return payload
const returnObjStart = 'return NextResponse.json({';
content = content.replace(returnObjStart, 'const finalPayload = {');

const catchBlockStart = '  } catch (error: unknown) {';
const newCatchBlock = `
    if (!debugMode) {
      // 寫入快取 (10分鐘 = 600秒)
      await setCache(cacheKey, finalPayload, 600);
    }
    return NextResponse.json(finalPayload);
  } catch (error: unknown) {`;

// Replace only the LAST occurrence of catchBlockStart
const lastIndex = content.lastIndexOf(catchBlockStart);
if (lastIndex !== -1) {
  content = content.substring(0, lastIndex) + newCatchBlock + content.substring(lastIndex + catchBlockStart.length);
}

fs.writeFileSync(targetPath, content);
console.log("Patch applied successfully");
