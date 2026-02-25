import { describe, it, expect } from 'vitest';
import { calculateCatalystScore } from '../catalystScore';

describe('calculateCatalystScore', () => {
    it('returns empty result when no news provided', () => {
        const res = calculateCatalystScore([]);
        expect(res.catalystScore).toBe(0);
        expect(res.timeline).toHaveLength(0);
        expect(res.topBullishNews).toHaveLength(0);
        expect(res.topBearishNews).toHaveLength(0);
    });

    it('calculates weighted score with time decay correctly', () => {
        const targetDate = new Date('2024-01-10T12:00:00Z');

        const newsInput = [
            {
                stock_id: '2330',
                date: '2024-01-10T10:00:00Z', // age = 0 days -> decay = 1
                title: '台積電Q4財報獲利大幅優於預期', // EARNINGS (60) + BULLISH (40) = 100
            },
            {
                stock_id: '2330',
                date: '2024-01-07T10:00:00Z', // age = 3 days -> decay = Math.exp(-1) ~= 0.367
                title: '某科技廠遭駭客攻擊，資安拉警報', // RISK (-60)
            }
        ];

        const res = calculateCatalystScore(newsInput, targetDate, 7);

        // Raw score: 100 * 1 + (-60) * 0.367 = 100 - 22.02 = 77.98
        // catalystScore = round(77.98 / 3) = 26
        expect(res.catalystScore).toBe(26);

        expect(res.timeline.length).toBe(2);

        expect(res.topBullishNews.length).toBe(1);
        expect(res.topBullishNews[0].title).toContain('台積電');

        expect(res.topBearishNews.length).toBe(1);
        expect(res.topBearishNews[0].title).toContain('駭客');
    });

    it('filters out news older than lookbackDays', () => {
        const targetDate = new Date('2024-01-10T12:00:00Z');
        const newsInput = [
            {
                stock_id: '2330',
                date: '2024-01-01T10:00:00Z', // 9 days old (lookback is 7)
                title: '大爆發',
            }
        ];

        const res = calculateCatalystScore(newsInput, targetDate, 7);
        expect(res.timeline.length).toBe(0);
        expect(res.catalystScore).toBe(0);
    });

    it('clamps catalyst score to [-100, 100]', () => {
        const targetDate = new Date('2024-01-10T12:00:00Z');
        // Produce huge score
        const newsInput = Array(10).fill(null).map((_, i) => ({
            stock_id: '2330',
            date: '2024-01-10T10:00:00Z',
            title: '大增創新高優於預期' // 100 score each
        }));

        const res = calculateCatalystScore(newsInput, targetDate, 7);
        expect(res.catalystScore).toBe(100); // capped at 100
    });
});
