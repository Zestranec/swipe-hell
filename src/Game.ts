import * as PIXI from 'pixi.js';
import { Economy } from './core/Economy';
import { OutcomeController, type CardModel, type PlayerChoice } from './core/OutcomeController';
import { GameStateMachine } from './core/GameStateMachine';
import { CardRenderer } from './rendering/CardRenderer';
import { HUD } from './rendering/HUD';

const GAME_W = 390;
const GAME_H = 760;

export class Game {
  private app: PIXI.Application;
  private economy: Economy;
  private outcome: OutcomeController;
  private sm: GameStateMachine;
  private cardRenderer: CardRenderer;
  private hud: HUD;

  private currentCard: CardModel | null = null;
  private seed: number;

  constructor(container: HTMLElement) {
    this.seed = Date.now();

    this.app = new PIXI.Application({
      width: GAME_W,
      height: GAME_H,
      backgroundColor: 0x0a0a0f,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    container.appendChild(this.app.view as HTMLCanvasElement);

    this.economy = new Economy();
    this.outcome = new OutcomeController(this.seed);
    this.sm = new GameStateMachine();

    this.cardRenderer = new CardRenderer(GAME_W, GAME_H);
    this.hud = new HUD(this.economy, GAME_W);

    this.app.stage.addChild(this.cardRenderer.container);
    this.app.stage.addChild(this.hud.container);

    this.cardRenderer.setCallbacks(
      () => this.onPlayerChoice('watch'),
      () => this.onPlayerChoice('skip'),
      () => this.onNextCard(),
    );

    this.showIntro();
  }

  private showIntro(): void {
    this.sm.transition('intro');

    const introContainer = new PIXI.Container();

    const title = new PIXI.Text('SWIPE HELL', {
      fontSize: 42,
      fontWeight: 'bold',
      fill: 0xffd700,
      fontFamily: 'monospace',
    });
    title.anchor.set(0.5);
    title.x = GAME_W / 2;
    title.y = GAME_H / 2 - 100;
    introContainer.addChild(title);

    const subtitle = new PIXI.Text('Watch or Skip. Trust your gut.', {
      fontSize: 18,
      fill: 0xaaaacc,
      fontFamily: 'monospace',
    });
    subtitle.anchor.set(0.5);
    subtitle.x = GAME_W / 2;
    subtitle.y = GAME_H / 2 - 45;
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

    playBtn.x = GAME_W / 2;
    playBtn.y = GAME_H / 2 + 30;
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

    this.economy.startRound();
    this.sm.transition('running');

    this.currentCard = this.outcome.nextCard();
    this.cardRenderer.showCardBack(this.currentCard);
  }

  private async onPlayerChoice(choice: PlayerChoice): Promise<void> {
    if (!this.sm.is('running') || !this.currentCard) return;

    this.sm.transition('revealing');

    const result = this.outcome.resolve(this.currentCard, choice);

    await this.cardRenderer.flipAndReveal(result);

    if (result.won) {
      this.economy.resolveWin(result.payoutMult);
    } else {
      this.economy.resolveLose();
    }

    this.sm.transition('result');
    this.cardRenderer.showResult(result, this.economy.bet);
  }

  private onNextCard(): void {
    if (!this.sm.is('result')) return;
    this.cardRenderer.hideResult();
    this.startNextCard();
  }

  private showGameOver(): void {
    this.sm.transition('gameover');

    const goContainer = new PIXI.Container();

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.85);
    bg.drawRect(0, 0, GAME_W, GAME_H);
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
    title.x = GAME_W / 2;
    title.y = GAME_H / 2 - 80;
    goContainer.addChild(title);

    const cardsPlayed = new PIXI.Text(`Cards played: ${this.outcome.getCardIndex()}`, {
      fontSize: 18,
      fill: 0xaaaacc,
      fontFamily: 'monospace',
    });
    cardsPlayed.anchor.set(0.5);
    cardsPlayed.x = GAME_W / 2;
    cardsPlayed.y = GAME_H / 2 - 25;
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

    restartBtn.x = GAME_W / 2;
    restartBtn.y = GAME_H / 2 + 40;
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
    this.economy = new Economy();
    this.outcome = new OutcomeController(this.seed);

    this.app.stage.removeChild(this.hud.container);
    this.hud = new HUD(this.economy, GAME_W);
    this.app.stage.addChild(this.hud.container);

    this.startNextCard();
  }
}
