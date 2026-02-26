import { CLUSTER_STOCK_POOL } from "./stockPool";
import { fetchYahooFinanceBars, YahooBar } from "./yahooFinance";
import pLimit from "p-limit";

export interface ClusterMember {
  symbol: string;
  clusterId: number;
  returns: number[]; // 60-day returns
}

interface CacheData {
  timestamp: number;
  members: Map<string, ClusterMember>;
  k: number;
}

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
let globalClusterCache: CacheData | null = null;

// Normalizing array to Z-score: (x - mean) / std.
// In Z-score space, Euclidean distance squared = 2 * n * (1 - correlation)
function normalizeToZScore(arr: number[]): number[] {
  if (arr.length === 0) return [];
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  // If variance is 0 (flat line), just return 0s
  if (variance <= 1e-9) return arr.map(() => 0);
  const std = Math.sqrt(variance);
  return arr.map((x) => (x - mean) / std);
}

function calcReturns(prices: number[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    if (prev === 0) rets.push(0);
    else rets.push((prices[i] - prev) / prev);
  }
  return rets;
}

function euclideanDistanceSq(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return sum;
}

function runKMeans(
  dataPoints: { symbol: string; features: number[]; rawReturns: number[] }[],
  k: number,
  maxIters: number = 30
) {
  if (dataPoints.length === 0) return [];

  // Initialize centroids by randomly picking exactly k points
  let centroids: number[][] = [];
  const shuffled = [...dataPoints].sort(() => 0.5 - Math.random());
  for (let i = 0; i < Math.min(k, shuffled.length); i++) {
    centroids.push([...shuffled[i].features]);
  }

  const dimension = dataPoints[0].features.length;
  let assignments = new Array(dataPoints.length).fill(0);

  for (let iter = 0; iter < maxIters; iter++) {
    let changed = false;

    // Assignment Step
    for (let i = 0; i < dataPoints.length; i++) {
      const pt = dataPoints[i].features;
      let bestCluster = 0;
      let minDst = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dst = euclideanDistanceSq(pt, centroids[c]);
        if (dst < minDst) {
          minDst = dst;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    if (!changed) break;

    // Update Step
    const newCentroids = Array.from({ length: centroids.length }, () => new Array(dimension).fill(0));
    const counts = new Array(centroids.length).fill(0);

    for (let i = 0; i < dataPoints.length; i++) {
      const c = assignments[i];
      const pt = dataPoints[i].features;
      for (let d = 0; d < dimension; d++) {
        newCentroids[c][d] += pt[d];
      }
      counts[c]++;
    }

    for (let c = 0; c < centroids.length; c++) {
      if (counts[c] > 0) {
        for (let d = 0; d < dimension; d++) {
          newCentroids[c][d] /= counts[c];
        }
      } else {
        // If a cluster became empty, reinitialize it randomly
        const randPt = dataPoints[Math.floor(Math.random() * dataPoints.length)].features;
        centroids[c] = [...randPt];
      }
      centroids[c] = newCentroids[c]; // normalize back? (k-means on z-scores implies spherical, centroids don't strictly need to be z-scores, but keeping them raw means works)
    }
  }

  const result: ClusterMember[] = [];
  for (let i = 0; i < dataPoints.length; i++) {
    result.push({
      symbol: dataPoints[i].symbol,
      clusterId: assignments[i],
      returns: dataPoints[i].rawReturns,
    });
  }

  return result;
}

export async function getOrComputeClusters(
  targetSymbol: string,
  targetPrices: { date: string; close: number }[],
  k: number = 15
): Promise<{ members: Map<string, ClusterMember>; targetClusterId: number }> {
  
  // 1. Check cache validity
  if (
    globalClusterCache &&
    globalClusterCache.k === k &&
    Date.now() - globalClusterCache.timestamp < CACHE_TTL_MS
  ) {
    const cachedMembers = globalClusterCache.members;
    if (cachedMembers.has(targetSymbol)) {
      return {
        members: cachedMembers,
        targetClusterId: cachedMembers.get(targetSymbol)!.clusterId,
      };
    }
    // If target is NOT in our cached cluster, we must compute its isolated distance to existing centroids,
    // but in a more robust flow, we'll just include it in the returned map dynamically by measuring its correlation against members.
    // For simplicity, if not present, we will inject it below.
  }

  console.log(`[ClusteringEngine] Computing dynamic K-Means clusters (K=${k}) for ${targetSymbol}...`);

  // We want ~100 symbols + targetSymbol
  const activeSymbols = new Set(CLUSTER_STOCK_POOL);
  activeSymbols.add(targetSymbol);

  const limit = pLimit(15);
  const fetches = Array.from(activeSymbols).map((sym) =>
    limit(async () => {
      // Small optimization: If targetSymbol, we already have `targetPrices`. But they are not Yahoo format.
      // So let's re-fetch via yahooFinance helper locally or just format existing.
      let bars = await fetchYahooFinanceBars(sym.match(/^[a-zA-Z^]/) ? sym : `${sym}.TW`, 120);
      if (bars.length < 65) {
        // Fallback for TWO
        bars = await fetchYahooFinanceBars(`${sym}.TWO`, 120);
      }
      return { symbol: sym, bars };
    })
  );

  const rawData = await Promise.all(fetches);

  // Align dates using target as anchor dates (last 60)
  const twDates = targetPrices.slice(-61).map((p) => p.date);

  const dataPoints: { symbol: string; features: number[]; rawReturns: number[] }[] = [];

  for (const item of rawData) {
    if (item.bars.length < 60) continue;

    const map = new Map(item.bars.map((b) => [b.date, b.close]));
    const aligned: number[] = [];
    let lastVal = item.bars[0]?.close || 0;
    
    for (const d of twDates) {
      if (map.has(d)) lastVal = map.get(d)!;
      aligned.push(lastVal);
    }
    
    // We need 60 returns, so we aligned 61 dates.
    const rets = calcReturns(aligned).slice(-60);
    if (rets.length === 60) {
      dataPoints.push({
        symbol: item.symbol,
        rawReturns: rets,
        features: normalizeToZScore(rets),
      });
    }
  }

  // Ensure target Symbol is in dataPoints
  let targetExists = dataPoints.some(d => d.symbol === targetSymbol);
  if (!targetExists) {
     const tRet = calcReturns(targetPrices.map(p => p.close)).slice(-60);
     if (tRet.length === 60) {
        dataPoints.push({
            symbol: targetSymbol,
            rawReturns: tRet,
            features: normalizeToZScore(tRet)
        });
     }
  }

  // Run Clustering
  const clusteredArray = runKMeans(dataPoints, k);
  const memberMap = new Map<string, ClusterMember>();
  
  for (const c of clusteredArray) {
    memberMap.set(c.symbol, c);
  }

  // Cache the results
  globalClusterCache = {
    timestamp: Date.now(),
    members: memberMap,
    k,
  };

  const targetId = memberMap.get(targetSymbol)?.clusterId ?? -1;
  return { members: memberMap, targetClusterId: targetId };
}
