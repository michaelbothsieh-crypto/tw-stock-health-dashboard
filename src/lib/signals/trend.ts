import { PriceDaily } from "../providers/finmind";

export interface TrendSignals {
    sma20: number | null;
    sma60: number | null;
    sma120: number | null;
    rsi14: number | null;
    macd: {
        macdLine: number | null;
        signalLine: number | null;
        histogram: number | null;
    };
    return20D: number | null;
    return60D: number | null;
    trendScore: number;
    reasons: string[];
}

// 簡單移動平均線 (SMA)
function calculateSMA(data: number[], period: number): number | null {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}

// 相對強弱指標 (RSI)
function calculateRSI(data: number[], period: number = 14): number | null {
    if (data.length <= period) return null;

    let gains = 0;
    let losses = 0;

    for (let i = data.length - period; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        if (diff >= 0) {
            gains += diff;
        } else {
            losses -= diff;
        }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// 指數移動平均線 (EMA)
function calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emas = [data[0]];
    for (let i = 1; i < data.length; i++) {
        emas.push(data[i] * k + emas[i - 1] * (1 - k));
    }
    return emas;
}

// MACD (12, 26, 9)
function calculateMACD(data: number[], shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    if (data.length < longPeriod + signalPeriod) {
        return { macdLine: null, signalLine: null, histogram: null };
    }

    const emaShort = calculateEMA(data, shortPeriod);
    const emaLong = calculateEMA(data, longPeriod);

    const macdLine = [];
    for (let i = 0; i < data.length; i++) {
        macdLine.push(emaShort[i] - emaLong[i]);
    }

    // 為了計算 Signal Line，我們取 MACD Line 的最後一段長度大於 signalPeriod 的內容
    const validMacdForSignal = macdLine.slice(-(data.length - longPeriod));
    const signalLineEma = calculateEMA(validMacdForSignal, signalPeriod);

    const currentMacdLine = macdLine[macdLine.length - 1];
    const currentSignalLine = signalLineEma[signalLineEma.length - 1];
    const histogram = currentMacdLine - currentSignalLine;

    return { macdLine: currentMacdLine, signalLine: currentSignalLine, histogram };
}

export function calculateTrend(data: PriceDaily[]): TrendSignals {
    if (!data || data.length === 0) {
        return {
            sma20: null, sma60: null, sma120: null,
            rsi14: null, macd: { macdLine: null, signalLine: null, histogram: null },
            return20D: null, return60D: null,
            trendScore: 50, reasons: ["No price data available"]
        };
    }

    // Ensure data is sorted by date ascending
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const closes = sortedData.map(d => d.close);
    const currentClose = closes[closes.length - 1];

    const sma20 = calculateSMA(closes, 20);
    const sma60 = calculateSMA(closes, 60);
    const sma120 = calculateSMA(closes, 120);

    const rsi14 = calculateRSI(closes, 14);
    const macd = calculateMACD(closes);

    const close20DAgo = closes.length > 20 ? closes[closes.length - 21] : null;
    const return20D = close20DAgo ? ((currentClose - close20DAgo) / close20DAgo) * 100 : null;

    const close60DAgo = closes.length > 60 ? closes[closes.length - 61] : null;
    const return60D = close60DAgo ? ((currentClose - close60DAgo) / close60DAgo) * 100 : null;

    let trendScore = 0;
    const reasons: string[] = [];

    // ================= 評分邏輯 =================

    // 1. 趨勢排列 40%
    let trendAlignmentScore = 20; // 中立 default
    if (sma20 && sma60 && sma120) {
        if (sma20 > sma60 && sma60 > sma120) {
            trendAlignmentScore = 40;
            reasons.push("均線呈多頭排列 (20MA > 60MA > 120MA)，趨勢偏多。");
        } else if (sma20 < sma60 && sma60 < sma120) {
            trendAlignmentScore = 0;
            reasons.push("均線呈空頭排列 (20MA < 60MA < 120MA)，趨勢偏空。");
        } else if (currentClose > sma60) {
            trendAlignmentScore = 25;
            reasons.push("股價站上季線 (60MA)，具備初步轉強訊號。");
        } else {
            reasons.push("均線交錯且未成明顯趨勢。");
        }
    } else {
        reasons.push("資料不足無法判斷長線均線趨勢。");
    }
    trendScore += trendAlignmentScore;

    // 2. RSI 區間 20%
    let rsiScore = 10;
    if (rsi14 !== null) {
        if (rsi14 > 70) {
            rsiScore = 15; // 稍強但可能超買 (先給較高分，後續風險提示可扣分)
            reasons.push(`RSI(14) 位於 ${rsi14.toFixed(1)}，步入超買區。`);
        } else if (rsi14 < 30) {
            rsiScore = 5;
            reasons.push(`RSI(14) 位於 ${rsi14.toFixed(1)}，步入超賣區。`);
        } else if (rsi14 > 50) {
            rsiScore = 18; // 最佳中性偏強區間
            reasons.push(`RSI(14) 位於 ${rsi14.toFixed(1)}，動能偏強。`);
        } else {
            rsiScore = 8;
            reasons.push(`RSI(14) 位於 ${rsi14.toFixed(1)}，動能偏弱。`);
        }
    }
    trendScore += rsiScore;

    // 3. MACD 正負 20%
    let macdScore = 10;
    if (macd.histogram !== null) {
        if (macd.histogram > 0) {
            if (macd.macdLine !== null && macd.macdLine > 0) {
                macdScore = 20;
                reasons.push("MACD 柱狀圖為正，且零軸之上，多頭動能強勁。");
            } else {
                macdScore = 15;
                reasons.push("MACD 柱狀圖轉正，動能開始轉強。");
            }
        } else {
            if (macd.macdLine !== null && macd.macdLine < 0) {
                macdScore = 0;
                reasons.push("MACD 柱狀圖為負，且零軸之下，空頭動能強勁。");
            } else {
                macdScore = 5;
                reasons.push("MACD 柱狀圖轉負，動能開始轉弱。");
            }
        }
    }
    trendScore += macdScore;

    // 4. 60D 報酬 20%
    let returnScore = 10;
    if (return60D !== null) {
        if (return60D > 15) {
            returnScore = 20;
            reasons.push(`近 60 日累積報酬達 ${return60D.toFixed(1)}%，波段強勢。`);
        } else if (return60D > 0) {
            returnScore = 15;
            reasons.push(`近 60 日累積報酬為正 (${return60D.toFixed(1)}%)。`);
        } else if (return60D < -15) {
            returnScore = 0;
            reasons.push(`近 60 日累積報酬跌幅達 ${return60D.toFixed(1)}%，波段弱勢。`);
        } else {
            returnScore = 5;
            reasons.push(`近 60 日累積報酬為負 (${return60D.toFixed(1)}%)。`);
        }
    }
    trendScore += returnScore;

    return {
        sma20, sma60, sma120, rsi14, macd, return20D, return60D,
        trendScore,
        reasons
    };
}
