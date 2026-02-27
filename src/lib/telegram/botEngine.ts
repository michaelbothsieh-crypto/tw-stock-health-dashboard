import { fetchLatestReport } from "./reportFetcher";
import { twStockNames } from "../../data/twStockNames";
import { fetchYahooFinanceBars } from "../global/yahooFinance";

type OverseasQuote = {
  symbol: string;
  name: string;
  price: number | null;
  changePct: string;
  corr60?: number | null;
  reason?: string;
};

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
  overseasQuotes?: OverseasQuote[];
};

type LatestReport = {
  date: string;
  watchlist: TelegramStockRow[];
};

async function sendMessage(chatId: string | number, text: string): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[TelegramBot] TELEGRAM_BOT_TOKEN is missing");
    return null;
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
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      console.error("[TelegramBot] Send Error:", await res.text());
      return null;
    }

    const payload = await res.json().catch(() => null);
    const messageId = payload?.result?.message_id;
    return typeof messageId === "number" ? messageId : null;
  } catch (error) {
    console.error("[TelegramBot] Network Error:", error);
    return null;
  }
}

async function editMessage(chatId: string | number, messageId: number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[TelegramBot] TELEGRAM_BOT_TOKEN is missing");
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      console.error("[TelegramBot] Edit Error:", await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[TelegramBot] Edit Network Error:", error);
    return false;
  }
}

