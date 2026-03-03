import * as PIXI from 'pixi.js';
import type { CardModel } from '../core/OutcomeController';
import type { CardResult } from '../core/OutcomeController';
import { displayMult } from '../config/TierConfig';
import { getSafeCardIcon } from '../config/SafeCardsConfig';

// ─── Base card dimensions (logical units) ─────────────────────────────────────
// All drawing code uses these constants. The cardContainer is uniformly scaled
// so the card fills the available stage area without changing any position math.
const BASE_W = 340;
const BASE_H = 480;
const CARD_RADIUS = 24;
const FLIP_DURATION_MS = 450;

const COLORS = {
  cardBack: 0x1a1a2e,
  cardBackBorder: 0x3a3a5e,
  cardFrontSafe: 0x0d2b0d,
  cardFrontBomb: 0x2b0d0d,
  safeGreen: 0x00ff88,
  bombRed: 0xff3355,
  gold: 0xffd700,
  white: 0xffffff,
  dimWhite: 0xaaaacc,
};

function skullString(count: number): string {
  return '💀'.repeat(count) + '🤍'.repeat(5 - count);
}

/**
 * Compute a uniform scale so the card (BASE_W × BASE_H) fills the available
 * stage area with an 88% margin, capped at 1.5× to prevent giant cards on tablets.
 */
function computeCardScale(stageW: number, stageH: number): number {
  const MARGIN = 0.88;
  const MAX_SCALE = 1.5;
  const sx = (stageW * MARGIN) / BASE_W;
  const sy = (stageH * MARGIN) / BASE_H;
  return Math.min(sx, sy, MAX_SCALE);
}

export class CardRenderer {
  readonly container: PIXI.Container;

  // cardContainer holds position + base scale.
  // flipContainer is the child that gets its scaleX animated during the flip.
  private cardContainer: PIXI.Container;
  private flipContainer: PIXI.Container;
  private backFace: PIXI.Container;
  private frontFace: PIXI.Container;

  private isFlipping = false;

