import { TrendSignals } from "../signals/trend";
import { FlowSignals } from "../signals/flow";
import { FundamentalSignals } from "../signals/fundamental";
import { CatalystEvaluation } from "../news/catalystScore";

export interface AIExplanation {
    stance: 'Bullish' | 'Neutral' | 'Bearish';
    confidence: number;
    summary: string;
    key_points: string[];
    risks: string[];
    debug?: any;
}

export function generateExplanation(
    ticker: string,
    trend: TrendSignals,
    flow: FlowSignals,
    fundamental: FundamentalSignals,
    catalyst: CatalystEvaluation | null = null
): AIExplanation {
    let stance: 'Bullish' | 'Neutral' | 'Bearish' = 'Neutral';
    let confidence = 50;

    const tScore = trend.trendScore;
    const fScore = flow.flowScore;
    const fundScore = fundamental.fundamentalScore;

    const allRisks = [
        ...trend.risks,
        ...flow.risks,
        ...fundamental.risks
    ];

    let debug: any = {
        trendScoreRaw: tScore,
        flowScoreRaw: fScore,
        fundamentalScoreRaw: fundScore,
        confidence_terms: {
            base: 50,
            trendTerm: 0,
            flowTerm: 0,
            fundamentalTerm: 0,
            catalystTerm: 0,
            riskPenaltyDetails: []
        },
        scores_before_round: { trend: tScore, flow: fScore, fundamental: fundScore },
        scores_after_round: {
            trend: tScore !== null ? Math.round(tScore) : null,
            flow: fScore !== null ? Math.round(fScore) : null,
            fundamental: fundScore !== null ? Math.round(fundScore) : null
        }
    };

    // 1. Base stance (由 TrendScore 主導)
    if (tScore === null) {
        stance = 'Neutral';
        confidence = 30; // 缺乏價格資料，信心極低
    } else {
        if (tScore >= 65) {
            stance = 'Bullish';
        } else if (tScore < 45) {
            stance = 'Bearish';
        } else {
            stance = 'Neutral';
        }

        // 2. Confidence 計算
        debug.confidence_terms.trendTerm = (tScore - 50) * 0.6;
        confidence += debug.confidence_terms.trendTerm;

        if (fScore !== null) {
            debug.confidence_terms.flowTerm = (fScore - 50) * 0.3;
            confidence += debug.confidence_terms.flowTerm;
        } else {
            confidence -= 10; // 缺籌碼資料扣分
            debug.confidence_terms.flowTerm = -10;
        }

        if (fundScore !== null) {
            debug.confidence_terms.fundamentalTerm = (fundScore - 50) * 0.2;
            confidence += debug.confidence_terms.fundamentalTerm;
        } else {
            confidence -= 5; // 缺基本面資料扣分
            debug.confidence_terms.fundamentalTerm = -5;
            allRisks.push("基本面資料不足，信心下降");
        }

        // 每個風險指標扣 5 分，最多扣 15 分
        const riskPenalty = Math.min(15, allRisks.length * 5);
        confidence -= riskPenalty;
        debug.confidence_terms.riskPenaltyDetails = allRisks.map(r => ({ flag: r, penalty: -5 }));
        debug.confidence_terms.riskPenaltyTotal = -riskPenalty;
    }

    let cScore = 0;
    if (catalyst) {
        cScore = catalyst.catalystScore;
        debug.confidence_terms.catalystTerm = cScore * 0.12;
        confidence += debug.confidence_terms.catalystTerm;
    }

    // 3. Stance 微調規則 (偏敏感)
    if (tScore !== null) {
        if (stance === 'Neutral' && tScore >= 58 && cScore >= 25) {
            stance = 'Bullish'; // 早期轉強
        } else if (stance === 'Bullish' && cScore <= -35) {
            stance = 'Neutral'; // 事件轉弱
        } else if (stance === 'Bearish' && cScore >= 35) {
            stance = 'Neutral'; // 利多反轉
        }
    }

    debug.confidence_before_round = confidence;
    confidence = Math.max(0, Math.min(100, Math.round(confidence)));
    debug.confidence_after_round = confidence;

    // 4. 整理 Key Points & Risks
    const key_points = [
        ...trend.reasons.slice(0, 3), // Trend 已經過濾前 3
        ...flow.reasons.slice(0, 3),  // Flow 已經過濾前 3
        ...fundamental.reasons.slice(0, 3) // Fundamental 已經過濾前 3
    ].filter(Boolean);

    // 取前 5 個最有代表性的 key points (避免字數過多)
    const final_key_points = key_points.slice(0, 5); // 可視 UI 需求調整

    if (catalyst && (catalyst.topBullishNews.length > 0 || catalyst.topBearishNews.length > 0)) {
        let catSummary = "近 7 天主要催化：";
        if (catalyst.topBullishNews.length > 0) catSummary += `利多(${catalyst.topBullishNews[0].title}) `;
        if (catalyst.topBearishNews.length > 0) catSummary += `利空(${catalyst.topBearishNews[0].title})`;

        final_key_points.unshift(catSummary.trim());
    }

    // 5. 生成 Summary
    let summary = `**代號 ${ticker}** 目前技術面給出 **${stance}** 的訊號。`;
    if (tScore === null) {
        summary = `**代號 ${ticker}** 由於價格資料不足，系統維持 **Neutral** 看法。`;
    }

    if (fScore !== null) {
        if (fScore > 60) {
            summary += ` 籌碼面呈現強勢，法人買盤進駐有助推升。`;
        } else if (fScore < 40) {
            summary += ` 籌碼面偏弱，須留意法人賣壓或散戶融資過高。`;
        } else {
            summary += ` 籌碼面中性穩定。`;
        }
    } else {
        summary += ` 缺乏近年籌碼變化資料。`;
    }

    if (fundScore !== null) {
        if (fundScore > 60) {
            summary += ` 基本面表現亮眼，營收連續成長帶來實質支撐。`;
        } else if (fundScore < 40) {
            summary += ` 基本面動能疲弱，營收動能近期減緩。`;
        }
    } else {
        summary += ` 基本面營收資料不足或未達評估門檻。`;
    }

    summary += ` 綜合評估信心水準為 ${confidence}%。`;

    return {
        stance,
        confidence,
        summary,
        key_points: final_key_points,
        risks: Array.from(new Set(allRisks)), // 確保風險指標不重複
        debug
    };
}
