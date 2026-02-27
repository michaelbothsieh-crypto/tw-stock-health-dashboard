import { fetchLatestReport } from "./reportFetcher";
import { twStockNames } from "../../data/twStockNames";

type TelegramStockRow = {
  symbol: string;
  nameZh: string;
  price: number | null;
  changePct: string;
  flowTotal: string;
  tomorrowTrend: string;
  upProb1D: number | null;
  upProb3D: number | null;
  upProb5D: number | null;
  strategySignal: string;
  strategyConfidence: number | null;
  majorNews: Array<{ title: string; date?: string; impact?: string; link?: string }>;
  majorNewsSummary?: string;
  predText?: string;
  probText?: string;
  h3Text?: string;
  h5Text?: string;
  detailStr?: string;
};

type LatestReport = {
  date: string;
  watchlist: TelegramStockRow[];
};

async function sendMessage(chatId: string | number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[TelegramBot] TELEGRAM_BOT_TOKEN is missing");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!res.ok) {
      console.error("[TelegramBot] Send Error:", await res.text());
    }
  } catch (error) {
    console.error("[TelegramBot] Network Error:", error);
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function toNumberPercent(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace("%", "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeRow(raw: TelegramStockRow): TelegramStockRow {
  const upProb1D =
    raw.upProb1D ?? toNumberPercent(raw.probText) ?? null;
  const upProb3D =
    raw.upProb3D ?? toNumberPercent(raw.h3Text) ?? null;
  const upProb5D =
    raw.upProb5D ?? toNumberPercent(raw.h5Text) ?? null;

  const tomorrowTrend = raw.tomorrowTrend || raw.predText || "資料不足";

  return {
    ...raw,
    tomorrowTrend,
    upProb1D,
    upProb3D,
    upProb5D,
    strategySignal: raw.strategySignal || raw.predText || "資料不足",
    strategyConfidence: raw.strategyConfidence ?? null,
    majorNews: Array.isArray(raw.majorNews) ? raw.majorNews : [],
  };
}

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${value.toFixed(1)}%`;
}

function formatPrice(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(2);
}

function impactLabel(impact?: string): string {
  if (impact === "BULLISH") return "偏多";
  if (impact === "BEARISH") return "偏空";
  return "中性";
}

function buildDailyMessage(report: LatestReport): string {
  const lines: string[] = [];
  lines.push(`📊 <b>每日收盤總覽 (${escapeHtml(report.date)})</b>`);
  lines.push("");

  for (const item of report.watchlist.map(normalizeRow)) {
    const firstNews = item.majorNews[0];
    const url = safeUrl(firstNews?.link);
    const oneNews = firstNews?.title || "無重大新聞";
    const newsText = url
      ? `<a href="${escapeHtml(url)}">${escapeHtml(oneNews)}</a>`
      : escapeHtml(oneNews);
    lines.push(
      `• ${escapeHtml(item.nameZh)}(${escapeHtml(item.symbol)}) 收 ${escapeHtml(formatPrice(item.price))} ${escapeHtml(item.changePct)}｜明日${escapeHtml(item.tomorrowTrend)} ${escapeHtml(formatPercent(item.upProb1D))}｜新聞: ${newsText}`,
    );
  }

  return lines.join("\n");
}

function buildSingleStockMessage(item: TelegramStockRow): string {
  const row = normalizeRow(item);
  const lines: string[] = [];
  lines.push(`<b>${escapeHtml(row.symbol)} ${escapeHtml(row.nameZh)}</b>`);
  lines.push(`收盤: ${escapeHtml(formatPrice(row.price))} (${escapeHtml(row.changePct)})`);
  lines.push(`三大法人合計: ${escapeHtml(row.flowTotal)}`);
  lines.push(`明日傾向: ${escapeHtml(row.tomorrowTrend)} (1D上漲機率 ${escapeHtml(formatPercent(row.upProb1D))})`);
  lines.push(`短線參考: 3D ${escapeHtml(formatPercent(row.upProb3D))} / 5D ${escapeHtml(formatPercent(row.upProb5D))}`);
  lines.push(
    `策略訊號: ${escapeHtml(row.strategySignal)}${row.strategyConfidence === null ? "" : ` (信心 ${escapeHtml(row.strategyConfidence.toFixed(1))}%)`}`,
  );

  if (row.majorNews.length > 0) {
    lines.push("<b>重大新聞:</b>");
    row.majorNews.slice(0, 3).forEach((news, idx) => {
      const url = safeUrl(news.link);
      const label = `[${impactLabel(news.impact)}]`;
      if (url) {
        lines.push(`${idx + 1}. ${escapeHtml(label)} <a href="${escapeHtml(url)}">${escapeHtml(news.title)}</a>`);
      } else {
        lines.push(`${idx + 1}. ${escapeHtml(label)} ${escapeHtml(news.title)}`);
      }
    });
  } else if (row.majorNewsSummary) {
    lines.push(`重大新聞: ${escapeHtml(row.majorNewsSummary)}`);
  } else {
    lines.push("重大新聞: 無");
  }

  return lines.join("\n");
}

function buildHelpMessage(): string {
  return [
    "<b>台股收盤機器人</b>",
    "",
    "目前僅支援：",
    "/stock <代號或名稱> - 單一股票詳細摘要 (例: /stock 2330)",
  ].join("\n");
}

function buildWatchlistMessage(report: LatestReport | null): string {
  if (!report || !Array.isArray(report.watchlist) || report.watchlist.length === 0) {
    return "目前沒有可用的 watchlist 報告資料。";
  }

  const symbols = report.watchlist.map((x) => `${escapeHtml(x.symbol)} ${escapeHtml(x.nameZh)}`);
  return `目前報告 watchlist (${escapeHtml(report.date)}):\n${symbols.join("\n")}`;
}

function getSnapshotBaseUrl(): string | null {
  const explicit = process.env.BOT_BASE_URL || process.env.APP_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  return null;
}

function resolveCodeFromInputLocal(input: string): string | null {
  const query = input.trim();
  if (!query) return null;

  const codeMatch = query.match(/^(\d{4,})(\.TW|\.TWO)?$/i);
  if (codeMatch) return codeMatch[1];

  for (const [code, name] of Object.entries(twStockNames)) {
    if (name === query) return code;
  }
  for (const [code, name] of Object.entries(twStockNames)) {
    if (name.includes(query) || query.includes(name)) return code;
  }
  return null;
}

async function fetchLiveStockRow(query: string): Promise<TelegramStockRow | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const resolved = resolveCodeFromInputLocal(trimmed);
  const symbol = resolved || (trimmed.match(/^(\d{4,})(\.TW|\.TWO)?$/i)?.[1] ?? null);
  if (!symbol) return null;

  const baseUrl = getSnapshotBaseUrl();
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/api/stock/${symbol}/snapshot`);
    if (!res.ok) return null;

    const snapshot = await res.json();
    const prices: Array<{ close: number }> = snapshot?.data?.prices || [];
    if (prices.length < 2) return null;

    const latest = prices[prices.length - 1].close;
    const prev = prices[prices.length - 2].close;
    const changePct = prev > 0 ? `${(((latest - prev) / prev) * 100 >= 0 ? "+" : "")}${((((latest - prev) / prev) * 100)).toFixed(2)}%` : "N/A";

    const flowTotalRaw = snapshot?.signals?.flow?.foreign5D ?? null;
    const flowTotal =
      typeof flowTotalRaw === "number" && Number.isFinite(flowTotalRaw)
        ? `${flowTotalRaw >= 0 ? "+" : ""}${Math.round(flowTotalRaw).toLocaleString()}`
        : "N/A";

    const upProb1D = typeof snapshot?.predictions?.upProb1D === "number" ? snapshot.predictions.upProb1D : null;
    const upProb3D = typeof snapshot?.predictions?.upProb3D === "number" ? snapshot.predictions.upProb3D : null;
    const upProb5D = typeof snapshot?.predictions?.upProb5D === "number" ? snapshot.predictions.upProb5D : null;
    const tomorrowTrend =
      upProb1D === null ? "中立" : upProb1D >= 58 ? "偏多" : upProb1D <= 42 ? "偏空" : "中立";

    const topBullish = Array.isArray(snapshot?.news?.topBullishNews) ? snapshot.news.topBullishNews : [];
    const topBearish = Array.isArray(snapshot?.news?.topBearishNews) ? snapshot.news.topBearishNews : [];
    const majorNews = [...topBullish, ...topBearish]
      .slice(0, 3)
      .map((n: any) => ({
        title: String(n?.title || ""),
        impact: String(n?.impact || "NEUTRAL"),
        link: n?.link ? String(n.link) : undefined,
        date: n?.date ? String(n.date) : undefined,
      }))
      .filter((n: { title: string }) => n.title.length > 0);

    return {
      symbol: String(snapshot?.normalizedTicker?.symbol || symbol),
      nameZh: String(snapshot?.normalizedTicker?.companyNameZh || snapshot?.normalizedTicker?.displayName || symbol),
      price: latest,
      changePct,
      flowTotal,
      tomorrowTrend,
      upProb1D,
      upProb3D,
      upProb5D,
      strategySignal: String(snapshot?.strategy?.signal || tomorrowTrend),
      strategyConfidence:
        typeof snapshot?.strategy?.confidence === "number" ? snapshot.strategy.confidence : null,
      majorNews,
      majorNewsSummary: majorNews.length > 0 ? "即時抓取" : "無重大新聞",
    };
  } catch {
    return null;
  }
}

