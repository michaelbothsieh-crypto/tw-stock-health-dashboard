import { PriceDaily } from "@/lib/providers/finmind";

export interface ShortTermVolatility {
  volumeSpike: number | null;
  atr14: number | null;
  atrPct: number | null;
  gap: number | null;
  volatilityScore: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function mapVolumeSpikeScore(volumeSpike: number | null): number {
  if (volumeSpike === null || !Number.isFinite(volumeSpike)) return 0;
  if (volumeSpike >= 2) return 35;
  if (volumeSpike >= 1.3) {
    return 15 + ((volumeSpike - 1.3) / 0.7) * 20;
  }
  return clamp((volumeSpike / 1.3) * 15, 0, 15);
}

function mapAtrPctScore(atrPct: number | null): number {
  if (atrPct === null || !Number.isFinite(atrPct)) return 0;
  if (atrPct >= 0.05) return 35;
  if (atrPct >= 0.02) {
    return 15 + ((atrPct - 0.02) / 0.03) * 20;
  }
  return clamp((atrPct / 0.02) * 15, 0, 15);
}

function mapGapScore(gap: number | null): number {
  if (gap === null || !Number.isFinite(gap)) return 0;
  const absGap = Math.abs(gap);
  if (absGap >= 0.03) return 30;
  if (absGap >= 0.01) {
    return 10 + ((absGap - 0.01) / 0.02) * 20;
  }
  return clamp((absGap / 0.01) * 10, 0, 10);
}

function calculateAtr14(bars: PriceDaily[]): number | null {
  if (bars.length < 15) return null;
  const sortedBars = [...bars].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const trueRanges: number[] = [];
  for (let i = 1; i < sortedBars.length; i += 1) {
    const current = sortedBars[i];
    const prev = sortedBars[i - 1];
    const tr = Math.max(
      current.max - current.min,
      Math.abs(current.max - prev.close),
      Math.abs(current.min - prev.close),
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < 14) return null;
  const recent14 = trueRanges.slice(-14);
  const sum = recent14.reduce((acc, value) => acc + value, 0);
  return sum / 14;
}

export function calculateShortTermVolatility(prices: PriceDaily[]): ShortTermVolatility {
  if (!prices || prices.length < 2) {
    return {
      volumeSpike: null,
      atr14: null,
      atrPct: null,
      gap: null,
      volatilityScore: 0,
    };
  }

  const sortedBars = [...prices].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const today = sortedBars[sortedBars.length - 1];
  const yesterday = sortedBars[sortedBars.length - 2];

  const recent20Volumes = sortedBars.slice(-20).map((bar) => bar.Trading_Volume || 0);
  const avg20Volume =
    recent20Volumes.length > 0
      ? recent20Volumes.reduce((acc, value) => acc + value, 0) / recent20Volumes.length
      : 0;

  const volumeSpike = safeDiv(today.Trading_Volume || 0, avg20Volume);
  const atr14 = calculateAtr14(sortedBars);
  const atrPct = atr14 !== null ? safeDiv(atr14, today.close) : null;
  const gap = safeDiv(today.open, yesterday.close);
  const normalizedGap = gap === null ? null : gap - 1;

  const volumeScore = mapVolumeSpikeScore(volumeSpike);
  const atrScore = mapAtrPctScore(atrPct);
  const gapScore = mapGapScore(normalizedGap);

  const volatilityScore = clamp(Math.round(volumeScore + atrScore + gapScore), 0, 100);

  return {
    volumeSpike,
    atr14,
    atrPct,
    gap: normalizedGap,
    volatilityScore,
  };
}
