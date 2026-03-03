import * as PIXI from 'pixi.js';
import { Economy } from './core/Economy';
import { OutcomeController, type CardModel, type PlayerChoice, type CardResult } from './core/OutcomeController';
import { GameStateMachine } from './core/GameStateMachine';
import { CardRenderer } from './rendering/CardRenderer';
import { HUD } from './rendering/HUD';
import { displayMult } from './config/TierConfig';

// ─── DOM panel states ─────────────────────────────────────────────────────────
type BottomPanel = 'none' | 'choice' | 'result';

export class Game {
  private app: PIXI.Application;
  private economy: Economy;
  private outcome: OutcomeController;
  private sm: GameStateMachine;
  private cardRenderer: CardRenderer;
  private hud: HUD;

  private currentCard: CardModel | null = null;
  private seed: number;

  // Input lock: true while flip animation is in progress or result is being shown
  private inputLocked = false;

  // ─── DOM refs ───────────────────────────────────────────────────────────────
  private readonly choiceButtonsEl: HTMLElement;
  private readonly resultPanelEl: HTMLElement;
  private readonly btnWatch: HTMLButtonElement;
  private readonly btnSkip: HTMLButtonElement;
  private readonly btnNext: HTMLButtonElement;
  private readonly resultTitleEl: HTMLElement;
  private readonly resultPayoutEl: HTMLElement;
  private readonly resultInfoEl: HTMLElement;

  // Stage dimensions (card-host size)
  private readonly stageW: number;
  private readonly stageH: number;

