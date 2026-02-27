export interface NormalizedTicker {
    symbol: string;
    market: 'TWSE' | 'TPEX' | 'UNKNOWN';
    yahoo: string;
    display: string;
}

export function normalizeTicker(input: string): NormalizedTicker {
    // 1. 基本清理: trim, 轉大寫, 去除多餘空白
    // 如果是包含逗號或空白的清單，先以第一個元素為主來解析
    let cleanInput = input.trim().toUpperCase();
    const parts = cleanInput.split(/[\s,]+/);
    if (parts.length > 0 && parts[0] !== '') {
        cleanInput = parts[0];
    }

    let symbol = '';
    let market: 'TWSE' | 'TPEX' | 'UNKNOWN' = 'UNKNOWN';
    let yahoo = '';

    // 2. 正則判斷
    const pureNumberMatch = cleanInput.match(/^(\d{4,6})$/);
    const suffixMatch = cleanInput.match(/^(\d{4,6})\.(TW|TWO)$/);
    const usSymbolMatch = cleanInput.match(/^[A-Z]{1,5}$/);

    if (pureNumberMatch) {
        symbol = pureNumberMatch[1];
        market = 'UNKNOWN';
        yahoo = `${symbol}.TW`; // 預設用 .TW, 後續由 market.ts 修正
    } else if (suffixMatch) {
        symbol = suffixMatch[1];
        const suffix = suffixMatch[2];
        if (suffix === 'TW') {
            market = 'TWSE';
            yahoo = `${symbol}.TW`;
        } else if (suffix === 'TWO') {
            market = 'TPEX';
            yahoo = `${symbol}.TWO`;
        }
    } else if (usSymbolMatch) {
        symbol = cleanInput;
        market = 'UNKNOWN'; // US stocks don't map to TW exchanges
        yahoo = symbol;
    } else {
        throw new Error(`InvalidTickerFormat: 無效的股票代碼格式 '${input}'`);
    }

    // display 暫時僅顯示 symbol，若後續有名稱表可以擴充
    const display = symbol;

    return {
        symbol,
        market,
        yahoo,
        display
    };
}
