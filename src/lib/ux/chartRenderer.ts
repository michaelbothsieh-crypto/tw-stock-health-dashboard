import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';

// 註冊本地字型 (解決 Vercel 環境缺少字型問題)
try {
  const fontDir = path.join(process.cwd(), 'public/fonts');
  const regPath = path.join(fontDir, 'NotoSans-Regular.ttf');
  const boldPath = path.join(fontDir, 'NotoSans-Bold.ttf');
  
  if (fs.existsSync(regPath)) {
    const regFont = fs.readFileSync(regPath);
    GlobalFonts.register(regFont, 'NotoSans');
  }
  if (fs.existsSync(boldPath)) {
    const boldFont = fs.readFileSync(boldPath);
    GlobalFonts.register(boldFont, 'NotoSansBold');
  }
} catch (e) {
  console.warn('[Chart] Font registration failed, using system fallback');
}

const FONT_SANS = 'bold 13px "NotoSansBold", "NotoSans", sans-serif';
const FONT_SANS_SMALL = '9px "NotoSans", sans-serif';

export interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
  const padding = { top: 70, right: 120, bottom: 70, left: 60 };
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const startIndex = Math.max(0, allData.length - visibleCount);
  const visibleData = allData.slice(startIndex);

  // 1. 背景
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, width, height);

  if (visibleData.length < 2) return canvas.toBuffer('image/png');

  // 2. 計算比例
  const prices = visibleData.flatMap(d => [d.high, d.low]);
  const minPrice = Math.min(...prices) * 0.98;
  const maxPrice = Math.max(...prices) * 1.02;
  const priceRange = maxPrice - minPrice;
  const maxVol = Math.max(...visibleData.map(d => d.volume), 1);

  const getX = (index: number) => padding.left + (index * (width - padding.left - padding.right) / (visibleData.length - 1));
  const getY = (price: number) => padding.top + (maxPrice - price) * (height - padding.top - padding.bottom) / priceRange;

  // 3. 繪製圖例 (Legend)
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

  // 6. 繪製均線 MA5, MA20, MA60
  const drawMA = (period: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = period === 5 ? 1 : 2; ctx.beginPath();
    let started = false;
    for (let i = 0; i < visibleData.length; i++) {
      const realIdx = startIndex + i;
      const slice = allData.slice(Math.max(0, realIdx - period + 1), realIdx + 1);
      if (slice.length < period) continue;
      const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
      const x = getX(i); const y = getY(avg);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  drawMA(5, '#ffffff'); drawMA(20, '#f59e0b'); drawMA(60, '#3b82f6');

  // 8. 修正後的專業三角收斂趨勢線
  const drawRealTrendLines = () => {
    // 壓力線：找出前半段最高與後半段最高點
    const mid = Math.floor(visibleData.length / 2);
    let p1 = { price: 0, i: 0 }, p2 = { price: 0, i: 0 };
    visibleData.forEach((d, i) => {
      if (i < mid && d.high > p1.price) p1 = { price: d.high, i };
      if (i >= mid && d.high > p2.price) p2 = { price: d.high, i };
    });
    if (p1.price > 0 && p2.price > 0) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(getX(p1.i), getY(p1.price)); 
      // 延伸至末端
      const slope = (p2.price - p1.price) / (p2.i - p1.i);
      const endPrice = p1.price + slope * (visibleData.length - 1 - p1.i);
      ctx.lineTo(getX(visibleData.length - 1), getY(endPrice)); ctx.stroke();
    }

    // 支撐線：找出前半段最低與後半段最低點
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

  // 9. 專業級現價標籤 (TradingView 風格)
  const last = visibleData[visibleData.length - 1];
  const lastY = getY(last.close);
  
  const boxW = 75, boxH = 24;
  const tagX = width - padding.right + 5;
  const tagY = lastY - boxH / 2;

  // 繪製帶箭頭的圓角標籤
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(tagX, lastY); // 箭頭尖端
  ctx.lineTo(tagX + 8, lastY - boxH / 2); // 往右上
  ctx.lineTo(tagX + boxW, lastY - boxH / 2); // 往右
  ctx.lineTo(tagX + boxW, lastY + boxH / 2); // 往下
  ctx.lineTo(tagX + 8, lastY + boxH / 2); // 往左
  ctx.closePath();
  ctx.fill();

  // 加上極細深色邊框增加立體感
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // 文字改為黑色並置中對齊
  ctx.fillStyle = '#000'; 
  ctx.font = FONT_SANS; 
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(last.close.toFixed(2), tagX + 12, lastY);

  return canvas.toBuffer('image/png');
}
