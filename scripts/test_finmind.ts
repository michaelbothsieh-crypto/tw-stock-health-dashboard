import fetch from 'node-fetch';

async function testApi(params: string) {
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockNews&${params}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
        status?: number;
        msg?: string;
        data?: unknown;
    };
    console.log(`Params: ${params}`);
    console.log(`Status: ${data.status ?? 'unknown'}, Msg: ${data.msg ?? 'unknown'}`);
    console.log(`Data count: ${Array.isArray(data.data) ? data.data.length : 'not array'}`);
    if (Array.isArray(data.data) && data.data.length > 0) {
        console.log(`Sample: ${JSON.stringify(data.data[0])}`);
    }
    console.log('---');
}

async function run() {
    await testApi('data_id=2330&start_date=2026-02-18&end_date=2026-02-25');
    await testApi('data_id=2330&date=2026-02-25');
    await testApi('stock_id=2330&start_date=2026-02-18&end_date=2026-02-25');
    await testApi('stock_id=2330&date=2026-02-25');
}

run();
