import { twStockNames } from "@/data/twStockNames";

// A stock name in Taiwan should mostly be Chinese. 
// We use a stricter check: if it has 3 or more English letters, it's likely an English name returned by Yahoo.
function containsTooMuchEnglish(text: string) {
  return /[A-Za-z]{3,}/.test(text);
}

export async function resolveStockName(inputCode: string): Promise<string> {
  const code = inputCode.toUpperCase();
  const isUS = /^[A-Z]+$/.test(code);
  const localCacheKey = `twshd:stockNameCache:v1:${code}`;
  
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(localCacheKey);
    // If US stock, we allow English names. If TW stock, we still filter out too much english (Yahoo Taiwan quirks)
    if (cached && (isUS || !containsTooMuchEnglish(cached)) && cached !== "未知公司") {
      return cached;
    }
  }
  
  // Step 1: Force local map first (only for TW stocks usually)
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
        
        // Step 3: English fallback rejection (Skip for US stocks)
        if (!isUS && containsTooMuchEnglish(finalName)) {
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
