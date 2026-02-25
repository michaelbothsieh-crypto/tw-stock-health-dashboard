import { z } from "zod";

const FINMIND_API_URL = "https://api.finmindtrade.com/api/v4/data";
const REVALIDATE_TIME = 21600; // 6 hours

// --- Schemas ---

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

export const MarginShortSchema = z.object({
    date: z.string(),
    stock_id: z.string(),
    MarginPurchaseTodayBalance: z.number().optional(),
    ShortSaleTodayBalance: z.number().optional(),
}).passthrough();
export type MarginShort = z.infer<typeof MarginShortSchema>;

export const MonthlyRevenueSchema = z.object({
    date: z.string(),
    stock_id: z.string(),
    revenue_month: z.number(),
    revenue_year: z.number(),
    revenue: z.number(),
    revenue_year_on_year: z.number().optional(),
});
export type MonthlyRevenue = z.infer<typeof MonthlyRevenueSchema>;

// --- Fetcher Wrapper ---

async function fetchFromFinMind<T>(
    dataset: string,
    data_id: string,
    start_date: string,
    end_date: string,
    schema: z.ZodType<T>
): Promise<T[]> {
    const token = process.env.FINMIND_API_TOKEN;
    let url = `${FINMIND_API_URL}?dataset=${dataset}&data_id=${data_id}&start_date=${start_date}&end_date=${end_date}`;
    if (token) {
        url += `&token=${token}`;
    }

    const res = await fetch(url, {
        next: { revalidate: REVALIDATE_TIME },
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!res.ok) {
        throw new Error(`FinMind API error: ${res.statusText}`);
    }

    const raw = await res.json();
    const parsedBase = BaseResponseSchema.passthrough().safeParse(raw);

    if (!parsedBase.success || parsedBase.data.status !== 200) {
        throw new Error(`FinMind API returned error status: ${raw.msg}`);
    }

    const dataSchema = z.array(schema);
    const parsedData = dataSchema.safeParse(raw.data);

    if (!parsedData.success) {
        console.error("Zod Parsing Error:", parsedData.error);
        throw new Error("Failed to parse FinMind data");
    }

    return parsedData.data;
}

// --- API Methods ---

export async function getPriceDaily(ticker: string, start: string, end: string) {
    return fetchFromFinMind("TaiwanStockPrice", ticker, start, end, PriceDailySchema);
}

export async function getInstitutionalInvestors(ticker: string, start: string, end: string) {
    return fetchFromFinMind("TaiwanStockInstitutionalInvestorsBuySell", ticker, start, end, InstitutionalInvestorsSchema);
}

export async function getMarginShort(ticker: string, start: string, end: string) {
    return fetchFromFinMind("TaiwanStockMarginPurchaseShortSale", ticker, start, end, MarginShortSchema);
}

export async function getMonthlyRevenue(ticker: string, start: string, end: string) {
    // FinMind's Monthly Revenue might be slightly delayed, fetch a longer timeframe safely
    return fetchFromFinMind("TaiwanStockMonthRevenue", ticker, start, end, MonthlyRevenueSchema);
}
