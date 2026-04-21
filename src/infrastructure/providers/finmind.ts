
/**
 * FinMind Data Provider (Infrastructure 層)
 */

export interface PriceDaily {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const API_TOKEN = process.env.FINMIND_API_TOKEN || "";

async function fetchFinmind(dataset: string, symbol: string, startDate: string, endDate: string) {
  const url = `https://api.finmindtrade.com/api/v4/data?dataset=${dataset}&data_id=${symbol}&start_date=${startDate}&end_date=${endDate}${API_TOKEN ? `&token=${API_TOKEN}` : ""}`;
  const res = await fetch(url);
  return await res.json();
}

export async function getPriceDaily(symbol: string, start: string, end: string) {
  return fetchFinmind("TaiwanStockPrice", symbol, start, end);
}

export async function getInstitutionalInvestors(symbol: string, start: string, end: string) {
  return fetchFinmind("TaiwanStockInstitutionalInvestorsBuySell", symbol, start, end);
}

export async function getMarginShort(symbol: string, start: string, end: string) {
  return fetchFinmind("TaiwanStockMarginPurchaseShortSale", symbol, start, end);
}

export async function getMonthlyRevenue(symbol: string, start: string, end: string) {
  return fetchFinmind("TaiwanStockMonthRevenue", symbol, start, end);
}

export async function getTaiwanStockNews(symbol: string, start: string, end: string) {
  return fetchFinmind("TaiwanStockNews", symbol, start, end);
}

// 美股支援
export async function getPriceDailyUs(symbol: string, start: string, end: string) {
  return fetchFinmind("USStockPrice", symbol, start, end);
}

export async function getMonthlyRevenueUs(symbol: string, start: string, end: string) {
  return fetchFinmind("USStockMonthRevenue", symbol, start, end);
}

export async function getUsStockNews(symbol: string, start: string, end: string) {
  return fetchFinmind("USStockNews", symbol, start, end);
}

export async function getInstitutionalInvestorsUs(symbol: string, start: string, end: string) {
  return fetchFinmind("USStockInstitutionalInvestorsBuySell", symbol, start, end);
}

// 相容性導出
export async function getStockInfo(symbol: string) {
   return fetchFinmind("TaiwanStockInfo", symbol, "2020-01-01", "2020-01-01");
}

export interface TaiwanStockNews {
  date: string;
  title: string;
  link?: string;
  source?: string;
}

export interface InstitutionalInvestor {
  date: string;
  buy: number;
  sell: number;
  name: string;
}

export interface MarginShort {
  date: string;
  MarginPurchaseBuy: number;
  MarginPurchaseSell: number;
  MarginPurchaseTodayBalance: number;
  ShortSaleTodayBalance: number;
}

export interface MonthlyRevenue {
  date: string;
  revenue: number;
  revenue_year: number;
  revenue_month: number;
}

export const FinmindProviderError = Error;
// export type { TaiwanStockNews, InstitutionalInvestor, MarginShort, MonthlyRevenue } from "@/shared/types/finmind";
// 改為在此直接定義以確保 SSOT

