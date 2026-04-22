
/**
 * 新聞處理工具 (Shared 層級 - SSOT)
 */

export function getFirstNewsTitle(news: any, symbol?: string, isUS = false): string | null {
  if (!news || !Array.isArray(news) || news.length === 0) return null;
  const cleanSymbol = symbol?.toUpperCase();
  for (const item of news) {
    const title = typeof item === 'string' ? item : (item?.title || item?.headline);
    if (!title) continue;
    const hasChinese = /[\u4e00-\u9fa5]/.test(title);
    const upperTitle = title.toUpperCase();
    if (!isUS) {
      if (hasChinese || (cleanSymbol && upperTitle.includes(cleanSymbol))) return title;
    } else {
      if (cleanSymbol && upperTitle.includes(cleanSymbol)) return title;
      if (hasChinese) return title;
    }
  }
  return null;
}

export function getRichNewsList(news: any, symbol?: string, isUS = false): string[] {
  if (!news || !Array.isArray(news) || news.length === 0) return [];
  const cleanSymbol = symbol?.toUpperCase();
  const results: string[] = [];
  for (const item of news) {
    const title = typeof item === 'string' ? item : (item?.title || item?.headline);
    const summary = item?.summary || item?.description || "";
    if (!title) continue;
    const content = summary ? `${title} | 摘要: ${summary}` : title;
    
    // 增加更寬鬆的相關性判斷
    const isRelevant = !cleanSymbol || 
                      title.toUpperCase().includes(cleanSymbol) || 
                      (isUS && cleanSymbol.split('.')[0] && title.toUpperCase().includes(cleanSymbol.split('.')[0]));

    if (isRelevant) {
      results.push(content);
    } else if (!isUS && /[\u4e00-\u9fa5]/.test(title)) {
      // 台股環境下，如果有中文字通常也是相關的
      results.push(content);
    }

    if (results.length >= 10) break;
  }
  return results;
}

export function isWithinDays(dateInput: any, days: number): boolean {
  if (!dateInput) return true; // 若無日期則預設通過，由後續過濾
  try {
    let ts: number;
    if (dateInput instanceof Date) {
      ts = dateInput.getTime();
    } else if (typeof dateInput === 'number') {
      // Yahoo Finance 有時返回秒數 (10位) 或毫秒 (13位)
      ts = dateInput > 10000000000 ? dateInput : dateInput * 1000;
    } else {
      ts = new Date(dateInput).getTime();
    }
    if (isNaN(ts)) return true;
    return (Date.now() - ts) <= days * 24 * 60 * 60 * 1000;
  } catch { return true; }
}
