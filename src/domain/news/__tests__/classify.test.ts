import { describe, it, expect } from 'vitest';
import { classifyNews } from '../classify';

describe('classifyNews', () => {
    it('catches EARNINGS accurately', () => {
        expect(classifyNews('台積電Q3財報亮眼，EPS再創新高')).toBe('EARNINGS');
        expect(classifyNews('鴻海10月營收雙增')).toBe('EARNINGS');
    });

    it('catches GUIDANCE accurately', () => {
        expect(classifyNews('大立光釋出Q4展望，預估稼動率滿載')).toBe('GUIDANCE');
        expect(classifyNews('廣達下修全年筆電出貨指引')).toBe('GUIDANCE');
    });

    it('catches RISK accurately', () => {
        expect(classifyNews('某科技廠遭駭客攻擊，資安拉警報')).toBe('RISK');
        expect(classifyNews('工廠大火導致停工，恐影響後續交期', '產線損毀嚴重')).toBe('RISK');
    });

    it('catches MNA accurately', () => {
        expect(classifyNews('國巨宣布併購歐洲感測器大廠')).toBe('MNA');
        expect(classifyNews('聯發科入股達發，強化網通佈局')).toBe('MNA');
    });

    it('catches GOV_REG accurately', () => {
        expect(classifyNews('美國擴大對中晶片管制禁令')).toBe('GOV_REG');
        expect(classifyNews('金管會祭出新法規，嚴管外資借券')).toBe('GOV_REG');
    });

    it('catches MACRO accurately', () => {
        expect(classifyNews('聯準會Fed宣布不升息，符合市場預期')).toBe('MACRO');
        expect(classifyNews('台灣8月CPI微幅攀升')).toBe('MACRO');
    });

    it('catches INDUSTRY accurately', () => {
        expect(classifyNews('蘋果iPhone 15供應鏈動起來')).toBe('INDUSTRY');
        expect(classifyNews('記憶體同業減產效應浮現')).toBe('INDUSTRY');
    });

    it('returns OTHER when no keywords match', () => {
        expect(classifyNews('台股早盤開高走低，終場小跌10點')).toBe('OTHER');
        expect(classifyNews('董事長出席公益活動', '發表感言')).toBe('OTHER');
    });

    it('respects priority matching (EARNINGS > RISK/MNA)', () => {
        // 含「財報」與「下修」，應判定為 EARNINGS 或 GUIDANCE (依 priority 設定 EARNINGS 最高)
        expect(classifyNews('法說會釋出利空，第三季財報不如預期，同時下修Q4展望')).toBe('EARNINGS');
    });
});
