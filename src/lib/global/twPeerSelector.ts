import { ClusterMember } from "./clusteringEngine";
import { calcCorrelation } from "./driverSelector";
import { getCompanyNameZh } from "../companyName";

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
  targetCode: string, // format like "2867"
  members: ClusterMember[],
  themeName: string | null
): Promise<TwPeerLinkage> {
  
  if (!members || members.length === 0) {
      return {
          benchmark: { kind: "台股族群基準", code: "Cluster", nameZh: "未知族群", returns: [] },
          peers: []
      };
  }

  // Calculate cluster benchmark index returns
  const numMembers = members.length;
  const numDays = members[0].returns.length; // usually 60
  const clusterReturns = new Array(numDays).fill(0);
  
  for (const m of members) {
      for (let i = 0; i < m.returns.length; i++) {
          clusterReturns[i] += m.returns[i] / numMembers;
      }
  }

  const benchmarkObj = {
    kind: "自建族群基準",
    code: `CLUSTER-${members[0].clusterId || 0}`,
    nameZh: `${themeName || "綜合"}族群指數`,
    returns: clusterReturns
  };

  const targetMember = members.find(m => m.symbol.replace(/\.TW$/, "") === targetCode);
  const targetReturns = targetMember?.returns || [];

  const peersResult = [];

  for (const m of members) {
      const code = m.symbol.replace(/\.TW$/, "").replace(/\.TWO$/, "");
      if (code === targetCode) continue;

      let nameZh = await getCompanyNameZh(code).catch(() => code);
      nameZh = nameZh || code;

      if (!targetReturns.length || !m.returns.length) {
          peersResult.push({
              code,
              nameZh,
              corr60: null,
              note: "資料不足"
          });
          continue;
      }

      const corr60 = calcCorrelation(targetReturns, m.returns);
      
      let note = "相關同業";
      if (Math.abs(corr60) < 0.25) {
          note = "連動不明顯"; // more strict filter
      }

      peersResult.push({
          code,
          nameZh,
          corr60,
          note
      });
  }

  // Sort by correlation
  peersResult.sort((a, b) => {
      if (a.corr60 === null && b.corr60 !== null) return 1;
      if (b.corr60 === null && a.corr60 !== null) return -1;
      if (a.corr60 === null || b.corr60 === null) return 0;
      return Math.abs(b.corr60) - Math.abs(a.corr60);
  });

  // Filter out low correlation and take top 5
  let filteredPeers = peersResult.filter(p => p.corr60 !== null && p.corr60 > 0.4);
  if (filteredPeers.length === 0) {
      // If extremely strict, fallback to top 5 positive correlation
      filteredPeers = peersResult.filter(p => p.corr60 !== null && p.corr60 > 0.15);
  }

  return {
    benchmark: benchmarkObj,
    peers: filteredPeers.slice(0, 5)
  };
}
