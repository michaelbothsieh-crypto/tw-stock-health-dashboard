import { describe, it, expect } from 'vitest';
import { calculateTrend } from '../trend';
import { PriceDaily } from '../../providers/finmind';

describe('calculateTrend', () => {
    // 產生一個基礎的 mock 資料集 (N=130 才能計算)
    function generateMockData(count: number, basePrice: number, baseVolume: number = 1000): PriceDaily[] {
        const data: PriceDaily[] = [];
        const today = new Date();
        for (let i = count; i >= 1; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            data.push({
                date: date.toISOString().split('T')[0],
                stock_id: '2330',
                open: basePrice,
                max: basePrice * 1.01,
                min: basePrice * 0.99,
                close: basePrice,
                Trading_Volume: baseVolume,
                Trading_money: basePrice * baseVolume,
                Trading_turnover: 100,
            });
        }
        return data;
    }

    it('should return null scores if data length is less than 130', () => {
        const data = generateMockData(129, 100);
        const result = calculateTrend(data);
        expect(result.trendScore).toBeNull();
        expect(result.reasons[0]).toContain("資料量不足");
    });

    it('should calculate valid trend score with constant price data', () => {
        const data = generateMockData(130, 100);
        const result = calculateTrend(data);
        expect(result.trendScore).not.toBeNull();
        expect(result.sma20).toBe(100);
        expect(result.sma60).toBe(100);
        expect(result.sma120).toBe(100);
        // RSI of constant prices should be mid-range (or 100 max depending on smoothing init, but flat means 100 loss is 0)
        // With Wilder's smoothing flat prices produce avgLoss = 0, so RSI = 100 or undefined. Our logic returns 100.
    });

    it('should calculate bullish alignment score correctly', () => {
        const data = generateMockData(130, 100);
        // Make recent prices go up smoothly to form a bullish alignment
        for (let i = 0; i < 130; i++) {
            data[i].close = 100 + i * 0.5; // Upward trend
        }
        const result = calculateTrend(data);
        expect(result.trendScore).not.toBeNull();
        expect(result.sma20).toBeGreaterThan(result.sma60!);
        expect(result.sma60).toBeGreaterThan(result.sma120!);
        // Since it's a strongly upward price, RSI should be high and score should be solid.
        expect(result.reasons.some(r => r.includes("多頭排列"))).toBe(true);
    });

    it('should filter out missing close prices and calculate correctly', () => {
        const data = generateMockData(131, 100);
        // deliberately set one close to undefined (simulating missing data via 'as any' since type doesn't allow it, but in JS it might happen)
        (data[50] as any).close = null;
        const result = calculateTrend(data);
        expect(result.trendScore).not.toBeNull();
        // Since we had 131, and removed 1, length is 130 => sufficient.
    });

    it('should add volume_missing flag if latest volume is 0', () => {
        const data = generateMockData(130, 100);
        data[129].Trading_Volume = 0;
        const result = calculateTrend(data);
        expect(result.risks).toContain("volume_missing");
    });
});
