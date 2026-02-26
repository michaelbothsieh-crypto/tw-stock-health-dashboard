import { twStockNames } from "@/data/twStockNames";

// A stock name in Taiwan should mostly be Chinese. 
// We use a stricter check: if it has 3 or more English letters, it's likely an English name returned by Yahoo.
function containsTooMuchEnglish(text: string) {
  return /[A-Za-z]{3,}/.test(text);
}

export async function resolveStockName(code: string): Promise<string> {
  const localCacheKey = `twshd:stockNameCache:v1:${code}`;
  
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(localCacheKey);
    if (cached && !containsTooMuchEnglish(cached) && cached !== "未知公司") {
      return cached;
    }
  }
  
  // Step 1: Force local map first
  if (twStockNames[code] && !containsTooMuchEnglish(twStockNames[code])) {
    return twStockNames[code];
  }
  
  // Step 2: Try API
  try {
    const res = await fetch(`/api/stock/name?code=${code}`);
    if (res.ok) {
      const data = await res.json();
      if (data.name) {
        let finalName = data.name;
        
        // Step 3: English fallback rejection
        if (containsTooMuchEnglish(finalName)) {
           finalName = twStockNames[code] || code; // use local if exists, else just code
        }

        if (typeof window !== "undefined" && finalName !== code) {
           localStorage.setItem(localCacheKey, finalName);
        }
        return finalName;
      }
    }
  } catch (e) {
    console.warn(`[NameResolver] API failed for ${code}`, e);
  }
  
  // Step 4: Fallback to Code only
  return code;
}

export async function resolveBatch(codes: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const code of codes) {
    result[code] = await resolveStockName(code);
  }
  return result;
}
