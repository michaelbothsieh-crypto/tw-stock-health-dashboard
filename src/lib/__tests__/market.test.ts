import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectMarket, clearMarketCache } from '../market';
import * as finmind from '../providers/finmind';

// Mock the finmind provider
vi.mock('../providers/finmind', () => ({
    getStockInfo: vi.fn(),
}));

describe('detectMarket', () => {
    beforeEach(() => {
        clearMarketCache();
        vi.clearAllMocks();
    });

    it('should detect TWSE market correctly and cache it', async () => {
        vi.mocked(finmind.getStockInfo).mockResolvedValueOnce([
            { stock_id: '2330', type: 'twse', industry_category: '半導體', stock_name: '台積電' }
        ]);

        const result1 = await detectMarket('2330');
        expect(result1.market).toBe('TWSE');
        expect(result1.yahoo).toBe('2330.TW');
        expect(result1.ambiguous).toBe(false);
        expect(finmind.getStockInfo).toHaveBeenCalledTimes(1);

        // Call again to verify cache
        const result2 = await detectMarket('2330');
        expect(result2).toEqual(result1);
        expect(finmind.getStockInfo).toHaveBeenCalledTimes(1); // should not fetch again
    });

    it('should detect TPEX market correctly', async () => {
        vi.mocked(finmind.getStockInfo).mockResolvedValueOnce([
            { stock_id: '3529', type: 'tpex', stock_name: '力旺' }
        ]);

        const result = await detectMarket('3529');
        expect(result.market).toBe('TPEX');
        expect(result.yahoo).toBe('3529.TWO');
    });

    it('should return UNKNOWN if API fails or returns empty', async () => {
        vi.mocked(finmind.getStockInfo).mockRejectedValueOnce(new Error('API Error'));

        const result = await detectMarket('9999');
        expect(result.market).toBe('UNKNOWN');
        expect(result.yahoo).toBe('9999.TW'); // Fallback to .TW
    });

    it('should return UNKNOWN if type is unrecognized', async () => {
        vi.mocked(finmind.getStockInfo).mockResolvedValueOnce([
            { stock_id: '1234', type: 'weird_type' }
        ]);

        const result = await detectMarket('1234');
        expect(result.market).toBe('UNKNOWN');
        expect(result.yahoo).toBe('1234.TW'); // Fallback
    });
});
