const { subDays } = require("date-fns");
const { getTaiwanStockNews } = require("../src/lib/providers/finmind");

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function main() {
  const ticker = "2330";
  const end = new Date();
  const start = subDays(end, 7);
  const startStr = formatDate(start);
  const endStr = formatDate(end);

  console.log(`[selfcheck:fallback] ticker=${ticker}, range=${startStr}..${endStr}`);

  const result = await getTaiwanStockNews(ticker, endStr, endStr);
  const tokenExists = Boolean(process.env.FINMIND_API_TOKEN?.trim());
  const { meta, data } = result;
  const count = data.length;

  console.log(
    `[selfcheck:fallback] authUsed=${meta.authUsed}, fallbackUsed=${meta.fallbackUsed}, statusAnon=${meta.statusAnon ?? "n/a"}, statusEnv=${meta.statusEnv ?? "n/a"}, count=${count}`,
  );

  if (meta.authUsed === "anon" && !meta.fallbackUsed) {
    console.log("PASS: 匿名請求成功，未觸發 fallback。");
    return;
  }

  if (meta.authUsed === "env" && meta.fallbackUsed && meta.statusEnv === 200) {
    console.log("PASS: 匿名受限後已自動 fallback 至 env token 並成功回應。");
    return;
  }

  if (!tokenExists) {
    console.error("FAIL: 匿名請求失敗且未設定 FINMIND_API_TOKEN。請在 Vercel env 設定。", meta);
    process.exit(1);
  }

  if (meta.errorCode) {
    console.error(`FAIL: fallback 最終失敗 errorCode=${meta.errorCode}, message=${meta.message ?? "unknown"}`);
    process.exit(1);
  }

  console.error("FAIL: fallback 驗證未達預期。", meta);
  process.exit(1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL: selfcheck exception: ${message}`);
  process.exit(1);
});
