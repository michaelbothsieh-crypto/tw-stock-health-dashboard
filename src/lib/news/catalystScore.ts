import { differenceInDays, parseISO } from 'date-fns';
import { TaiwanStockNews } from '../providers/finmind';
import { classifyNews, NewsCategory } from './classify';
import { analyzeSentiment, SentimentImpact } from './sentiment';

export interface ProcessedNews extends TaiwanStockNews {
    category: NewsCategory;
    impact: SentimentImpact;
    impactScore: number;
    decayWeight: number;
    weightedScore: number;
}

export interface CatalystEvaluation {
    catalystScore: number;
    topBullishNews: ProcessedNews[];
    topBearishNews: ProcessedNews[];
    timeline: ProcessedNews[];
}

export function calculateCatalystScore(
    newsItems: TaiwanStockNews[],
    targetDate: Date = new Date(),
    lookbackDays: number = 7
): CatalystEvaluation {
    if (!newsItems || newsItems.length === 0) {
        return {
            catalystScore: 0,
            topBullishNews: [],
            topBearishNews: [],
            timeline: []
        };
    }

    const processed: ProcessedNews[] = [];
    let rawScoreSum = 0;

    for (const item of newsItems) {
        // Parse the date (FinMind format is usually "YYYY-MM-DD HH:mm:ss")
        const publishedAt = new Date(item.date); // or parseISO depending on format
        const ageDays = differenceInDays(targetDate, publishedAt);

        // Filter out news beyond lookback period or in the future
        if (ageDays < 0 || ageDays > lookbackDays) {
            continue;
        }

        // Feature Engineering
        const category = classifyNews(item.title, '');
        const { impact, score: impactScore } = analyzeSentiment(category, item.title, '');

        // Decay calculation (ageDays/3 -> half-life of sorts)
        const decayWeight = Math.exp(-ageDays / 3);
        const weightedScore = impactScore * decayWeight;

        rawScoreSum += weightedScore;

        processed.push({
            ...item,
            category,
            impact,
            impactScore,
            decayWeight,
            weightedScore
        });
    }

    // Sort by most recent first for timeline
    processed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Timeline (top 10 recent)
    const timeline = processed.slice(0, 10);

    // Bullish (sort by impactScore descending)
    const bullishCandidates = processed.filter(n => n.impact === 'BULLISH')
        .sort((a, b) => b.impactScore - a.impactScore || new Date(b.date).getTime() - new Date(a.date).getTime());

    // Bearish (sort by impactScore ascending)
    const bearishCandidates = processed.filter(n => n.impact === 'BEARISH')
        .sort((a, b) => a.impactScore - b.impactScore || new Date(b.date).getTime() - new Date(a.date).getTime());

    // Normalization
    const catalystScore = Math.max(-100, Math.min(100, Math.round(rawScoreSum / 3)));

    return {
        catalystScore,
        topBullishNews: bullishCandidates.slice(0, 3),
        topBearishNews: bearishCandidates.slice(0, 3),
        timeline
    };
}
