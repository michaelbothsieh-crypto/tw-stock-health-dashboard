import { describe, it, expect } from 'vitest';
import { generateExplanation } from '../explain';
import { TrendSignals } from '../../signals/trend';
import { FlowSignals } from '../../signals/flow';
import { FundamentalSignals } from '../../signals/fundamental';

describe('generateExplanation', () => {
    it('should return Neutral and low confidence when prices are missing (null trendScore)', () => {
        const trend: TrendSignals = {
            sma20: null, sma60: null, sma120: null,
            rsi14: null, macd: { macdLine: null, signalLine: null, histogram: null },
            return20D: null, return60D: null, volRatio: null,
            trendScore: null, reasons: ["null trend"], risks: []
        };
        const flow: FlowSignals = {
            foreign5D: 0, foreign20D: 0, trust5D: 0, trust20D: 0, marginChange20D: null,
            flowScore: 80, reasons: [], risks: []
        };
        const fund: FundamentalSignals = {
            recent3MoYoyAverage: null, recent6MoYoyAverage: null, yoyTrend: null,
            fundamentalScore: 80, reasons: [], risks: []
        };

        const result = generateExplanation("2330", trend, flow, fund);
        expect(result.stance).toBe('Neutral');
        expect(result.confidence).toBe(30);
        expect(result.summary).toContain("價格資料不足");
    });

    it('should upgrade to Bullish early if Neutral but trend and catalyst are reasonably high', () => {
        const trend: TrendSignals = {
            sma20: null, sma60: null, sma120: null,
            rsi14: null, macd: { macdLine: null, signalLine: null, histogram: null },
            return20D: null, return60D: null, volRatio: null,
            trendScore: 60, reasons: [], risks: []
        };
        const flow: FlowSignals = {
            foreign5D: 0, foreign20D: 0, trust5D: 0, trust20D: 0, marginChange20D: null,
            flowScore: 65, reasons: [], risks: []
        };
        const fund: FundamentalSignals = {
            recent3MoYoyAverage: null, recent6MoYoyAverage: null, yoyTrend: null,
            fundamentalScore: 50, reasons: [], risks: []
        };
        const catalyst = {
            catalystScore: 30, // >= 25 triggers early Bullish
            timeline: [], topBullishNews: [], topBearishNews: []
        };

        const result = generateExplanation("2330", trend, flow, fund, catalyst);

        // Trend 60 is natively Neutral (45~64). But early upgrade triggers (tScore >= 58 && cScore >= 25).
        expect(result.stance).toBe('Bullish');
    });

    it('should deduct confidence points for risk flags', () => {
        const trend: TrendSignals = {
            sma20: null, sma60: null, sma120: null,
            rsi14: null, macd: { macdLine: null, signalLine: null, histogram: null },
            return20D: null, return60D: null, volRatio: null,
            trendScore: 80, reasons: [], risks: ['overheated', 'whipsaw']
        };
        const flow: FlowSignals = {
            foreign5D: 0, foreign20D: 0, trust5D: 0, trust20D: 0, marginChange20D: null,
            flowScore: 80, reasons: [], risks: ['margin_spike']
        };
        const fund: FundamentalSignals = {
            recent3MoYoyAverage: null, recent6MoYoyAverage: null, yoyTrend: null,
            fundamentalScore: 80, reasons: [], risks: []
        };

        // Base confidence starts at 50 + (80-50)*0.6 = 68
        // Flow adds (80-50)*0.3 = 9
        // Fund adds (80-50)*0.2 = 6
        // Pre-risk confidence = 83
        // 3 risks = -15 points (max capped at 15)
        // Expected confidence = 68
        const result = generateExplanation("2330", trend, flow, fund);
        expect(result.confidence).toBe(68);
    });

});
