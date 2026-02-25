import { useQuery } from '@tanstack/react-query';

export function useStockSnapshot(ticker: string) {
    return useQuery({
        queryKey: ['stockSnapshot', ticker],
        queryFn: async () => {
            const res = await fetch(`/api/stock/${ticker}/snapshot`);
            if (!res.ok) {
                throw new Error('Failed to fetch snapshot');
            }
            return res.json();
        },
        enabled: !!ticker,
    });
}
