import { describe, it, expect } from 'vitest';
import { normalizeTicker } from "@/shared/utils/ticker";

describe('normalizeTicker', () => {
    it('should parse 4-digit symbol correctly', () => {
        const result = normalizeTicker('2330');
        expect(result.symbol).toBe('2330');
        // Current implementation defaults numeric to TWSE
        expect(result.market).toBe('TWSE');
        expect(result.yahoo).toBe('2330.TW');
    });

    it('should parse symbol with .TW suffix correctly', () => {
        const result = normalizeTicker('2330.TW');
        expect(result.symbol).toBe('2330');
        expect(result.market).toBe('TWSE');
        expect(result.yahoo).toBe('2330.TW');
    });

    it('should parse symbol with .TWO suffix correctly', () => {
        const result = normalizeTicker('3231.two');
        expect(result.symbol).toBe('3231');
        expect(result.market).toBe('TPEX');
        expect(result.yahoo).toBe('3231.TWO');
    });

    it('should handle extra spaces', () => {
        const result = normalizeTicker('  2317.tw  ');
        expect(result.symbol).toBe('2317');
        expect(result.market).toBe('TWSE');
    });
});
