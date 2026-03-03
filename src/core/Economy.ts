export const BET_OPTIONS = [10, 25, 50, 100, 250, 500];
export const DEFAULT_BALANCE = 10000;

export class Economy {
  private _balance: number;
  private _bet: number;
  private _onChange: (() => void) | null = null;

  constructor(initialBalance = DEFAULT_BALANCE) {
    this._balance = initialBalance;
    this._bet = BET_OPTIONS[0];
  }

  get balance(): number {
    return this._balance;
  }

  get bet(): number {
    return this._bet;
  }

  setBet(amount: number): void {
    if (BET_OPTIONS.includes(amount)) {
      this._bet = amount;
      this._onChange?.();
    }
  }

  cycleBet(): void {
    const idx = BET_OPTIONS.indexOf(this._bet);
    const next = BET_OPTIONS[(idx + 1) % BET_OPTIONS.length];
    if (next <= this._balance) {
      this._bet = next;
    } else {
      this._bet = BET_OPTIONS[0];
    }
    this._onChange?.();
  }

  canStartRound(): boolean {
    return this._balance >= this._bet;
  }

  /** Deduct bet at round start. Returns false if insufficient funds. */
  startRound(): boolean {
    if (!this.canStartRound()) return false;
    this._balance -= this._bet;
    this._onChange?.();
    return true;
  }

  /** Add gross payout on win (bet * multiplier). */
  resolveWin(multiplier: number): number {
    const payout = Math.round(this._bet * multiplier);
    this._balance += payout;
    this._onChange?.();
    return payout;
  }

  /** On lose: payout is 0. Bet was already deducted. */
  resolveLose(): void {
    this._onChange?.();
  }

  onChange(cb: () => void): void {
    this._onChange = cb;
  }

  /** Reset to starting state (used on game restart). */
  reset(): void {
    this._balance = DEFAULT_BALANCE;
    this._bet = BET_OPTIONS[0];
    this._onChange?.();
  }
}
