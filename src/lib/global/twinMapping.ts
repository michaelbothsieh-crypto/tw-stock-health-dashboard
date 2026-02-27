export const US_TO_TW_TWIN: Record<string, string> = {
  "TSM": "2330",
  "UMC": "2303",
  "ASX": "3711",
  "CHT": "2412",
  "AUO": "2409",
  "HIMX": "3441", // Common Himax to AUO or similar, but let's keep certain ones
};

export const TW_TO_US_TWIN: Record<string, string> = Object.entries(US_TO_TW_TWIN).reduce((acc, [us, tw]) => {
  acc[tw] = us;
  return acc;
}, {} as Record<string, string>);

export function getTwinSymbol(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/\.(TW|TWO)$/, "");
  return US_TO_TW_TWIN[s] || TW_TO_US_TWIN[s] || null;
}
