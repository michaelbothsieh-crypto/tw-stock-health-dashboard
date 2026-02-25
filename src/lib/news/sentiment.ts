import { NewsCategory } from './classify';

export type SentimentImpact = 'BULLISH' | 'NEUTRAL' | 'BEARISH';

export interface SentimentResult {
    impact: SentimentImpact;
    score: number; // -100 to 100
}

const STRONG_BULLISH_WORDS = [/創新高/i, /大增/i, /上修/i, /優於預期/i, /獲利大幅/i, /接單爆量/i, /調高目標/i];
const STRONG_BEARISH_WORDS = [/下修/i, /不如預期/i, /衰退/i, /大減/i, /虧損擴大/i, /砍單/i, /違約/i, /停工/i];

export function analyzeSentiment(category: NewsCategory, title: string, summary: string = ''): SentimentResult {
    const text = (title + ' ' + summary).toLowerCase();

    let score = 0;

    // 1. 基要分類預設值 (RISK)
    if (category === 'RISK') {
        score -= 60;
    }

    // 2. 特殊分類的情緒強化 (EARNINGS / GUIDANCE)
    if (category === 'EARNINGS' || category === 'GUIDANCE') {
        if (/上修/i.test(text) || /優於預期/i.test(text)) {
            score += 60;
        }
        if (/下修/i.test(text) || /不如預期/i.test(text)) {
            score -= 60;
        }
    }

    // 3. 強烈字眼掃描 (累加)
    for (const p of STRONG_BULLISH_WORDS) {
        if (p.test(text)) score += 40;
    }

    for (const p of STRONG_BEARISH_WORDS) {
        if (p.test(text)) score -= 40;
    }

    // 確保分數在範圍內
    score = Math.max(-100, Math.min(100, score));

    // 判定 impact (設定門檻，過濾微小波動)
    let impact: SentimentImpact = 'NEUTRAL';
    if (score >= 25) {
        impact = 'BULLISH';
    } else if (score <= -25) {
        impact = 'BEARISH';
    }

    // 若分數為0但被分在 RISK，給定 BEARISH 防止漏網
    if (score === 0 && category === 'RISK') {
        impact = 'BEARISH';
        score = -20;
    }

    return {
        impact,
        score
    };
}
