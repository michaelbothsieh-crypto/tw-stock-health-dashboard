export type NewsCategory =
    | 'EARNINGS'
    | 'GUIDANCE'
    | 'MACRO'
    | 'INDUSTRY'
    | 'GOV_REG'
    | 'MNA'
    | 'RISK'
    | 'OTHER';

const KEYWORDS: Record<NewsCategory, RegExp[]> = {
    EARNINGS: [/財報/i, /法說/i, /EPS/i, /季報/i, /年報/i, /損益/i, /毛利/i, /營收/i, /YoY/i, /MoM/i],
    GUIDANCE: [/展望/i, /指引/i, /上修/i, /下修/i, /guidance/i, /outlook/i, /forecast/i],
    RISK: [/裁罰/i, /調查/i, /訴訟/i, /違規/i, /資安/i, /停工/i, /火災/i, /缺料/i, /警示/i, /下修/i],
    MNA: [/併購/i, /收購/i, /合併/i, /投資/i, /入股/i, /M&A/i, /acquire/i],
    GOV_REG: [/政策/i, /法規/i, /制裁/i, /禁令/i, /特許/i],
    MACRO: [/央行/i, /升息/i, /降息/i, /通膨/i, /CPI/i, /匯率/i, /關稅/i],
    INDUSTRY: [/供應鏈/i, /產業/i, /競品/i, /同業/i, /市積率/i, /市佔/i],
    OTHER: []
};

// 分類優先順序 - 避免關鍵字重疊時誤判
const CATEGORY_PRIORITY: NewsCategory[] = [
    'EARNINGS',
    'GUIDANCE',
    'RISK',
    'MNA',
    'GOV_REG',
    'MACRO',
    'INDUSTRY'
];

export function classifyNews(title: string, summary: string = ''): NewsCategory {
    const text = (title + ' ' + summary).toLowerCase();

    for (const category of CATEGORY_PRIORITY) {
        const patterns = KEYWORDS[category];
        if (patterns.some(pattern => pattern.test(text))) {
            return category;
        }
    }

    return 'OTHER';
}
