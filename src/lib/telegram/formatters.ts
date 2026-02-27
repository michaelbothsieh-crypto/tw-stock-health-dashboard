export type BasicBar = {
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  max?: number;
  min?: number;
  Trading_Volume?: number;
};

const MAJOR_NEWS_KEYWORDS = [
  "財測",
  "下修",
  "法說",
  "制裁",
  "訴訟",
  "停工",
  "併購",
  "重大投資",
  "增資",
  "減資",
  "違約",
  "爆雷",
  "裁員",
  "重大缺陷",
];

function toFinite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function roundTo(value: number, digits = 1): number {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

export function formatPrice(value: number | null | undefined, digits = 2): string {
  const n = toFinite(value);
  if (n === null) return "—";
  return n.toFixed(digits);
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  const n = toFinite(value);
  if (n === null) return "—";
  return `${n.toFixed(digits)}%`;
}

export function formatSignedPct(value: number | null | undefined, digits = 1): string {
  const n = toFinite(value);
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function humanizeNumber(value: number | null | undefined): string {
  const n = toFinite(value);
  if (n === null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${n / 1e8 >= 0 ? "" : "-"}${(abs / 1e8).toFixed(2)}億`;
  if (abs >= 1e4) return `${n / 1e4 >= 0 ? "" : "-"}${(abs / 1e4).toFixed(2)}萬`;
  return Math.round(n).toLocaleString("zh-TW");
}

export function clampTextLength(text: string, max = 90): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function syncLevel(corr: number | null | undefined): string {
  const n = toFinite(corr);
  if (n === null) return "—";
  const abs = Math.abs(n);
  if (abs < 0.15) return "低";
  if (abs < 0.35) return "中";
  return "高";
}

export function buildStanceText(shortDir?: string | null, strategyText?: string | null, _confidence?: number | null): string {
  const s = shortDir ?? "";
  const st = strategyText ?? "";

  if (s.includes("偏空") || st.includes("偏空") || st.includes("減碼")) return "偏空需防守";
  if (s.includes("偏多") && (st.includes("進場") || st.includes("加碼"))) return "偏多偏積極";
  if (s.includes("偏多")) return "偏多可續抱";
  if ((s.includes("中立") || s === "") && st.includes("觀察")) return "中立偏觀察";
  return "中立觀望";
}

export function detectMajorNews(title: string): boolean {
  const t = title || "";
  return MAJOR_NEWS_KEYWORDS.some((kw) => t.includes(kw));
}

export function buildNewsLine(title?: string | null, maxLen = 90): string {
  if (!title || !title.trim()) return "—";
  const clipped = clampTextLength(title.trim(), maxLen);
  return `${detectMajorNews(clipped) ? "⚠️" : "📰"} ${clipped}`;
}

export function buildNewsFlag(title?: string | null): string {
  if (!title || !title.trim()) return "—";
  return detectMajorNews(title) ? "⚠️" : "📰";
}

export function calcSupportResistance(bars: BasicBar[]): {
  support: number | null;
  resistance: number | null;
  bullTarget: number | null;
  bearTarget: number | null;
} {
  const last20 = bars.slice(-20);
  const highs = last20
    .map((b) => toFinite(b.high) ?? toFinite(b.max))
    .filter((v): v is number => v !== null);
  const lows = last20
    .map((b) => toFinite(b.low) ?? toFinite(b.min))
    .filter((v): v is number => v !== null);

  if (highs.length === 0 || lows.length === 0) {
    return { support: null, resistance: null, bullTarget: null, bearTarget: null };
  }

  const support = Math.min(...lows);
  const resistance = Math.max(...highs);
  const range = resistance - support;

  return {
    support: roundTo(support, 1),
    resistance: roundTo(resistance, 1),
    bullTarget: roundTo(resistance + range * 0.5, 1),
    bearTarget: roundTo(support - range * 0.5, 1),
  };
}

export function calcVolumeVs5d(bars: BasicBar[]): { volume: number | null; volumeVs5dPct: number | null } {
  if (!bars || bars.length === 0) return { volume: null, volumeVs5dPct: null };

  const volumes = bars
    .map((b) => toFinite(b.volume) ?? toFinite(b.Trading_Volume))
    .filter((v): v is number => v !== null);

  if (volumes.length === 0) return { volume: null, volumeVs5dPct: null };

  const latest = volumes[volumes.length - 1];
  const prev5 = volumes.slice(Math.max(0, volumes.length - 6), volumes.length - 1);
  if (prev5.length === 0) return { volume: latest, volumeVs5dPct: null };

  const avg5 = prev5.reduce((a, b) => a + b, 0) / prev5.length;
  if (!Number.isFinite(avg5) || avg5 <= 0) return { volume: latest, volumeVs5dPct: null };

  return {
    volume: latest,
    volumeVs5dPct: ((latest - avg5) / avg5) * 100,
  };
}

export function parseSignedNumberLoose(input: string | null | undefined): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[^0-9+\-.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
