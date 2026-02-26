import { evaluateCrashWarning } from "../src/lib/global/crash/crashEngine";
import { MarketIndicatorResult } from "../src/lib/providers/marketIndicators";
import { assert } from "console";

async function runCrashEngineVerification() {
  console.log("=== 開始驗證 Crash Engine V2 ==============================");

  // 1. 空白資料測試 (Empty Data)
  console.log("\n[測試 1] 全空資料 -> 預期: 資料不足");
  const emptyMock: MarketIndicatorResult = {
    seriesBySymbol: {},
    okBySymbol: {},
    usedSymbols: []
  };
  
  const emptyRes = evaluateCrashWarning(emptyMock);
  if (emptyRes.score !== null) throw new Error("空白資料應回傳 score = null");
  if (emptyRes.level !== "資料不足") throw new Error(`空白資料應顯示 '資料不足', 卻顯示 '${emptyRes.level}'`);
  if (emptyRes.meta.usedSymbols.length !== 0) throw new Error("空白系統不應有 usedSymbols");
  console.log("✅ 測試 1 通過: 空白資料正確阻止 0.0% 顯示。");


  // 2. 僅部分資料但不足 (Below Threshold Data)
  console.log("\n[測試 2] 僅1檔有效資料 -> 預期: 資料不足 (至少需 2 檔)");
  const mockInsufficient: MarketIndicatorResult = {
    seriesBySymbol: {
      "^VIX": { closes: new Array(60).fill(20), dates: new Array(60).fill("2024-01-01") }
    },
    okBySymbol: {
      "^VIX": { ok: true, points: 60 }
    },
    usedSymbols: ["^VIX"]
  };
  
  const insuffRes = evaluateCrashWarning(mockInsufficient);
  if (insuffRes.score !== null) throw new Error("僅 1 檔資料應回傳 score = null");
  if (insuffRes.level !== "資料不足") throw new Error("僅 1 檔資料應顯示 '資料不足'");
  if (insuffRes.meta.usedSymbols.length !== 1) throw new Error("應使用 1 檔資料但評估不達標");
  console.log("✅ 測試 2 通過: 條件門檻有效阻截假資料。");

  // 3. 長度不足測試 (Short data < 21 points)
  console.log("\n[測試 3] 長度不足 (<21天) 資料 -> 預期: 資料不足");
  const mockShort: MarketIndicatorResult = {
    seriesBySymbol: {
      "^VIX": { closes: new Array(10).fill(20), dates: new Array(10).fill("2024-01-01") },
      "SOXX": { closes: new Array(10).fill(100), dates: new Array(10).fill("2024-01-01") }
    },
    okBySymbol: {
      "^VIX": { ok: false, points: 10 },
      "SOXX": { ok: false, points: 10 }
    },
    usedSymbols: []
  };

  const shortRes = evaluateCrashWarning(mockShort);
  if (shortRes.score !== null || shortRes.level !== "資料不足") throw new Error("未滿 21 天的資料不應產出分數");
  console.log("✅ 測試 3 通過: 長度不足有效阻截。");


  // 4. 正常計算測試 (Valid Mock Data)
  console.log("\n[測試 4] 充足市場資料 -> 預期: 產出分數且擁有 calcTrace 軌跡");
  // 建立正常的走勢 (VIX=20, SOXX漲)
  const vixCloses = new Array(21).fill(20);
  const soxxCloses = new Array(21).fill(100).map((v, i) => v + i); // 100 -> 120 (上漲)
  const dxyCloses = new Array(21).fill(100); 

  const validMock: MarketIndicatorResult = {
    seriesBySymbol: {
      "^VIX": { closes: vixCloses, dates: vixCloses.map((_, i) => "2024-" + i) },
      "SOXX": { closes: soxxCloses, dates: soxxCloses.map((_, i) => "2024-" + i) },
      "^DXY": { closes: dxyCloses, dates: dxyCloses.map((_, i) => "2024-" + i) }
    },
    okBySymbol: {
      "^VIX": { ok: true, points: 21 },
      "SOXX": { ok: true, points: 21 },
      "^DXY": { ok: true, points: 21 }
    },
    usedSymbols: ["^VIX", "SOXX", "^DXY"]
  };
  
  const validRes = evaluateCrashWarning(validMock);
  if (validRes.score === null) throw new Error("合法的充足資料卻算出 null 分數");
  if (validRes.level === "資料不足") throw new Error("充足資料不應顯示資料不足");
  if (validRes.meta.usedSymbols.length !== 3) throw new Error("未正確記錄 usedSymbols");
  if (validRes.meta.usedPointsMin !== 21) throw new Error("未正確記錄 usedPointsMin");
  if (!validRes.meta.calcTrace.volatility.available) throw new Error("Volatility calcTrace 未生效");
  if (!validRes.meta.calcTrace.sector.available) throw new Error("Sector calcTrace 未生效");
  
  console.log("   --- Calc Trace 驗證 ---")
  console.log("   引擎版本:", validRes.meta.engineVersion);
  console.log("   最小資料天數:", validRes.meta.usedPointsMin);
  console.log("   參與標的:", validRes.meta.usedSymbols.join(", "));
  console.log("✅ 測試 4 通過: 計算邏輯與 Trace 紀錄全數正常！");
  
  console.log("\n🎉 所有動態聚類與對標測試綠燈通過！");
}

runCrashEngineVerification().catch((err) => {
  console.error("Test Failed: ", err);
  process.exit(1);
});
