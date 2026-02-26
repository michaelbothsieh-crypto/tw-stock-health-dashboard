import { DashboardBento } from "@/components/dashboard/DashboardBento";

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  return <DashboardBento initialTicker={ticker} />;
}
