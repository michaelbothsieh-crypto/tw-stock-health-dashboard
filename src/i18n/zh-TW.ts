export const zhTW = {
  appTitle: "台股健康儀表板",
  actions: {
    switchStock: "切換",
    switchStockTitle: "切換股票",
    manageWatchlist: "管理追蹤清單",
    openExplain: "ⓘ 查看計算",
    collapse: "收合",
    expand: "展開",
    close: "關閉",
    viewAll: "全部",
    showGuide: "功能說明",
    settings: "設定",
  },
  stockPicker: {
    searchPlaceholder: "輸入代號或股名",
    noResult: "找不到符合條件的股票",
  },
  states: {
    loading: "資料讀取中...",
    snapshotError: "快照載入失敗",
    noData: "無資料",
    noNews: "近 7 天無可用新聞",
    newsLoadFailed: "新聞抓不到",
    unknownSource: "未知來源",
    otherCategory: "其他",
    current: "目前",
    none: "無",
  },
  section: {
    heroBasis: "主要依據",
    confidence: "信心",
    trend: "趨勢",
    flow: "資金流",
    fundamental: "基本面",
    confidenceTab: "信心",
    volatility: "波動",
    volatilityCard: "波動敏感度",
    volatilityDesc: "1~5 天波動敏感度",
    newsCatalyst: "新聞與催化",
    chart: "價格走勢圖",
    chartDesc: "最近 {count} 筆資料 · 收盤與均線",
    explain: "計算說明",
    explainDesc: "展開細項查看分數怎麼算出來的",
    newsDesc: "近 7 日新聞催化 · 多 {bull} / 空 {bear}",
    currentStock: "目前股票",
    market: "市場",
    yahoo: "Yahoo",
    trendDesc: "趨勢與動能",
    flowDesc: "法人與融資籌碼",
    fundamentalDesc: "營收基本面",
    shortTerm: "短期機會",
    shortTermDesc: "短線爆發潛力與回檔風險",
    prediction: "預測機率",
    predictionDesc: "1/3/5 日上漲與大波動機率",
    upProb1D: "1 日上漲機率",
    upProb3D: "3 日上漲機率",
    upProb5D: "5 日上漲機率",
    bigMoveProb3D: "3 日大波動機率",
    pullbackRisk: "回檔風險",
    rawProb: "原始",
    calibratedProb: "校準後",
    radar: "雷達總覽",
    radarDesc: "技術、籌碼、基本面、新聞、波動、短期、機率",
    strategy: "策略建議",
    strategyDesc: "碰到條件就觸發的可執行策略",
    score: "分數",
  },
  guide: {
    lines: [
      "最上方有各面向分數：趨勢、籌碼、基本面、短期機會、預測機率和波動度。",
      "按一下「查看計算」就能展開看細節、公式和風險提醒。",
      "新聞區有最近催化事件，分出利多跟利空。",
    ],
  },
  riskLevel: {
    high: "高",
    medium: "中",
    low: "低",
  },
  disclaimer: "這只是歷史統計出來的機率，不代表未來真的會這樣",
  strategy: {
    modeTrend: "波段",
    modeShort: "短線",
    signalObserve: "觀察",
    signalBullish: "偏多",
    signalBearish: "偏空",
    signalWait: "等待",
    signalAvoid: "避開",
    confidence: "策略信心",
    conditions: "觸發條件",
    invalidation: "失效條件",
    riskNotes: "風險提醒",
    plan: "執行計畫",
    viewDetail: "查看詳情",
    hideDetail: "收合詳情",
    noCard: "目前沒什麼特別的，先觀察就好",
  },
  explain: {
    formula: "公式",
    components: "組成項目",
    reasons: "依據",
    riskFlags: "風險標記",
    columns: {
      label: "項目",
      value: "原始值",
      weight: "權重",
      contribution: "貢獻",
    },
    openHint: "點一下卡片來展開計算細節",
  },
  stance: {
    bullish: "偏多",
    neutral: "中性",
    bearish: "偏空",
  },
  impact: {
    bullish: "利多",
    bearish: "利空",
    neutral: "中性",
  },
  chart: {
    noPrice: "缺價格資料",
    date: "日期",
    close: "收盤",
    sma20: "20 日均線",
    sma60: "60 日均線",
    volume: "成交量",
  },
  volatilitySummary: {
    high: "近 5 天上下洗得很兇，留意突破或是急拉急殺",
    medium: "近 5 天波動普通，留意有沒有假突破",
    low: "近 5 天沒什麼大動靜",
  },
};

export const defaultWatchlist = ["2330", "2317", "2454", "3231"];

export const stockNameMap: Record<string, string> = {
  "2330": "台積電",
  "2317": "鴻海",
  "2454": "聯發科",
  "3231": "緯創",
  "2382": "廣達",
  "2303": "聯電",
};

export function stanceLabelWithEn(stance: "Bullish" | "Neutral" | "Bearish"): string {
  if (stance === "Bullish") return `${zhTW.stance.bullish} (Bullish)`;
  if (stance === "Bearish") return `${zhTW.stance.bearish} (Bearish)`;
  return `${zhTW.stance.neutral} (Neutral)`;
}

export function impactLabel(impact?: "BULLISH" | "BEARISH" | "NEUTRAL"): string {
  if (impact === "BULLISH") return zhTW.impact.bullish;
  if (impact === "BEARISH") return zhTW.impact.bearish;
  return zhTW.impact.neutral;
}

export function mapErrorCodeToZh(errorCode?: string | null): string {
  if (!errorCode) return "伺服器有點異常，先等等";
  const code = errorCode.toUpperCase();

  if (code.includes("ERR_FINMIND_TOKEN_REQUIRED") || code.includes("AUTH_REQUIRED")) {
    return "API Token 卡住了，可能是沒設定好或是沒額度了";
  }
  if (code.includes("ERR_FINMIND_RATE_LIMIT") || code.includes("RATE") || code.includes("QUOTA")) {
    return "剛剛敲 API 敲太快了，被擋下來，稍後再試";
  }
  if (code.includes("PERMISSION")) {
    return "抓這筆資料的權限不夠，先跳過";
  }
  if (code.includes("NETWORK")) {
    return "網路連線異常，再整理一次看看";
  }
  if (code.includes("FINMIND_REQUEST_FAILED")) {
    return "FinMind 剛才回應失敗，晚點再來";
  }

  return "資料打不回來，可能塞車了";
}

export function volatilitySummary(score: number | null): string {
  if (score === null) return zhTW.states.noData;
  if (score >= 70) return zhTW.volatilitySummary.high;
  if (score >= 40) return zhTW.volatilitySummary.medium;
  return zhTW.volatilitySummary.low;
}
