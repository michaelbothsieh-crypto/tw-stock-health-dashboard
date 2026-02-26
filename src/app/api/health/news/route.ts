import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const symbol = req.nextUrl.searchParams.get("symbol") || "2330";
    const token = process.env.FINMIND_API_TOKEN;
    const hasToken = !!token;

    // Use a recent 7 days range, typical for news fetching
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const formatDate = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const start = formatDate(fromDate);
    const end = formatDate(toDate);

    const performFetch = async (version: "v3" | "v4", params: Record<string, string>) => {
        const query = new URLSearchParams(params);
        if (!token && query.has("end_date")) {
            query.delete("end_date");
        }
        if (token) query.append("token", token);
        const baseUrl = `https://api.finmindtrade.com/api/${version}/data`;
        const url = `${baseUrl}?${query.toString()}`;

        const res = await fetch(url, { cache: 'no-store' });

        let raw: any = null;
        try {
            raw = await res.json();
        } catch (e) { }

        const safeParams = { ...params };
        let safeUrl = url;
        if (token) {
            safeParams.token = "***";
            safeUrl = safeUrl.replace(token, "***");
        }

        const requestPreview = {
            url: safeUrl,
            paramsWithoutToken: safeParams
        };

        return { res, raw, requestPreview };
    };

    try {
        // v3 try
        let fetchResult = await performFetch("v3", { dataset: "TaiwanStockNews", data_id: symbol, date: start, end_date: end });
        let { res, raw, requestPreview } = fetchResult;

        if (!res.ok || (raw && raw.status !== 200)) {
            // v4 fallback
            const v4Result = await performFetch("v4", { dataset: "TaiwanStockNews", data_id: symbol, start_date: start, end_date: end });
            res = v4Result.res;
            raw = v4Result.raw;
            requestPreview = v4Result.requestPreview;
        }

        const status = res.status;
        let data_count = 0;
        let sample_titles: string[] = [];
        let errorMsg = null;

        if (!res.ok || (raw && raw.status !== 200)) {
            let msg = res.statusText;
            if (raw && raw.msg) msg = raw.msg;
            errorMsg = `URL: ${requestPreview.url} | Params: ${JSON.stringify(requestPreview.paramsWithoutToken)} | Status: ${status} | Msg: ${msg}`;
        } else if (raw && Array.isArray(raw.data)) {
            data_count = raw.data.length;
            sample_titles = raw.data.slice(0, 3).map((item: any) => item.title || item.link || "Untitled");
        }

        return NextResponse.json({
            env_has_finmind_token: hasToken,
            requestPreview,
            status,
            data_count,
            sample_titles,
            error: errorMsg
        });

    } catch (e: any) {
        return NextResponse.json({
            env_has_finmind_token: hasToken,
            requestPreview: { url: "unknown", paramsWithoutToken: {} },
            status: 500,
            data_count: 0,
            sample_titles: [],
            error: e.message || "Failed to fetch"
        }, { status: 500 });
    }
}
