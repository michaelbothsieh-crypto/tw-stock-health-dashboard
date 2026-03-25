import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { NOTO_SANS_BOLD_B64 } from './fontData';
import { getCompanyNameZh } from '@/lib/companyName';
import * as opentype from 'opentype.js';
import path from 'path';

export interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 字型快取
let _otFont: opentype.Font | null = null;
function getOtFont() {
  if (_otFont) return _otFont;
  try {
    const fontPath = path.join(process.cwd(), 'public/fonts/NotoSans-Bold.ttf');
    _otFont = opentype.loadSync(fontPath);
    return _otFont;
  } catch (e) {
    console.error('Failed to load opentype font:', e);
    return null;
  }
}

/**
 * 使用 opentype.js 將文字繪製為路徑 (避免中文亂碼/方塊)
 */
function drawTextAsPath(ctx: any, text: string, x: number, y: number, fontSize: number, color: string, options: { textAlign?: 'left' | 'right' | 'center' } = {}) {
  const font = getOtFont();
  if (!font) {
    // Fallback to fillText if font not loaded
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
    ctx.fillText(text, x, y);
    return;
  }

  const align = options.textAlign || 'left';
  let drawX = x;
  
  if (align !== 'left') {
    const width = font.getAdvanceWidth(text, fontSize);
    if (align === 'right') drawX = x - width;
    else if (align === 'center') drawX = x - width / 2;
  }

  const path = font.getPath(text, drawX, y, fontSize);
  ctx.fillStyle = color;
  
  // napi-rs/canvas 的 ctx 可以直接執行 opentype path 的 draw
  // 或者手動轉換
  const svgPath = path.toPathData(2); 
  // 這裡我們需要一個簡單的方法將 opentype path 畫到 canvas ctx 上
  // opentype 的 path 對象有 draw(ctx) 方法
  path.fill = color;
  path.draw(ctx);
}

// 字型只需要註冊一次（module-level singleton）
// fontData.ts 內嵌真正的 NotoSans-Bold.otf base64，無需 filesystem 或 HTTP
let _fontsRegistered = false;
const FONT_FAMILY = 'NotoSans';

function ensureFonts() {
  if (_fontsRegistered) return;
  const buf = Buffer.from(NOTO_SANS_BOLD_B64, 'base64');
  GlobalFonts.register(buf, FONT_FAMILY);
  _fontsRegistered = true;
}

