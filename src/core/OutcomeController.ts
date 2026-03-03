import { RNG } from './RNG';
import { TIERS, TOTAL_WEIGHT, type TierDef } from '../config/TierConfig';
import { MEME_CAPTIONS } from '../config/MemeCaptions';
import { SAFE_CARDS_CONFIG, type SafeCardConfig } from '../config/SafeCardsConfig';

export interface CardModel {
  tier: TierDef;
  isBomb: boolean;
  captionIndex: number;
  caption: string;
  /** Max potential multiplier shown on card back = max(watchMult, skipMult) */
  potentialMult: number;
  /** Assigned safe card content (used on reveal if card is SAFE). */
  safeCard: SafeCardConfig;
}

export type PlayerChoice = 'watch' | 'skip';

export interface CardResult {
  card: CardModel;
  choice: PlayerChoice;
  won: boolean;
  /** Gross payout multiplier (0 on loss). */
  payoutMult: number;
}

export class OutcomeController {
  private rng: RNG;
  private cardIndex = 0;

  constructor(seed: number) {
    this.rng = new RNG(seed);
  }

  /** Pre-roll the next card. Consumes exactly 4 RNG calls. */
  nextCard(): CardModel {
    const tierRoll = this.rng.next() * TOTAL_WEIGHT;
    const bombRoll = this.rng.next();
    const captionRoll = this.rng.next();
    const safeCardRoll = this.rng.next();

    const tier = pickTier(tierRoll);
    const isBomb = bombRoll < tier.bombProb;
    const captionIndex = Math.floor(captionRoll * MEME_CAPTIONS.length);
    const safeCardIndex = Math.floor(safeCardRoll * SAFE_CARDS_CONFIG.length);

    this.cardIndex++;

    return {
      tier,
      isBomb,
      captionIndex,
      caption: MEME_CAPTIONS[captionIndex],
      potentialMult: Math.max(tier.watchMult, tier.skipMult),
      safeCard: SAFE_CARDS_CONFIG[safeCardIndex],
    };
  }

  /** Resolve a card given the player's choice. Pure computation, no RNG consumed. */
  resolve(card: CardModel, choice: PlayerChoice): CardResult {
    let won: boolean;
    let payoutMult: number;

    if (choice === 'watch') {
      won = !card.isBomb;
      payoutMult = won ? card.tier.watchMult : 0;
    } else {
      won = card.isBomb;
      payoutMult = won ? card.tier.skipMult : 0;
    }

    return { card, choice, won, payoutMult };
  }

  getCardIndex(): number {
    return this.cardIndex;
  }
}

function pickTier(roll: number): TierDef {
  let cumulative = 0;
  for (const tier of TIERS) {
    cumulative += tier.weight;
    if (roll < cumulative) return tier;
  }
  return TIERS[TIERS.length - 1];
}