/**
 * Handles incoming Telegram messages.
 * @param chatId The ID of the chat where the message originated.
 * @param text The message text.
 * @param isBackgroundPush If true, this is a scheduled report; should only go to TELEGRAM_CHAT_ID.
 */
export async function handleTelegramMessage(chatId: number, text: string, isBackgroundPush = false) {
  const privateChatId = process.env.TELEGRAM_CHAT_ID;

  if (isBackgroundPush) {
    if (!privateChatId) {
      console.warn("[TelegramBot] Skipping background push: TELEGRAM_CHAT_ID is missing");
      return;
    }
    await sendMessage(privateChatId, text);
    return;
  }

  if (!text.startsWith("/")) return;

  const [commandRaw, ...argParts] = text.trim().split(/\s+/);
  const command = commandRaw.toLowerCase();
  const query = argParts.join(" ").trim();

  if (command === "/help" || command === "/start") {
    await sendMessage(chatId, buildHelpMessage());
    return;
  }

  if (command !== "/stock") {
    await sendMessage(chatId, "目前僅支援 /stock 指令。");
    return;
  }

  let report: LatestReport | null = null;
  try {
    report = (await fetchLatestReport()) as LatestReport | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sendMessage(chatId, `讀取最新報告失敗: ${message}`);
    return;
  }

  if (!query) {
    await sendMessage(chatId, "請輸入股票代號或名稱，例如: /stock 2330");
    return;
  }

  if (!report || !Array.isArray(report.watchlist) || report.watchlist.length === 0) {
    const live = await fetchLiveStockRow(query);
    if (live) {
      await sendMessage(chatId, `${buildSingleStockMessage(live)}\n\n<i>（即時抓取，非日報快照）</i>`);
      return;
    }
    await sendMessage(chatId, "目前尚未產出最新收盤報告，且即時抓取失敗，請稍後再試。");
    return;
  }

  const stock =
    report.watchlist.find((item) => {
      const symbolMatch = item.symbol === query;
      const nameMatch = item.nameZh?.includes(query);
      return symbolMatch || Boolean(nameMatch);
    }) || (await fetchLiveStockRow(query));

  if (!stock) {
    await sendMessage(chatId, `找不到 ${query}，請確認代號或名稱。`);
    return;
  }

  await sendMessage(
    chatId,
    buildSingleStockMessage(stock) + (report.watchlist.includes(stock as TelegramStockRow) ? "" : "\n\n<i>（即時抓取，非watchlist日報）</i>"),
  );
}
