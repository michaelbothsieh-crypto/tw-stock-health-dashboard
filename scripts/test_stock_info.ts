import { getStockInfo } from "../src/lib/providers/finmind";

async function run() {
  try {
    const res = await getStockInfo("2867");
    console.log("2867:", res.data);
    
    const res2 = await getStockInfo("2330");
    console.log("2330:", res2.data);
  } catch (e) {
    console.error(e);
  }
}

run();
