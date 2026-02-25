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
    volRatio: number | null;
    trendScore: number | null;
    reasons: string[];
    risks: string[];
}

// 簡單移動平均線 (SMA)
function calculateSMA(data: number[], period: number): number | null {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}

// 相對強弱指標 (RSI) - Wilder's smoothing
function calculateRSI(data: number[], period: number = 14): number | null {
    if (data.length <= period) return null;

    let sumGain = 0;
    let sumLoss = 0;

    // 計算前 14 天的初始平滑平均值
    for (let i = 1; i <= period; i++) {
        const diff = data[i] - data[i - 1];
        if (diff >= 0) {
            sumGain += diff;
        } else {
            sumLoss -= diff;
        }
    }

    let avgGain = sumGain / period;
    let avgLoss = sumLoss / period;

    // Wilder's smoothing 運用於後續天數
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        let currentGain = 0;
        let currentLoss = 0;
        if (diff >= 0) {
            currentGain = diff;
        } else {
            currentLoss = -diff;
        }
        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    }

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
        return { macdLine: null, signalLine: null, histogram: null, prevHistogram: null };
    }

    const emaShort = calculateEMA(data, shortPeriod);
    const emaLong = calculateEMA(data, longPeriod);

    const macdLine = [];
    for (let i = 0; i < data.length; i++) {
        macdLine.push(emaShort[i] - emaLong[i]);
    }

    const validMacdForSignal = macdLine.slice(-(data.length - longPeriod));
    const signalLineEma = calculateEMA(validMacdForSignal, signalPeriod);

    // Padding 補齊 macdLine 讓陣列對齊
    const signalLineFull = new Array(macdLine.length - signalLineEma.length).fill(0).concat(signalLineEma);

    const histArray = macdLine.map((m, i) => m - signalLineFull[i]);

    const currentMacdLine = macdLine[macdLine.length - 1];
    const currentSignalLine = signalLineEma[signalLineEma.length - 1];
    const histogram = histArray[histArray.length - 1];
    const prevHistogram = histArray[histArray.length - 2];

    return { macdLine: currentMacdLine, signalLine: currentSignalLine, histogram, prevHistogram };
}

