/**
 * RTP Simulation — validates that the tier system produces ~95% RTP
 * regardless of player strategy.
 *
 * Run: npx tsx src/simulation.ts
 */

import { RNG } from './core/RNG';
import { TIERS, TOTAL_WEIGHT, RTP_TARGET, displayMult, type TierDef } from './config/TierConfig';
import { MEME_CAPTIONS } from './config/MemeCaptions';

interface SimResult {
  strategy: string;
  totalCards: number;
  totalBet: number;
  totalPayout: number;
  rtp: number;
  winRate: number;
  tierBreakdown: Map<string, { count: number; wins: number; totalPayout: number }>;
}

type Strategy = 'always_watch' | 'always_skip' | 'random';

function pickTier(roll: number): TierDef {
  let cum = 0;
  for (const tier of TIERS) {
    cum += tier.weight;
    if (roll < cum) return tier;
  }
  return TIERS[TIERS.length - 1];
}

function simulate(strategy: Strategy, n: number, seed: number): SimResult {
  const rng = new RNG(seed);
  const stratRng = new RNG(seed + 999);

  let totalBet = 0;
  let totalPayout = 0;
  let wins = 0;
  const tierBreakdown = new Map<string, { count: number; wins: number; totalPayout: number }>();

  for (const tier of TIERS) {
    tierBreakdown.set(tier.id, { count: 0, wins: 0, totalPayout: 0 });
  }

  const bet = 100;

  for (let i = 0; i < n; i++) {
    const tierRoll = rng.next() * TOTAL_WEIGHT;
    const bombRoll = rng.next();
    const _captionRoll = rng.next();
    const _safeCardRoll = rng.next();

    const tier = pickTier(tierRoll);
    const isBomb = bombRoll < tier.bombProb;

    let choice: 'watch' | 'skip';
    if (strategy === 'always_watch') choice = 'watch';
    else if (strategy === 'always_skip') choice = 'skip';
    else choice = stratRng.next() < 0.5 ? 'watch' : 'skip';

    let won: boolean;
    let payoutMult: number;
    if (choice === 'watch') {
      won = !isBomb;
      payoutMult = won ? tier.watchMult : 0;
    } else {
      won = isBomb;
      payoutMult = won ? tier.skipMult : 0;
    }

    totalBet += bet;
    const payout = bet * payoutMult;
    totalPayout += payout;
    if (won) wins++;

    const tb = tierBreakdown.get(tier.id)!;
    tb.count++;
    if (won) tb.wins++;
    tb.totalPayout += payout;
  }

  return {
    strategy,
    totalCards: n,
    totalBet,
    totalPayout,
    rtp: totalPayout / totalBet,
    winRate: wins / n,
    tierBreakdown,
  };
}

function printResult(r: SimResult): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Strategy: ${r.strategy.toUpperCase()}`);
  console.log(`Cards: ${r.totalCards.toLocaleString()}`);
  console.log(`Total Bet: ${r.totalBet.toLocaleString()}`);
  console.log(`Total Payout: ${Math.round(r.totalPayout).toLocaleString()}`);
  console.log(`RTP: ${(r.rtp * 100).toFixed(4)}% (target: ${RTP_TARGET * 100}%)`);
  console.log(`Win Rate: ${(r.winRate * 100).toFixed(2)}%`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`${'Tier'.padEnd(8)} ${'Count'.padStart(8)} ${'Wins'.padStart(8)} ${'WinRate'.padStart(9)} ${'TierRTP'.padStart(10)}`);

  for (const tier of TIERS) {
    const tb = r.tierBreakdown.get(tier.id)!;
    if (tb.count === 0) continue;
    const tierWinRate = ((tb.wins / tb.count) * 100).toFixed(1);
    const tierBet = tb.count * 100;
    const tierRTP = ((tb.totalPayout / tierBet) * 100).toFixed(2);
    console.log(
      `${tier.id.padEnd(8)} ${tb.count.toString().padStart(8)} ${tb.wins.toString().padStart(8)} ${(tierWinRate + '%').padStart(9)} ${(tierRTP + '%').padStart(10)}`
    );
  }
}

// Print tier table
console.log('\n📊 TIER CONFIGURATION');
console.log('─'.repeat(80));
console.log(
  `${'ID'.padEnd(8)} ${'q(bomb)'.padStart(9)} ${'A(watch)'.padStart(10)} ${'B(skip)'.padStart(10)} ${'Weight'.padStart(8)} ${'Risk'.padStart(6)}`
);
for (const t of TIERS) {
  console.log(
    `${t.id.padEnd(8)} ${(t.bombProb * 100).toFixed(2).padStart(8)}% ${('x' + displayMult(t.watchMult)).padStart(10)} ${('x' + displayMult(t.skipMult)).padStart(10)} ${t.weight.toString().padStart(8)} ${'💀'.repeat(t.riskLabel).padStart(6)}`
  );
}

console.log(`\nTotal weight: ${TOTAL_WEIGHT.toFixed(1)}`);
console.log(`Meme captions loaded: ${MEME_CAPTIONS.length}`);

const N = 1_000_000;
const SEED = 42;

console.log(`\n🎰 SIMULATING ${N.toLocaleString()} CARDS...`);

const results = [
  simulate('always_watch', N, SEED),
  simulate('always_skip', N, SEED),
  simulate('random', N, SEED),
];

for (const r of results) {
  printResult(r);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📋 SUMMARY');
console.log('─'.repeat(60));
for (const r of results) {
  const rtpPct = (r.rtp * 100).toFixed(4);
  const delta = ((r.rtp - RTP_TARGET) * 100).toFixed(4);
  const pass = Math.abs(r.rtp - RTP_TARGET) < 0.02 ? '✅' : '❌';
  console.log(`${r.strategy.padEnd(15)} RTP=${rtpPct}%  Δ=${delta}%  ${pass}`);
}

console.log('\nExpected: all strategies ≈ 95.0000% (±2% tolerance for 1M sample)');
