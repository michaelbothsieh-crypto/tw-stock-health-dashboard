import { KeyLevelsResult } from "@/lib/signals/keyLevels";

export interface UxSummaryInput {
  direction: "Bullish" | "Neutral" | "Bearish";
  strategyConfidence: number;
  consistencyLevel: "高一致性" | "中一致性" | "低一致性";
  topRiskFlag?: string;
  keyLevels: KeyLevelsResult;
}

export interface UxSummaryOutput {
  headline: string;
  subline: string;
  bullets: string[];
}

export function buildUxSummary(input: UxSummaryInput): UxSummaryOutput {
  const { direction, strategyConfidence, consistencyLevel, topRiskFlag, keyLevels } = input;
  
  let headline = "";
  if (direction === "Bullish" && strategyConfidence >= 65) {
    headline = "偏多結構明確";
  } else if (direction === "Bullish" && strategyConfidence < 50) {
    headline = "偏多但暫不出手";
  } else if (direction === "Bullish") {
    headline = "偏多結構延續";
  } else if (direction === "Neutral") {
    headline = "訊號分歧，等待";
  } else if (direction === "Bearish") {
    headline = "偏空結構，保守";
  }

  let subline = "";
  if (direction === "Neutral") {
    subline = "目前方向不明朗，建議等待訊號一致性回升";
  } else if (strategyConfidence < 50) {
    let msg = `方向${direction === "Bullish" ? "偏多" : "偏空"}，但可出手度偏低：`;
    if (consistencyLevel === "低一致性") msg += "一致性偏低 + ";
    msg += "回檔風險偏高";
    subline = msg;
  } else if (consistencyLevel === "低一致性") {
    subline = `方向${direction === "Bullish" ? "偏多" : "偏空"}，但一致性偏低，請留意洗盤風險`;
  } else {
    subline = `方向${direction === "Bullish" ? "偏多" : "偏空"}，各項訊號具一致性，具備出手條件`;
  }

  const b1 = `一致性：${consistencyLevel.replace("一致性", "")}`;
  
  let b2 = "門檻：--";
  if (keyLevels.breakoutLevel && keyLevels.invalidationLevel) {
    b2 = `轉強:≥${keyLevels.breakoutLevel}｜失效:<${keyLevels.invalidationLevel}`;
  } else if (keyLevels.breakoutLevel) {
    b2 = `轉強:≥${keyLevels.breakoutLevel}`;
  } else if (keyLevels.invalidationLevel) {
    b2 = `失效:<${keyLevels.invalidationLevel}`;
  }

  let b3 = "最大風險：無明顯風險";
  if (topRiskFlag) {
    // try to make risk flag shorter if possible
    let riskStr = topRiskFlag;
    if (riskStr.length > 16) {
      riskStr = riskStr.substring(0, 15) + "…";
    }
    b3 = `最大風險：${riskStr}`;
  }

  return {
    headline,
    subline,
    bullets: [b1, b2, b3],
  };
}
