import type { Economy } from '../core/Economy';

/**
 * DOM-based HUD. Updates #hud-balance and #hud-bet elements.
 * No Pixi dependency — the top bar is a plain HTML row.
 */
export class HUD {
  private economy: Economy;
  private balanceEl: HTMLElement;
  private betEl: HTMLButtonElement;

  constructor(economy: Economy) {
    this.economy = economy;

    this.balanceEl = document.getElementById('hud-balance') as HTMLElement;
    this.betEl = document.getElementById('hud-bet') as HTMLButtonElement;

    this.betEl.addEventListener('click', () => {
      if (!this.betEl.disabled) {
        this.economy.cycleBet();
      }
    });

    this.update();
    economy.onChange(() => this.update());
  }

  setInteractive(enabled: boolean): void {
    this.betEl.disabled = !enabled;
  }

  update(): void {
    this.balanceEl.textContent = `\u{1F4B0} ${this.economy.balance} FUN`;
    this.betEl.textContent = `BET: ${this.economy.bet} \u25BC`;
  }
}
