import { z } from "zod";
import { FinmindFetchMeta, finmindFetch } from "./finmindFetch";

const FINMIND_API_URL = "https://api.finmindtrade.com/api/v4/data";
const REVALIDATE_TIME = 21600;

const BaseResponseSchema = z.object({
  msg: z.string(),
  status: z.number(),
});

export const PriceDailySchema = z.object({
  date: z.string(),
  stock_id: z.string(),
  Trading_Volume: z.number(),
  Trading_money: z.number().optional(),
  open: z.number(),
  max: z.number(),
  min: z.number(),
  close: z.number(),
  spread: z.number().optional(),
  Trading_turnover: z.number().optional(),
});
export type PriceDaily = z.infer<typeof PriceDailySchema>;

export const InstitutionalInvestorsSchema = z.object({
  date: z.string(),
  stock_id: z.string(),
  name: z.string(),
  buy: z.number(),
  sell: z.number(),
});
export type InstitutionalInvestor = z.infer<typeof InstitutionalInvestorsSchema>;

export const MarginShortSchema = z
  .object({
    date: z.string(),
    stock_id: z.string(),
    MarginPurchaseTodayBalance: z.number().optional(),
    ShortSaleTodayBalance: z.number().optional(),
  })
  .passthrough();
export type MarginShort = z.infer<typeof MarginShortSchema>;

export const StockInfoSchema = z
  .object({
    industry_category: z.string().optional(),
    stock_id: z.string(),
    stock_name: z.string().optional(),
    type: z.string().optional(),
    date: z.string().optional(),
  })
  .passthrough();
export type StockInfo = z.infer<typeof StockInfoSchema>;

export const MonthlyRevenueSchema = z.object({
  date: z.string(),
  stock_id: z.string(),
  revenue_month: z.number(),
  revenue_year: z.number(),
  revenue: z.number(),
  revenue_year_on_year: z.number().optional(),
});
export type MonthlyRevenue = z.infer<typeof MonthlyRevenueSchema>;

export const TaiwanStockNewsSchema = z
  .object({
    date: z.string(),
    stock_id: z.string(),
    link: z.string().optional(),
    source: z.string().optional(),
    title: z.string(),
  })
  .passthrough();
export type TaiwanStockNews = z.infer<typeof TaiwanStockNewsSchema>;

export interface FinmindDatasetResult<T> {
  data: T[];
  meta: FinmindFetchMeta;
}

export class FinmindProviderError extends Error {
  errorCode: string;
  meta: FinmindFetchMeta;

  constructor(message: string, errorCode: string, meta: FinmindFetchMeta) {
    super(message);
    this.name = "FinmindProviderError";
    this.errorCode = errorCode;
    this.meta = meta;
  }
}

async function fetchFromFinMind<T>(
  dataset: string,
  dataId: string,
  startDate: string,
  endDate: string,
  schema: z.ZodType<T>,
): Promise<FinmindDatasetResult<T>> {
  const result = await finmindFetch({
    url: FINMIND_API_URL,
    params: {
      dataset,
      data_id: dataId,
      start_date: startDate,
      end_date: endDate,
    },
    revalidateSeconds: REVALIDATE_TIME,
    cacheKeyBase: `${dataset}:${dataId}:${startDate}:${endDate}`,
  });

  if (!result.ok) {
    const message = result.meta.message || "FinMind request failed";
    const errorCode = result.meta.errorCode || "finmind_request_failed";
    throw new FinmindProviderError(message, errorCode, result.meta);
  }

  const parsedBase = BaseResponseSchema.passthrough().safeParse(result.body);
  if (!parsedBase.success || parsedBase.data.status !== 200) {
    throw new FinmindProviderError(
      result.body?.msg || "FinMind status is not 200",
      "finmind_status_error",
      result.meta,
    );
  }

  const parsedData = z.array(schema).safeParse(result.body?.data || []);
  if (!parsedData.success) {
    throw new FinmindProviderError("Failed to parse FinMind data", "finmind_parse_error", result.meta);
  }

  return {
    data: parsedData.data,
    meta: result.meta,
  };
}

export async function getPriceDaily(ticker: string, start: string, end: string) {
  return fetchFromFinMind("TaiwanStockPrice", ticker, start, end, PriceDailySchema);
}

export async function getInstitutionalInvestors(ticker: string, start: string, end: string) {
  return fetchFromFinMind(
    "TaiwanStockInstitutionalInvestorsBuySell",
    ticker,
    start,
    end,
    InstitutionalInvestorsSchema,
  );
}

export async function getMarginShort(ticker: string, start: string, end: string) {
  return fetchFromFinMind("TaiwanStockMarginPurchaseShortSale", ticker, start, end, MarginShortSchema);
}

export async function getMonthlyRevenue(ticker: string, start: string, end: string) {
  return fetchFromFinMind("TaiwanStockMonthRevenue", ticker, start, end, MonthlyRevenueSchema);
}

export async function getStockInfo(ticker: string) {
  const result = await finmindFetch({
    url: FINMIND_API_URL,
    params: {
      dataset: "TaiwanStockInfo",
      data_id: ticker,
    },
    revalidateSeconds: 86400 * 7,
    cacheKeyBase: `TaiwanStockInfo:${ticker}:none:none`,
  });

  if (!result.ok) {
    throw new FinmindProviderError(
      result.meta.message || "Failed to fetch stock info",
      result.meta.errorCode || "finmind_request_failed",
      result.meta,
    );
  }

  const parsedBase = BaseResponseSchema.passthrough().safeParse(result.body);
  if (!parsedBase.success || parsedBase.data.status !== 200) {
    throw new FinmindProviderError(
      result.body?.msg || "FinMind status is not 200",
      "finmind_status_error",
      result.meta,
    );
  }

  const parsedData = z.array(StockInfoSchema).safeParse(result.body?.data || []);
  if (!parsedData.success) {
    throw new FinmindProviderError("Failed to parse StockInfo data", "finmind_parse_error", result.meta);
  }

  return {
    data: parsedData.data,
    meta: result.meta,
  };
}

export async function getTaiwanStockNews(ticker: string, start: string, end: string) {
  return fetchFromFinMind("TaiwanStockNews", ticker, start, end, TaiwanStockNewsSchema);
}
