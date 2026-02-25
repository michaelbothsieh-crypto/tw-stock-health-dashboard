import { TrendSignals } from "../signals/trend";
import { FlowSignals } from "../signals/flow";
import { FundamentalSignals } from "../signals/fundamental";

export interface AIExplanation {
    stance: 'Bullish' | 'Neutral' | 'Bearish';
    confidence: number;
    summary: string;
    key_points: string[];
    risks: string[];
}

export function generateExplanation(
    ticker: string,
    trend: TrendSignals,
    flow: FlowSignals,
    fundamental: FundamentalSignals
): AIExplanation {
    let stance: 'Bullish' | 'Neutral' | 'Bearish' = 'Neutral';
    let confidence = 50;

    // 1. 決定主方向 (基於技術面 Trend)
    if (trend.trendScore > 65) {
        stance = 'Bullish';
        confidence = trend.trendScore;
    } else if (trend.trendScore < 35) {
        stance = 'Bearish';
        // 跌勢越重 (分數越低)，看空的 confidence 越高 (100 - score)
        confidence = 100 - trend.trendScore;
    } else {
        stance = 'Neutral';
        // 中立時，分數越接近 50，中立信心越高
        confidence = 100 - Math.abs(50 - trend.trendScore) * 2;
    }

    // 2. 籌碼與基本面調整 Confidence
    // 將 0-100 的分數轉為 -50 到 +50 的差距
    const flowDiff = flow.flowScore - 50;
    const fundDiff = fundamental.fundamentalScore - 50;

    if (stance === 'Bullish') {
        // 偏多時，籌碼/基本面好會加分，壞會扣分 (調整幅度最多 +/- 15)
        confidence += (flowDiff / 50) * 15;
        confidence += (fundDiff / 50) * 15;
    } else if (stance === 'Bearish') {
        // 偏空時，籌碼/基本面差會讓看空信心增加
        confidence += -(flowDiff / 50) * 15;
        confidence += -(fundDiff / 50) * 15;
    } else {
        // 中立時，若兩者同向極端，可能稍微拉低中立信心
        confidence -= (Math.abs(flowDiff) / 50) * 10;
        confidence -= (Math.abs(fundDiff) / 50) * 10;
    }

    confidence = Math.max(0, Math.min(100, Math.round(confidence)));

    // 3. 整理 Key Points & Risks
    const key_points = [
        ...trend.reasons.slice(0, 2),
        ...flow.reasons.slice(0, 2),
        ...fundamental.reasons.slice(0, 1)
    ].filter(Boolean);

    const risks = [
        ...flow.risks,
        // Add some basic rule-based risks if none present
    ];

    if (trend.rsi14 && trend.rsi14 > 80) {
        risks.push(`RSI 高達 ${trend.rsi14.toFixed(1)}，慎防短線過熱回檔。`);
    } else if (trend.rsi14 && trend.rsi14 < 20) {
        risks.push(`RSI 低至 ${trend.rsi14.toFixed(1)}，可能面臨非理性殺盤風險。`);
    }

    // 4. 生成 Summary
    let summary = `**代號 ${ticker}** 目前技術面給出 **${stance}** 的訊號 (Trend Score: ${trend.trendScore})。`;

    if (flow.flowScore > 60) {
        summary += ` 籌碼面呈現強勢 (Score: ${flow.flowScore})，法人買盤進駐有助推升。`;
    } else if (flow.flowScore < 40) {
        summary += ` 籌碼面偏弱 (Score: ${flow.flowScore})，須留意法人賣壓或散戶融資過高。`;
    } else {
        summary += ` 籌碼面中性穩定。`;
    }

    if (fundamental.fundamentalScore > 60) {
        summary += ` 基本面表現亮眼，營收連續成長帶來實質支撐。`;
    } else if (fundamental.fundamentalScore < 40) {
        summary += ` 基本面動能疲弱，營收 YOY 不如預期。`;
    }

    summary += ` 綜合評估信心水準為 ${confidence}%。`;

    return {
        stance,
        confidence,
        summary,
        key_points,
        risks
    };
}