async function replyOrEdit(chatId: number, progressMessageId: number | null, text: string) {
  if (progressMessageId !== null) {
    const ok = await editMessage(chatId, progressMessageId, text);
    if (ok) return;
  }
  await sendMessage(chatId, text);
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
  const upProb1D = raw.upProb1D ?? toNumberPercent(raw.probText) ?? null;
  const upProb3D = raw.upProb3D ?? toNumberPercent(raw.h3Text) ?? null;
  const upProb5D = raw.upProb5D ?? toNumberPercent(raw.h5Text) ?? null;
  const tomorrowTrend = raw.tomorrowTrend || raw.predText || "中立";

  return {
    ...raw,
    tomorrowTrend,
    upProb1D,
    upProb3D,
    upProb5D,
    strategySignal: raw.strategySignal || raw.predText || "中立",
    strategyConfidence: raw.strategyConfidence ?? null,
    majorNews: Array.isArray(raw.majorNews) ? raw.majorNews : [],
    overseasQuotes: Array.isArray(raw.overseasQuotes) ? raw.overseasQuotes : [],
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

function formatCorr(corr?: number | null): string {
  if (typeof corr !== "number" || !Number.isFinite(corr)) return "-";
  return `${(corr * 100).toFixed(0)}%`;
}

function buildSingleStockMessage(item: TelegramStockRow): string {
  const row = normalizeRow(item);
  const lines: string[] = [];

  lines.push(`<b>${escapeHtml(row.symbol)} ${escapeHtml(row.nameZh)}</b>`);
  lines.push(`收盤價: ${escapeHtml(formatPrice(row.price))} (${escapeHtml(row.changePct)})`);
  lines.push(`法人淨買賣: ${escapeHtml(row.flowTotal)}`);
  lines.push(`短線方向: ${escapeHtml(row.tomorrowTrend)} (1D 上漲機率 ${escapeHtml(formatPercent(row.upProb1D))})`);
  lines.push(`機率參考: 3D ${escapeHtml(formatPercent(row.upProb3D))} / 5D ${escapeHtml(formatPercent(row.upProb5D))}`);
  lines.push(
    `策略訊號: ${escapeHtml(row.strategySignal)}${row.strategyConfidence === null ? "" : ` (信心 ${escapeHtml(row.strategyConfidence.toFixed(1))}%)`}`,
  );

  if (row.overseasQuotes && row.overseasQuotes.length > 0) {
    lines.push("<b>海外對標收盤:</b>");
    row.overseasQuotes.slice(0, 4).forEach((q, idx) => {
      const reasonPart = q.reason ? `｜${q.reason}` : "";
      const corrPart = typeof q.corr60 === "number" ? `｜相關 ${formatCorr(q.corr60)}` : "";
      lines.push(
        `${idx + 1}. ${escapeHtml(q.symbol)} ${escapeHtml(formatPrice(q.price))} (${escapeHtml(q.changePct)})${escapeHtml(corrPart)}${escapeHtml(reasonPart)}`,
      );
    });
  }

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
    "<b>台股機器人</b>",
    "",
    "目前僅支援一個指令:",
    "/stock <代號或名稱> - 取得單一股票即時摘要 (例: /stock 2330)",
  ].join("\n");
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

function buildTrendByProb(upProb1D: number | null): string {
  if (upProb1D === null) return "中立";
  if (upProb1D >= 58) return "偏多";
  if (upProb1D <= 42) return "偏空";
  return "中立";
}

async function fetchUsQuote(symbol: string, name: string, corr60?: number, reason?: string): Promise<OverseasQuote> {
  try {
    const bars = await fetchYahooFinanceBars(symbol, 7);
    if (!bars || bars.length < 2) {
      return { symbol, name, price: null, changePct: "N/A", corr60: corr60 ?? null, reason };
    }

    const latest = bars[bars.length - 1].close;
    const prev = bars[bars.length - 2].close;
    const changePct = prev > 0 ? `${((latest - prev) / prev) * 100 >= 0 ? "+" : ""}${(((latest - prev) / prev) * 100).toFixed(2)}%` : "N/A";

    return {
      symbol,
      name,
      price: Number.isFinite(latest) ? latest : null,
      changePct,
      corr60: corr60 ?? null,
      reason,
    };
  } catch {
    return { symbol, name, price: null, changePct: "N/A", corr60: corr60 ?? null, reason };
  }
}

async function fetchLiveStockRow(query: string): Promise<TelegramStockRow | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const resolved = resolveCodeFromInputLocal(trimmed);
  const symbol = resolved || trimmed.match(/^(\d{4,})(\.TW|\.TWO)?$/i)?.[1] || null;
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
    const changePct =
      prev > 0
        ? `${((latest - prev) / prev) * 100 >= 0 ? "+" : ""}${(((latest - prev) / prev) * 100).toFixed(2)}%`
        : "N/A";

    const flowTotalRaw = snapshot?.signals?.flow?.foreign5D ?? null;
    const flowTotal =
      typeof flowTotalRaw === "number" && Number.isFinite(flowTotalRaw)
        ? `${flowTotalRaw >= 0 ? "+" : ""}${Math.round(flowTotalRaw).toLocaleString()}`
        : "N/A";

    const upProb1D = typeof snapshot?.predictions?.upProb1D === "number" ? snapshot.predictions.upProb1D : null;
    const upProb3D = typeof snapshot?.predictions?.upProb3D === "number" ? snapshot.predictions.upProb3D : null;
    const upProb5D = typeof snapshot?.predictions?.upProb5D === "number" ? snapshot.predictions.upProb5D : null;

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

    const sector = snapshot?.globalLinkage?.drivers?.sector;
    const peers = Array.isArray(snapshot?.globalLinkage?.drivers?.peers)
      ? snapshot.globalLinkage.drivers.peers
      : [];

    const candidates: Array<{ symbol: string; name: string; corr60?: number; reason?: string }> = [];
    if (sector?.id) {
      candidates.push({
        symbol: String(sector.id),
        name: String(sector.nameZh || sector.id),
        corr60: typeof sector.corr60 === "number" ? sector.corr60 : undefined,
        reason: "海外板塊",
      });
    }

    for (const p of peers.slice(0, 3)) {
      if (!p?.symbol) continue;
      candidates.push({
        symbol: String(p.symbol),
        name: String(p.nameEn || p.symbol),
        corr60: typeof p.corr60 === "number" ? p.corr60 : undefined,
        reason: typeof p.reason === "string" ? p.reason : undefined,
      });
    }

    const unique = new Map<string, { symbol: string; name: string; corr60?: number; reason?: string }>();
    for (const c of candidates) {
      if (!unique.has(c.symbol)) unique.set(c.symbol, c);
    }

    const overseasQuotes = await Promise.all(
      Array.from(unique.values()).map((c) => fetchUsQuote(c.symbol, c.name, c.corr60, c.reason)),
    );

    return {
      symbol: String(snapshot?.normalizedTicker?.symbol || symbol),
      nameZh: String(snapshot?.normalizedTicker?.companyNameZh || snapshot?.normalizedTicker?.displayName || symbol),
      price: latest,
      changePct,
      flowTotal,
      tomorrowTrend: buildTrendByProb(upProb1D),
      upProb1D,
      upProb3D,
      upProb5D,
      strategySignal: String(snapshot?.strategy?.signal || buildTrendByProb(upProb1D)),
      strategyConfidence: typeof snapshot?.strategy?.confidence === "number" ? snapshot.strategy.confidence : null,
      majorNews,
      majorNewsSummary: majorNews.length > 0 ? "有重大新聞" : "無重大新聞",
      overseasQuotes,
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

  if (!query) {
    await sendMessage(chatId, "請輸入股票代號或名稱，例如: /stock 2330");
    return;
  }

  const progressMessageId = await sendMessage(chatId, "正在搜尋資料中，請稍候...");

  const liveFirst = await fetchLiveStockRow(query);
  if (liveFirst) {
    await replyOrEdit(chatId, progressMessageId, `${buildSingleStockMessage(liveFirst)}\n\n<i>資料來源: 即時 snapshot</i>`);
    return;
  }

  let report: LatestReport | null = null;
  try {
    report = (await fetchLatestReport()) as LatestReport | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await replyOrEdit(
      chatId,
      progressMessageId,
      `目前即時來源暫時不可用，且最新收盤報告尚未同步完成。\n請稍後再試（不是無資料）。\n\n錯誤: ${escapeHtml(message)}`,
    );
    return;
  }

  if (!report || !Array.isArray(report.watchlist) || report.watchlist.length === 0) {
    await replyOrEdit(chatId, progressMessageId, "最新收盤報告尚未同步完成，請稍後再試（不是無資料）。");
    return;
  }

  const stock = report.watchlist.find((item) => {
    const symbolMatch = item.symbol === query;
    const nameMatch = item.nameZh?.includes(query);
    return symbolMatch || Boolean(nameMatch);
  });

  if (!stock) {
    await replyOrEdit(chatId, progressMessageId, `找不到 ${escapeHtml(query)}，請確認股票代號或名稱。`);
    return;
  }

  await replyOrEdit(chatId, progressMessageId, `${buildSingleStockMessage(stock)}\n\n<i>資料來源: 最新收盤報告快照</i>`);
}
