"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateCrashWarning = evaluateCrashWarning;
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function calcRet20(bars) {
    if (bars.length < 21)
        return null;
    var current = bars[bars.length - 1].close;
    var old = bars[bars.length - 21].close;
    if (old === 0)
        return null;
    return (current - old) / old;
}
function calcDrawdown20(bars) {
    if (bars.length < 21)
        return null;
    var recent20 = bars.slice(-20);
    var current = recent20[recent20.length - 1].close;
    var maxClose = Math.max.apply(Math, recent20.map(function (b) { return b.close; }));
    if (maxClose === 0)
        return null;
    return current / maxClose - 1;
}
function calcVixStats(bars) {
    if (bars.length < 20)
        return null;
    var current = bars[bars.length - 1].close;
    var sum20 = bars.slice(-20).reduce(function (acc, b) { return acc + b.close; }, 0);
    var ma20 = sum20 / 20;
    if (ma20 === 0)
        return null;
    var delta = (current - ma20) / ma20;
    return { current: current, ma20: ma20, delta: delta };
}
function evaluateCrashWarning(marketData) {
    var debugSymbols = {};
    var computed = {};
    var notes = [];
    var getBars = function (keys, label) {
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var k = keys_1[_i];
            if (marketData[k] && marketData[k].length > 0) {
                debugSymbols[label] = { symbol: k, points: marketData[k].length, ok: marketData[k].length >= 21, lastClose: marketData[k][marketData[k].length - 1].close };
                return marketData[k];
            }
        }
        debugSymbols[label] = { symbol: keys[0], points: 0, ok: false, lastClose: null };
        return [];
    };
    var vixBars = getBars(["^VIX"], "VIX");
    var moveBars = getBars(["^MOVE"], "MOVE");
    var soxxBars = getBars(["SOXX"], "SOXX");
    var qqqBars = getBars(["QQQ"], "QQQ");
    var dxyBars = getBars(["^DXY", "DX-Y.NYB", "UUP"], "DXY");
    var usdjpyBars = getBars(["USDJPY=X", "JPY=X"], "USDJPY");
    // --- 1. 波動壓力 (Volatility) ---
    var volFact = { score: 0, triggers: [], available: false };
    var vixStats = calcVixStats(vixBars);
    if (vixStats) {
        volFact.available = true;
        computed.vix = vixStats.current;
        computed.vixMA20 = vixStats.ma20;
        computed.vixDelta = vixStats.delta;
        if (vixStats.current >= 35) {
            volFact.score += 40;
            volFact.triggers.push("VIX 高於 35（恐慌水位）");
        }
        else if (vixStats.current >= 25) {
            volFact.score += 25;
            volFact.triggers.push("VIX 高於 25（波動升溫）");
        }
        if (vixStats.delta >= 0.20) {
            volFact.score += 15;
            volFact.triggers.push("VIX 顯著高於月均（快速升溫）");
        }
    }
    if (moveBars.length > 0) {
        var move = moveBars[moveBars.length - 1].close;
        if (move >= 140) {
            volFact.score += 20;
            volFact.triggers.push("MOVE 偏高（債市極端波動）");
        }
        else if (move >= 120) {
            volFact.score += 10;
            volFact.triggers.push("MOVE 偏高（債市波動升溫）");
        }
    }
    if (!volFact.available) {
        notes.push("VIX missing");
    }
    volFact.score = clamp(volFact.score, 0, 100);
    // --- 2. 板塊破位 (Sector Breakdown) ---
    var secFact = { score: 0, triggers: [], available: false };
    var soxxRet20 = calcRet20(soxxBars);
    var qqqRet20 = calcRet20(qqqBars);
    var soxxDd = calcDrawdown20(soxxBars);
    var qqqDd = calcDrawdown20(qqqBars);
    computed.soxxRet20 = soxxRet20;
    computed.qqqRet20 = qqqRet20;
    if (soxxRet20 !== null) {
        secFact.available = true;
        if (soxxRet20 <= -0.12) {
            secFact.score += 40;
            secFact.triggers.push("費半近 20 日跌幅大於 12%（明顯破位）");
        }
        else if (soxxRet20 <= -0.08) {
            secFact.score += 25;
            secFact.triggers.push("費半近 20 日跌幅大於 8%（板塊轉弱）");
        }
    }
    if (qqqRet20 !== null) {
        secFact.available = true;
        if (qqqRet20 <= -0.10) {
            secFact.score += 30;
            secFact.triggers.push("QQQ 跌幅偏大（科技風險急升）");
        }
        else if (qqqRet20 <= -0.06) {
            secFact.score += 15;
            secFact.triggers.push("QQQ 跌幅偏大（科技風險上升）");
        }
    }
    var minDd = Math.min(soxxDd !== null && soxxDd !== void 0 ? soxxDd : 0, qqqDd !== null && qqqDd !== void 0 ? qqqDd : 0);
    if (minDd <= -0.06) {
        secFact.score += 15;
        secFact.triggers.push("近 20 日回落幅度擴大（走勢破位）");
    }
    if (!secFact.available) {
        notes.push("SOXX/QQQ missing");
    }
    secFact.score = clamp(secFact.score, 0, 100);
    // --- 3. 跨資產壓力 (Cross Asset) ---
    var crossFact = { score: 0, triggers: [], available: false };
    var dxyRet20 = calcRet20(dxyBars);
    var usdjpyRet20 = calcRet20(usdjpyBars);
    computed.dxyRet20 = dxyRet20;
    computed.usdjpyRet20 = usdjpyRet20;
    if (dxyRet20 !== null) {
        crossFact.available = true;
        if (dxyRet20 >= 0.06) {
            crossFact.score += 25;
            crossFact.triggers.push("美元指數近 20 日明顯走強（風險緊縮）");
        }
        else if (dxyRet20 >= 0.03) {
            crossFact.score += 15;
            crossFact.triggers.push("美元指數偏強（資金流出壓力）");
        }
    }
    if (usdjpyRet20 !== null) {
        crossFact.available = true;
        if (usdjpyRet20 >= 0.06) {
            crossFact.score += 20;
            crossFact.triggers.push("美元兌日圓升幅偏大（匯率壓力升溫）");
        }
        else if (usdjpyRet20 >= 0.03) {
            crossFact.score += 10;
            crossFact.triggers.push("美元兌日圓偏強（匯率壓力）");
        }
    }
    if (!crossFact.available) {
        notes.push("DXY/USDJPY missing");
    }
    crossFact.score = clamp(crossFact.score, 0, 100);
    // --- 4. 流動性壓力 (Liquidity Proxy) ---
    var liqFact = { score: 0, triggers: [], available: false };
    if (vixStats && dxyRet20 !== null && soxxRet20 !== null) {
        liqFact.available = true;
        var liqHits = 0;
        if (vixStats.current >= 25 && dxyRet20 >= 0.03) {
            liqFact.score += 25;
            liqFact.triggers.push("波動升溫 + 美元偏強（流動性代理訊號）");
            liqHits++;
        }
        if (soxxRet20 <= -0.10 && vixStats.delta >= 0.20) {
            liqFact.score += 25;
            liqFact.triggers.push("費半轉弱 + 波動急升（流動性代理訊號）");
            liqHits++;
        }
        if (liqHits === 2) {
            liqFact.score += 10;
            liqFact.triggers.push("多重壓力疊加，資金流動性顯著變差");
        }
    }
    if (!liqFact.available) {
        notes.push("Liquidity proxy missing");
    }
    liqFact.score = clamp(liqFact.score, 0, 100);
    // --- 綜合計算 (Normalize Weights) ---
    var totalScoreRaw = 0;
    var availableWeight = 0;
    if (volFact.available) {
        totalScoreRaw += volFact.score * 0.30;
        availableWeight += 0.30;
    }
    if (secFact.available) {
        totalScoreRaw += secFact.score * 0.30;
        availableWeight += 0.30;
    }
    if (crossFact.available) {
        totalScoreRaw += crossFact.score * 0.20;
        availableWeight += 0.20;
    }
    if (liqFact.available) {
        totalScoreRaw += liqFact.score * 0.20;
        availableWeight += 0.20;
    }
    var finalScore = null;
    var level = "資料不足";
    var reasons = [];
    if (availableWeight > 0) {
        var normalized = totalScoreRaw / availableWeight;
        finalScore = Math.round(clamp(normalized, 0, 100) * 10) / 10;
        if (finalScore >= 80)
            level = "崩盤風險";
        else if (finalScore >= 60)
            level = "高風險";
        else if (finalScore >= 30)
            level = "警戒";
        else
            level = "正常";
        var allFactors = [
            { name: "波動", res: volFact },
            { name: "板塊", res: secFact },
            { name: "跨資產", res: crossFact },
            { name: "流動性", res: liqFact }
        ];
        allFactors.sort(function (a, b) { return b.res.score - a.res.score; });
        for (var _i = 0, allFactors_1 = allFactors; _i < allFactors_1.length; _i++) {
            var f = allFactors_1[_i];
            if (f.res.available && f.res.triggers.length > 0) {
                reasons.push.apply(reasons, f.res.triggers.slice(0, 2));
            }
        }
        var dedupedReasons = Array.from(new Set(reasons)).filter(function (r) { return r !== "正常"; });
        if (dedupedReasons.length > 0) {
            reasons.length = 0;
            reasons.push.apply(reasons, dedupedReasons);
        }
        else {
            reasons.push("總經與市場指標平穩");
        }
    }
    var headline = "";
    var summary = "";
    var triggersTop = [];
    if (level === "資料不足") {
        headline = "資料不足";
        summary = "目前無法取得足夠市場資料";
        triggersTop = ["請稍後再試", "或檢查資料來源"];
    }
    else {
        if (level === "崩盤風險") {
            headline = "崩盤風險極高，建議對沖";
            summary = "多項市場指標顯示極端異常，資金可能快速撤出風險資產。";
        }
        else if (level === "高風險") {
            headline = "風險升高，偏向防守";
            summary = "市場出現明顯壓力訊號，建議降低持股水位。";
        }
        else if (level === "警戒") {
            headline = "市場進入警戒狀態";
            summary = "部分指標轉弱或波動升溫，需密切觀察。";
        }
        else {
            headline = "市場風險偏低";
            summary = "整體環境相對平穩，可維持正常操作。";
        }
        triggersTop = reasons.slice(0, 4);
        if (availableWeight < 1 && availableWeight > 0) {
            triggersTop.push("部分資料缺失，以可用指標估算");
        }
    }
    return {
        score: finalScore,
        level: level,
        headline: headline,
        summary: summary,
        triggersTop: triggersTop.length > 0 ? triggersTop : ["各項指標未見極端異常"],
        factors: {
            volatilityStress: volFact,
            sectorBreakdown: secFact,
            crossAssetStress: crossFact,
            liquidityStress: liqFact
        },
        lastUpdated: new Date().toISOString(),
        debug: {
            symbols: debugSymbols,
            computed: computed,
            notes: notes
        }
    };
}
