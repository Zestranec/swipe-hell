import * as PIXI from 'pixi.js';
import type { CardModel } from '../core/OutcomeController';
import type { CardResult } from '../core/OutcomeController';
import { displayMult } from '../config/TierConfig';
import { getSafeCardIcon } from '../config/SafeCardsConfig';

const CARD_W = 340;
const CARD_H = 480;
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
  watchBtn: 0x00cc66,
  skipBtn: 0xff4466,
  btnHover: 0xffffff,
  overlay: 0x000000,
  winBg: 0x003300,
  loseBg: 0x330000,
};

function skullString(count: number): string {
  return '💀'.repeat(count) + '🤍'.repeat(5 - count);
}

export class CardRenderer {
  readonly container: PIXI.Container;
  private cardContainer: PIXI.Container;
  private backFace: PIXI.Container;
  private frontFace: PIXI.Container;
  private resultOverlay: PIXI.Container;

  private watchBtn!: PIXI.Container;
  private skipBtn!: PIXI.Container;

  private onWatch: (() => void) | null = null;
  private onSkip: (() => void) | null = null;
  private onNext: (() => void) | null = null;
  private inputLocked = false;
  private isFlipping = false;

  private stageW: number;
  private stageH: number;

  constructor(stageW: number, stageH: number) {
    this.stageW = stageW;
    this.stageH = stageH;
    this.container = new PIXI.Container();
    this.cardContainer = new PIXI.Container();
    this.backFace = new PIXI.Container();
    this.frontFace = new PIXI.Container();
    this.resultOverlay = new PIXI.Container();

    this.frontFace.visible = false;
    this.resultOverlay.visible = false;

    this.cardContainer.addChild(this.backFace);
    this.cardContainer.addChild(this.frontFace);
    this.container.addChild(this.cardContainer);
    this.container.addChild(this.resultOverlay);

    this.cardContainer.x = stageW / 2;
    this.cardContainer.y = stageH / 2 - 30;
  }

  setCallbacks(onWatch: () => void, onSkip: () => void, onNext: () => void): void {
    this.onWatch = onWatch;
    this.onSkip = onSkip;
    this.onNext = onNext;
  }

