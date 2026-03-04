import { Resvg } from '@resvg/resvg-js';
import { NOTO_SANS_BOLD_B64 } from './fontData';

export interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function e(n: number, d = 1): string {
  return n.toFixed(d);
}

function calcMA(allData: ChartDataPoint[], startIndex: number, i: number, period: number): number | null {
  const realIdx = startIndex + i;
  const slice = allData.slice(Math.max(0, realIdx - period + 1), realIdx + 1);
  if (slice.length < period) return null;
  return slice.reduce((sum, d) => sum + d.close, 0) / period;
}

export async function renderStockChart(
  allData: ChartDataPoint[],
  support: number | null,
  resistance: number | null,
  symbol: string,
  visibleCount: number = 180
): Promise<Buffer> {
  const width = 1200;
  const height = 650;
  const pad = { top: 70, right: 120, bottom: 70, left: 60 };

  const startIndex = Math.max(0, allData.length - visibleCount);
  const visibleData = allData.slice(startIndex);

  if (visibleData.length < 2) {
    // Return a minimal blank image
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#121212"/></svg>`;
    const resvg = new Resvg(svg, { font: { fontBuffers: [Buffer.from(NOTO_SANS_BOLD_B64, 'base64')] } });
    return Buffer.from(resvg.render().asPng());
  }

  const prices = visibleData.flatMap(d => [d.high, d.low]);
  const minPrice = Math.min(...prices) * 0.98;
  const maxPrice = Math.max(...prices) * 1.02;
  const priceRange = maxPrice - minPrice;
  const maxVol = Math.max(...visibleData.map(d => d.volume), 1);
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const getX = (i: number) => pad.left + (i * chartW / (visibleData.length - 1));
  const getY = (price: number) => pad.top + (maxPrice - price) * chartH / priceRange;
  const barWidth = Math.max(1.5, chartW / visibleData.length * 0.6);

  const parts: string[] = [];

  // ── 1. Background ──────────────────────────────────────────────────────────
  parts.push(`<rect width="${width}" height="${height}" fill="#121212"/>`);

  // ── 2. Grid lines + Y-axis labels ─────────────────────────────────────────
  for (let i = 0; i <= 8; i++) {
    const y = pad.top + i * chartH / 8;
    const p = maxPrice - i * priceRange / 8;
    parts.push(`<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#262626" stroke-width="1" stroke-dasharray="5,5"/>`);
    parts.push(`<text x="${width - pad.right + 10}" y="${y + 4}" fill="#6b7280" font-family="NotoSans" font-size="12" font-weight="bold">${e(p, 1)}</text>`);
  }

  // ── 3. X-axis date labels ──────────────────────────────────────────────────
  const labelInterval = Math.ceil(visibleData.length / 6);
  visibleData.forEach((d, i) => {
    if (i % labelInterval === 0 || i === visibleData.length - 1) {
      const x = getX(i);
      const label = d.date?.substring(5) || '';
      parts.push(`<text x="${x}" y="${height - pad.bottom + 20}" fill="#6b7280" font-family="NotoSans" font-size="12" font-weight="bold" text-anchor="middle">${label}</text>`);
    }
  });

  // ── 4. Volume bars ─────────────────────────────────────────────────────────
  const volBaseY = height - pad.bottom;
  visibleData.forEach((d, i) => {
    const x = getX(i);
    const vHeight = (d.volume / maxVol) * (height * 0.12);
    const color = d.close >= d.open ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)';
    parts.push(`<rect x="${x - barWidth / 2}" y="${volBaseY - vHeight}" width="${barWidth}" height="${vHeight}" fill="${color}"/>`);
  });

  // ── 5. MA lines ────────────────────────────────────────────────────────────
  const drawMA = (period: number, color: string, strokeWidth: number) => {
    const pts: string[] = [];
    for (let i = 0; i < visibleData.length; i++) {
      const avg = calcMA(allData, startIndex, i, period);
      if (avg === null) continue;
      const x = getX(i);
      const y = getY(avg);
      pts.push(pts.length === 0 ? `M${e(x, 2)},${e(y, 2)}` : `L${e(x, 2)},${e(y, 2)}`);
    }
    if (pts.length > 1) {
      parts.push(`<path d="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>`);
    }
  };
  drawMA(5, '#ffffff', 1);
  drawMA(20, '#f59e0b', 2);
  drawMA(60, '#3b82f6', 2);

  // ── 6. Trend lines ─────────────────────────────────────────────────────────
  const mid = Math.floor(visibleData.length / 2);
  let p1 = { price: 0, i: 0 }, p2 = { price: 0, i: 0 };
  visibleData.forEach((d, i) => {
    if (i < mid && d.high > p1.price) p1 = { price: d.high, i };
    if (i >= mid && d.high > p2.price) p2 = { price: d.high, i };
  });
  if (p1.price > 0 && p2.price > 0) {
    const slope = (p2.price - p1.price) / (p2.i - p1.i);
    const endPrice = p1.price + slope * (visibleData.length - 1 - p1.i);
    parts.push(`<line x1="${e(getX(p1.i), 2)}" y1="${e(getY(p1.price), 2)}" x2="${e(getX(visibleData.length - 1), 2)}" y2="${e(getY(endPrice), 2)}" stroke="rgba(239,68,68,0.5)" stroke-width="1.5" stroke-dasharray="3,3"/>`);
  }
  let s1 = { price: Infinity, i: 0 }, s2 = { price: Infinity, i: 0 };
  visibleData.forEach((d, i) => {
    if (i < mid && d.low < s1.price) s1 = { price: d.low, i };
    if (i >= mid && d.low < s2.price) s2 = { price: d.low, i };
  });
  if (s1.price < Infinity && s2.price < Infinity) {
    const slope = (s2.price - s1.price) / (s2.i - s1.i);
    const endPrice = s1.price + slope * (visibleData.length - 1 - s1.i);
    parts.push(`<line x1="${e(getX(s1.i), 2)}" y1="${e(getY(s1.price), 2)}" x2="${e(getX(visibleData.length - 1), 2)}" y2="${e(getY(endPrice), 2)}" stroke="rgba(34,197,94,0.5)" stroke-width="1.5" stroke-dasharray="3,3"/>`);
  }

  // ── 7. Candlesticks ────────────────────────────────────────────────────────
  visibleData.forEach((d, i) => {
    const x = getX(i);
    const color = d.close >= d.open ? '#ef4444' : '#22c55e';
    const yHigh = getY(d.high);
    const yLow = getY(d.low);
    const yTop = getY(Math.max(d.open, d.close));
    const yBot = getY(Math.min(d.open, d.close));
    const bodyH = Math.max(Math.abs(yBot - yTop), 1);
    parts.push(`<line x1="${e(x, 2)}" y1="${e(yHigh, 2)}" x2="${e(x, 2)}" y2="${e(yLow, 2)}" stroke="${color}" stroke-width="1"/>`);
    parts.push(`<rect x="${e(x - barWidth / 2, 2)}" y="${e(yTop, 2)}" width="${e(barWidth, 2)}" height="${e(bodyH, 2)}" fill="${color}"/>`);
  });

  // ── 8. Price tag (last close) ──────────────────────────────────────────────
  const last = visibleData[visibleData.length - 1];
  const lastY = getY(last.close);
  const tagX = width - pad.right + 5;
  const boxW = 80;
  const boxH = 24;
  const arrowPts = `${tagX},${e(lastY, 2)} ${tagX + 8},${e(lastY - boxH / 2, 2)} ${tagX + boxW},${e(lastY - boxH / 2, 2)} ${tagX + boxW},${e(lastY + boxH / 2, 2)} ${tagX + 8},${e(lastY + boxH / 2, 2)}`;
  parts.push(`<polygon points="${arrowPts}" fill="#facc15"/>`);
  parts.push(`<text x="${tagX + 12}" y="${e(lastY + 4.5, 2)}" fill="#000" font-family="NotoSans" font-size="13" font-weight="bold">${last.close.toFixed(2)}</text>`);

  // ── 9. Legend ──────────────────────────────────────────────────────────────
  const legendItems: Array<{ color: string; label: string; isRect?: boolean }> = [
    { color: '#ffffff', label: 'MA5' },
    { color: '#f59e0b', label: 'MA20' },
    { color: '#3b82f6', label: 'MA60' },
  ];
  let lx = pad.left;
  legendItems.forEach(({ color, label }) => {
    parts.push(`<rect x="${lx}" y="29" width="15" height="3" fill="${color}"/>`);
    parts.push(`<text x="${lx + 20}" y="33" fill="#9ca3af" font-family="NotoSans" font-size="12" font-weight="bold" dominant-baseline="middle">${label}</text>`);
    lx += 75;
  });
  parts.push(`<rect x="${lx + 10}" y="25" width="8" height="12" fill="#ef4444"/>`);
  parts.push(`<rect x="${lx + 20}" y="25" width="8" height="12" fill="#22c55e"/>`);
  parts.push(`<text x="${lx + 35}" y="33" fill="#9ca3af" font-family="NotoSans" font-size="12" font-weight="bold" dominant-baseline="middle">Trend (Red Up / Green Down)</text>`);

  // ── Assemble SVG ───────────────────────────────────────────────────────────
  const fontFace = `@font-face { font-family: 'NotoSans'; src: url('data:font/ttf;base64,${NOTO_SANS_BOLD_B64}'); font-weight: bold; }`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<defs><style>${fontFace}</style></defs>`,
    ...parts,
    `</svg>`,
  ].join('');

  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [Buffer.from(NOTO_SANS_BOLD_B64, 'base64')],
      defaultFontFamily: 'NotoSans',
      defaultFontSize: 13,
    },
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}