export function calculateTrend(data: PriceDaily[]): TrendSignals {
    const defaultReturn: TrendSignals = {
        sma20: null, sma60: null, sma120: null,
        rsi14: null, macd: { macdLine: null, signalLine: null, histogram: null },
        return20D: null, return60D: null, volRatio: null,
        trendScore: null, reasons: ["資料量不足，無法判斷趨勢。"], risks: []
    };

    if (!data || data.length === 0) return defaultReturn;

    // 前處理：依日期排序，過濾缺少 close 的資料
    const sortedData = [...data]
        .filter(d => d.close !== null && d.close !== undefined)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 檢查最少資料量 >= 130
    if (sortedData.length < 130) {
        return defaultReturn;
    }

    const closes = sortedData.map(d => d.close);
    const volumes = sortedData.map(d => d.Trading_Volume || 0); // 這裡 Volume 可能是單位股數，缺值為 0
    const currentClose = closes[closes.length - 1];

    const risks: string[] = [];
    // 檢查 volume 缺值
    if (volumes[volumes.length - 1] === 0) {
        risks.push("volume_missing");
    }

    const sma20 = calculateSMA(closes, 20);
    const sma20_10d_ago = calculateSMA(closes.slice(0, closes.length - 10), 20);
    const sma60 = calculateSMA(closes, 60);
    const sma60_10d_ago = calculateSMA(closes.slice(0, closes.length - 10), 60);
    const sma120 = calculateSMA(closes, 120);

    const slope20 = (sma20 && sma20_10d_ago) ? (sma20 - sma20_10d_ago) / sma20_10d_ago : 0;
    const slope60 = (sma60 && sma60_10d_ago) ? (sma60 - sma60_10d_ago) / sma60_10d_ago : 0;

    const rsi14 = calculateRSI(closes, 14);
    const macd = calculateMACD(closes);

    const close20DAgo = closes[closes.length - 21];
    const return20D = close20DAgo ? (currentClose / close20DAgo) - 1 : null;

    const close60DAgo = closes[closes.length - 61];
    const return60D = close60DAgo ? (currentClose / close60DAgo) - 1 : null;

    const v20 = calculateSMA(volumes, 20);
    const volRatio = (v20 && v20 > 0) ? volumes[volumes.length - 1] / v20 : null;

    const allReasons: { priority: number; text: string }[] = [];

    // ================= 子分數計算 =================

    // A) 趨勢排列 + 突破 (40%)
    let trendA = 50;
    let bull_align = 0;
    let bear_align = 0;

    if (sma20 && sma60 && sma120) {
        if (sma20 > sma60 && sma60 > sma120) {
            bull_align = 2;
        } else if (sma20 > sma60 || sma60 > sma120) {
            bull_align = 1;
        }

        if (sma20 < sma60 && sma60 < sma120) {
            bear_align = 2;
        } else if (sma20 < sma60 || sma60 < sma120) {
            bear_align = 1;
        }

        const isAboveSMA20 = currentClose > sma20;

        if (bull_align === 2 && isAboveSMA20) { trendA = 95; allReasons.push({ priority: 1, text: "均線多頭排列 (20MA>60MA>120MA) 且價格站上短均線。" }); }
        else if (bull_align === 2 && !isAboveSMA20) { trendA = 80; allReasons.push({ priority: 1, text: "均線多頭排列，但短線跌破 20MA，留意盤整。" }); }
        else if (bull_align === 1 && isAboveSMA20) { trendA = 70; allReasons.push({ priority: 1, text: "均線初步轉多，價格站穩 20MA 之上。" }); }
        else if (bull_align === 1 && !isAboveSMA20) { trendA = 55; allReasons.push({ priority: 1, text: "均線初步轉多，但價格受制於 20MA 壓力。" }); }
        else if (bear_align === 2 && !isAboveSMA20) { trendA = 10; allReasons.push({ priority: 1, text: "均線空頭排列 (20MA<60MA<120MA)，趨勢極弱。" }); }
        else if (bear_align === 2 && isAboveSMA20) { trendA = 25; allReasons.push({ priority: 1, text: "均線空頭排列，目前價格短暫站上 20MA 反彈。" }); }
        else if (bear_align === 1 && !isAboveSMA20) { trendA = 35; allReasons.push({ priority: 1, text: "均線偏空，且價格在 20MA 之下，表現弱勢。" }); }
        else { trendA = 50; allReasons.push({ priority: 1, text: "均線交錯且未成明顯趨勢。" }); }
    }

    // B) 斜率動能 (20%)
    let trendB = 50;
    const s = 0.7 * slope20 + 0.3 * slope60;
    if (s >= 0.03) trendB = 95;
    else if (s >= 0.01) trendB = 70 + (s - 0.01) / 0.02 * 25;
    else if (s >= -0.01) trendB = 45 + (s - (-0.01)) / 0.02 * 10;
    else if (s >= -0.03) trendB = 30 + (s - (-0.03)) / 0.02 * 15;
    else trendB = 10;

    // C) RSI (15%)
    let trendC = 50;
    if (rsi14 !== null) {
        if (rsi14 >= 65) {
            trendC = 95;
            allReasons.push({ priority: 2, text: `RSI 強勢區間 (${rsi14.toFixed(1)} > 65)。` });
        } else if (rsi14 >= 55) {
            trendC = 70 + ((rsi14 - 55) / 10) * 25;
            allReasons.push({ priority: 2, text: `RSI 偏多 (${rsi14.toFixed(1)})。` });
        } else if (rsi14 >= 45) {
            trendC = 45 + ((rsi14 - 45) / 10) * 25;
        } else if (rsi14 >= 35) {
            trendC = 20 + ((rsi14 - 35) / 10) * 25;
            allReasons.push({ priority: 2, text: `RSI 偏弱 (${rsi14.toFixed(1)})。` });
        } else {
            trendC = 10;
            allReasons.push({ priority: 2, text: `RSI 弱勢區間 (${rsi14.toFixed(1)} < 35)。` });
        }
    }

    // D) MACD Hist (15%)
    let trendD = 50;
    if (macd.histogram !== null && macd.prevHistogram !== null) {
        const histDiff = macd.histogram - macd.prevHistogram;
        if (macd.histogram > 0) {
            if (histDiff > 0) {
                trendD = 90;
                allReasons.push({ priority: 3, text: "MACD 柱狀體位於正值範圍且逐漸擴大，多方動能增強。" });
            } else {
                trendD = 75;
                allReasons.push({ priority: 3, text: "MACD 柱狀體位於正值範圍但略微收斂。" });
            }
        } else {
            if (histDiff > 0) {
                trendD = 55;
                allReasons.push({ priority: 3, text: "MACD 柱狀體負值範圍收斂，空方動能減弱。" });
            } else {
                trendD = 25;
                allReasons.push({ priority: 3, text: "MACD 柱狀體負值逐漸擴大，空方動能強勁。" });
            }
        }
    }

    // E) 近 20 日波段報酬 (30%)
    let trendE = 50;
    if (return20D !== null) {
        if (return20D >= 0.15) trendE = 95;
        else if (return20D >= 0.05) trendE = 70 + (return20D - 0.05) / 0.10 * 25;
        else if (return20D >= 0) trendE = 50 + (return20D - 0) / 0.05 * 20;
        else if (return20D >= -0.05) trendE = 30 + (return20D - (-0.05)) / 0.05 * 20;
        else trendE = 10;
    }

    const trendScore = 0.3 * trendA + 0.1 * trendB + 0.15 * trendC + 0.15 * trendD + 0.3 * trendE;

    // ================= Risk Flags =================

    // overheated: RSI>=75 且乖離超過 10%
    if (rsi14 && rsi14 >= 75 && sma20 && (currentClose / sma20 - 1) > 0.1) {
        risks.push("overheated");
    }

    // breakdown_risk: 跌破 SMA20 且原本多頭排列
    if (sma20 && currentClose < sma20 && bull_align === 2) {
        risks.push("breakdown_risk");
    }

    // whipsaw: 均線無明顯方向且 RSI 在中部盤整且 MACD 柱狀體微弱
    if (bull_align === 0 && bear_align === 0 && rsi14 && rsi14 >= 45 && rsi14 <= 55 && macd.histogram !== null && Math.abs(macd.histogram) < (currentClose * 0.005)) { // 簡易判斷 MACD 趨近 0
        risks.push("whipsaw");
    }

    // 額外理由捕捉
    if (return20D && return20D > 0.15) {
        allReasons.push({ priority: 4, text: `近一個月波段漲幅達 ${(return20D * 100).toFixed(1)}%。` });
    }
    if (volRatio && volRatio > 1.5) {
        allReasons.push({ priority: 4, text: `今日成交量放大，達月均量的 ${volRatio.toFixed(1)} 倍。` });
    }

    // 取得前 3 個不相同的最重要理由
    const finalReasons = Array.from(new Set(allReasons.sort((a, b) => a.priority - b.priority).map(r => r.text))).slice(0, 3);

    return {
        sma20, sma60, sma120, rsi14, macd: { macdLine: macd.macdLine, signalLine: macd.signalLine, histogram: macd.histogram },
        return20D, return60D, volRatio,
        trendScore,
        reasons: finalReasons.length > 0 ? finalReasons : ["資料量不足，無法判斷趨勢。"],
        risks
    };
}

