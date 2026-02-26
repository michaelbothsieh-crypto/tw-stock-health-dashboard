export const RISK_FLAG_LABELS: Record<string, string> = {
  overheated: "短線過熱（RSI 過高且乖離偏大）",
  breakdown_risk: "跌破短期均線，轉弱風險上升",
  whipsaw: "盤整震盪，假突破風險",
  volume_missing: "成交量資料不足",
  margin_spike: "融資餘額快速上升",
  inst_reversal_down: "法人由買轉賣",
  inst_reversal_up: "法人由賣轉買",
  rev_turn_negative: "營收動能轉弱為負",
  growth_decelerating: "營收成長率明顯放緩",
  flow_data_missing: "籌碼資料不足",
  margin_data_missing: "融資資料不足",
};

export function riskFlagLabel(key: string): string {
  return RISK_FLAG_LABELS[key] ?? key;
}
