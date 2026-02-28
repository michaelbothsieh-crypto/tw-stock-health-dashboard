export function getSharedScoreStyle(score: number | null) {
  if (score === null) {
    return {
      container: "bg-neutral-900 border-neutral-800",
      text: "text-neutral-500",
      weather: "⋯ 載入中",
      dot: "bg-neutral-700"
    };
  }

  // TWSE Logic: >= 70 Red (Bullish), 50-69 Amber (Neutral), < 50 Green (Bearish)
  if (score >= 70) {
    return {
      container: "bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20 hover:border-red-500/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]",
      text: "text-red-600 dark:text-red-500",
      weather: "☀️ 體質強健",
      dot: "bg-red-500"
    };
  }
  if (score >= 50) {
    return {
      container: "bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]",
      text: "text-amber-600 dark:text-amber-500",
      weather: "☁️ 中性震盪",
      dot: "bg-amber-500"
    };
  }
  
  return {
    container: "bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20 hover:border-green-500/50 hover:shadow-[0_0_30px_rgba(34,197,94,0.15)]",
    text: "text-green-600 dark:text-green-500",
    weather: "⛈️ 避險警報",
    dot: "bg-green-500"
  };
}
