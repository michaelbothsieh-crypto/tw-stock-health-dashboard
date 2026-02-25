import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRecentBars } from '../range';
import * as finmind from '../providers/finmind';

vi.mock('../providers/finmind');

describe('fetchRecentBars', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 180 bars if enough data is available in first try', async () => {
        // Mock 200 trading days
        const mockData = Array.from({ length: 200 }, (_, i) => {
            const d = new Date(2024, 0, i + 1);
            return {
                date: d.toISOString().split('T')[0],
                stock_id: '2330',
                Trading_Volume: 1000,
                open: 100,
                max: 105,
                min: 95,
                close: 100 + i,
            };
        });

        vi.mocked(finmind.getPriceDaily).mockResolvedValueOnce(mockData);

        const result = await fetchRecentBars('2330', 180);

        expect(finmind.getPriceDaily).toHaveBeenCalledTimes(1);
        expect(result.barsRequested).toBe(180);
        expect(result.barsReturned).toBe(180);
        expect(result.data.length).toBe(180);
        // Should have the latest bars
        expect(result.data[179].close).toBe(299); // 100 + 199
    });

    it('should retry with expanding range if data is insufficient', async () => {
        // First try returns 100 bars
        const mockData1 = Array.from({ length: 100 }, (_, i) => ({
            date: `2024-01-01`, close: 100
        })) as any[];

        // Second try returns 185 bars
        const mockData2 = Array.from({ length: 185 }, (_, i) => ({
            date: `2024-01-01`, close: 100
        })) as any[];

        vi.mocked(finmind.getPriceDaily)
            .mockResolvedValueOnce(mockData1)
            .mockResolvedValueOnce(mockData2);

        const result = await fetchRecentBars('2330', 180);

        // It should have retried
        expect(finmind.getPriceDaily).toHaveBeenCalledTimes(2);
        expect(result.barsReturned).toBe(180);
    });

    it('should return what it has if max retries exceeded', async () => {
        // Always returns 50 bars
        const mockData = Array.from({ length: 50 }, (_, i) => ({
            date: `2024-01-01`, close: 100
        })) as any[];

        vi.mocked(finmind.getPriceDaily).mockResolvedValue(mockData);

        const result = await fetchRecentBars('2330', 180);

        // Checked 3 times: initial (365), retry 1 (730), retry 2 (900)
        expect(finmind.getPriceDaily).toHaveBeenCalledTimes(3);
        expect(result.barsRequested).toBe(180);
        expect(result.barsReturned).toBe(50);
        expect(result.data.length).toBe(50);
    });

    it('should filter out missing close prices', async () => {
        const mockData = [
            { date: '2024-01-01', close: 100 },
            { date: '2024-01-02', close: null }, // shouldn't be included
            { date: '2024-01-03', close: undefined }, // shouldn't be included
            { date: '2024-01-04', close: 105 },
        ] as any[];

        vi.mocked(finmind.getPriceDaily).mockResolvedValue(mockData);

        const result = await fetchRecentBars('2330', 4);

        expect(result.barsReturned).toBe(2);
        expect(result.data[0].date).toBe('2024-01-01');
        expect(result.data[1].date).toBe('2024-01-04');
    });
});