  constructor(stageW: number, stageH: number) {
    this.container = new PIXI.Container();
    this.cardContainer = new PIXI.Container();
    this.flipContainer = new PIXI.Container();
    this.backFace = new PIXI.Container();
    this.frontFace = new PIXI.Container();

    this.frontFace.visible = false;

    this.flipContainer.addChild(this.backFace);
    this.flipContainer.addChild(this.frontFace);
    this.cardContainer.addChild(this.flipContainer);
    this.container.addChild(this.cardContainer);

    // Position the card in the centre of the stage and scale it to fit.
    const scale = computeCardScale(stageW, stageH);
    this.cardContainer.scale.set(scale, scale);
    this.cardContainer.x = stageW / 2;
    this.cardContainer.y = stageH / 2;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  get flipping(): boolean {
    return this.isFlipping;
  }

  showCardBack(card: CardModel): void {
    this.isFlipping = false;
    this.backFace.removeChildren();
    this.frontFace.removeChildren();
    this.frontFace.visible = false;
    this.backFace.visible = true;
    this.flipContainer.scale.x = 1;
    this.cardContainer.alpha = 1;

    this.buildBackFace(card);
  }

  /** Flip animation + reveal. Returns a promise that resolves when the flip is done. */
  async flipAndReveal(result: CardResult): Promise<void> {
    this.isFlipping = true;
    this.buildFrontFace(result);

    // Phase 1: collapse card to edge
    await this.animateFlipX(1, 0, FLIP_DURATION_MS / 2);

    this.backFace.visible = false;
    this.frontFace.visible = true;

    // Phase 2: expand from edge to full
    await this.animateFlipX(0, 1, FLIP_DURATION_MS / 2);

    this.isFlipping = false;
  }

  // ─── Card back ──────────────────────────────────────────────────────────────

  private buildBackFace(card: CardModel): void {
    // ── Card background ────────────────────────────────────────────────────
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.cardBack);
    bg.drawRoundedRect(-BASE_W / 2, -BASE_H / 2, BASE_W, BASE_H, CARD_RADIUS);
    bg.endFill();
    bg.lineStyle(2, COLORS.cardBackBorder);
    bg.drawRoundedRect(-BASE_W / 2, -BASE_H / 2, BASE_W, BASE_H, CARD_RADIUS);
    this.backFace.addChild(bg);

    // ── Mystery "?" glyph ─────────────────────────────────────────────────
    const qMark = new PIXI.Text('?', {
      fontSize: 72,
      fontWeight: 'bold',
      fill: COLORS.dimWhite,
      fontFamily: 'monospace',
    });
    qMark.anchor.set(0.5);
    qMark.y = -BASE_H / 2 + 72;
    this.backFace.addChild(qMark);

    // ── "UP TO x{upToMult}" — uses the pre-stored card field ──────────────
    // This is max(watchMult, skipMult) and is the maximum the player can win.
    const upToLabel = new PIXI.Text(`UP TO x${displayMult(card.upToMult)}`, {
      fontSize: 26,
      fontWeight: 'bold',
      fill: COLORS.gold,
      fontFamily: 'monospace',
    });
    upToLabel.anchor.set(0.5);
    upToLabel.y = -BASE_H / 2 + 130;
    this.backFace.addChild(upToLabel);

    // ── Clarifier: explains "UP TO" so the number isn't misleading ─────────
    const clarifier = new PIXI.Text('Max payout if you pick the right button.', {
      fontSize: 11,
      fill: COLORS.dimWhite,
      fontFamily: 'monospace',
      wordWrap: true,
      wordWrapWidth: BASE_W - 50,
      align: 'center',
    });
    clarifier.anchor.set(0.5, 0);
    clarifier.y = -BASE_H / 2 + 152;
    this.backFace.addChild(clarifier);

    // ── Risk meter (skulls) ───────────────────────────────────────────────
    const skulls = new PIXI.Text(skullString(card.tier.riskLabel), {
      fontSize: 22,
      fill: COLORS.white,
    });
    skulls.anchor.set(0.5);
    skulls.y = -BASE_H / 2 + 184;
    this.backFace.addChild(skulls);

    // ── Tier label ────────────────────────────────────────────────────────
    const riskText = new PIXI.Text(`RISK: ${card.tier.id}`, {
      fontSize: 13,
      fill: COLORS.dimWhite,
      fontFamily: 'monospace',
    });
    riskText.anchor.set(0.5);
    riskText.y = -BASE_H / 2 + 210;
    this.backFace.addChild(riskText);

    // ── Per-choice multiplier hints ───────────────────────────────────────
    // Shows the actual multiplier for each button so the player knows what
    // they'd win with each choice — no ambiguity between watchMult / skipMult.
    const watchHint = new PIXI.Text(`\u{1F441} x${displayMult(card.watchMult)}`, {
      fontSize: 13,
      fill: 0x44ee88,  // soft green matching WATCH button
      fontFamily: 'monospace',
      fontWeight: 'bold',
    });
    watchHint.anchor.set(1, 0.5);  // right-align
    watchHint.x = -8;
    watchHint.y = -BASE_H / 2 + 232;
    this.backFace.addChild(watchHint);

    const divider = new PIXI.Text('|', {
      fontSize: 13,
      fill: COLORS.dimWhite,
      fontFamily: 'monospace',
    });
    divider.anchor.set(0.5, 0.5);
    divider.x = 0;
    divider.y = -BASE_H / 2 + 232;
    this.backFace.addChild(divider);

    const skipHint = new PIXI.Text(`\u{1F6AB} x${displayMult(card.skipMult)}`, {
      fontSize: 13,
      fill: 0xff6688,  // soft red matching SKIP button
      fontFamily: 'monospace',
      fontWeight: 'bold',
    });
    skipHint.anchor.set(0, 0.5);  // left-align
    skipHint.x = 8;
    skipHint.y = -BASE_H / 2 + 232;
    this.backFace.addChild(skipHint);

    // ── Meme caption ──────────────────────────────────────────────────────
    const caption = new PIXI.Text(`"${card.caption}"`, {
      fontSize: 16,
      fill: COLORS.white,
      fontFamily: 'serif',
      fontStyle: 'italic',
      wordWrap: true,
      wordWrapWidth: BASE_W - 40,
      align: 'center',
    });
    caption.anchor.set(0.5);
    caption.y = 30;
    this.backFace.addChild(caption);
  }

  // ─── Card front ─────────────────────────────────────────────────────────────

