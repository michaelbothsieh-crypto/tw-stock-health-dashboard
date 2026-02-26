import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function performFetch(url: string, name: string) {
    let result = `${name}:\nURL: ${url.replace(/token=[^&]+/, "token=***")}\n`;
    try {
        const res = await fetch(url);
        const text = await res.text();
        result += `Status: ${res.status}\n`;
        try {
            const json = JSON.parse(text);
            result += `Msg: ${json.msg}\n`;
            if (json.data) {
                result += `Data Length: ${json.data.length}\n`;
            }
        } catch {
            result += `Raw: ${text.substring(0, 100)}\n`;
        }
    } catch (e: any) {
        result += `Error: ${e.message}\n`;
    }
    result += "\n";
    return result;
}

async function test() {
    let output = "";
    const token = process.env.FINMIND_API_TOKEN;
    const tokenParams = token ? `&token=${token}` : "";

    output += await performFetch(`https://api.finmindtrade.com/api/v3/data?dataset=TaiwanStockNews&data_id=2330&date=2026-02-19&end_date=2026-02-26${tokenParams}`, "V3 date + end_date");
    output += await performFetch(`https://api.finmindtrade.com/api/v3/data?dataset=TaiwanStockNews&data_id=2330&start_date=2026-02-19&end_date=2026-02-26${tokenParams}`, "V3 start_date + end_date");
    output += await performFetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockNews&data_id=2330&start_date=2026-02-19&end_date=2026-02-26${tokenParams}`, "V4 start_date + end_date");
    output += await performFetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockNews&data_id=2330&start_date=2026-02-19${tokenParams}`, "V4 start_date only");

    fs.writeFileSync('test_api_clean.log', output, 'utf8');
}
test();
