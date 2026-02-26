import { differenceInDays } from "date-fns";
import { TaiwanStockNews } from "../providers/finmind";
import { classifyNews, NewsCategory } from "./classify";
import { SentimentImpact } from "./sentiment";

const POSITIVE_KEYWORDS = ["上修", "創新高", "大增", "接單", "利多", "突破", "獲利", "成長"];
const NEGATIVE_KEYWORDS = ["下修", "衰退", "虧損", "違約", "裁罰", "風險", "警示"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function toImpact(score: number): SentimentImpact {
  if (score > 0) return "BULLISH";
  if (score < 0) return "BEARISH";
  return "NEUTRAL";
}

export interface ProcessedNews extends TaiwanStockNews {
  category: NewsCategory;
  impact: SentimentImpact;
  impactScore: number;
  decayWeight: number;
  weightedScore: number;
}

export interface CatalystEvaluation {
  catalystScore: number;
  bullishCount: number;
  bearishCount: number;
  topBullishNews: ProcessedNews[];
  topBearishNews: ProcessedNews[];
  timeline: ProcessedNews[];
}

export function calculateCatalystScore(
  newsItems: TaiwanStockNews[],
  targetDate: Date = new Date(),
  lookbackDays: number = 7,
): CatalystEvaluation {
  if (!newsItems || newsItems.length === 0) {
    return {
      catalystScore: 0,
      bullishCount: 0,
      bearishCount: 0,
      topBullishNews: [],
      topBearishNews: [],
      timeline: [],
    };
  }

  const processed: ProcessedNews[] = [];
  let raw = 0;

  for (const item of newsItems) {
    const publishedAt = new Date(item.date);
    if (Number.isNaN(publishedAt.getTime())) continue;

    const ageDays = differenceInDays(targetDate, publishedAt);
    if (ageDays < 0 || ageDays > lookbackDays) {
      continue;
    }

    const title = String(item.title ?? "");
    const category = classifyNews(title, "");
    const normalizedCategory = String((item as { category?: string }).category ?? category);

    let impactScore = 0;
    if (includesAny(title, POSITIVE_KEYWORDS)) impactScore += 50;
    if (includesAny(title, NEGATIVE_KEYWORDS)) impactScore -= 50;
    if (normalizedCategory === "EARNINGS" && title.includes("優於預期")) impactScore += 70;
    if (title.includes("不如預期")) impactScore -= 70;
    impactScore = clamp(impactScore, -100, 100);

    const decayWeight = Math.exp(-ageDays / 4);
    const weightedScore = impactScore * decayWeight;
    raw += weightedScore;

    processed.push({
      ...item,
      category,
      impact: toImpact(impactScore),
      impactScore,
      decayWeight,
      weightedScore,
    });
  }

  processed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const bullishCandidates = processed
    .filter((n) => n.impact === "BULLISH")
    .sort((a, b) => b.weightedScore - a.weightedScore || new Date(b.date).getTime() - new Date(a.date).getTime());
  const bearishCandidates = processed
    .filter((n) => n.impact === "BEARISH")
    .sort((a, b) => a.weightedScore - b.weightedScore || new Date(b.date).getTime() - new Date(a.date).getTime());

  const neutralOnly = processed.length > 0 && processed.every((item) => item.impactScore === 0);
  const catalystScore = neutralOnly ? clamp(processed.length * 5, -20, 20) : clamp(Math.round(raw / 2), -100, 100);

  return {
    catalystScore,
    bullishCount: bullishCandidates.length,
    bearishCount: bearishCandidates.length,
    topBullishNews: bullishCandidates.slice(0, 3),
    topBearishNews: bearishCandidates.slice(0, 3),
    timeline: processed.slice(0, 10),
  };
}
