export const RTP_TARGET = 0.95;
export const MAX_MULTIPLIER = 500;

export interface TierDef {
  id: string;
  bombProb: number;
  watchMult: number;
  skipMult: number;
  weight: number;
  riskLabel: number; // 1–5 skulls
}

function computeMultipliers(q: number): { watchMult: number; skipMult: number } {
  const A = Math.min(RTP_TARGET / (1 - q), MAX_MULTIPLIER);
  const B = Math.min(RTP_TARGET / q, MAX_MULTIPLIER);
  return { watchMult: A, skipMult: B };
}

function riskFromBombProb(q: number): number {
  if (q <= 0.02) return 1;
  if (q <= 0.10) return 2;
  if (q <= 0.30) return 3;
  if (q <= 0.60) return 4;
  return 5;
}

interface TierInput {
  id: string;
  q: number;
  weight: number;
}

const TIER_INPUTS: TierInput[] = [
  { id: 'T1',    q: 0.005,  weight: 2 },
  { id: 'T2',    q: 0.01,   weight: 3 },
  { id: 'T3',    q: 0.02,   weight: 5 },
  { id: 'T4',    q: 0.05,   weight: 8 },
  { id: 'T5',    q: 0.10,   weight: 12 },
  { id: 'T6',    q: 0.20,   weight: 15 },
  { id: 'T7',    q: 0.30,   weight: 15 },
  { id: 'T8',    q: 0.40,   weight: 12 },
  { id: 'T9',    q: 0.50,   weight: 12 },
  { id: 'T10',   q: 0.60,   weight: 8 },
  { id: 'T11',   q: 0.70,   weight: 5 },
  { id: 'T12',   q: 0.80,   weight: 3 },
  { id: 'ULTRA', q: 0.0019, weight: 0.3 },
];

export const TIERS: TierDef[] = TIER_INPUTS.map(({ id, q, weight }) => {
  const { watchMult, skipMult } = computeMultipliers(q);
  return {
    id,
    bombProb: q,
    watchMult,
    skipMult,
    weight,
    riskLabel: riskFromBombProb(q),
  };
});

export const TOTAL_WEIGHT = TIERS.reduce((s, t) => s + t.weight, 0);

export function displayMult(m: number): string {
  return m.toFixed(2);
}
