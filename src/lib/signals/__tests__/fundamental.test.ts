import { describe, it, expect } from 'vitest';
import { calculateFundamental } from '../fundamental';
import { MonthlyRevenue } from '../../providers/finmind';

describe('calculateFundamental', () => {
    function generateRevenueData(months: number, yoyGetter: (idx: number) => number): MonthlyRevenue[] {
        const data: MonthlyRevenue[] = [];
        let curYear = 2024;
        let curMonth = 1;
        for (let i = 0; i < months; i++) {
            data.push({
                date: `${curYear}-${String(curMonth).padStart(2, '0')}-01`,
                stock_id: '2330',
                country: 'Taiwan',
                revenue_year: curYear,
                revenue_month: curMonth,
                revenue: 1000000 * (1 + (yoyGetter(i) / 100)),
                revenue_year_on_year: yoyGetter(i)
            } as any);
            curMonth++;
            if (curMonth > 12) {
                curMonth = 1;
                curYear++;
            }
        }
        return data; // returns Old -> New
    }

    it('should return null if data length is less than 8 months', () => {
        const rev = generateRevenueData(7, () => 10);
        const result = calculateFundamental(rev);
        expect(result.fundamentalScore).toBeNull();
        expect(result.reasons[0]).toContain("營收資料不足");
    });

    it('should calculate valid score with consistent high growth', () => {
        const rev = generateRevenueData(8, () => 30); // 30% YoY constant
        const result = calculateFundamental(rev);
        expect(result.fundamentalScore).not.toBeNull();

        // baseScore should be 95 (y3 >= 25)
        // accelScore should be 0 (trend3 is 0)
        // consistency_adj should be +5 (>=2 months > 20)
        // total: 100
        expect(result.fundamentalScore).toBe(100);
        expect(result.reasons.some(r => r.includes("連續高成長"))).toBe(true);
    });

    it('should trigger rev_turn_negative risk when negative yoy occurs', () => {
        // First 5 months 10%, last 3 months -5%
        const rev = generateRevenueData(8, (i) => i < 5 ? 10 : -5);
        const result = calculateFundamental(rev);

        expect(result.risks).toContain("rev_turn_negative");
    });

    it('should trigger growth_decelerating risk when trend3 <= -10', () => {
        // Prev 3 avg is +20, latest 3 avg is +5. Trend3 = -15
        const rev = generateRevenueData(8, (i) => {
            if (i >= 2 && i < 5) return 20; // prev 3
            if (i >= 5) return 5; // latest 3
            return 10;
        });
        const result = calculateFundamental(rev);

        expect(result.risks).toContain("growth_decelerating");
    });
});
