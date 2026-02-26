async function runVerification() {
  console.log("=== 正在驗證 2867 (三商壽) 板塊與對標連動 ===");
  try {
    const res = await fetch("http://localhost:3000/api/stock/2867/snapshot");
    if (!res.ok) {
      console.error("API response not ok", res.status);
      process.exit(1);
    }
    const data = await res.json();
    const linkage = data.globalLinkage;

    if (!linkage) {
      throw new Error("Missing globalLinkage object in response");
    }

    // 1. Assert sector Zh
    if (linkage.profile.sectorZh !== "金融保險") {
      throw new Error(`Profile sector assertion failed. Expected "金融保險", got "${linkage.profile.sectorZh}"`);
    } else {
      console.log("✅ 產業辨識正確: 金融保險");
    }

    // 2. Assert no QQQ/MSFT
    const badOverseas = ["QQQ", "MSFT", "XLK"];
    if (linkage.drivers.sector && badOverseas.includes(linkage.drivers.sector.id)) {
      throw new Error(`Overseas sector fallback failed guardrail. Got: ${linkage.drivers.sector.id}`);
    }
    if (linkage.drivers.peers) {
        for (const p of linkage.drivers.peers) {
             if (badOverseas.includes(p.symbol)) {
                 throw new Error(`Overseas peer fallback failed guardrail. Got bad symbol: ${p.symbol}`);
             }
        }
    }
    console.log("✅ 海外對標與板塊無科技股誤判 (QQQ/MSFT)");

    // 3. Assert TW Peers length >= 3
    const twLinkage = linkage.twPeerLinkage;
    if (!twLinkage || !twLinkage.peers || twLinkage.peers.length < 3) {
      throw new Error(`twPeerLinkage missing or less than 3 peers. Size: ${twLinkage?.peers?.length}`);
    } else {
      console.log(`✅ 台股對標生成成功，數量: ${twLinkage.peers.length}`);
    }

    // 4. Print Peers to manual review correlation
    console.log("--- 台股對標清單 ---");
    for (const p of twLinkage.peers) {
       console.log(` - ${p.nameZh} (${p.code}): 相關度 = ${p.corr60 ? (p.corr60 * 100).toFixed(1) : "N/A"}% -> [${p.note}]`);
       if (Math.abs(p.corr60 || 0) < 0.15 && p.note !== "連動不明顯" && p.note !== "資料不足") {
           throw new Error(`Correlation constraint failed. Expected note '連動不明顯' for corr < 0.15. Got ${p.note} for ${p.code}`);
       }
    }
    
    console.log("\n海外板塊:", linkage.drivers.sector?.id, linkage.drivers.sector?.nameZh);
    console.log("海外對標:", linkage.drivers.peers.map((p: any) => `${p.symbol} (${p.reason})`).join(", "));

    console.log("\n🎉 所有連動與對標測試綠燈通過！");

  } catch (err: any) {
    console.error("❌ 測試失敗:", err.message);
    process.exit(1);
  }
}

runVerification();
