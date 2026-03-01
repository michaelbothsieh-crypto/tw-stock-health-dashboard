import Groq from "groq-sdk";

export type InsiderSell = {
    date: string;
    declarer: string;
    role: string;
    humanMode: string;
    lots: number;
    valueText: string;
    transferRatio: number;
};

export type StockAnalystInput = {
    symbol: string;
    nameZh: string;
    close: number | null;
    chgPct: number | null;
    volume: number | null;
    volumeVs5dPct: number | null;
    flowNet: number | null;
    flowUnit: string;
    shortDir: string;
    strategySignal: string;
    confidence: number | null;
    p1d: number | null;
    p3d: number | null;
    p5d: number | null;
    support: number | null;
    resistance: number | null;
    newsLine: string;
    syncLevel: string;
    overseas: Array<{ symbol: string; chgPct: number | null }>;
    insiderSells: InsiderSell[];  // 內部人市場拋售（60天內）
};

function buildAnalystPrompt(input: StockAnalystInput): string {
    const priceText = input.close != null ? `${input.close.toFixed(2)}` : "N/A";
    const chgText = input.chgPct != null
        ? `${input.chgPct >= 0 ? "+" : ""}${input.chgPct.toFixed(2)}%`
        : "N/A";
    const flowText = input.flowNet != null
        ? `${input.flowNet >= 0 ? "法人買超" : "法人賣超"} ${Math.abs(input.flowNet).toLocaleString()} ${input.flowUnit}`
        : "N/A";
    const volLabel = input.volumeVs5dPct != null
        ? (input.volumeVs5dPct >= 80 ? "爆量" : input.volumeVs5dPct >= 15 ? "放量" : input.volumeVs5dPct <= -20 ? "縮量" : "平量")
        : "平量";
    const volText = input.volumeVs5dPct != null
        ? `${volLabel}（vs 5日均量 ${input.volumeVs5dPct >= 0 ? "+" : ""}${input.volumeVs5dPct.toFixed(0)}%）`
        : "N/A";
    const overseasText = input.overseas.length > 0
        ? input.overseas.slice(0, 3)
            .map(o => `${o.symbol}(${o.chgPct != null ? (o.chgPct >= 0 ? "+" : "") + o.chgPct.toFixed(2) + "%" : "N/A"})`)
            .join("、")
        : "N/A";

    // 內部人賣出摘要
    const marketSells = input.insiderSells.filter(s => s.humanMode.includes("拋售") || s.humanMode.includes("賣出"));
    const hasInsiderSell = marketSells.length > 0;
    const insiderText = hasInsiderSell
        ? marketSells
            .slice(0, 3)
            .map(s => `${s.date} ${s.role}「${s.declarer}」申報市場拋售 ${s.lots.toLocaleString()} 張（約 ${s.valueText}，佔持股 ${(s.transferRatio * 100).toFixed(1)}%）`)
            .join("；")
        : "近60天無重大內部人市場拋售申報";

    const insiderWarning = hasInsiderSell
        ? `\n⚠️ 重要！近60天偵測到內部人市場拋售申報：${insiderText}。請在分析中用強烈語氣特別點出此風險，這是最重要的警示。`
        : "";

    return `你是一位頂尖的台灣股市技術分析師，個性犀利、直接，說話帶有專業但接地氣的語感，有點像在跟信任的朋友分析盤勢。

以下是 ${input.nameZh}（${input.symbol}）的即時數據：

📌 盤面資訊
- 現價：${priceText}（${chgText}）
- 成交量：${volText}
- 籌碼：${flowText}
- AI 預測上漲機率：1日 ${input.p1d?.toFixed(1) ?? "N/A"}%、3日 ${input.p3d?.toFixed(1) ?? "N/A"}%、5日 ${input.p5d?.toFixed(1) ?? "N/A"}%
- 策略訊號：${input.strategySignal}（信心 ${input.confidence?.toFixed(1) ?? "N/A"}%）
- 短線方向：${input.shortDir}
- 支撐：${input.support?.toFixed(2) ?? "N/A"}　壓力：${input.resistance?.toFixed(2) ?? "N/A"}
- 海外市場：${overseasText}（同步度 ${input.syncLevel}）
- 重大新聞：${input.newsLine || "無"}
- 內部人申報：${insiderText}${insiderWarning}

📋 任務
請依據上述數據，用繁體中文寫出一段高級分析師評語（約 130~170 字）。

格式要求：
1. 第一句：直接說現在這支股票「是什麼狀況」（多/空/中性）+ 最關鍵的理由（1個）
2. 中段：解讀量、籌碼、海外聯動三者之間的「故事」（說含意，不要乾燥列數字）
3. ${hasInsiderSell ? "特別提醒：用強烈語氣點出內部人拋售是重大風險警示，散戶應高度警惕" : "最後一句：給一個明確的操作邏輯（例如：站上 xxx 可輕倉、跌破 xxx 不要追）"}

規則：
- 嚴禁廢話或重複數字（數字只作佐證）
- 語氣要有觀點，像跟朋友分析，不能太官腔
- 絕對不要加免責聲明
- 不要用 markdown 格式，純文字段落即可
- ${hasInsiderSell ? "內部人拋售必須是最突出的警示，放在最顯眼的位置" : "如果沒有重大風險，給出積極但理性的操作建議"}`;
}

export async function generateStockAnalysis(input: StockAnalystInput): Promise<string | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.warn("[StockAnalyst] GROQ_API_KEY is missing");
        return null;
    }

    const prompt = buildAnalystPrompt(input);

    // 先嘗試 70B（更聰明），超時降級 8B
    for (const model of ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]) {
        try {
            const groq = new Groq({ apiKey });
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model,
                temperature: 0.72,
                max_tokens: 500,
            });
            const result = completion.choices[0]?.message?.content?.trim();
            if (result && result.length > 30) {
                console.log(`[StockAnalyst] Generated with ${model} (${result.length} chars)`);
                return result;
            }
        } catch (error) {
            console.warn(`[StockAnalyst] ${model} failed:`, error);
        }
    }

    return null;
}
