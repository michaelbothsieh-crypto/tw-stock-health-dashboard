
/**
 * 新聞處理工具 (Shared 層級 - SSOT)
 */

type NewsAliasInput = string | string[] | undefined;
type NewsItem = {
  title?: string;
  headline?: string;
  summary?: string;
  description?: string;
  link?: string;
  url?: string;
};

function asNewsItem(item: unknown): NewsItem | null {
  return item && typeof item === "object" ? item as NewsItem : null;
}

function normalizeAliases(symbol?: NewsAliasInput): string[] {
  const aliases = Array.isArray(symbol) ? symbol : symbol ? [symbol] : [];
  return aliases
    .map(alias => String(alias || "").trim())
    .filter(Boolean);
}

function isRelevantNewsText(title: string, summary: string, symbol?: NewsAliasInput, isUS = false): boolean {
  const content = `${title} ${summary || ""}`;
  const upperContent = content.toUpperCase();
  const aliases = normalizeAliases(symbol);

  if (aliases.length > 0) {
    return aliases.some(alias => {
      const upperAlias = alias.toUpperCase();
      const rootAlias = upperAlias.split(".")[0];
      return upperContent.includes(upperAlias) || (isUS && rootAlias.length >= 2 && upperContent.includes(rootAlias));
    });
  }

  return !isUS && /[\u4e00-\u9fa5]/.test(title);
}

export function isRelevantNewsItem(item: unknown, symbol?: NewsAliasInput, isUS = false): boolean {
  if (typeof item === "string") return isRelevantNewsText(item, "", symbol, isUS);

  const newsItem = asNewsItem(item);
  const title = newsItem?.title || newsItem?.headline;
  const summary = newsItem?.summary || newsItem?.description || "";
  return Boolean(title && isRelevantNewsText(title, summary, symbol, isUS));
}

export function getFirstNewsTitle(news: unknown, symbol?: NewsAliasInput, isUS = false): string | null {
  if (!news || !Array.isArray(news) || news.length === 0) return null;
  for (const item of news) {
    const newsItem = asNewsItem(item);
    const title = typeof item === 'string' ? item : (newsItem?.title || newsItem?.headline);
    if (!title) continue;
    if (isRelevantNewsItem(item, symbol, isUS)) return title;
  }
  return null;
}

export function getRichNewsList(news: unknown, symbol?: NewsAliasInput, isUS = false): string[] {
  if (!news || !Array.isArray(news) || news.length === 0) return [];
  const results: string[] = [];
  for (const item of news) {
    const newsItem = asNewsItem(item);
    const title = typeof item === 'string' ? item : (newsItem?.title || newsItem?.headline);
    const summary = newsItem?.summary || newsItem?.description || "";
    if (!title) continue;
    const content = summary ? `${title} | 摘要: ${summary}` : title;

    if (isRelevantNewsItem(item, symbol, isUS)) {
      results.push(content);
    }

    if (results.length >= 10) break;
  }
  return results;
}

export function getRichNewsLinks(news: unknown[], limit = 3, symbol?: NewsAliasInput, isUS = false): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = [];
  for (const item of news) {
    if (typeof item === 'string') continue;
    const newsItem = asNewsItem(item);
    const title = newsItem?.title || newsItem?.headline;
    const url = newsItem?.link || newsItem?.url;
    if (title && url && typeof url === 'string' && url.startsWith('http') && isRelevantNewsItem(item, symbol, isUS)) {
      results.push({ title, url });
      if (results.length >= limit) break;
    }
  }
  return results;
}

export function isWithinDays(dateInput: unknown, days: number): boolean {
  if (!dateInput) return true; // 若無日期則預設通過，由後續過濾
  try {
    let ts: number;
    if (dateInput instanceof Date) {
      ts = dateInput.getTime();
    } else if (typeof dateInput === 'number') {
      // Yahoo Finance 有時返回秒數 (10位) 或毫秒 (13位)
      ts = dateInput > 10000000000 ? dateInput : dateInput * 1000;
    } else if (typeof dateInput === 'string') {
      ts = new Date(dateInput).getTime();
    } else {
      return true;
    }
    if (isNaN(ts)) return true;
    return (Date.now() - ts) <= days * 24 * 60 * 60 * 1000;
  } catch { return true; }
}