  constructor(cardHost: HTMLElement) {
    this.seed = Date.now();

    // Read card-host dimensions (guaranteed non-zero by main.ts)
    this.stageW = cardHost.clientWidth;
    this.stageH = cardHost.clientHeight;

    // ── Pixi app fills card-host ────────────────────────────────────────────
    this.app = new PIXI.Application({
      width: this.stageW,
      height: this.stageH,
      backgroundColor: 0x0a0a0f,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    cardHost.appendChild(this.app.view as HTMLCanvasElement);

    // ── Core systems ────────────────────────────────────────────────────────
    this.economy = new Economy();
    this.outcome = new OutcomeController(this.seed);
    this.sm = new GameStateMachine();

    // ── Card renderer (Pixi only — no buttons/result in canvas) ────────────
    this.cardRenderer = new CardRenderer(this.stageW, this.stageH);
    this.app.stage.addChild(this.cardRenderer.container);

    // ── DOM HUD ─────────────────────────────────────────────────────────────
    this.hud = new HUD(this.economy);

    // ── Grab DOM refs ───────────────────────────────────────────────────────
    this.choiceButtonsEl = document.getElementById('choice-buttons')!;
    this.resultPanelEl   = document.getElementById('result-panel')!;
    this.btnWatch        = document.getElementById('btn-watch') as HTMLButtonElement;
    this.btnSkip         = document.getElementById('btn-skip') as HTMLButtonElement;
    this.btnNext         = document.getElementById('btn-next') as HTMLButtonElement;
    this.resultTitleEl   = document.getElementById('result-title')!;
    this.resultPayoutEl  = document.getElementById('result-payout')!;
    this.resultInfoEl    = document.getElementById('result-info')!;

    // ── Wire DOM buttons ────────────────────────────────────────────────────
    this.btnWatch.addEventListener('click', () => this.handleChoice('watch'));
    this.btnSkip.addEventListener('click',  () => this.handleChoice('skip'));
    this.btnNext.addEventListener('click',  () => this.handleNext());

    // ── Initial panel state ─────────────────────────────────────────────────
    this.setPanel('none');

    this.showIntro();
  }

  // ─── Panel management ────────────────────────────────────────────────────────

  private setPanel(which: BottomPanel): void {
    // Choice buttons
    this.choiceButtonsEl.classList.toggle('hidden', which !== 'choice');
    this.btnWatch.disabled = false;
    this.btnSkip.disabled  = false;

    // Result panel
    this.resultPanelEl.classList.toggle('hidden', which !== 'result');
    this.resultPanelEl.classList.toggle('visible', which === 'result');

    // Bet button: allow cycling only before a card starts
    this.hud.setInteractive(which === 'none');
  }

  private disableChoiceButtons(): void {
    this.btnWatch.disabled = true;
    this.btnSkip.disabled  = true;
  }

  // ─── Result panel ────────────────────────────────────────────────────────────

  private showResultPanel(result: CardResult, bet: number): void {
    this.resultPanelEl.className = result.won ? 'visible win' : 'visible lose';

    this.resultTitleEl.textContent = result.won ? 'NICE!' : 'BUSTED';

    if (result.won) {
      // Gross payout uses full-precision multiplier; display rounds to 2dp.
      const grossPayout = Math.round(bet * result.payoutMult);
      this.resultPayoutEl.textContent =
        `+${grossPayout} FUN \u00D7 x${displayMult(result.payoutMult)}`;
    } else {
      this.resultPayoutEl.textContent = `-${bet} FUN`;
    }

    // Info line: tells the player exactly why they won/lost so the multiplier
    // displayed always matches the one shown on the card back for that choice.
    const cardType  = result.card.isBomb ? 'BOMB \u{1F4A3}' : 'SAFE \u2705';
    const choiceStr = result.choice === 'watch' ? '\u{1F441} WATCH' : '\u{1F6AB} SKIP';
    const multStr   = result.won
      ? ` (x${displayMult(result.payoutMult)})`
      : '';
    this.resultInfoEl.textContent =
      `${choiceStr}${multStr} \u2014 ${cardType}`;

    // Swap: hide choice buttons, show result
    this.choiceButtonsEl.classList.add('hidden');
    this.resultPanelEl.classList.remove('hidden');
  }

  // ─── Game flow ───────────────────────────────────────────────────────────────

  private showIntro(): void {
    this.sm.transition('intro');
    this.setPanel('none');

    const introContainer = new PIXI.Container();

    const title = new PIXI.Text('SWIPE HELL', {
      fontSize: 42,
      fontWeight: 'bold',
      fill: 0xffd700,
      fontFamily: 'monospace',
    });
    title.anchor.set(0.5);
    title.x = this.stageW / 2;
    title.y = this.stageH / 2 - 100;
    introContainer.addChild(title);

    const subtitle = new PIXI.Text('Watch or Skip. Trust your gut.', {
      fontSize: 18,
      fill: 0xaaaacc,
      fontFamily: 'monospace',
    });
    subtitle.anchor.set(0.5);
    subtitle.x = this.stageW / 2;
    subtitle.y = this.stageH / 2 - 50;
    introContainer.addChild(subtitle);

    const playBtn = new PIXI.Container();
    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(0xffd700, 0.95);
    btnBg.drawRoundedRect(-100, -28, 200, 56, 16);
    btnBg.endFill();
    playBtn.addChild(btnBg);

    const btnText = new PIXI.Text('PLAY', {
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0x000000,
      fontFamily: 'monospace',
    });
    btnText.anchor.set(0.5);
    playBtn.addChild(btnText);

    playBtn.x = this.stageW / 2;
    playBtn.y = this.stageH / 2 + 30;
    playBtn.eventMode = 'static';
    playBtn.cursor = 'pointer';

    let started = false;
    playBtn.on('pointertap', () => {
      if (started) return;
      started = true;
      this.app.stage.removeChild(introContainer);
      introContainer.destroy({ children: true });
      this.startNextCard();
    });

    introContainer.addChild(playBtn);
    this.app.stage.addChild(introContainer);
  }

  private startNextCard(): void {
    if (!this.economy.canStartRound()) {
      this.showGameOver();
      return;
    }

    this.inputLocked = false;
    this.economy.startRound();
    this.sm.transition('running');

    this.currentCard = this.outcome.nextCard();
    this.cardRenderer.showCardBack(this.currentCard);

    // Show choice buttons (enabled), hide result
    this.setPanel('choice');
  }

  private handleChoice(choice: PlayerChoice): void {
    if (this.inputLocked || this.cardRenderer.flipping) return;
    if (!this.sm.is('running') || !this.currentCard) return;

    this.inputLocked = true;
    this.disableChoiceButtons();
    this.onPlayerChoice(choice);
  }

  private async onPlayerChoice(choice: PlayerChoice): Promise<void> {
    this.sm.transition('revealing');

    const result = this.outcome.resolve(this.currentCard!, choice);

    // ── DEV-only assertion: payoutMult must exactly match the multiplier
    // that was stored on the card for this choice, so the card back and
    // the result popup can never disagree.
    if (import.meta.env.DEV && result.won) {
      const expected = choice === 'watch'
        ? result.card.watchMult
        : result.card.skipMult;
      const EPSILON = 1e-9;
      if (Math.abs(result.payoutMult - expected) > EPSILON) {
        console.error(
          '[DEV] Multiplier mismatch detected!',
          { choice, payoutMult: result.payoutMult, expected, tierId: result.card.tier.id },
        );
      }
    }

    await this.cardRenderer.flipAndReveal(result);

    if (result.won) {
      this.economy.resolveWin(result.payoutMult);
    } else {
      this.economy.resolveLose();
    }

    this.sm.transition('result');
    this.showResultPanel(result, this.economy.bet);
    // Bet selector becomes available during result (for choosing next round's bet)
    this.hud.setInteractive(true);
  }

  private handleNext(): void {
    if (!this.sm.is('result')) return;
    this.startNextCard();
  }

  private showGameOver(): void {
    this.sm.transition('gameover');
    this.setPanel('none');

    const goContainer = new PIXI.Container();

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.88);
    bg.drawRect(0, 0, this.stageW, this.stageH);
    bg.endFill();
    bg.eventMode = 'static';
    goContainer.addChild(bg);

    const title = new PIXI.Text('GAME OVER', {
      fontSize: 42,
      fontWeight: 'bold',
      fill: 0xff3355,
      fontFamily: 'monospace',
    });
    title.anchor.set(0.5);
    title.x = this.stageW / 2;
    title.y = this.stageH / 2 - 80;
    goContainer.addChild(title);

    const cardsPlayed = new PIXI.Text(`Cards played: ${this.outcome.getCardIndex()}`, {
      fontSize: 18,
      fill: 0xaaaacc,
      fontFamily: 'monospace',
    });
    cardsPlayed.anchor.set(0.5);
    cardsPlayed.x = this.stageW / 2;
    cardsPlayed.y = this.stageH / 2 - 25;
    goContainer.addChild(cardsPlayed);

    const restartBtn = new PIXI.Container();
    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(0xffd700, 0.95);
    btnBg.drawRoundedRect(-100, -28, 200, 56, 16);
    btnBg.endFill();
    restartBtn.addChild(btnBg);

    const btnText = new PIXI.Text('RESTART', {
      fontSize: 22,
      fontWeight: 'bold',
      fill: 0x000000,
      fontFamily: 'monospace',
    });
    btnText.anchor.set(0.5);
    restartBtn.addChild(btnText);

    restartBtn.x = this.stageW / 2;
    restartBtn.y = this.stageH / 2 + 40;
    restartBtn.eventMode = 'static';
    restartBtn.cursor = 'pointer';

    let restarted = false;
    restartBtn.on('pointertap', () => {
      if (restarted) return;
      restarted = true;
      this.app.stage.removeChild(goContainer);
      goContainer.destroy({ children: true });
      this.restart();
    });

    goContainer.addChild(restartBtn);
    this.app.stage.addChild(goContainer);
  }

  private restart(): void {
    this.seed = Date.now();
    this.economy.reset();
    this.outcome = new OutcomeController(this.seed);
    this.startNextCard();
  }
}
