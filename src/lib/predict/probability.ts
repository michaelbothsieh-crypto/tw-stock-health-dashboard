export interface PredictionComponent {
  key: string;
  label: string;
  value: number | string;
  weight: number;
  contribution: number;
}

export interface PredictionOutput {
  upProb1D: number;
  upProb3D: number;
  upProb5D: number;
  upProb1DRaw: number;
  upProb3DRaw: number;
  upProb5DRaw: number;
  bigMoveProb3D: number;
  breakdown: {
    components: PredictionComponent[];
    formula: string;
    notes: string[];
  };
  calibration: {
    a: number;
    b: number;
    sampleSize: number;
  };
}

export interface PredictionInput {
  trendScore: number | null;
  flowScore: number | null;
  fundamentalScore: number | null;
  catalystScore: number;
  volatilityScore: number;
  shortTermOpportunityScore: number;
  pullbackRiskScore: number;
  volumeSpike: number | null;
  gap: number | null;
  calibration?: {
    a: number;
    b: number;
    sampleSize?: number;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function normalizeScore(score: number | null): number {
  const safe = score ?? 50;
  return (safe - 50) / 50;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function calibrated(prob: number, a: number, b: number): number {
  return clamp(round1(a * prob + b), 0, 100);
}

export function computeRawProbabilities(input: PredictionInput): {
  upProb1D: number;
  upProb3D: number;
  upProb5D: number;
  bigMoveProb3D: number;
  logits: {
    logit1D: number;
    logit3D: number;
    logit5D: number;
    bigMoveLogit: number;
  };
  features: {
    xTrend: number;
    xFlow: number;
    xFund: number;
    xNews: number;
    xVol: number;
    xOpp: number;
    xRisk: number;
    volumeSpikeMapped: number;
    gapMapped: number;
  };
} {
  const xTrend = normalizeScore(input.trendScore);
  const xFlow = normalizeScore(input.flowScore);
  const xFund = input.fundamentalScore === null ? 0 : normalizeScore(input.fundamentalScore);
  const xNews = input.catalystScore / 100;
  const xVol = normalizeScore(input.volatilityScore);
  const xOpp = normalizeScore(input.shortTermOpportunityScore);
  const xRisk = normalizeScore(input.pullbackRiskScore);

  const logit1D =
    0.9 * xOpp + 0.6 * xTrend + 0.4 * xNews + 0.2 * xFlow - 0.7 * xRisk + 0.1 * xFund;
  const logit3D =
    0.8 * xOpp + 0.7 * xTrend + 0.5 * xNews + 0.3 * xFlow - 0.6 * xRisk + 0.2 * xFund;
  const logit5D =
    0.6 * xOpp + 0.8 * xTrend + 0.4 * xNews + 0.4 * xFlow - 0.5 * xRisk + 0.3 * xFund;

  const volumeSpikeMapped = clamp(((input.volumeSpike ?? 1) - 1) / 1.5, 0, 1);
  const gapMapped = clamp(Math.abs(input.gap ?? 0) / 0.05, 0, 1);

  const bigMoveLogit =
    1.1 * normalizeScore(input.volatilityScore) +
    0.6 * Math.abs(input.catalystScore) / 100 +
    0.4 * volumeSpikeMapped +
    0.2 * gapMapped;

  return {
    upProb1D: round1(sigmoid(logit1D) * 100),
    upProb3D: round1(sigmoid(logit3D) * 100),
    upProb5D: round1(sigmoid(logit5D) * 100),
    bigMoveProb3D: round1(sigmoid(bigMoveLogit) * 100),
    logits: { logit1D, logit3D, logit5D, bigMoveLogit },
    features: {
      xTrend,
      xFlow,
      xFund,
      xNews,
      xVol,
      xOpp,
      xRisk,
      volumeSpikeMapped,
      gapMapped,
    },
  };
}

export function predictProbabilities(input: PredictionInput): PredictionOutput {
  const raw = computeRawProbabilities(input);
  const a = input.calibration?.a ?? 1;
  const b = input.calibration?.b ?? 0;
  const sampleSize = input.calibration?.sampleSize ?? 0;

  const components: PredictionComponent[] = [
    {
      key: "xOpp",
      label: "短期機會特徵",
      value: Number(raw.features.xOpp.toFixed(4)),
      weight: 0.8,
      contribution: Number((0.8 * raw.features.xOpp).toFixed(4)),
    },
    {
      key: "xTrend",
      label: "趨勢特徵",
      value: Number(raw.features.xTrend.toFixed(4)),
      weight: 0.7,
      contribution: Number((0.7 * raw.features.xTrend).toFixed(4)),
    },
    {
      key: "xNews",
      label: "新聞催化特徵",
      value: Number(raw.features.xNews.toFixed(4)),
      weight: 0.5,
      contribution: Number((0.5 * raw.features.xNews).toFixed(4)),
    },
    {
      key: "xFlow",
      label: "資金流特徵",
      value: Number(raw.features.xFlow.toFixed(4)),
      weight: 0.3,
      contribution: Number((0.3 * raw.features.xFlow).toFixed(4)),
    },
    {
      key: "xRisk",
      label: "回檔風險特徵",
      value: Number(raw.features.xRisk.toFixed(4)),
      weight: -0.6,
      contribution: Number((-0.6 * raw.features.xRisk).toFixed(4)),
    },
    {
      key: "xFund",
      label: "基本面特徵",
      value: Number(raw.features.xFund.toFixed(4)),
      weight: 0.2,
      contribution: Number((0.2 * raw.features.xFund).toFixed(4)),
    },
  ];

  return {
    upProb1D: calibrated(raw.upProb1D, a, b),
    upProb3D: calibrated(raw.upProb3D, a, b),
    upProb5D: calibrated(raw.upProb5D, a, b),
    upProb1DRaw: raw.upProb1D,
    upProb3DRaw: raw.upProb3D,
    upProb5DRaw: raw.upProb5D,
    bigMoveProb3D: raw.bigMoveProb3D,
    breakdown: {
      components,
      formula:
        "logit3D = 0.8*xOpp + 0.7*xTrend + 0.5*xNews + 0.3*xFlow - 0.6*xRisk + 0.2*xFund，upProb = sigmoid(logit)*100",
      notes: [
        "短期視角會提高短期機會與趨勢特徵權重",
        "大波動機率以波動敏感度、新聞強度、量能與跳空估計",
        "機率為統計輸出，非投資建議",
      ],
    },
    calibration: { a, b, sampleSize },
  };
}
