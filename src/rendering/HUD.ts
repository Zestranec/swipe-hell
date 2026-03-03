import * as PIXI from 'pixi.js';
import type { Economy } from '../core/Economy';

const HUD_HEIGHT = 60;

export class HUD {
  readonly container: PIXI.Container;
  private balanceText: PIXI.Text;
  private betText: PIXI.Text;
  private betButton: PIXI.Container;
  private economy: Economy;
  private stageW: number;

  constructor(economy: Economy, stageW: number) {
    this.economy = economy;
    this.stageW = stageW;
    this.container = new PIXI.Container();

    // Background bar
    const bg = new PIXI.Graphics();
    bg.beginFill(0x111122, 0.9);
    bg.drawRect(0, 0, stageW, HUD_HEIGHT);
    bg.endFill();
    this.container.addChild(bg);

    // Balance
    this.balanceText = new PIXI.Text('', {
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xffd700,
      fontFamily: 'monospace',
    });
    this.balanceText.x = 16;
    this.balanceText.y = 18;
    this.container.addChild(this.balanceText);

    // Bet display + tap to cycle
    this.betButton = new PIXI.Container();
    this.betButton.eventMode = 'static';
    this.betButton.cursor = 'pointer';
    this.betButton.on('pointertap', () => {
      this.economy.cycleBet();
    });

    const betBg = new PIXI.Graphics();
    betBg.beginFill(0x2a2a4e, 0.9);
    betBg.drawRoundedRect(0, 0, 140, 36, 10);
    betBg.endFill();
    this.betButton.addChild(betBg);

    this.betText = new PIXI.Text('', {
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0xffffff,
      fontFamily: 'monospace',
    });
    this.betText.x = 12;
    this.betText.y = 8;
    this.betButton.addChild(this.betText);

    this.betButton.x = stageW - 156;
    this.betButton.y = 12;
    this.container.addChild(this.betButton);

    this.update();
    economy.onChange(() => this.update());
  }

  update(): void {
    this.balanceText.text = `💰 ${this.economy.balance} FUN`;
    this.betText.text = `BET: ${this.economy.bet} ▼`;
  }
}
