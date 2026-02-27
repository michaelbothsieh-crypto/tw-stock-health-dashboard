import { TvTechnicalData } from "@/lib/providers/tradingViewFetch";

export interface TranslatedTechnicals {
  rating: { text: string; variant: "positive" | "negative" | "neutral" };
  signals: { name: string; value: string; status: string; variant: "positive" | "negative" | "neutral" }[];
  levels: { support: number; supportLabel: string; resistance: number; resistanceLabel: string };
  action: string;
}

export function translateTechnicals(data: TvTechnicalData): TranslatedTechnicals {
  const { close, SMA20, SMA50, SMA200, RSI14, MACD, MACD_signal, BB_lower, BB_upper, ATR } = data;

  let trendVariant: "positive" | "negative" | "neutral" = "neutral";
  let trendStatus = "震盪整理";
  if (close > SMA20 && close > SMA50 && close > SMA200) {
    trendVariant = "positive";
    trendStatus = "強勢多頭";
  } else if (close < SMA20 && close < SMA50 && close < SMA200) {
    trendVariant = "negative";
    trendStatus = "弱勢空頭";
  } else if (close < SMA20 && close < SMA50 && close > SMA200) {
    trendVariant = "negative";
    trendStatus = "長多短空";
  } else if (close > SMA20 && close < SMA50) {
    trendVariant = "neutral";
    trendStatus = "止跌轉強";
  } else if (close < SMA20 && close > SMA50) {
    trendVariant = "negative";
    trendStatus = "短線修正";
  }

  let rsiVariant: "positive" | "negative" | "neutral" = "neutral";
  let rsiStatus = "中性區間";
  if (RSI14 >= 70) {
    rsiVariant = "negative";
    rsiStatus = "過熱超買";
  } else if (RSI14 <= 30) {
    rsiVariant = "positive";
    rsiStatus = "超賣醞釀";
  } else if (RSI14 > 50) {
    rsiVariant = "positive";
    rsiStatus = "買盤佔優";
  } else {
    rsiVariant = "negative";
    rsiStatus = "賣壓偏重";
  }

  let macdVariant: "positive" | "negative" | "neutral" = "neutral";
  let macdStatus = "動能不明";
  if (MACD > MACD_signal && MACD > 0) {
    macdVariant = "positive";
    macdStatus = "多頭延續";
  } else if (MACD < MACD_signal && MACD < 0) {
    macdVariant = "negative";
    macdStatus = "空頭發散";
  } else if (MACD > MACD_signal && MACD < 0) {
    macdVariant = "positive";
    macdStatus = "空頭收斂";
  } else if (MACD < MACD_signal && MACD > 0) {
    macdVariant = "negative";
    macdStatus = "多頭衰退";
  }

  let support = 0;
  let supportLabel = "";
  if (close > SMA20) {
    support = SMA20;
    supportLabel = "月線";
  } else if (close > SMA50) {
    support = SMA50;
    supportLabel = "季線";
  } else {
    support = BB_lower;
    supportLabel = "布林下緣";
  }

  let resistance = 0;
  let resistanceLabel = "";
  if (close < SMA20) {
    resistance = SMA20;
    resistanceLabel = "月線反壓";
  } else if (close < SMA50) {
    resistance = SMA50;
    resistanceLabel = "季線反壓";
  } else {
    resistance = BB_upper;
    resistanceLabel = "布林上緣";
  }

  let action = "區間操作，買黑賣紅";
  let ratingText = "中立觀望";
  let ratingVariant: "positive" | "negative" | "neutral" = "neutral";

  if (close > SMA20 && close > SMA50) {
    ratingText = "偏多操作";
    ratingVariant = "positive";
    action = "技術面偏多，可於拉回測試月線時分批試單，跌破月線減碼";
  } else if (close < SMA20 && close < SMA50) {
    ratingText = "偏空保守";
    ratingVariant = "negative";
    action = "趨勢偏弱，空手者暫時觀望，持有多單遇反壓無法突破宜減碼";
  } else {
    action = "目前處於震盪整理格局，適合區間操作，跌破通道下緣需嚴格停損";
  }

  const distanceSma20 = ((close - SMA20) / SMA20) * 100;

  return {
    rating: { text: ratingText, variant: ratingVariant },
    signals: [
      { name: "均線架構", value: `${distanceSma20 > 0 ? "+" : ""}${distanceSma20.toFixed(2)}%`, status: trendStatus, variant: trendVariant },
      { name: "RSI指標", value: RSI14.toFixed(1), status: rsiStatus, variant: rsiVariant },
      { name: "MACD", value: MACD.toFixed(2), status: macdStatus, variant: macdVariant },
    ],
    levels: { support, supportLabel, resistance, resistanceLabel },
    action,
  };
}
