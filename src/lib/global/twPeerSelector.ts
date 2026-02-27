import { ClusterMember } from "./clusteringEngine";
import { calcCorrelation } from "./driverSelector";
import { getCompanyNameZh } from "../companyName";
import { getTwinSymbol } from "./twinMapping";

export interface TwPeerLinkage {
  benchmark: {
    kind: string;
    code: string;
    nameZh: string;
    returns: number[]; // 60 days
  };
  peers: Array<{
    code: string;
    nameZh: string;
    corr60: number | null;
    note: string;
  }>;
}

export async function selectTwPeers(
  targetCode: string, // format like "2867" or "TSM"
  clusterMembers: ClusterMember[],
  themeName: string | null,
  allMembers?: Map<string, ClusterMember>
): Promise<TwPeerLinkage> {
  const twinCode = getTwinSymbol(targetCode);
  const peersResult: Array<{ code: string; nameZh: string; corr60: number | null; note: string }> = [];
  
  // Use cluster members as the base pool
  let pool = [...clusterMembers];

  // If a twin exists and is NOT in the cluster, manually inject it from allMembers if available
  if (twinCode && !pool.some(m => m.symbol.replace(/\.TW$/, "").replace(/\.TWO$/, "") === twinCode)) {
    const twinMember = allMembers?.get(twinCode) || allMembers?.get(`${twinCode}.TW`) || allMembers?.get(`${twinCode}.TWO`);
    if (twinMember) {
      pool.push(twinMember);
    }
  }

  if (pool.length === 0) {
      return {
          benchmark: { kind: "台股族群基準", code: "Cluster", nameZh: "未知族群", returns: [] },
          peers: []
      };
  }

  // Calculate cluster benchmark index returns
  const numMembers = pool.length;
  const numDays = pool[0].returns.length;
  const clusterReturns = new Array(numDays).fill(0);
  
  for (const m of pool) {
      for (let i = 0; i < m.returns.length; i++) {
          clusterReturns[i] += m.returns[i] / numMembers;
      }
  }

  const benchmarkObj = {
    kind: "自建族群基準",
    code: `CLUSTER-${pool[0].clusterId || 0}`,
    nameZh: `${themeName || "綜合"}族群指數`,
    returns: clusterReturns
  };

  const targetMember = clusterMembers.find(m => m.symbol.replace(/\.TW$/, "").replace(/\.TWO$/, "") === targetCode) 
                    || allMembers?.get(targetCode) 
                    || allMembers?.get(`${targetCode}.TW`);
  const targetReturns = targetMember?.returns || [];

  for (const m of pool) {
      const code = m.symbol.replace(/\.TW$/, "").replace(/\.TWO$/, "");
      if (code === targetCode) continue;

      let nameZh = await getCompanyNameZh(code).catch(() => code);
      nameZh = nameZh || code;

      const isTwin = code === twinCode;

      if (!targetReturns.length || !m.returns.length) {
          peersResult.push({
              code,
              nameZh,
              corr60: null,
              note: isTwin ? "關鍵對標 (Twin)" : "資料不足"
          });
          continue;
      }

      const corr60 = calcCorrelation(targetReturns, m.returns);
      
      let note = isTwin ? "關鍵對標 (Twin)" : "相關同業";
      if (!isTwin && Math.abs(corr60) < 0.25) {
          note = "連動不明顯";
      }

      peersResult.push({
          code,
          nameZh,
          corr60,
          note
      });
  }

  // Sort by correlation, but TWIN always goes first if correlation is positive or high
  peersResult.sort((a, b) => {
      const aIsTwin = a.code === twinCode ? 1 : 0;
      const bIsTwin = b.code === twinCode ? 1 : 0;
      if (aIsTwin !== bIsTwin) return bIsTwin - aIsTwin;

      if (a.corr60 === null && b.corr60 !== null) return 1;
      if (b.corr60 === null && a.corr60 !== null) return -1;
      if (a.corr60 === null || b.corr60 === null) return 0;
      return Math.abs(b.corr60) - Math.abs(a.corr60);
  });

  return {
    benchmark: benchmarkObj,
    peers: peersResult.slice(0, 5)
  };
}
