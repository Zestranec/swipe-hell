import { RNG } from './RNG';
import { TIERS, TOTAL_WEIGHT, type TierDef } from '../config/TierConfig';
import { MEME_CAPTIONS } from '../config/MemeCaptions';
import { SAFE_CARDS_CONFIG, type SafeCardConfig } from '../config/SafeCardsConfig';

/**
 * Single source of truth for one card.
 * All multipliers are copied from the tier at creation time so nothing is
 * ever re-derived later — the card back UI, payout logic, and result popup
 * all read from the same fields.
 */
export interface CardModel {
  tier: TierDef;
  isBomb: boolean;
  captionIndex: number;
  caption: string;

  /** Gross payout multiplier if player chooses WATCH and card is SAFE. */
  watchMult: number;
  /** Gross payout multiplier if player chooses SKIP and card is BOMB. */
  skipMult: number;
  /** max(watchMult, skipMult) — shown as "UP TO x…" on the card back. */
  upToMult: number;

  /** Assigned safe-card content (used on reveal when card is SAFE). */
  safeCard: SafeCardConfig;
}

export type PlayerChoice = 'watch' | 'skip';

export interface CardResult {
  card: CardModel;
  choice: PlayerChoice;
  won: boolean;
  /**
   * Gross payout multiplier actually applied (0 on loss).
   * On WIN this equals card.watchMult (WATCH+SAFE) or card.skipMult (SKIP+BOMB).
   */
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
    const tierRoll    = this.rng.next() * TOTAL_WEIGHT;
    const bombRoll    = this.rng.next();
    const captionRoll = this.rng.next();
    const safeCardRoll = this.rng.next();

    const tier         = pickTier(tierRoll);
    const isBomb       = bombRoll < tier.bombProb;
    const captionIndex = Math.floor(captionRoll * MEME_CAPTIONS.length);
    const safeCardIndex = Math.floor(safeCardRoll * SAFE_CARDS_CONFIG.length);

    // Copy multipliers onto the card — these must NEVER be re-derived elsewhere.
    const watchMult = tier.watchMult;
    const skipMult  = tier.skipMult;

    this.cardIndex++;

    return {
      tier,
      isBomb,
      captionIndex,
      caption: MEME_CAPTIONS[captionIndex],
      watchMult,
      skipMult,
      upToMult: Math.max(watchMult, skipMult),
      safeCard: SAFE_CARDS_CONFIG[safeCardIndex],
    };
  }

  /**
   * Resolve a card given the player's choice.
   * Pure computation — no RNG consumed.
   * Reads multipliers exclusively from the stored CardModel fields.
   */
  resolve(card: CardModel, choice: PlayerChoice): CardResult {
    let won: boolean;
    let payoutMult: number;

    if (choice === 'watch') {
      // WATCH wins when card is SAFE
      won        = !card.isBomb;
      payoutMult = won ? card.watchMult : 0;
    } else {
      // SKIP wins when card is BOMB
      won        = card.isBomb;
      payoutMult = won ? card.skipMult : 0;
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
