import { NewsCategory } from './classify';

export type SentimentImpact = 'BULLISH' | 'NEUTRAL' | 'BEARISH';

export interface SentimentResult {
    impact: SentimentImpact;
    score: number; // -100 to 100
}

const STRONG_BULLISH_WORDS = [/創新高/i, /大增/i, /上修/i, /優於預期/i, /大單/i, /接單/i, /調高目標/i, /突破/i];
const STRONG_BEARISH_WORDS = [/下修/i, /不如預期/i, /衰退/i, /大減/i, /虧損/i, /砍單/i, /違約/i, /停工/i, /裁罰/i];

export function analyzeSentiment(category: NewsCategory, title: string, summary: string = ''): SentimentResult {
    const text = (title + ' ' + summary).toLowerCase();

    let score = 0;

    // 1. RISK 預設 -60
    if (category === 'RISK') {
        score = -60;
    }

    // 2. EARNINGS / GUIDANCE 的精準評分 (+60 / -60)
    if (category === 'EARNINGS' || category === 'GUIDANCE') {
        if (/上修/i.test(text) || /優於預期/i.test(text)) {
            score += 60;
        } else if (/下修/i.test(text) || /不如預期/i.test(text)) {
            score -= 60;
        }
    }

    // 3. 強烈字眼掃描 (累加 +40 / -40)
    for (const p of STRONG_BULLISH_WORDS) {
        if (p.test(text)) score += 40;
    }

    for (const p of STRONG_BEARISH_WORDS) {
        if (p.test(text)) score -= 40;
    }

    // 確保分數不超出範圍
    score = Math.max(-100, Math.min(100, score));

    // 判定 impact 標籤
    let impact: SentimentImpact = 'NEUTRAL';
    if (score > 0) {
        impact = 'BULLISH';
    } else if (score < 0) {
        impact = 'BEARISH';
    }

    return {
        impact,
        score
    };
}