  private buildFrontFace(result: CardResult): void {
    this.frontFace.removeChildren();

    const isBomb = result.card.isBomb;

    const bg = new PIXI.Graphics();
    bg.beginFill(isBomb ? COLORS.cardFrontBomb : COLORS.cardFrontSafe);
    bg.drawRoundedRect(-BASE_W / 2, -BASE_H / 2, BASE_W, BASE_H, CARD_RADIUS);
    bg.endFill();
    bg.lineStyle(3, isBomb ? COLORS.bombRed : COLORS.safeGreen);
    bg.drawRoundedRect(-BASE_W / 2, -BASE_H / 2, BASE_W, BASE_H, CARD_RADIUS);
    this.frontFace.addChild(bg);

    if (isBomb) {
      this.buildBombFront(result);
    } else {
      this.buildSafeFront(result);
    }
  }

  private buildBombFront(result: CardResult): void {
    const icon = new PIXI.Text('💣', { fontSize: 80 });
    icon.anchor.set(0.5);
    icon.y = -60;
    this.frontFace.addChild(icon);

    const label = new PIXI.Text('BOMB', {
      fontSize: 40,
      fontWeight: 'bold',
      fill: COLORS.bombRed,
      fontFamily: 'monospace',
    });
    label.anchor.set(0.5);
    label.y = 20;
    this.frontFace.addChild(label);

    const resultLabel = new PIXI.Text(result.won ? 'WIN' : 'LOSE', {
      fontSize: 36,
      fontWeight: 'bold',
      fill: result.won ? COLORS.gold : COLORS.bombRed,
      fontFamily: 'monospace',
    });
    resultLabel.anchor.set(0.5);
    resultLabel.y = 80;
    this.frontFace.addChild(resultLabel);

    if (result.won) {
      const multLabel = new PIXI.Text(`x${displayMult(result.payoutMult)}`, {
        fontSize: 28,
        fill: COLORS.gold,
        fontFamily: 'monospace',
      });
      multLabel.anchor.set(0.5);
      multLabel.y = 130;
      this.frontFace.addChild(multLabel);
    }
  }

  private buildSafeFront(result: CardResult): void {
    const safeCard = result.card.safeCard;
    const safeIcon = getSafeCardIcon(safeCard);

    const icon = new PIXI.Text(safeIcon, { fontSize: 64 });
    icon.anchor.set(0.5);
    icon.y = -BASE_H / 2 + 75;
    this.frontFace.addChild(icon);

    const safeLabel = new PIXI.Text('SAFE', {
      fontSize: 18,
      fontWeight: 'bold',
      fill: COLORS.safeGreen,
      fontFamily: 'monospace',
      letterSpacing: 4,
    });
    safeLabel.anchor.set(0.5);
    safeLabel.y = -BASE_H / 2 + 120;
    this.frontFace.addChild(safeLabel);

    const titleText = new PIXI.Text(safeCard.title, {
      fontSize: 22,
      fontWeight: 'bold',
      fill: COLORS.white,
      fontFamily: 'monospace',
      wordWrap: true,
      wordWrapWidth: BASE_W - 40,
      align: 'center',
    });
    titleText.anchor.set(0.5);
    titleText.y = -15;
    this.frontFace.addChild(titleText);

    const subtitleText = new PIXI.Text(safeCard.subtitle, {
      fontSize: 14,
      fill: COLORS.dimWhite,
      fontFamily: 'serif',
      fontStyle: 'italic',
      wordWrap: true,
      wordWrapWidth: BASE_W - 40,
      align: 'center',
    });
    subtitleText.anchor.set(0.5);
    subtitleText.y = 25;
    this.frontFace.addChild(subtitleText);

    const resultLabel = new PIXI.Text(result.won ? 'WIN' : 'LOSE', {
      fontSize: 36,
      fontWeight: 'bold',
      fill: result.won ? COLORS.gold : COLORS.bombRed,
      fontFamily: 'monospace',
    });
    resultLabel.anchor.set(0.5);
    resultLabel.y = 90;
    this.frontFace.addChild(resultLabel);

    if (result.won) {
      const multLabel = new PIXI.Text(`x${displayMult(result.payoutMult)}`, {
        fontSize: 28,
        fill: COLORS.gold,
        fontFamily: 'monospace',
      });
      multLabel.anchor.set(0.5);
      multLabel.y = 140;
      this.frontFace.addChild(multLabel);
    }
  }

  // ─── Animation ──────────────────────────────────────────────────────────────

  /** Animate flipContainer.scale.x from `from` to `to` over `duration` ms. */
  private animateFlipX(from: number, to: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        const elapsed = performance.now() - start;
        const t = Math.min(elapsed / duration, 1);
        // Ease in-out quad
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this.flipContainer.scale.x = from + (to - from) * eased;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          this.flipContainer.scale.x = to;
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }
}