export async function renderStockChart(
  allData: ChartDataPoint[],
  support: number | null,
  resistance: number | null,
  symbol: string,
  visibleCount: number = 180,
  options: { width?: number; height?: number } = {}
): Promise<Buffer> {
  ensureFonts();

  const width = options.width ?? 1200;
  const height = options.height ?? 650;
  const padding = { top: 70, right: 120, bottom: 70, left: 60 };
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const FONT_SANS = `bold 13px ${FONT_FAMILY}`;

  const startIndex = Math.max(0, allData.length - visibleCount);
  
  // 0. 資料清洗：排除價格異常點
  // 先計算中位數作為基準，排除掉與中位數差異過大（例如低於 10%）的髒資料
  const validCloses = allData.map(d => d.close).filter(c => c > 0).sort((a, b) => a - b);
  const medianPrice = validCloses.length > 0 ? validCloses[Math.floor(validCloses.length / 2)] : 0;
  
  const cleanData = allData.filter(d => {
    const isNormal = d.close > medianPrice * 0.1 && d.close < medianPrice * 10 &&
                     d.open > medianPrice * 0.1 && d.open < medianPrice * 10 &&
                     d.high > medianPrice * 0.1 && d.high < medianPrice * 10 &&
                     d.low > medianPrice * 0.1 && d.low < medianPrice * 10;
    return isNormal;
  });

  if (cleanData.length < 2) return canvas.toBuffer('image/png');

  const visibleData = cleanData.slice(Math.max(0, cleanData.length - visibleCount));

  // 1. 背景
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, width, height);

  // 2. 計算比例
  const allPrices = visibleData.flatMap(d => [d.high, d.low]);
  const minPrice = Math.min(...allPrices) * 0.98;
  const maxPrice = Math.max(...allPrices) * 1.02;
  const priceRange = maxPrice - minPrice;
  const maxVol = Math.max(...visibleData.map(d => d.volume), 1);

  const getX = (index: number) => padding.left + (index * (width - padding.left - padding.right) / (visibleData.length - 1));
  const getY = (price: number) => padding.top + (maxPrice - price) * (height - padding.top - padding.bottom) / priceRange;

  // 3. 繪製圖例
  ctx.font = FONT_SANS;
  ctx.textBaseline = 'middle';

  const drawLeg = (label: string, color: string, x: number) => {
    ctx.fillStyle = color; ctx.fillRect(x, 30, 15, 3);
    ctx.fillStyle = '#9ca3af'; ctx.fillText(label, x + 20, 32);
    return x + 75;
  };
  let curX = padding.left;
  curX = drawLeg('MA5', '#ffffff', curX);
  curX = drawLeg('MA20', '#f59e0b', curX);
  curX = drawLeg('MA60', '#3b82f6', curX);

  ctx.fillStyle = '#ef4444'; ctx.fillRect(curX + 10, 25, 8, 12);
  ctx.fillStyle = '#22c55e'; ctx.fillRect(curX + 20, 25, 8, 12);
  ctx.fillStyle = '#9ca3af'; ctx.fillText('Trend (Red Up / Green Down)', curX + 35, 32);

  // 4. 繪製格線
  ctx.strokeStyle = '#262626';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const y = padding.top + i * (height - padding.top - padding.bottom) / 8;
    ctx.beginPath(); ctx.setLineDash([5, 5]);
    ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = '#6b7280';
    const p = maxPrice - i * priceRange / 8;
    ctx.fillText(p.toFixed(1), width - padding.right + 10, y + 4);
  }

  // 4.1 支撐 / 壓力線
  const drawLevel = (label: string, price: number | null, color: string) => {
    if (price === null) return;
    if (price < minPrice || price > maxPrice) return;
    const y = getY(price);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${label} ${price.toFixed(2)}`, width - padding.right + 10, y);
  };
  drawLevel('R', resistance, '#ef4444');
  drawLevel('S', support, '#22c55e');

  // 時間軸
  const labelInterval = Math.ceil(visibleData.length / 6);
  visibleData.forEach((d, i) => {
    if (i % labelInterval === 0 || i === visibleData.length - 1) {
      const x = getX(i);
      ctx.fillStyle = '#6b7280'; ctx.textAlign = 'center';
      ctx.fillText(d.date?.substring(5) || '', x, height - padding.bottom + 20);
    }
  });

  // 5. 繪製成交量
  const volBaseY = height - padding.bottom;
  const barWidth = Math.max(1, (width - padding.left - padding.right) / visibleData.length * 0.6);
  visibleData.forEach((d, i) => {
    const x = getX(i);
    const vHeight = (d.volume / maxVol) * (height * 0.12);
    ctx.fillStyle = d.close >= d.open ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
    ctx.fillRect(x - barWidth/2, volBaseY - vHeight, barWidth, vHeight);
  });

  // 6. 均線
  const drawMA = (period: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = period === 5 ? 1 : 2; ctx.beginPath();
    let started = false;
    
    // 計算 visibleData 在 cleanData 中的起始位置
    const offset = Math.max(0, cleanData.length - visibleData.length);
    
    for (let i = 0; i < visibleData.length; i++) {
      const cleanIdx = offset + i;
      const slice = cleanData.slice(Math.max(0, cleanIdx - period + 1), cleanIdx + 1);
      if (slice.length < period) continue;
      
      const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
      const x = getX(i); const y = getY(avg);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  drawMA(5, '#ffffff'); drawMA(20, '#f59e0b'); drawMA(60, '#3b82f6');

  // 7. 趨勢線
  const drawRealTrendLines = () => {
    const mid = Math.floor(visibleData.length / 2);
    let p1 = { price: 0, i: 0 }, p2 = { price: 0, i: 0 };
    visibleData.forEach((d, i) => {
      if (i < mid && d.high > p1.price) p1 = { price: d.high, i };
      if (i >= mid && d.high > p2.price) p2 = { price: d.high, i };
    });
    if (p1.price > 0 && p2.price > 0) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(getX(p1.i), getY(p1.price));
      const slope = (p2.price - p1.price) / (p2.i - p1.i);
      const endPrice = p1.price + slope * (visibleData.length - 1 - p1.i);
      ctx.lineTo(getX(visibleData.length - 1), getY(endPrice)); ctx.stroke();
    }
    let s1 = { price: Infinity, i: 0 }, s2 = { price: Infinity, i: 0 };
    visibleData.forEach((d, i) => {
      if (i < mid && d.low < s1.price) s1 = { price: d.low, i };
      if (i >= mid && d.low < s2.price) s2 = { price: d.low, i };
    });
    if (s1.price < Infinity && s2.price < Infinity) {
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
      ctx.beginPath(); ctx.moveTo(getX(s1.i), getY(s1.price));
      const slope = (s2.price - s1.price) / (s2.i - s1.i);
      const endPrice = s1.price + slope * (visibleData.length - 1 - s1.i);
      ctx.lineTo(getX(visibleData.length - 1), getY(endPrice)); ctx.stroke();
    }
    ctx.setLineDash([]);
  };
  drawRealTrendLines();

  // 8. 繪製 K 線
  visibleData.forEach((d, i) => {
    const x = getX(i);
    const color = d.close >= d.open ? '#ef4444' : '#22c55e';
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x, getY(d.high)); ctx.lineTo(x, getY(d.low)); ctx.stroke();
    const bTop = getY(Math.max(d.open, d.close));
    const bBot = getY(Math.min(d.open, d.close));
    ctx.fillRect(x - barWidth/2, bTop, barWidth, Math.max(Math.abs(bBot - bTop), 1));
  });

  // 9. 現價標籤
  const last = visibleData[visibleData.length - 1];
  const lastY = getY(last.close);
  const boxW = 75, boxH = 24;
  const tagX = width - padding.right + 5;

  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(tagX, lastY);
  ctx.lineTo(tagX + 8, lastY - boxH / 2);
  ctx.lineTo(tagX + boxW, lastY - boxH / 2);
  ctx.lineTo(tagX + boxW, lastY + boxH / 2);
  ctx.lineTo(tagX + 8, lastY + boxH / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#000';
  ctx.font = FONT_SANS;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(last.close.toFixed(2), tagX + 12, lastY);

  return canvas.toBuffer('image/png');
}

/**
 * 繪製熱門股票報酬率排行圖 (橫向長條圖)
 */
export async function renderRankChart(
  data: { symbol: string; pct: number; count: number }[],
  options: { width?: number; height?: number } = {}
): Promise<Buffer> {
  ensureFonts();
  const width = options.width ?? 800;
  const height = options.height ?? (data.length * 50 + 100);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, width, height);

  const padding = { top: 60, right: 100, bottom: 40, left: 120 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 標題
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 24px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText('Group Top Performance', width / 2, 35);

  if (data.length === 0) return canvas.toBuffer('image/png');

  // 獲取所有中文名稱 (台股)
  const dataWithNames = await Promise.all(data.map(async d => {
    const name = await getCompanyNameZh(d.symbol);
    return { ...d, displayName: name ? `${d.symbol} ${name}` : d.symbol };
  }));

  // 計算比例
  const maxPct = Math.max(...dataWithNames.map(d => Math.abs(d.pct)), 5);
  const getX = (pct: number) => padding.left + (chartWidth / 2) + (pct / (maxPct * 1.1)) * (chartWidth / 2);
  const barHeight = 30;
  const gap = (chartHeight - (dataWithNames.length * barHeight)) / (dataWithNames.length + 1);

  // 繪製中心軸
  ctx.strokeStyle = '#404040';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left + chartWidth / 2, padding.top);
  ctx.lineTo(padding.left + chartWidth / 2, height - padding.bottom);
  ctx.stroke();

  dataWithNames.forEach((d, i) => {
    const y = padding.top + gap + i * (barHeight + gap);
    const centerX = padding.left + chartWidth / 2;
    const endX = getX(d.pct);
    const color = d.pct >= 0 ? '#ef4444' : '#22c55e';

    // 繪製長條
    ctx.fillStyle = color;
    ctx.fillRect(Math.min(centerX, endX), y, Math.abs(endX - centerX), barHeight);

    // 繪製代號與名稱 (使用路徑繪製避免中文問題)
    drawTextAsPath(ctx, d.displayName, padding.left - 10, y + barHeight / 2 + 6, 16, '#e5e7eb', { textAlign: 'right' });
    
    drawTextAsPath(ctx, `${d.count} hits`, padding.left - 10, y + barHeight / 2 + 22, 12, '#9ca3af', { textAlign: 'right' });

    // 繪製百分比文字
    const pctText = `${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(2)}%`;
    drawTextAsPath(ctx, pctText, d.pct >= 0 ? endX + 10 : endX - 10, y + barHeight / 2 + 6, 16, color, { textAlign: d.pct >= 0 ? 'left' : 'right' });
  });

  return canvas.toBuffer('image/png');
}

/**
 * 繪製多檔股票報酬率對比圖
 */
export async function renderMultiRoiChart(
  series: { symbol: string; data: { date: Date; close: number }[]; initialPrice: number }[],
  period: string = "",
  options: { width?: number; height?: number } = {}
): Promise<Buffer> {
  ensureFonts();
  const width = options.width ?? 1000;
  const height = options.height ?? 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, width, height);

  const padding = { top: 80, right: 150, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 顏色盤
  const colors = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#06b6d4'];

  // 標題
  drawTextAsPath(ctx, `ROI Comparison (${period})`, padding.left, 45, 28, '#ffffff');

  // 計算所有系列的百分比數據與名稱
  const normalizedSeries = await Promise.all(series.map(async (s, idx) => {
    const data = s.data.map(d => ({
      date: d.date,
      pct: ((d.close - s.initialPrice) / s.initialPrice) * 100
    }));

    // 獲取中文名稱 (台股)
    const name = await getCompanyNameZh(s.symbol);
    const displayName = name ? `${s.symbol} ${name}` : s.symbol;

    return {
      symbol: s.symbol,
      displayName,
      data,
      color: colors[idx % colors.length],
      finalPct: data.length > 0 ? data[data.length - 1].pct : 0
    };
  }));

  if (normalizedSeries.length === 0) return canvas.toBuffer('image/png');

  // 找範圍
  const allPcts = normalizedSeries.flatMap(s => s.data.map(d => d.pct));
  const maxPct = Math.max(...allPcts, 5) * 1.1;
  const minPct = Math.min(...allPcts, -5) * 1.1;
  const pctRange = maxPct - minPct;

  const maxLen = Math.max(...normalizedSeries.map(s => s.data.length));
  const getX = (i: number, len: number) => padding.left + (i * chartWidth) / (len - 1);
  const getY = (pct: number) => padding.top + (maxPct - pct) * (chartHeight / pctRange);

  // 繪製水平格線與 0% 基準線
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.font = `12px ${FONT_FAMILY}`;
  for (let i = 0; i <= 10; i++) {
    const val = maxPct - (i * pctRange) / 10;
    const y = getY(val);
    
    ctx.strokeStyle = Math.abs(val) < 0.1 ? '#ffffff' : '#262626';
    ctx.setLineDash(Math.abs(val) < 0.1 ? [] : [5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`${val.toFixed(1)}%`, padding.left - 10, y + 4);
  }
  ctx.setLineDash([]);

  // 繪製每一條線
  normalizedSeries.forEach(s => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.data.forEach((d, i) => {
      const x = getX(i, s.data.length);
      const y = getY(d.pct);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 繪製末端小圓點
    if (s.data.length > 0) {
      const last = s.data[s.data.length - 1];
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(getX(s.data.length - 1, s.data.length), getY(last.pct), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 繪製圖例 (Legend)
  ctx.textAlign = 'left';
  normalizedSeries.forEach((s, i) => {
    const x = width - padding.right + 20;
    const y = padding.top + i * 35;
    
    // 色塊
    ctx.fillStyle = s.color;
    ctx.fillRect(x, y, 15, 15);
    
    // 代號與名稱 (使用路徑繪製避免中文問題)
    drawTextAsPath(ctx, s.displayName, x + 25, y + 13, 14, '#ffffff');
    
    // 最終報酬率
    const pctColor = s.finalPct >= 0 ? '#ef4444' : '#22c55e';
    const pctText = `${s.finalPct >= 0 ? '+' : ''}${s.finalPct.toFixed(2)}%`;
    drawTextAsPath(ctx, pctText, x + 25, y + 30, 12, pctColor);
  });

  // 時間軸 (取第一條線作為基準)
  const ref = normalizedSeries[0].data;
  ctx.fillStyle = '#9ca3af';
  ctx.textAlign = 'center';
  const labelCount = 5;
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.floor((i * (ref.length - 1)) / (labelCount - 1));
    const x = getX(idx, ref.length);
    const date = ref[idx].date.toLocaleDateString('en-CA', { month: '2-digit', day: '2-digit' });
    ctx.fillText(date, x, height - padding.bottom + 25);
  }

  return canvas.toBuffer('image/png');
}

/**
 * 繪製報酬率線圖
 */
export async function renderProfitChart(
  symbol: string,
  history: { date: Date; close: number }[],
  initialPrice: number,
  currentPrice: number,
  period: string = "",
  options: { width?: number; height?: number } = {}
): Promise<Buffer> {
  ensureFonts();
  const width = options.width ?? 1000;
  const height = options.height ?? 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, width, height);

  const padding = { top: 80, right: 80, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 標題與數據
  const name = await getCompanyNameZh(symbol);
  const displayName = name ? `${symbol} ${name}` : symbol;
  const totalPct = ((currentPrice - initialPrice) / initialPrice) * 100;
  
  drawTextAsPath(ctx, `${displayName} ROI Analysis (${period})`, padding.left, 45, 28, '#ffffff');

  const pctColor = totalPct >= 0 ? '#ef4444' : '#22c55e';
  const pctText = `${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(2)}%`;
  drawTextAsPath(ctx, pctText, width - padding.right, 45, 24, pctColor, { textAlign: 'right' });

  if (history.length < 2) return canvas.toBuffer('image/png');

  // 計算比例
  const allPrices = [...history.map(h => h.close), initialPrice, currentPrice];
  const maxPrice = Math.max(...allPrices) * 1.05;
  const minPrice = Math.min(...allPrices) * 0.95;
  const priceRange = maxPrice - minPrice;

  const getX = (i: number) => padding.left + (i * chartWidth) / (history.length - 1);
  const getY = (price: number) => padding.top + (maxPrice - price) * (chartHeight / priceRange);

  // 繪製基準線 (Initial Price)
  const initialY = getY(initialPrice);
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(padding.left, initialY);
  ctx.lineTo(width - padding.right, initialY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 基準線標籤
  ctx.fillStyle = '#6b7280';
  ctx.font = `14px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.fillText(`Start: ${initialPrice.toFixed(2)}`, padding.left + 5, initialY - 10);

  // 繪製折線
  ctx.strokeStyle = totalPct >= 0 ? '#ef4444' : '#22c55e';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  history.forEach((h, i) => {
    const x = getX(i);
    const y = getY(h.close);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // 繪製漸層填充
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, totalPct >= 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)');
  gradient.addColorStop(1, 'rgba(18, 18, 18, 0)');
  ctx.fillStyle = gradient;
  ctx.lineTo(getX(history.length - 1), height - padding.bottom);
  ctx.lineTo(getX(0), height - padding.bottom);
  ctx.closePath();
  ctx.fill();

  // 時間軸標籤
  ctx.fillStyle = '#9ca3af';
  ctx.font = `14px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  const labelCount = 5;
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.floor((i * (history.length - 1)) / (labelCount - 1));
    const x = getX(idx);
    const date = history[idx].date.toLocaleDateString('en-CA', { month: '2-digit', day: '2-digit' });
    ctx.fillText(date, x, height - padding.bottom + 25);
  }

  return canvas.toBuffer('image/png');
}
