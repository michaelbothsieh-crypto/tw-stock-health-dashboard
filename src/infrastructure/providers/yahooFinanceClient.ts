import YahooFinance from "yahoo-finance2";

/**
 * 共用的 yahoo-finance2 singleton，已抑制 yahooSurvey notice。
 * 所有模組應 import 此實例，而非自行 new YahooFinance()。
 */
export const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});