  showCardBack(card: CardModel): void {
    this.inputLocked = false;
    this.isFlipping = false;
    this.backFace.removeChildren();
    this.frontFace.removeChildren();
    this.frontFace.visible = false;
    this.backFace.visible = true;
    this.resultOverlay.visible = false;
    this.cardContainer.scale.x = 1;
    this.cardContainer.alpha = 1;

    // Card background
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.cardBack);
    bg.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, CARD_RADIUS);
    bg.endFill();
    bg.lineStyle(2, COLORS.cardBackBorder);
    bg.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, CARD_RADIUS);
    this.backFace.addChild(bg);

    // "?" icon
    const questionMark = new PIXI.Text('?', {
      fontSize: 72,
      fontWeight: 'bold',
      fill: COLORS.dimWhite,
      fontFamily: 'monospace',
    });
    questionMark.anchor.set(0.5);
    questionMark.y = -CARD_H / 2 + 75;
    this.backFace.addChild(questionMark);

    // Potential label
    const maxMult = Math.max(card.tier.watchMult, card.tier.skipMult);
    const potLabel = new PIXI.Text(`WIN x${displayMult(maxMult)}`, {
      fontSize: 28,
      fontWeight: 'bold',
      fill: COLORS.gold,
      fontFamily: 'monospace',
    });
    potLabel.anchor.set(0.5);
    potLabel.y = -CARD_H / 2 + 135;
    this.backFace.addChild(potLabel);

    // Risk meter (skulls)
    const skulls = new PIXI.Text(skullString(card.tier.riskLabel), {
      fontSize: 22,
      fill: COLORS.white,
    });
    skulls.anchor.set(0.5);
    skulls.y = -CARD_H / 2 + 175;
    this.backFace.addChild(skulls);

    // Risk label text
    const riskText = new PIXI.Text(`RISK: ${card.tier.id}`, {
      fontSize: 14,
      fill: COLORS.dimWhite,
      fontFamily: 'monospace',
    });
    riskText.anchor.set(0.5);
    riskText.y = -CARD_H / 2 + 205;
    this.backFace.addChild(riskText);

    // Meme caption
    const caption = new PIXI.Text(`"${card.caption}"`, {
      fontSize: 16,
      fill: COLORS.white,
      fontFamily: 'serif',
      fontStyle: 'italic',
      wordWrap: true,
      wordWrapWidth: CARD_W - 40,
      align: 'center',
    });
    caption.anchor.set(0.5);
    caption.y = 10;
    this.backFace.addChild(caption);

    // Buttons
    this.watchBtn = this.createButton('👁 WATCH', COLORS.watchBtn, -80);
    this.skipBtn = this.createButton('🚫 SKIP', COLORS.skipBtn, 80);

    this.watchBtn.y = CARD_H / 2 - 55;
    this.skipBtn.y = CARD_H / 2 - 55;

    this.watchBtn.eventMode = 'static';
    this.watchBtn.cursor = 'pointer';
    this.watchBtn.on('pointertap', () => {
      if (!this.inputLocked && !this.isFlipping) {
        this.inputLocked = true;
        this.onWatch?.();
      }
    });

    this.skipBtn.eventMode = 'static';
    this.skipBtn.cursor = 'pointer';
    this.skipBtn.on('pointertap', () => {
      if (!this.inputLocked && !this.isFlipping) {
        this.inputLocked = true;
        this.onSkip?.();
      }
    });

    this.backFace.addChild(this.watchBtn);
    this.backFace.addChild(this.skipBtn);
  }

  private createButton(label: string, color: number, xOff: number): PIXI.Container {
    const btn = new PIXI.Container();
    const w = 140;
    const h = 48;

    const bg = new PIXI.Graphics();
    bg.beginFill(color, 0.9);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, 14);
    bg.endFill();
    btn.addChild(bg);

    const txt = new PIXI.Text(label, {
      fontSize: 18,
      fontWeight: 'bold',
      fill: COLORS.white,
      fontFamily: 'monospace',
    });
    txt.anchor.set(0.5);
    btn.addChild(txt);

    btn.x = xOff;
    return btn;
  }

  /** Play flip animation and reveal card front. Returns a promise that resolves when flip is done. */
  async flipAndReveal(result: CardResult): Promise<void> {
    this.isFlipping = true;
    this.inputLocked = true;

    this.buildFrontFace(result);

    // Phase 1: scale X to 0 (card flips to edge)
    await this.animateScaleX(1, 0, FLIP_DURATION_MS / 2);

    // Swap faces
    this.backFace.visible = false;
    this.frontFace.visible = true;

    // Phase 2: scale X back to 1 (reveal)
    await this.animateScaleX(0, 1, FLIP_DURATION_MS / 2);

    this.isFlipping = false;
  }

  showResult(result: CardResult, bet: number): void {
    this.resultOverlay.removeChildren();
    this.resultOverlay.visible = true;

    // Full-screen semi-transparent overlay
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.overlay, 0.7);
    bg.drawRect(0, 0, this.stageW, this.stageH);
    bg.endFill();
    this.resultOverlay.addChild(bg);

    // Bottom sheet panel
    const panelH = 260;
    const panelY = this.stageH - panelH;
    const panel = new PIXI.Graphics();
    const panelColor = result.won ? COLORS.winBg : COLORS.loseBg;
    panel.beginFill(panelColor, 0.95);
    panel.drawRoundedRect(0, panelY, this.stageW, panelH, 24);
    panel.endFill();
    this.resultOverlay.addChild(panel);

    // Result title
    const title = new PIXI.Text(result.won ? 'NICE!' : 'BUSTED', {
      fontSize: 48,
      fontWeight: 'bold',
      fill: result.won ? COLORS.safeGreen : COLORS.bombRed,
      fontFamily: 'monospace',
    });
    title.anchor.set(0.5, 0);
    title.x = this.stageW / 2;
    title.y = panelY + 25;
    this.resultOverlay.addChild(title);

    // Payout text
    let payoutText: string;
    if (result.won) {
      const payout = Math.round(bet * result.payoutMult);
      payoutText = `+${payout} FUN`;
    } else {
      payoutText = `-${bet} FUN`;
    }
    const payoutLabel = new PIXI.Text(payoutText, {
      fontSize: 32,
      fontWeight: 'bold',
      fill: result.won ? COLORS.gold : COLORS.bombRed,
      fontFamily: 'monospace',
    });
    payoutLabel.anchor.set(0.5, 0);
    payoutLabel.x = this.stageW / 2;
    payoutLabel.y = panelY + 85;
    this.resultOverlay.addChild(payoutLabel);

    // Choice + card info
    const infoText = `You chose ${result.choice.toUpperCase()} — Card was ${result.card.isBomb ? 'BOMB 💣' : 'SAFE ✅'}`;
    const info = new PIXI.Text(infoText, {
      fontSize: 15,
      fill: COLORS.dimWhite,
      fontFamily: 'monospace',
      align: 'center',
    });
    info.anchor.set(0.5, 0);
    info.x = this.stageW / 2;
    info.y = panelY + 130;
    this.resultOverlay.addChild(info);

    // NEXT button
    const nextBtn = new PIXI.Container();
    const btnW = 200;
    const btnH = 52;
    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(COLORS.gold, 0.95);
    btnBg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 16);
    btnBg.endFill();
    nextBtn.addChild(btnBg);

    const btnText = new PIXI.Text('NEXT →', {
      fontSize: 22,
      fontWeight: 'bold',
      fill: 0x000000,
      fontFamily: 'monospace',
    });
    btnText.anchor.set(0.5);
    nextBtn.addChild(btnText);

    nextBtn.x = this.stageW / 2;
    nextBtn.y = panelY + 205;
    nextBtn.eventMode = 'static';
    nextBtn.cursor = 'pointer';

    let nextFired = false;
    nextBtn.on('pointertap', () => {
      if (!nextFired) {
        nextFired = true;
        this.onNext?.();
      }
    });
    this.resultOverlay.addChild(nextBtn);

    // Make overlay intercept all clicks
    bg.eventMode = 'static';
  }

  hideResult(): void {
    this.resultOverlay.visible = false;
    this.resultOverlay.removeChildren();
  }

  private buildFrontFace(result: CardResult): void {
    this.frontFace.removeChildren();

    const isBomb = result.card.isBomb;
    const bgColor = isBomb ? COLORS.cardFrontBomb : COLORS.cardFrontSafe;

    const bg = new PIXI.Graphics();
    bg.beginFill(bgColor);
    bg.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, CARD_RADIUS);
    bg.endFill();
    bg.lineStyle(3, isBomb ? COLORS.bombRed : COLORS.safeGreen);
    bg.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, CARD_RADIUS);
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
    icon.y = -CARD_H / 2 + 75;
    this.frontFace.addChild(icon);

    const safeLabel = new PIXI.Text('SAFE', {
      fontSize: 18,
      fontWeight: 'bold',
      fill: COLORS.safeGreen,
      fontFamily: 'monospace',
      letterSpacing: 4,
    });
    safeLabel.anchor.set(0.5);
    safeLabel.y = -CARD_H / 2 + 120;
    this.frontFace.addChild(safeLabel);

    const titleText = new PIXI.Text(safeCard.title, {
      fontSize: 22,
      fontWeight: 'bold',
      fill: COLORS.white,
      fontFamily: 'monospace',
      wordWrap: true,
      wordWrapWidth: CARD_W - 40,
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
      wordWrapWidth: CARD_W - 40,
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

  private animateScaleX(from: number, to: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        const elapsed = performance.now() - start;
        const t = Math.min(elapsed / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this.cardContainer.scale.x = from + (to - from) * eased;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          this.cardContainer.scale.x = to;
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }
}
