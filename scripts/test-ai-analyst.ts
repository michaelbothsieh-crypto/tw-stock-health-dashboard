#!/usr/bin/env node
// 直接測試：呼叫 Groq API 生成 2330 AI 分析，然後推 Telegram 給使用者

import { config } from "dotenv";
import { resolve } from "path";

// 載入 .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const TG_BOT_TOKEN = "8258745740:AAHJLNvpmdxdRiO-rEra9wg0V7_WC95x7qs";
const CHAT_ID = "906863238";

async function callGroq(prompt: string): Promise<string> {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.72,
            max_tokens: 500,
        }),
    });
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "AI 生成失敗";
}

async function sendTG(text: string, photoUrl?: string) {
    if (photoUrl) {
        await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                photo: photoUrl,
                caption: text,
                parse_mode: "HTML",
            }),
        });
    } else {
        await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text,
                parse_mode: "HTML",
            }),
        });
    }
}

function buildMockChartUrl(): string {
    const barsCount = 180;
    const data = Array.from({ length: barsCount }, (_, i) => 700 + i * 0.5 + Math.sin(i / 10) * 30 + Math.random() * 20);
    const volumes = Array.from({ length: barsCount }, () => Math.random() * 50000 + 10000);
    
    const isUp = data[data.length - 1] > data[0];
    const color = isUp ? 'rgb(239, 68, 68)' : 'rgb(34, 197, 94)'; // 台灣股市紅漲綠跌
    
    const support = 848.00;
    const resistance = 878.00;
    const latestPrice = data[data.length - 1];
    const maxVol = Math.max(...volumes);
    
    const chartConfig: any = {
        type: 'bar',
        data: {
            labels: data.map((_, i) => i),
            datasets: [
                {
                    type: 'line',
                    data: data,
                    borderColor: color,
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    data: volumes,
                    backgroundColor: 'rgba(156, 163, 175, 0.3)',
                    yAxisID: 'yVol'
                }
            ]
        },
        options: {
            legend: { display: false },
            scales: {
                xAxes: [{ display: false }],
                yAxes: [
                    {
                        id: 'y',
                        position: 'right',
                        gridLines: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { fontColor: '#9ca3af' }
                    },
                    {
                        id: 'yVol',
                        display: false,
                        ticks: { min: 0, max: maxVol * 4 } // 讓成交量只佔下方 1/4
                    }
                ]
            },
            layout: { padding: 10 },
            annotation: {
                annotations: [
                    {
                        type: 'line',
                        mode: 'horizontal',
                        scaleID: 'y',
                        value: support,
                        borderColor: 'rgba(34, 197, 94, 0.8)',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        label: { enabled: true, content: '支撐 ' + support, position: 'left', backgroundColor: 'rgba(34, 197, 94, 0.8)' }
                    },
                    {
                        type: 'line',
                        mode: 'horizontal',
                        scaleID: 'y',
                        value: resistance,
                        borderColor: 'rgba(239, 68, 68, 0.8)',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        label: { enabled: true, content: '壓力 ' + resistance, position: 'left', backgroundColor: 'rgba(239, 68, 68, 0.8)' }
                    },
                    {
                        type: 'line',
                        mode: 'horizontal',
                        scaleID: 'y',
                        value: latestPrice,
                        borderColor: color,
                        borderWidth: 1.5,
                        borderDash: [2, 2],
                        label: { enabled: true, content: '現價 ' + latestPrice.toFixed(2), position: 'right', backgroundColor: color }
                    }
                ]
            }
        }
    };
    
    // QuickChart background color
    chartConfig['backgroundColor'] = '#1f2937'; // dark mode background
    
    return `https://quickchart.io/chart?w=800&h=400&bkg=1f2937&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
}

async function main() {
    console.log("🤖 呼叫 Groq 生成 2330 AI 分析...");

    const prompt = `你是一位頂尖的台灣股市技術分析師，個性犀利、直接，有點像在跟信任的朋友分析盤勢。

以下是 台積電（2330）的即時數據：

📌 盤面資訊
- 現價：865.00（+1.29%）
- 成交量：放量（vs 5日均量 +32%）
- 籌碼：法人買超 12,543 張
- AI 預測上漲機率：1日 61.2%、3日 58.7%、5日 55.1%
- 策略訊號：積極做多（勝率 72.5%）
- 短線方向：偏多
- 支撐：848.00　壓力：878.00
- 重大新聞：台積電 2 奈米進度超前，供應鏈傳出訂單滿載
- 內部人申報：近60天無重大內部人市場拋售申報

📋 任務
請依據上述數據，用繁體中文寫出一段高級分析師評語（極嚴格限制：最多 80 字內），風格要求極度犀利、冷酷、一針見血，不說廢話。

格式要求：
1. 第一句：直接說現在這支股票「是什麼狀況」（多/空/中性）+ 1個最致命的理由。
2. 中段：一句話點破量與籌碼背後的真相。
3. 最後一句：給一個最冷酷、明確的操作底線（如：破 xxx 停損，過 xxx 才看）。

規則：
- 總字數絕對不能超過 80 字。
- 嚴禁廢話或重複數據，只要給結論。
- 語氣要像冷酷的交易員。
- 絕對不要加免責聲明、不要 markdown。`;

    const aiText = await callGroq(prompt);
    console.log("=== AI 生成結果 ===\n", aiText);

    // 組合完整訊息（模擬 /tw 2330 的輸出格式）
    const message = [
        "📊 <b>2330 台積電</b>  【即時展示】",
        "【現價】 865.00（+1.29%）  【量能】 放量（vs5D +32%）",
        "【法人】 +1.25萬（單位：張）",
        "【趨勢】 積極做多（勝率 72.5%）",
        "",
        "【關鍵價】 支撐 848.00 ｜ 壓力 878.00",
        "• 站穩 878.00 → 看 895.00（續強）",
        "• 跌破 848.00 → 防 832.00（轉弱）",
        "",
        "【新聞】 CoWoS 先進封裝需求強勁，AI 伺服器拉貨週期啟動",
        "",
        "━━━━━━━━━━━━━━",
        "🤖 <b>AI 分析師點評</b>",
        aiText
    ].join("\n");

    console.log("📤 推送 Telegram...");
    const chartUrl = buildMockChartUrl();
    await sendTG(message, chartUrl);
    console.log("✅ 完成！請查看 Telegram！");
}

main().catch(console.error);
