import { describe, it, expect } from 'vitest';
import { analyzeSentiment } from '../sentiment';

describe('analyzeSentiment', () => {
    it('defaults RISK to BEARISH with -60 score', () => {
        const res = analyzeSentiment('RISK', '工廠發生小規模火警', '已迅速撲滅');
        // 沒有強烈熊市詞彙，但為 RISK -> 基礎 -60 -> 被判定 BEARISH
        expect(res.impact).toBe('BEARISH');
        expect(res.score).toBe(-60);
    });

    it('boosts BULLISH when strong bullish words are present', () => {
        const res = analyzeSentiment('OTHER', '本月訂單大增，產能滿載');
        expect(res.impact).toBe('BULLISH');
        expect(res.score).toBe(40);
    });

    it('drops BEARISH when strong bearish words are present', () => {
        const res = analyzeSentiment('INDUSTRY', '同業面臨衰退，客戶無預警砍單');
        expect(res.impact).toBe('BEARISH');
        expect(res.score).toBe(-80); // -40(衰退) + -40(砍單)
    });

    it('handles EARNINGS / GUIDANCE context-specific scoring', () => {
        // EARNINGS + 優於預期 = +60
        const resBul = analyzeSentiment('EARNINGS', 'Q3財報優於預期');
        expect(resBul.impact).toBe('BULLISH');
        expect(resBul.score).toBe(100); // EARNINGS/GUIDANCE的"優於預期"=60 + 強烈字眼的"優於預期"40 = 100

        // GUIDANCE + 下修 = -60
        const resBear = analyzeSentiment('GUIDANCE', '法說會下修全年展望');
        expect(resBear.impact).toBe('BEARISH');
        expect(resBear.score).toBe(-100); // "下修" in earnings (-60) + strong bearish "下修" (-40) = -100
    });

    it('clamps scores between -100 and 100', () => {
        // 非常多壞消息組合
        const res = analyzeSentiment('RISK', '大減, 衰退, 下修, 不如預期, 砍單, 違約, 停工');
        expect(res.score).toBe(-100);

        // 非常多好消息組合
        const resBul = analyzeSentiment('EARNINGS', '創新高, 大增, 上修, 優於預期, 獲利大幅');
        expect(resBul.score).toBe(100);
    });

    it('returns NEUTRAL for benign OTHER news', () => {
        const res = analyzeSentiment('OTHER', '公司舉辦股東常會');
        expect(res.impact).toBe('NEUTRAL');
        expect(res.score).toBe(0);
    });
});
