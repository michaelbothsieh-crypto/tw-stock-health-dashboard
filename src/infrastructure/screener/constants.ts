export const DEFAULT_BREAKOUT_MIN_TURNOVER = 500_000_000;
export const YI = 100_000_000;
export const DEFAULT_BREAKOUT_MIN_RSI = 60;
export const DEFAULT_BREAKOUT_MAX_CROSS_AGE_DAYS = 3;
export const DEFAULT_BREAKOUT_RELATIVE_VOLUME_MULTIPLIER = 2;
export const DEFAULT_BREAKOUT_FAST_EMA = 8;
export const DEFAULT_BREAKOUT_SLOW_EMA = 21;
export const DEFAULT_BREAKOUT_TREND_EMA = 200;

export function getBreakoutMinTurnover(): number {
  const yiRaw = process.env.BREAKOUT_MIN_TURNOVER_YI;
  if (yiRaw) {
    const yi = Number(yiRaw);
    if (Number.isFinite(yi) && yi > 0) return Math.trunc(yi * YI);
  }

  const raw = process.env.BREAKOUT_MIN_TURNOVER;
  if (!raw) return DEFAULT_BREAKOUT_MIN_TURNOVER;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BREAKOUT_MIN_TURNOVER;
  return Math.trunc(parsed);
}

export function getBreakoutMinRsi(): number {
  const raw = process.env.BREAKOUT_MIN_RSI;
  if (!raw) return DEFAULT_BREAKOUT_MIN_RSI;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_BREAKOUT_MIN_RSI;
  return Math.min(Math.max(parsed, 1), 99);
}

export function getBreakoutMaxCrossAgeDays(): number {
  const raw = process.env.BREAKOUT_MAX_CROSS_AGE_DAYS;
  if (!raw) return DEFAULT_BREAKOUT_MAX_CROSS_AGE_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_BREAKOUT_MAX_CROSS_AGE_DAYS;
  return Math.min(Math.max(Math.trunc(parsed), 0), 10);
}

export function getBreakoutRelativeVolumeMultiplier(): number {
  const raw = process.env.BREAKOUT_RELATIVE_VOLUME_MULTIPLIER;
  if (!raw) return DEFAULT_BREAKOUT_RELATIVE_VOLUME_MULTIPLIER;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_BREAKOUT_RELATIVE_VOLUME_MULTIPLIER;
  return Math.min(Math.max(parsed, 0.5), 10);
}

export function getBreakoutFastEma(): number {
  const raw = process.env.BREAKOUT_FAST_EMA;
  if (!raw) return DEFAULT_BREAKOUT_FAST_EMA;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_BREAKOUT_FAST_EMA;
  return Math.min(Math.max(Math.trunc(parsed), 2), 60);
}

export function getBreakoutSlowEma(): number {
  const raw = process.env.BREAKOUT_SLOW_EMA;
  if (!raw) return DEFAULT_BREAKOUT_SLOW_EMA;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_BREAKOUT_SLOW_EMA;
  return Math.min(Math.max(Math.trunc(parsed), 3), 120);
}

export function getBreakoutTrendEma(): number {
  const raw = process.env.BREAKOUT_TREND_EMA;
  if (!raw) return DEFAULT_BREAKOUT_TREND_EMA;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_BREAKOUT_TREND_EMA;
  return Math.min(Math.max(Math.trunc(parsed), 20), 300);
}

export function formatTurnover(value: number): string {
  if (value >= YI) {
    const yi = value / YI;
    return `${Number.isInteger(yi) ? yi.toFixed(0) : yi.toFixed(1)} 億`;
  }
  if (value >= 10_000) {
    const wan = value / 10_000;
    return `${Number.isInteger(wan) ? wan.toFixed(0) : wan.toFixed(1)} 萬`;
  }
  return value.toLocaleString();
}
