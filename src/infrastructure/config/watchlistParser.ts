import fs from "fs";
import path from "path";

/**
 * Parses the WATCHLIST_TW environment variable.
 * Supports both JSON array string '["2330", "2881"]' 
 * and comma-separated string '2330,2881'.
 * Fallbacks to src/data/watchlist.json if ENV is missing.
 */
export function getWatchlist(): string[] {
  const envVal = process.env.WATCHLIST_TW?.trim();
  let parsed: string[] = [];

  if (envVal) {
    if (envVal.startsWith("[") && envVal.endsWith("]")) {
      try {
        const jsonArr = JSON.parse(envVal);
        if (Array.isArray(jsonArr)) {
          parsed = jsonArr.map(String);
        }
      } catch (e) {
        console.warn("[WatchlistParser] Failed to parse WATCHLIST_TW as JSON. Falling back to CSV parsing.");
      }
    }

    if (parsed.length === 0) {
      // CSV parsing
      parsed = envVal.split(",").map(s => s.trim());
    }
  } else {
    // Fallback to local JSON
    try {
      const fallbackPath = path.join(process.cwd(), "src", "data", "watchlist.json");
      if (fs.existsSync(fallbackPath)) {
        const fileContent = fs.readFileSync(fallbackPath, "utf-8");
        const jsonArr = JSON.parse(fileContent);
        if (Array.isArray(jsonArr)) {
           parsed = jsonArr.map(String);
        }
      }
    } catch (e) {
      console.warn("[WatchlistParser] Failed to read fallback watchlist.json:", e);
    }
  }

  // Sanitize: filter out non-numeric, remove empty, and deduplicate
  const clean = parsed
    .filter(s => s.length > 0 && /^\d+$/.test(s));
  
  return Array.from(new Set(clean));
}
