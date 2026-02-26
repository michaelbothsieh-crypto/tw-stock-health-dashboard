import { twStockNames } from "@/data/twStockNames";

export async function resolveCodeFromInput(input: string): Promise<string | null> {
  const query = input.trim();
  if (!query) return null;

  // Direct code match
  const codeMatch = query.match(/^(\d{4,})(\.TW|\.TWO)?$/i);
  if (codeMatch) {
    return codeMatch[1];
  }

  // Exact match by name
  for (const [code, name] of Object.entries(twStockNames)) {
    if (name === query) {
      return code;
    }
  }

  // Partial match
  const partialMatches: string[] = [];
  for (const [code, name] of Object.entries(twStockNames)) {
    if (name.includes(query) || query.includes(name)) {
      partialMatches.push(code);
    }
  }

  if (partialMatches.length > 0) {
    return partialMatches[0]; // Return the first matching stock code
  }

  return null;
}
