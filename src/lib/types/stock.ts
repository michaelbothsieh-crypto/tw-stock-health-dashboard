import { TvTechnicalData } from "@/lib/providers/tradingViewFetch";
import { MonthlyRevenue, InstitutionalInvestor, MarginShort } from "@/lib/providers/finmind";

export interface UnifiedStockSnapshot {
  displayName: string | null;
  prices: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
  fundamentals: {
    revenue: MonthlyRevenue[];
    eps: number | null;
    peRatio: number | null;
    revenueGrowth: number | null;
  };
  flow: {
    investors: InstitutionalInvestor[];
    margin: MarginShort[];
    institutionalOwnership: number | null;
  } | null;
  technicals: TvTechnicalData | null;
  news: any[];
  meta: {
    providerAuthUsed: "anon" | "env";
    fallbackUsed: boolean;
    newsMeta: {
      authUsed: string;
      fallbackUsed: boolean;
      errorCode?: string;
      message?: string;
    };
  };
  warnings: string[];
}
