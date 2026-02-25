import { describe, it, expect } from 'vitest';
import { calculateFlow } from '../flow';
import { InstitutionalInvestor, MarginShort } from '../../providers/finmind';

describe('calculateFlow', () => {
    function generateInstData(days: number, name: string, netBuy: number): InstitutionalInvestor[] {
        const data: InstitutionalInvestor[] = [];
        const today = new Date();
        for (let i = days; i >= 1; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            data.push({
                date: date.toISOString().split('T')[0],
                stock_id: '2330',
                name: name,
                buy: netBuy > 0 ? netBuy : 0,
                sell: netBuy < 0 ? -netBuy : 0,
            });
        }
        return data; // returns Old -> New
    }

    function generateMarginData(days: number, changeRate: number): MarginShort[] {
        const data: MarginShort[] = [];
        const today = new Date();
        const baseBalance = 10000;
        for (let i = days; i >= 1; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            // Linear scale: from day `days` (oldest, factor=0) to day `1` (newest, factor=changeRate)
            const fraction = (days - i) / (days - 1); // 0 at oldest, 1 at newest
            const currentBalance = baseBalance * (1 + changeRate * fraction);
            data.push({
                date: date.toISOString().split('T')[0],
                stock_id: '2330',
                MarginPurchaseTodayBalance: currentBalance,
            } as any);
        }
        return data;
    }

    it('should return null if data length is less than 30 unique dates', () => {
        const inst = generateInstData(29, "外資", 100);
        const margin = generateMarginData(29, 0);
        const tradingDates = inst.map(d => d.date).sort();
        const result = calculateFlow(tradingDates, inst, margin);
        expect(result.flowScore).toBeNull();
        expect(result.reasons[0]).toContain("資料量不足");
    });

    it('should calculate valid flow score and identify foreign buy', () => {
        const instForeign = generateInstData(30, "外資", 100);
        const instTrust = generateInstData(30, "投信", 50);
        const margin = generateMarginData(30, 0); // no change
        const tradingDates = instForeign.map(d => d.date).sort();
        const result = calculateFlow(tradingDates, [...instForeign, ...instTrust], margin);

        expect(result.flowScore).not.toBeNull();
        expect(result.foreign5D).toBe(500); // 5 days * 100
        expect(result.foreign20D).toBe(2000); // 20 days * 100
        expect(result.reasons.some(r => r.includes("外資近 5 日與 20 日皆為買超"))).toBe(true);
    });

    it('should trigger margin_spike risk when margin increases significantly', () => {
        const instForeign = generateInstData(30, "外資", 100);
        const instTrust = generateInstData(30, "投信", 50);
        // We want the 20-day change to be >= +15%.
        // Our margin array goes from DateIdx 30..1. The latest 20 dates are DateIdx 20..1.
        // The fraction at oldest of 20 days is (30-20)/(29) = 10/29.
        // The fraction at newest is 29/29 = 1.
        // Difference is 19/29. So 19/29 * changeRate >= 0.15 => changeRate >= 0.23.
        const margin = generateMarginData(30, 0.25); // Set to 25% overall change
        const tradingDates = instForeign.map(d => d.date).sort();
        const result = calculateFlow(tradingDates, [...instForeign, ...instTrust], margin);

        expect(result.risks).toContain("margin_spike");
    });

    it('should penalize and flag risk when data is missing more than 20%', () => {
        // Need to pass the `uniqueDates.length >= 30` check.
        // We can do this by having another investor provide the dates.
        const instTrust = generateInstData(30, "投信", 50);
        const instForeignFull = generateInstData(30, "外資", 100);
        // We configure tradingDates BEFORE removing missing data
        const tradingDates = instForeignFull.map(d => d.date).sort();

        // Remove 5 days of "外資" data from the recent 20 days.
        const instForeign = [...instForeignFull];
        instForeign.splice(instForeign.length - 10, 5);

        const margin = generateMarginData(30, 0);
        const result = calculateFlow(tradingDates, [...instForeign, ...instTrust], margin);

        expect(result.risks.some(r => r.includes("資料缺漏比例偏高"))).toBe(true);
    });
});
