async function runClusterVerification() {
  console.log("=== 正在驗證 2867 (三商壽) 自動聚類與動態對標連動 ===");
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

    // 1. Assert sector Zh (should be recognized by FinMind or keywords as 金融保險)
    if (!linkage.profile.sectorZh?.includes("金融") && !linkage.profile.sectorZh?.includes("保險")) {
      throw new Error(`Profile sector assertion failed. Expected "金融保險", got "${linkage.profile.sectorZh}"`);
    } else {
      console.log(`✅ 產業辨識正確: ${linkage.profile.sectorZh} (Confidence: ${linkage.profile.confidence})`);
    }

    // 2. Assert no QQQ/MSFT, expecting XLF
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
    console.log(`✅ 海外對標正確分類為: ${linkage.drivers.sector?.id} (${linkage.drivers.sector?.nameZh})`);
    console.log("   海外對標:", linkage.drivers.peers.map((p: any) => `${p.symbol} (${p.reason || '相關同業'})`).join(", "));

    // 3. Assert TW Peers length
    const twLinkage = linkage.twPeerLinkage;
    if (!twLinkage || !twLinkage.peers || twLinkage.peers.length === 0) {
      throw new Error(`twPeerLinkage missing or 0 peers. Size: ${twLinkage?.peers?.length}`);
    } else {
      console.log(`✅ 台股對標生成成功，自動聚類並選出數量: ${twLinkage.peers.length}`);
    }

    // 4. Print Peers 
    console.log(`--- 台股對標清單 (基準: ${twLinkage.benchmark.nameZh}) ---`);
    for (const p of twLinkage.peers) {
       console.log(` - ${p.nameZh} (${p.code}): 相關度 = ${p.corr60 ? (p.corr60 * 100).toFixed(1) : "N/A"}% -> [${p.note}]`);
    }

    console.log("\n🎉 所有動態聚類與對標測試綠燈通過！");

  } catch (err: any) {
    console.error("❌ 測試失敗:", err.message);
    process.exit(1);
  }
}

runClusterVerification();
